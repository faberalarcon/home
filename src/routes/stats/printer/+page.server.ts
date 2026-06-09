import { getCanonStatus } from '$lib/stats/server/canon';
import { getPrinterHistory, getPrinterStatus, type PrinterHistoryRange } from '$lib/stats/server/printer';
import { withStatsCache } from '$lib/stats/server/stats-preload-cache';
import type { PageServerLoad } from './$types';

function parseRange(v: string | null): PrinterHistoryRange {
  if (v === '30d' || v === '90d') return v;
  return '7d';
}

export async function _loadPrinterPageData(url: URL) {
  const range = parseRange(url.searchParams.get('range'));
  const [status, history, canon] = await Promise.all([
    getPrinterStatus(),
    getPrinterHistory(range),
    getCanonStatus()
  ]);
  return { status, history, canon };
}

export const load: PageServerLoad = async ({ url }) => {
  return withStatsCache(url, () => _loadPrinterPageData(url));
};
