import { json } from '@sveltejs/kit';
import { isAvailable as isHaAvailable } from '$lib/server/home-assistant';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const [ha, drinkHub] = await Promise.all([
    isHaAvailable().catch(() => false),
    fetch(`${process.env.DRINK_HUB_URL ?? 'https://drink-hub.21bristoe.com'}/api/health`, {
      signal: AbortSignal.timeout(4000)
    }).then((r) => r.ok).catch(() => false)
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
