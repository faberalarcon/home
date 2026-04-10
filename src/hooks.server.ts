import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '$lib/server/db';
import { bootstrapSettings, getSetting } from '$lib/server/db/settings';
import { hashPin, verifySessionToken } from '$lib/server/auth';
import { getConfiguredSitePasswordHash } from '$lib/server/site-access';
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
  site_name: 'drink-hub',
  admin_pin_hash: hashPin('1234')
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

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  const sitePasswordHash = getConfiguredSitePasswordHash();
  const siteToken = event.cookies.get('site_session');

  event.locals.sitePasswordEnabled = !!sitePasswordHash;
  event.locals.siteAuthenticated = verifySessionToken(siteToken, sitePasswordHash);

  if (event.locals.sitePasswordEnabled && !event.locals.siteAuthenticated && !isPublicPath(path)) {
    if (path.startsWith('/api/')) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const next = `${path}${event.url.search}`;
    throw redirect(303, `/login?next=${encodeURIComponent(next)}`);
  }

  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const pinHash = getSetting('admin_pin_hash') ?? '';
    const token = event.cookies.get('admin_session');
    if (!verifySessionToken(token, pinHash)) {
      throw redirect(303, '/admin/login');
    }
  }

  return resolve(event);
};
