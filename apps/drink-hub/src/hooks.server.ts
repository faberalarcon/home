import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '$lib/server/db';
import { bootstrapSettings } from '$lib/server/db/settings';
import { verifySessionToken } from '$lib/server/auth';
import { bootstrapAdminPassword, isAdminPasswordConfigured } from '$lib/server/admin-password';
import { getConfiguredSitePasswordHash } from '$lib/server/site-access';
import { base } from '$app/paths';
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

// Admin password bootstrap — runs once per process. If a temp password was
// generated, print it prominently so the operator can log in and change it.
const adminBootstrap = bootstrapAdminPassword();
if (adminBootstrap.generatedPassword) {
  console.log('');
  console.log('==============================================================');
  console.log('[drink-hub] INITIAL ADMIN PASSWORD: ' + adminBootstrap.generatedPassword);
  console.log(`[drink-hub] Log in at ${withBase('/admin/login')} and change it immediately.`);
  console.log('==============================================================');
  console.log('');
} else if (adminBootstrap.source === 'env') {
  console.log('[drink-hub] admin password seeded from ADMIN_PASSWORD env var');
}

if (process.env.ADMIN_PIN || process.env.ADMIN_PIN_HASH) {
  console.warn(
    '[drink-hub] ADMIN_PIN / ADMIN_PIN_HASH are deprecated and ignored. ' +
    'Use ADMIN_PASSWORD (or let the server generate a temp password) and ' +
    `manage the credential from ${withBase('/admin/settings')}.`
  );
}

function isPublicPath(path: string): boolean {
  return (
    path === '/login' ||
    path === '/api/health' ||
    path === '/api/stats' ||
    path === '/admin/login' ||
    path.startsWith('/_app/') ||
    path.startsWith('/icons/') ||
    path === '/favicon.png' ||
    path === '/manifest.webmanifest' ||
    path === '/service-worker.js'
  );
}

function routePath(pathname: string): string {
  if (!base) return pathname;
  if (pathname === base) return '/';
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  return pathname;
}

function withBase(path: string): string {
  if (!base) return path;
  if (path === '/') return base;
  return `${base}${path}`;
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
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

export const handle: Handle = async ({ event, resolve }) => {
  const path = routePath(event.url.pathname);
  const sitePasswordHash = getConfiguredSitePasswordHash();
  const siteToken = event.cookies.get('site_session');
  const adminToken = event.cookies.get('admin_session');

  event.locals.sitePasswordEnabled = !!sitePasswordHash;
  event.locals.siteAuthenticated = event.locals.sitePasswordEnabled
    ? verifySessionToken(siteToken, 'site')
    : true;
  event.locals.adminAuthenticated = isAdminPasswordConfigured()
    ? verifySessionToken(adminToken, 'admin')
    : false;

  // House-password gate: everything except the public paths requires site auth
  // when a site password is configured. /admin/login is exempt so admins can
  // still reach it when site password is configured but the user hasn't
  // unlocked yet — but /admin/* itself now requires the house password too.
  if (event.locals.sitePasswordEnabled && !event.locals.siteAuthenticated && !isPublicPath(path)) {
    if (path.startsWith('/api/')) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const next = `${path}${event.url.search}`;
    throw redirect(303, `${withBase('/login')}?next=${encodeURIComponent(next)}`);
  }

  if (path.startsWith('/admin') && path !== '/admin/login') {
    if (!event.locals.adminAuthenticated) {
      throw redirect(303, withBase('/admin/login'));
    }
  }

  const response = await resolve(event);

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
};
