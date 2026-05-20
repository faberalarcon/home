import { json } from '@sveltejs/kit';
import { getDrinksStats } from '$lib/drinks/server/stats';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  return json(getDrinksStats(url.searchParams), {
    headers: {
      'Cache-Control': 'public, max-age=30',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
