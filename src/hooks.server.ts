import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { json, redirect, type Handle } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { db } from '$lib/drinks/server/db';
import { bootstrapSettings } from '$lib/drinks/server/db/settings';
import { verifySessionToken } from '$lib/drinks/server/auth';
import {
  bootstrapAdminPassword,
  isAdminPasswordConfigured
} from '$lib/drinks/server/admin-password';
import { getConfiguredSitePasswordHash } from '$lib/drinks/server/site-access';
import { getConfiguredGoobyPasswordHash } from '$lib/gooby/auth';

const isProduction = process.env.NODE_ENV === 'production';
const rootAdminSecret = process.env.ADMIN_SHARED_SECRET ?? '';

if (isProduction && !rootAdminSecret) {
  console.error('[fatal] ADMIN_SHARED_SECRET is required in production. Refusing to start.');
  process.exit(1);
}

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

const adminBootstrap = bootstrapAdminPassword();
if (adminBootstrap.generatedPassword) {
  console.log('');
  console.log('==============================================================');
  console.log('[drink-hub] INITIAL ADMIN PASSWORD: ' + adminBootstrap.generatedPassword);
  console.log(`[drink-hub] Log in at ${withDrinksBase('/admin/login')} and change it immediately.`);
  console.log('==============================================================');
  console.log('');
} else if (adminBootstrap.source === 'env') {
  console.log('[drink-hub] admin password seeded from ADMIN_PASSWORD env var');
}

if (process.env.ADMIN_PIN || process.env.ADMIN_PIN_HASH) {
  console.warn(
    '[drink-hub] ADMIN_PIN / ADMIN_PIN_HASH are deprecated and ignored. ' +
      'Use ADMIN_PASSWORD (or let the server generate a temp password) and ' +
      `manage the credential from ${withDrinksBase('/admin/settings')}.`
  );
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://21bristoe.com data: blob:",
    "connect-src 'self' https://21bristoe.com",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
};

function isDrinkPublicPath(path: string): boolean {
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

function drinkRoutePath(pathname: string): string {
  if (pathname === '/drinks') return '/';
  if (pathname.startsWith('/drinks/')) return pathname.slice('/drinks'.length);
  return pathname;
}

function withDrinksBase(path: string): string {
  if (path === '/') return '/drinks';
  return `/drinks${path}`;
}

function isGoobyPublicPath(pathname: string): boolean {
  return (
    pathname === '/gooby/login' ||
    pathname.startsWith('/_app/') ||
    pathname === '/favicon.png' ||
    pathname === '/favicon.svg'
  );
}

function verifyRootAdminProxy(event: Parameters<Handle>[0]['event']): boolean {
  if (!isProduction) return true;
  const supplied = event.request.headers.get('x-admin-auth') ?? '';
  const expected = rootAdminSecret;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.rootAdminAuthenticated = false;
  event.locals.goobyPasswordEnabled = false;
  event.locals.goobyAuthenticated = false;

  if (event.url.pathname === '/admin') {
    throw redirect(308, '/admin/');
  }

  if (event.url.pathname.startsWith('/admin/')) {
    event.locals.rootAdminAuthenticated = verifyRootAdminProxy(event);
    if (!event.locals.rootAdminAuthenticated) {
      console.warn(`[admin] blocked request without trusted proxy auth: ${event.request.method} ${event.url.pathname}`);
      return json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (event.url.pathname.startsWith('/drinks')) {
    const path = drinkRoutePath(event.url.pathname);
    const sitePasswordHash = getConfiguredSitePasswordHash();
    const siteToken = event.cookies.get('site_session');
    const adminToken = event.cookies.get('admin_session');

    event.locals.sitePasswordEnabled = !!sitePasswordHash;
    event.locals.siteAuthenticated = event.locals.sitePasswordEnabled
      ? verifySessionToken(siteToken, 'site')
      : true;
    event.locals.drinkAdminAuthenticated = isAdminPasswordConfigured()
      ? verifySessionToken(adminToken, 'admin')
      : false;
    event.locals.adminAuthenticated = event.locals.drinkAdminAuthenticated;

    if (event.locals.sitePasswordEnabled && !event.locals.siteAuthenticated && !isDrinkPublicPath(path)) {
      if (path.startsWith('/api/')) {
        return json({ error: 'Authentication required' }, { status: 401 });
      }

      const next = `${path}${event.url.search}`;
      throw redirect(303, `${withDrinksBase('/login')}?next=${encodeURIComponent(next)}`);
    }

    if (path.startsWith('/admin') && path !== '/admin/login') {
      if (!event.locals.drinkAdminAuthenticated) {
        throw redirect(303, withDrinksBase('/admin/login'));
      }
    }
  } else if (event.url.pathname.startsWith('/gooby')) {
    const goobyPasswordHash = getConfiguredGoobyPasswordHash();
    const goobyToken = event.cookies.get('gooby_session');

    event.locals.goobyPasswordEnabled = !!goobyPasswordHash;
    event.locals.goobyAuthenticated = event.locals.goobyPasswordEnabled
      ? verifySessionToken(goobyToken, 'gooby')
      : false;
    event.locals.sitePasswordEnabled = false;
    event.locals.siteAuthenticated = true;
    event.locals.drinkAdminAuthenticated = false;
    event.locals.adminAuthenticated = false;

    if ((!event.locals.goobyPasswordEnabled || !event.locals.goobyAuthenticated) && !isGoobyPublicPath(event.url.pathname)) {
      if (event.url.pathname.startsWith('/gooby/api/')) {
        return json(
          { error: event.locals.goobyPasswordEnabled ? 'Authentication required' : 'GoobyGPT password is not configured' },
          { status: event.locals.goobyPasswordEnabled ? 401 : 503 }
        );
      }

      const next = `${event.url.pathname}${event.url.search}`;
      throw redirect(303, `/gooby/login?next=${encodeURIComponent(next)}`);
    }
  } else {
    event.locals.sitePasswordEnabled = false;
    event.locals.siteAuthenticated = true;
    event.locals.drinkAdminAuthenticated = false;
    event.locals.adminAuthenticated = false;
  }

  const response = await resolve(event);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  if (event.url.pathname === '/') {
    response.headers.set('Cache-Control', 'no-store');
  } else if (
    event.url.pathname === '/stats/' ||
    event.url.pathname === '/stats/drinks' ||
    event.url.pathname === '/stats/house'
  ) {
    response.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  }

  return response;
};
