import { fetchDrinkHubStats } from '$lib/stats/server/drink-hub';
import { withStatsCache } from '$lib/stats/server/stats-preload-cache';
import type { PageServerLoad } from './$types';

export async function _loadDrinksPageData(url: URL) {
  // Pass through any filter params
  const params = new URLSearchParams();
  for (const key of ['profile_id', 'drink_id', 'category', 'from', 'to']) {
    const val = url.searchParams.get(key);
    if (val) params.set(key, val);
  }

  const stats = await fetchDrinkHubStats(params);

  return {
    stats,
    filters: {
      profileId: url.searchParams.get('profile_id') ?? '',
      drinkId: url.searchParams.get('drink_id') ?? '',
      category: url.searchParams.get('category') ?? '',
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? ''
    }
  };
}

export const load: PageServerLoad = async ({ url }) => {
  return withStatsCache(url, () => _loadDrinksPageData(url));
};
