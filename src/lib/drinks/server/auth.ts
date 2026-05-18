import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getSetting, setSetting } from './db/settings';

// Legacy static salt — retained ONLY to verify pre-existing SITE_PASSWORD_HASH
// values that were derived with this constant. New hashes use a per-deploy
// random salt persisted in the settings table.
const LEGACY_SITE_PASSWORD_SALT = 'drink-hub-site-password';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type SessionScope = 'site' | 'gooby';

let legacySaltWarned = false;
function warnLegacySaltOnce(): void {
  if (legacySaltWarned) return;
  legacySaltWarned = true;
  console.warn(
    '[auth] site password verified using legacy static salt — regenerate SITE_PASSWORD_HASH (or switch to SITE_PASSWORD) to migrate off the deprecated salt.'
  );
}

function getOrCreateSitePasswordSalt(): string {
  let stored = getSetting('site_password_salt');
  if (!stored || stored.length < 32) {
    stored = randomBytes(16).toString('hex');
    setSetting('site_password_salt', stored);
  }
  return stored;
}

export function hashSitePassword(password: string): string {
  return scryptSync(password, getOrCreateSitePasswordSalt(), 32).toString('hex');
}

function constantTimeHexEqual(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifySitePasswordHash(password: string, storedHex: string): boolean {
  if (!password || !storedHex) return false;
  const candidate = hashSitePassword(password);
  if (constantTimeHexEqual(candidate, storedHex)) return true;
  // Fallback: SITE_PASSWORD_HASH env values predating the per-deploy salt were
  // generated against LEGACY_SITE_PASSWORD_SALT. Verify against it so existing
  // deployments don't break — but warn so operators regenerate.
  const legacyCandidate = scryptSync(password, LEGACY_SITE_PASSWORD_SALT, 32).toString('hex');
  if (constantTimeHexEqual(legacyCandidate, storedHex)) {
    warnLegacySaltOnce();
    return true;
  }
  return false;
}

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) return envSecret;
  let stored = getSetting('session_secret');
  if (!stored || stored.length < 32) {
    stored = randomBytes(32).toString('hex');
    setSetting('session_secret', stored);
  }
  return stored;
}

/**
 * Session token format: `<scope>.<ts>.<hmac>`
 * HMAC key is a server-side session secret so leaking a credential hash
 * does not yield token forgery.
 */
export function makeSessionToken(scope: SessionScope): string {
  const ts = String(Date.now());
  const secret = getSessionSecret();
  const hmac = createHmac('sha256', secret).update(`${scope}.${ts}`).digest('hex');
  return `${scope}.${ts}.${hmac}`;
}

export function verifySessionToken(token: string | undefined, scope: SessionScope): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [scopeStr, tsStr, hmac] = parts;
  if (scopeStr !== scope) return false;

  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > SESSION_TTL_MS) return false;

  const secret = getSessionSecret();
  const expected = createHmac('sha256', secret).update(`${scope}.${tsStr}`).digest('hex');
  const actualBuf = Buffer.from(hmac, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}
