import { json } from '@sveltejs/kit';
import { fetchLlamaModels, probeGoobyModelLoad } from '$lib/gooby/llama';
import { getSetting } from '$lib/drinks/server/db/settings';
import { markDrinksActive } from '$lib/drinks/server/llm-priority';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  markDrinksActive();
  const targetModel = (getSetting('tts_llm_model') ?? 'gemma4:e2b').trim();

  try {
    const models = await fetchLlamaModels();
    const target = models.find((m) => m.id === targetModel);
    if (target?.status === 'loaded') {
      return json({ status: 'ready', model: targetModel });
    }
    probeGoobyModelLoad(targetModel).catch((err) => {
      console.warn('[tts-preload] probe rejected:', err instanceof Error ? err.message : err);
    });
    return json({ status: 'loading', model: targetModel });
  } catch (err) {
    return json(
      {
        status: 'failed',
        model: targetModel,
        error: err instanceof Error ? err.message : 'llama.cpp unreachable'
      },
      { status: 200 }
    );
  }
};
