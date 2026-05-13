import { scryptSync, timingSafeEqual } from 'node:crypto';

const GOOBY_PASSWORD_SALT = 'gooby-gpt-password';

export function hashGoobyPassword(password: string): string {
  return scryptSync(password, GOOBY_PASSWORD_SALT, 32).toString('hex');
}

export function getConfiguredGoobyPasswordHash(): string {
  const envHash = process.env.GOOBY_PASSWORD_HASH?.trim();
  if (envHash) return envHash;

  const envPassword = process.env.GOOBY_PASSWORD?.trim();
  if (envPassword) return hashGoobyPassword(envPassword);
  return '';
}

export function verifyGoobyPassword(password: string): boolean {
  const stored = getConfiguredGoobyPasswordHash();
  if (!stored || !password) return false;

  const candidate = Buffer.from(hashGoobyPassword(password), 'hex');
  const expected = Buffer.from(stored, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function normalizeGoobyNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/gooby')) return '/gooby/';
  if (next.startsWith('//')) return '/gooby/';
  return next;
}
