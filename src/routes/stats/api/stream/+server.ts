import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { subscribe, getMissedEvents, clientCount } from '$lib/stats/server/stream';
import { latestRow } from '$lib/stats/server/pi-history';

const MAX_CLIENTS = 50;

export const GET: RequestHandler = ({ request }) => {
  if (clientCount() >= MAX_CLIENTS) {
    return json({ error: 'Too many connections' }, { status: 503 });
  }

  const lastEventId = Number(request.headers.get('Last-Event-ID') ?? 0);
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      if (lastEventId > 0) {
        const missed = getMissedEvents(lastEventId);
        if (missed) controller.enqueue(encoder.encode(missed));
      }
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Send initial snapshot so reconnecting clients get current values immediately.
      const latest = latestRow();
      if (latest) {
        controller.enqueue(
          encoder.encode(`event: pi-snapshot\ndata: ${JSON.stringify(latest)}\n\n`)
        );
      }

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
