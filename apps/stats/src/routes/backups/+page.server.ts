import { readBackupManifest } from '$lib/server/backups';
import { withStatsCache } from '$lib/server/stats-preload-cache';
import type { PageServerLoad } from './$types';

export async function _loadBackupsPageData() {
  const manifest = await readBackupManifest();
  return { manifest };
};

export const load: PageServerLoad = async ({ url }) => {
  return withStatsCache(url, _loadBackupsPageData);
};
