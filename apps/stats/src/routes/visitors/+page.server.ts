import { getVisitorLocationStats } from '$lib/server/visitors';
import { withStatsCache } from '$lib/server/stats-preload-cache';

export async function _loadVisitorsPageData() {
  return {
    stats: await getVisitorLocationStats()
  };
}

export async function load({ url }: { url: URL }) {
  return withStatsCache(url, _loadVisitorsPageData);
}
