import { json } from '@sveltejs/kit';
import { db } from '$lib/drinks/server/db';
import { orders } from '$lib/drinks/server/db/schema';
import { isAvailable as isHaAvailable } from '$lib/stats/server/home-assistant';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function isDrinkHubAvailable(): boolean {
  try {
    db.select({ c: sql<number>`count(*)` }).from(orders).get();
    return true;
  } catch {
    return false;
  }
}

export const GET: RequestHandler = async () => {
  const [ha, drinkHub] = await Promise.all([
    isHaAvailable().catch(() => false),
    Promise.resolve(isDrinkHubAvailable())
  ]);

  const status = ha && drinkHub ? 'ok' : ha || drinkHub ? 'degraded' : 'unhealthy';

  return json(
    {
      status,
      services: {
        homeAssistant: ha ? 'ok' : 'unavailable',
        drinkHub: drinkHub ? 'ok' : 'unavailable'
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    },
    { status: status === 'unhealthy' ? 503 : 200 }
  );
};
