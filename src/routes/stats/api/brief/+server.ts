import { json, type RequestHandler } from '@sveltejs/kit';
import { listBriefs } from '$lib/stats/server/brief';

export const GET: RequestHandler = ({ url }) => {
  const limitParam = Number(url.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 90) : 30;
  const briefs = listBriefs(limit);
  return json({ briefs });
};
