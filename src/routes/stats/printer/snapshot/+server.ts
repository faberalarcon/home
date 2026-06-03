import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Proxies a single still image from the printer's webcam (e.g. crowsnest
// `http://<printer>/webcam/?action=snapshot`). Keeps the browser off the
// printer directly and the feed local-network-only. 404 when unconfigured.

const SNAPSHOT_TIMEOUT = 5000;

export const GET: RequestHandler = async () => {
  const src = env.PRINTER_SNAPSHOT_URL?.trim();
  if (!src) throw error(404, 'Printer snapshot not configured');

  let upstream: Response;
  try {
    upstream = await fetch(src, { signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT) });
  } catch {
    throw error(502, 'Printer snapshot unreachable');
  }
  if (!upstream.ok || !upstream.body) throw error(502, 'Printer snapshot unavailable');

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
  return new Response(upstream.body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store, max-age=0'
    }
  });
};
