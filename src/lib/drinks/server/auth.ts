import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { getAdminSessionEpoch, getSessionSecret } from './admin-password';

const SITE_PASSWORD_SALT = 'drink-hub-site-password';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type SessionScope = 'admin' | 'site' | 'gooby';

export function hashSitePassword(password: string): string {
  return scryptSync(password, SITE_PASSWORD_SALT, 32).toString('hex');
}

function sessionEpochFor(scope: SessionScope): number {
  return scope === 'admin' ? getAdminSessionEpoch() : 0;
}

/**
 * Session token format: `<scope>.<epoch>.<ts>.<hmac>`
 * HMAC key is a server-side session secret (not the credential hash), so
 * recovering the credential hash does not yield token forgery.
 * The epoch is bumped on admin password change to invalidate prior sessions.
 */
export function makeSessionToken(scope: SessionScope): string {
  const ts = String(Date.now());
  const epoch = String(sessionEpochFor(scope));
  const secret = getSessionSecret();
  const hmac = createHmac('sha256', secret).update(`${scope}.${epoch}.${ts}`).digest('hex');
  return `${scope}.${epoch}.${ts}.${hmac}`;
}

export function verifySessionToken(token: string | undefined, scope: SessionScope): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [scopeStr, epochStr, tsStr, hmac] = parts;
  if (scopeStr !== scope) return false;

  const epoch = Number(epochStr);
  const ts = Number(tsStr);
  if (!Number.isFinite(epoch) || !Number.isFinite(ts)) return false;
  if (epoch !== sessionEpochFor(scope)) return false;
  if (Date.now() - ts > SESSION_TTL_MS) return false;

  const secret = getSessionSecret();
  const expected = createHmac('sha256', secret).update(`${scope}.${epochStr}.${tsStr}`).digest('hex');
  const actualBuf = Buffer.from(hmac, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}
