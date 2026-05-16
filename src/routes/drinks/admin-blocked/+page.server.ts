import { readVisitorCount } from '$lib/site/visitors.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ request, getClientAddress }) => {
  const headerIp = request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? '';
  let ip = headerIp;
  if (!ip) {
    try { ip = getClientAddress(); } catch { ip = ''; }
  }
  const stripped = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return {
    clientIp: stripped,
    visitorCount: readVisitorCount()
  };
};
