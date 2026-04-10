import { createHash, createHmac } from 'node:crypto';

const PIN_SALT = 'drink-hub-pin';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function hashPin(pin: string): string {
  return createHash('sha256').update(`${PIN_SALT}:${pin}`).digest('hex');
}

export function makeSessionToken(pinHash: string): string {
  const ts = String(Date.now());
  const hmac = createHmac('sha256', pinHash).update(ts).digest('hex');
  return `${ts}.${hmac}`;
}

export function verifySessionToken(token: string | undefined, pinHash: string): boolean {
  if (!token || !pinHash) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const tsStr = token.slice(0, dot);
  const hmac = token.slice(dot + 1);
  const ts = Number(tsStr);
  if (isNaN(ts) || Date.now() - ts > SESSION_TTL_MS) return false;
  const expected = createHmac('sha256', pinHash).update(tsStr).digest('hex');
  return hmac === expected;
}
