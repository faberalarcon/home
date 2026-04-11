import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '$lib/server/db';
import { bootstrapSettings } from '$lib/server/db/settings';
import { verifySessionToken } from '$lib/server/auth';
import { getConfiguredAdminPinHash, getConfiguredSitePasswordHash } from '$lib/server/site-access';
import { json, redirect, type Handle } from '@sveltejs/kit';

let migrated = false;
if (!migrated) {
  try {
    migrate(db, { migrationsFolder: './drizzle' });
    migrated = true;
    console.log('[drink-hub] migrations applied');
  } catch (err) {
    console.error('[drink-hub] migration failed:', err);
  }
}

bootstrapSettings({
  ha_base_url: 'http://ai.local:8123',
  ha_token: '',
  site_name: 'drink-hub'
});

function isPublicPath(path: string): boolean {
  return (
    path === '/login' ||
    path === '/api/health' ||
    path.startsWith('/admin') ||
    path.startsWith('/_app/') ||
    path.startsWith('/icons/') ||
    path === '/favicon.png' ||
    path === '/manifest.webmanifest' ||
    path === '/service-worker.js'
  );
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  // strict-origin-when-cross-origin preserves the Referer header for same-origin
  // requests, which is required for SvelteKit's CSRF check. Using no-referrer
  // causes browsers to send Origin: null on form POSTs, which breaks CSRF validation.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // unsafe-inline is required for SvelteKit's hydration scripts and Tailwind styles.
  // frame-ancestors 'none' duplicates X-Frame-Options for CSP-aware browsers.
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
};

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  const sitePasswordHash = getConfiguredSitePasswordHash();
  const adminPinHash = getConfiguredAdminPinHash();
  const siteToken = event.cookies.get('site_session');
  const adminToken = event.cookies.get('admin_session');

  event.locals.sitePasswordEnabled = !!sitePasswordHash;
  event.locals.siteAuthenticated = verifySessionToken(siteToken, sitePasswordHash);
  event.locals.adminAuthenticated = verifySessionToken(adminToken, adminPinHash);

  if (event.locals.sitePasswordEnabled && !event.locals.siteAuthenticated && !isPublicPath(path)) {
    if (path.startsWith('/api/')) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const next = `${path}${event.url.search}`;
    throw redirect(303, `/login?next=${encodeURIComponent(next)}`);
  }

  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    if (!event.locals.adminAuthenticated) {
      throw redirect(303, '/admin/login');
    }
  }

  const response = await resolve(event);

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
};
