import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getSetting, setSetting } from '$lib/drinks/server/db/settings';

// Legacy static salt — kept ONLY for backward-compat verification of any
// GOOBY_PASSWORD_HASH that was generated before per-deploy salts were added.
const LEGACY_GOOBY_PASSWORD_SALT = 'gooby-gpt-password';

let legacySaltWarned = false;
function warnLegacySaltOnce(): void {
  if (legacySaltWarned) return;
  legacySaltWarned = true;
  console.warn(
    '[auth] gooby password verified using legacy static salt — regenerate GOOBY_PASSWORD_HASH (or switch to GOOBY_PASSWORD) to migrate off the deprecated salt.'
  );
}

function getOrCreateGoobyPasswordSalt(): string {
  let stored = getSetting('gooby_password_salt');
  if (!stored || stored.length < 32) {
    stored = randomBytes(16).toString('hex');
    setSetting('gooby_password_salt', stored);
  }
  return stored;
}

export function hashGoobyPassword(password: string): string {
  return scryptSync(password, getOrCreateGoobyPasswordSalt(), 32).toString('hex');
}

export function getConfiguredGoobyPasswordHash(): string {
  const envHash = process.env.GOOBY_PASSWORD_HASH?.trim();
  if (envHash) return envHash;

  const envPassword = process.env.GOOBY_PASSWORD?.trim();
  if (envPassword) return hashGoobyPassword(envPassword);
  return '';
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

export function verifyGoobyPassword(password: string): boolean {
  const stored = getConfiguredGoobyPasswordHash();
  if (!stored || !password) return false;

  if (constantTimeHexEqual(hashGoobyPassword(password), stored)) return true;
  const legacyCandidate = scryptSync(password, LEGACY_GOOBY_PASSWORD_SALT, 32).toString('hex');
  if (constantTimeHexEqual(legacyCandidate, stored)) {
    warnLegacySaltOnce();
    return true;
  }
  return false;
}

export function normalizeGoobyNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/gooby')) return '/gooby/';
  if (next.startsWith('//')) return '/gooby/';
  return next;
}
