import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getSetting, setSetting } from './db/settings';

const SITE_PASSWORD_SALT = 'drink-hub-site-password';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type SessionScope = 'site' | 'gooby';

export function hashSitePassword(password: string): string {
  return scryptSync(password, SITE_PASSWORD_SALT, 32).toString('hex');
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
