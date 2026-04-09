import { subscribe } from '$lib/server/stream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request }) => {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
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
