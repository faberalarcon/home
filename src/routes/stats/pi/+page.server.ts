import { getPiMetrics, type PiMetricsRange } from '$lib/stats/server/pi-metrics';
import { withStatsCache } from '$lib/stats/server/stats-preload-cache';
import type { PageServerLoad } from './$types';

function parseRange(v: string | null): PiMetricsRange {
  if (v === '7d' || v === '30d' || v === '90d') return v;
  return '1d';
}

export async function _loadPiPageData(url: URL) {
  const range = parseRange(url.searchParams.get('range'));
  const pi = await getPiMetrics(range);
  return { pi };
}

export const load: PageServerLoad = async ({ url }) => {
  return withStatsCache(url, () => _loadPiPageData(url));
};
