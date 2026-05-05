import { getOpsBoard } from '$lib/server/ops-board';
import { withStatsCache } from '$lib/server/stats-preload-cache';
import type { PageServerLoad } from './$types';

export async function _loadOverviewPageData() {
  return {
    ops: await getOpsBoard()
  };
}

export const load: PageServerLoad = async ({ url }) => {
  return withStatsCache(url, _loadOverviewPageData);
};
