import { json } from '@sveltejs/kit';
import {
  getGoobyLlamaStatus,
  isGoobyModelId,
  probeGoobyModelLoad
} from '$lib/gooby/llama';

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
  const probeError = await probeGoobyModelLoad(model);
  const status = await getGoobyLlamaStatus();
  return json(
    { ...status, error: probeError ?? status.error },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
