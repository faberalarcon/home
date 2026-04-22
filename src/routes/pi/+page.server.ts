import { getPiMetrics } from '$lib/server/pi-metrics';
import type { PageServerLoad } from './$types';

function parseRange(v: string | null): '1d' | '7d' {
  return v === '7d' ? '7d' : '1d';
}

export const load: PageServerLoad = async ({ url }) => {
  const range = parseRange(url.searchParams.get('range'));
  const pi = await getPiMetrics(range);
  return { pi };
};
