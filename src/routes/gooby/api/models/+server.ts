import { json } from '@sveltejs/kit';
import {
  getGoobyLlamaStatus,
  goobyModelOption,
  isGoobyModelId,
  probeGoobyModelLoad
} from '$lib/gooby/llama';

const SWITCH_POLL_MS = 1_500;
const SWITCH_MAX_MS = 190_000;

export async function GET() {
  return json(await getGoobyLlamaStatus(), {
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const model = typeof body.model === 'string' ? body.model : '';
  if (!isGoobyModelId(model)) {
    return json({ error: 'Unknown model' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const label = goobyModelOption(model)?.displayLabel ?? model;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const emit = async (phase: 'starting' | 'loading' | 'ready' | 'failed', extra: Record<string, unknown> = {}) => {
        const status = await getGoobyLlamaStatus().catch(() => null);
        const payload = {
          phase,
          model,
          label,
          models: status?.models ?? [],
          defaultModel: status?.defaultModel ?? null,
          available: status?.available ?? false,
          error: status?.error ?? null,
          ...extra
        };
        safeEnqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      await emit('starting');

      const deadline = Date.now() + SWITCH_MAX_MS;
      let probeError: string | null = null;
      let probeDone = false;
      const probe = probeGoobyModelLoad(model)
        .then((err) => {
          probeError = err;
        })
        .catch((err: unknown) => {
          probeError = err instanceof Error ? err.message : 'Probe failed';
        })
        .finally(() => {
          probeDone = true;
        });

      while (!probeDone && Date.now() < deadline && !closed) {
        await new Promise((resolve) => setTimeout(resolve, SWITCH_POLL_MS));
        if (probeDone || closed) break;
        await emit('loading');
      }

      await probe;

      if (closed) {
        try { controller.close(); } catch { /* already closed */ }
        return;
      }

      if (probeError) {
        await emit('failed', { error: probeError });
      } else if (!probeDone) {
        await emit('failed', { error: `${label} did not load within ${Math.round(SWITCH_MAX_MS / 1000)} seconds` });
      } else {
        await emit('ready');
      }

      safeEnqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      closed = true;
      try { controller.close(); } catch { /* already closed */ }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no'
    }
  });
}
