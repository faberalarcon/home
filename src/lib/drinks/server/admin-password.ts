import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getSetting, setSetting } from './db/settings';

const SCRYPT_KEY_LEN = 32;

export interface BootstrapResult {
  generatedPassword: string | null;
  source: 'existing' | 'env' | 'generated';
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function randomPassword(): string {
  // 16 url-safe chars (~96 bits of entropy). Avoid ambiguous 0/O/1/l.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const buf = randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function scryptHash(password: string, saltHex: string): string {
  return scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEY_LEN).toString('hex');
}

/**
 * Ensure an admin password exists in the settings table. Called once at boot.
 *
 * Precedence:
 *   1. Existing settings row — leave as is.
 *   2. `ADMIN_PASSWORD` env var — seed the row with it, clear must_reset.
 *   3. Generate a random 16-char password, log it to stdout, set must_reset.
 *
 * Returns the generated/env password (caller decides whether to print).
 */
export function bootstrapAdminPassword(): BootstrapResult {
  const existingHash = getSetting('admin_password_hash');
  const existingSalt = getSetting('admin_password_salt');
  if (existingHash && existingSalt) {
    return { generatedPassword: null, source: 'existing' };
  }

  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  if (envPassword) {
    const salt = randomToken(16);
    setSetting('admin_password_salt', salt);
    setSetting('admin_password_hash', scryptHash(envPassword, salt));
    setSetting('admin_password_must_reset', '0');
    bumpAdminSessionEpoch();
    return { generatedPassword: null, source: 'env' };
  }

  const generated = randomPassword();
  const salt = randomToken(16);
  setSetting('admin_password_salt', salt);
  setSetting('admin_password_hash', scryptHash(generated, salt));
  setSetting('admin_password_must_reset', '1');
  bumpAdminSessionEpoch();
  return { generatedPassword: generated, source: 'generated' };
}

export function isAdminPasswordConfigured(): boolean {
  return !!(getSetting('admin_password_hash') && getSetting('admin_password_salt'));
}

export function isAdminPasswordMustReset(): boolean {
  return getSetting('admin_password_must_reset') === '1';
}

export function verifyAdminPassword(password: string): boolean {
  const storedHash = getSetting('admin_password_hash');
  const storedSalt = getSetting('admin_password_salt');
  if (!storedHash || !storedSalt || !password) return false;
  const candidate = Buffer.from(scryptHash(password, storedSalt), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export function setAdminPassword(newPassword: string): void {
  const salt = randomToken(16);
  setSetting('admin_password_salt', salt);
  setSetting('admin_password_hash', scryptHash(newPassword, salt));
  setSetting('admin_password_must_reset', '0');
  bumpAdminSessionEpoch();
}

/** Generate a new random temporary password, mark must_reset, and return it. */
export function resetAdminPassword(): string {
  const generated = randomPassword();
  const salt = randomToken(16);
  setSetting('admin_password_salt', salt);
  setSetting('admin_password_hash', scryptHash(generated, salt));
  setSetting('admin_password_must_reset', '1');
  bumpAdminSessionEpoch();
  return generated;
}

export function getAdminSessionEpoch(): number {
  return Number(getSetting('admin_session_epoch') ?? '0') || 0;
}

function bumpAdminSessionEpoch(): void {
  setSetting('admin_session_epoch', String(getAdminSessionEpoch() + 1));
}

export function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) return envSecret;
  let stored = getSetting('session_secret');
  if (!stored || stored.length < 32) {
    stored = randomToken(32);
    setSetting('session_secret', stored);
  }
  return stored;
}
