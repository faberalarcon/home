import { subscribe, getMissedEvents, clientCount } from '$lib/drinks/server/stream';
import { checkRateLimit } from '$lib/drinks/server/ratelimit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, getClientAddress }) => {
  const ip = getClientAddress();
  const rateCheck = checkRateLimit('sse', ip);
  if (!rateCheck.allowed) {
    console.warn(`[rate-limit] sse blocked ip=${ip} at=${new Date().toISOString()}`);
    return json({ error: 'Too many connections' }, {
      status: 429,
      headers: { 'Retry-After': String(rateCheck.retryAfter ?? 10) }
    });
  }

  if (clientCount() >= 50) {
    return json({ error: 'Too many connections' }, { status: 503 });
  }

  const lastEventId = Number(request.headers.get('Last-Event-ID') ?? 0);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // Replay any events missed since the client last connected
      if (lastEventId > 0) {
        const missed = getMissedEvents(lastEventId);
        if (missed) controller.enqueue(encoder.encode(missed));
      }

      controller.enqueue(encoder.encode(': connected\n\n'));

      unsubscribe = subscribe((chunk) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          unsubscribe?.();
        }
      });
    },
    cancel() {
      unsubscribe?.();
    }
  });

  request.signal.addEventListener('abort', () => unsubscribe?.());

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
};
