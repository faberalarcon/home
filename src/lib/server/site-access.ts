import { getSetting } from '$lib/server/db/settings';
import { hashSitePassword } from '$lib/server/auth';

export function getConfiguredSitePasswordHash(): string {
  const envHash = process.env.SITE_PASSWORD_HASH?.trim();
  if (envHash) return envHash;

  const envPassword = process.env.SITE_PASSWORD?.trim();
  if (envPassword) return hashSitePassword(envPassword);

  return getSetting('site_password_hash') ?? '';
}

export function normalizeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) return '/';
  if (next.startsWith('//')) return '/';
  return next;
}

export function isSecureRequest(url: URL, forwardedProto: string | null): boolean {
  return url.protocol === 'https:' || forwardedProto === 'https';
}
