import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '$lib/server/db';
import { bootstrapSettings } from '$lib/server/db/settings';

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
  ha_base_url: 'http://homeassistant.local:8123',
  ha_token: '',
  site_name: 'drink-hub'
});
