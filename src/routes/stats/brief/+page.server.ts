import type { PageServerLoad } from './$types';
import { listBriefs } from '$lib/stats/server/brief';

export const load: PageServerLoad = () => {
  return { briefs: listBriefs(30) };
};
