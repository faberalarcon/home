import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { orders } from '$lib/server/db/schema';
import { getSetting } from '$lib/server/db/settings';
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

  const haBaseUrl = getSetting('ha_base_url') ?? '';
  const haToken = getSetting('ha_token') ?? '';
  let haStatus = 'unconfigured';

  if (haToken && haBaseUrl) {
    try {
      const res = await fetch(`${haBaseUrl.replace(/\/$/, '')}/api/`, {
        headers: { Authorization: `Bearer ${haToken}` },
        signal: AbortSignal.timeout(2000)
      });
      haStatus = res.ok ? 'ok' : 'degraded';
    } catch {
      haStatus = 'degraded';
    }
  }

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
