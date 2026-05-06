import { getPiMetrics } from '$lib/stats/server/pi-metrics';
import { withStatsCache } from '$lib/stats/server/stats-preload-cache';
import type { PageServerLoad } from './$types';

function parseRange(v: string | null): '1d' | '7d' {
  return v === '7d' ? '7d' : '1d';
}

export async function _loadPiPageData(url: URL) {
  const range = parseRange(url.searchParams.get('range'));
  const pi = await getPiMetrics(range);
  return { pi };
}

export const load: PageServerLoad = async ({ url }) => {
  return withStatsCache(url, () => _loadPiPageData(url));
};
