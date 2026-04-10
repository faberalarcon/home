import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '$lib/server/db';
import { bootstrapSettings, getSetting } from '$lib/server/db/settings';
import { hashPin, verifySessionToken } from '$lib/server/auth';
import { redirect, type Handle } from '@sveltejs/kit';

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

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;

  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const pinHash = getSetting('admin_pin_hash') ?? '';
    const token = event.cookies.get('admin_session');
    if (!verifySessionToken(token, pinHash)) {
      throw redirect(303, '/admin/login');
    }
  }

  return resolve(event);
};
