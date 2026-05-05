import { error, json } from '@sveltejs/kit';
import { canonicalizeStatsHref, withStatsCache } from '$lib/server/stats-preload-cache';
import { _loadOverviewPageData } from '../../+page.server';
import { _loadBackupsPageData } from '../../backups/+page.server';
import { _loadDrinksPageData } from '../../drinks/+page.server';
import { _loadHousePageData } from '../../house/+page.server';
import { _loadPiPageData } from '../../pi/+page.server';
import { _loadVisitorsPageData } from '../../visitors/+page.server';
import type { RequestHandler } from './$types';

async function loadPageData(canonical: string, origin: string): Promise<Record<string, unknown>> {
  const targetUrl = new URL(canonical, origin);
  const loader: () => Promise<Record<string, unknown>> = async () => {
    switch (targetUrl.pathname) {
      case '/':
        return (await _loadOverviewPageData()) as Record<string, unknown>;
      case '/house':
        return (await _loadHousePageData(targetUrl)) as Record<string, unknown>;
      case '/drinks':
        return (await _loadDrinksPageData(targetUrl)) as Record<string, unknown>;
      case '/visitors':
        return (await _loadVisitorsPageData()) as Record<string, unknown>;
      case '/backups':
        return (await _loadBackupsPageData()) as Record<string, unknown>;
      case '/pi':
        return (await _loadPiPageData(targetUrl)) as Record<string, unknown>;
      default:
        throw error(404, 'Unknown stats page');
    }
  };

  return withStatsCache<Record<string, unknown>>(targetUrl, loader);
}

export const GET: RequestHandler = async ({ request, url }) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    throw error(403, 'Cross-origin page data is not allowed');
  }

  const href = url.searchParams.get('href');
  if (!href) throw error(400, 'Missing href');

  const canonical = canonicalizeStatsHref(href);
  if (!canonical) throw error(400, 'Unsupported stats href');

  const data = await loadPageData(canonical, url.origin);
  return json({ href: canonical, data });
};
