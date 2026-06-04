import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

const dbPath = process.env.DATABASE_PATH ?? './data/drink-hub.db';
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
// Restrict the DB (and the WAL/SHM sidecars SQLite derives from it) to owner-only.
try {
  chmodSync(dbPath, 0o600);
} catch {
  // best-effort; non-fatal if FS doesn't support chmod
}
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { schema };
