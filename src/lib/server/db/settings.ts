import { db } from './index';
import { settings } from './schema';
import { eq } from 'drizzle-orm';

export function getSetting(key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function getStatsResetAt(): number {
  return Number(getSetting('stats_reset_at') ?? '0');
}

export function setStatsResetAt(ts: number): void {
  setSetting('stats_reset_at', String(ts));
}

export function bootstrapSettings(defaults: Record<string, string>): void {
  for (const [key, value] of Object.entries(defaults)) {
    db.insert(settings).values({ key, value }).onConflictDoNothing().run();
  }
}
