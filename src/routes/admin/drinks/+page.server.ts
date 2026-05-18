import { db } from '$lib/drinks/server/db';
import { orders, drinks, profiles, haEventsLog } from '$lib/drinks/server/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { getSetting, setStatsResetAt } from '$lib/drinks/server/db/settings';
import { haHealthFetch } from '$lib/drinks/server/ha';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
  const totalOrders = db.select({ c: count() }).from(orders).get()?.c ?? 0;
  const activeDrinks = db.select({ c: count() }).from(drinks).where(eq(drinks.active, true)).get()?.c ?? 0;
  const activeProfiles = db.select({ c: count() }).from(profiles).where(eq(profiles.active, true)).get()?.c ?? 0;
  const failedEvents = db.select({ c: count() }).from(haEventsLog).where(eq(haEventsLog.success, false)).get()?.c ?? 0;

  const haBaseUrl = getSetting('ha_base_url') ?? '';
  const haToken = getSetting('ha_token') ?? '';

  let haStatus: 'ok' | 'error' | 'unconfigured' = 'unconfigured';
  if (haToken && haBaseUrl) {
    // Route through haHealthFetch so the bearer token never reaches a DNS-rebound IP.
    const probe = await haHealthFetch(haBaseUrl, haToken, 3000);
    haStatus = probe.ok ? 'ok' : 'error';
  }

  return { totalOrders, activeDrinks, activeProfiles, failedEvents, haStatus };
};

export const actions: Actions = {
  clearStats: async () => {
    setStatsResetAt(Math.floor(Date.now() / 1000));
    return { cleared: true };
  }
};
