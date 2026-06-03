import { error } from '@sveltejs/kit';
import { webrtcSignalingUrl } from '$lib/stats/server/printer';
import type { RequestHandler } from './$types';

// Same-origin signaling proxy for the K2 Pro camera's WebRTC handshake. The
// browser POSTs its base64 offer here; we forward it to the printer's
// `webrtc_local` endpoint (which sends no CORS headers, so the browser can't
// reach it directly) and return the base64 answer. Media (ICE/DTLS/SRTP) then
// flows browser <-> printer directly, so this only works on the home LAN.
const SIGNALING_TIMEOUT = 8000;

export const POST: RequestHandler = async ({ request }) => {
  const target = webrtcSignalingUrl();
  if (!target) throw error(404, 'Printer WebRTC not configured');

  const offer = await request.text();
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'plain/text' },
      body: offer,
      signal: AbortSignal.timeout(SIGNALING_TIMEOUT)
    });
  } catch {
    throw error(502, 'Printer WebRTC unreachable');
  }
  if (!upstream.ok) throw error(502, 'Printer WebRTC signaling failed');

  const answer = await upstream.text();
  return new Response(answer, {
    headers: { 'content-type': 'text/plain', 'cache-control': 'no-store, max-age=0' }
  });
};
