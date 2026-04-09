import { db } from '$lib/server/db';
import { orders, drinks, profiles, haEventsLog } from '$lib/server/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { getSetting } from '$lib/server/db/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const totalOrders = db.select({ c: count() }).from(orders).get()?.c ?? 0;
  const activeDrinks = db.select({ c: count() }).from(drinks).where(eq(drinks.active, true)).get()?.c ?? 0;
  const activeProfiles = db.select({ c: count() }).from(profiles).where(eq(profiles.active, true)).get()?.c ?? 0;
  const failedEvents = db.select({ c: count() }).from(haEventsLog).where(eq(haEventsLog.success, false)).get()?.c ?? 0;

  const haBaseUrl = getSetting('ha_base_url') ?? '';
  const haToken = getSetting('ha_token') ?? '';

  let haStatus: 'ok' | 'error' | 'unconfigured' = 'unconfigured';
  if (haToken && haBaseUrl) {
    try {
      const res = await fetch(`${haBaseUrl.replace(/\/$/, '')}/api/`, {
        headers: { Authorization: `Bearer ${haToken}` },
        signal: AbortSignal.timeout(3000)
      });
      haStatus = res.ok ? 'ok' : 'error';
    } catch {
      haStatus = 'error';
    }
  }

  return { totalOrders, activeDrinks, activeProfiles, failedEvents, haStatus };
};
