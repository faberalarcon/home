import { error, json } from '@sveltejs/kit';
import {
  canonicalizeStatsHref,
  warmStatsCache
} from '$lib/stats/server/stats-preload-cache';
import { _loadOverviewPageData } from '../../+page.server';
import { _loadBackupsPageData } from '../../backups/+page.server';
import { _loadDrinksPageData } from '../../drinks/+page.server';
import { _loadHousePageData } from '../../house/+page.server';
import { _loadPiPageData } from '../../pi/+page.server';
import { _loadVisitorsPageData } from '../../visitors/+page.server';
import type { RequestHandler } from './$types';

const MAX_HREFS = 40;
const CONCURRENCY = 2;

async function warmHref(href: string, origin: string): Promise<'warmed' | 'skipped'> {
  const canonical = canonicalizeStatsHref(href);
  if (!canonical) return 'skipped';

  const targetUrl = new URL(canonical, origin);
  const loader: () => Promise<unknown> = () => {
    switch (targetUrl.pathname) {
      case '/':
        return _loadOverviewPageData();
      case '/house':
        return _loadHousePageData(targetUrl);
      case '/drinks':
        return _loadDrinksPageData(targetUrl);
      case '/visitors':
        return _loadVisitorsPageData();
      case '/backups':
        return _loadBackupsPageData();
      case '/pi':
        return _loadPiPageData(targetUrl);
      default:
        return Promise.resolve(null);
    }
  };

  return warmStatsCache<unknown>(canonical, loader);
}

async function runWarmups(hrefs: string[], origin: string): Promise<{ warmed: number; skipped: number; failed: number }> {
  let next = 0;
  let warmed = 0;
  let skipped = 0;
  let failed = 0;

  async function worker() {
    while (next < hrefs.length) {
      const href = hrefs[next++];
      try {
        const result = await warmHref(href, origin);
        if (result === 'warmed') warmed += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, hrefs.length) }, worker));
  return { warmed, skipped, failed };
}

export const POST: RequestHandler = async ({ request, url }) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    throw error(403, 'Cross-origin preload is not allowed');
  }

  let body: { hrefs?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Expected JSON body');
  }

  if (!Array.isArray(body.hrefs)) {
    throw error(400, 'Expected hrefs array');
  }

  const hrefs = body.hrefs
    .filter((href): href is string => typeof href === 'string')
    .slice(0, MAX_HREFS);

  const result = await runWarmups(hrefs, url.origin);
  return json({ ok: true, requested: hrefs.length, ...result });
};
