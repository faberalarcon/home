import { json } from '@sveltejs/kit';
import { db } from '$lib/drinks/server/db';
import { orders } from '$lib/drinks/server/db/schema';
import { probeHa } from '$lib/drinks/server/ha';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const startedAt = Date.now();

export const GET: RequestHandler = async () => {
  let dbStatus = 'ok';
  try {
    db.select({ c: sql<number>`count(*)` }).from(orders).get();
  } catch {
    dbStatus = 'error';
  }

  const haStatus = await probeHa();

  const status = dbStatus === 'error' ? 'unhealthy' : haStatus === 'degraded' ? 'degraded' : 'ok';

  return json(
    {
      status,
      db: dbStatus,
      ha: haStatus,
      uptime: Math.floor((Date.now() - startedAt) / 1000)
    },
    { status: status === 'unhealthy' ? 503 : 200 }
  );
};
