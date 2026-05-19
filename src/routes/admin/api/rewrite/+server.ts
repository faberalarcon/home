import { json, type RequestHandler } from '@sveltejs/kit';
import { checkAdminRateLimit } from '$lib/admin/server';
import { getSetting } from '$lib/drinks/server/db/settings';
import {
  isAnyHigherPriorityActive,
  markRagActive,
  clearRagActive
} from '$lib/drinks/server/llm-priority';
import { llamaBaseUrl } from '$lib/server/llama-endpoint';

const ALLOWED_FIELDS = new Set([
  'member_bio',
  'drink_description',
  'neighborhood_tip',
  'visitor_tip',
  'limon_spotlight'
]);

interface RewriteBody {
  field: string;
  current: string;
  context?: Record<string, string>;
}

const TONES: Array<{ tone: string; temperature: number }> = [
  { tone: 'faithful', temperature: 0.45 },
  { tone: 'punchier', temperature: 0.7 },
  { tone: 'playful', temperature: 0.95 }
];

const REWRITE_TIMEOUT_MS = 120_000;
const YIELD_POLL_MS = 250;
const YIELD_MAX_WAIT_MS = 12_000;

async function yieldToHigher(): Promise<void> {
  const start = Date.now();
  while (isAnyHigherPriorityActive() && Date.now() - start < YIELD_MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, YIELD_POLL_MS));
  }
}

function buildUserPrompt(body: RewriteBody, toneHint: string): string {
  const contextLines = body.context
    ? Object.entries(body.context)
        .filter(([, v]) => typeof v === 'string' && v.trim())
        .map(([k, v]) => `${k}: ${v}`)
    : [];
  const contextPart = contextLines.length ? `\n\nContext:\n${contextLines.join('\n')}` : '';
  return `Original text:\n${body.current}${contextPart}\n\nRewrite this in a ${toneHint} register. Output only the rewrite.`;
}

async function callOne(systemPrompt: string, userPrompt: string, model: string, temperature: number): Promise<string | null> {
  try {
    const response = await fetch(`${llamaBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REWRITE_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: false,
        temperature,
        max_tokens: 600,
        // Suppress chain-of-thought for gemma4-thinking / gpt-oss-thinking models
        // — otherwise max_tokens is eaten by reasoning_content and the visible
        // content comes back empty. Ignored by non-thinking models.
        chat_template_kwargs: { enable_thinking: false, reasoning_effort: 'low' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    if (!response.ok) {
      console.warn(`[gooby-rewrite] non-ok: ${response.status}`);
      return null;
    }
    const payload = await response.json().catch(() => null);
    const message = payload?.choices?.[0]?.message;
    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (!content) {
      console.warn('[gooby-rewrite] empty content', {
        finish: payload?.choices?.[0]?.finish_reason,
        reasoningChars: typeof message?.reasoning_content === 'string' ? message.reasoning_content.length : 0
      });
      return null;
    }
    return content;
  } catch (err) {
    console.warn('[gooby-rewrite] call failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export const POST: RequestHandler = async (event) => {
  if (!checkAdminRateLimit(event, 'api')) {
    return json({ error: 'Too many requests — please wait a moment' }, { status: 429 });
  }

  const body = (await event.request.json().catch(() => null)) as RewriteBody | null;
  if (!body || typeof body.field !== 'string' || !ALLOWED_FIELDS.has(body.field)) {
    return json({ error: 'Unknown or missing field' }, { status: 400 });
  }
  if (typeof body.current !== 'string' || !body.current.trim()) {
    return json({ error: 'current is required' }, { status: 400 });
  }
  if (body.current.length > 4_000) {
    return json({ error: 'current is too long' }, { status: 400 });
  }

  const systemPrompt = (getSetting(`rewrite_prompt_${body.field}`) ?? '').trim();
  if (!systemPrompt) {
    return json({ error: `Rewrite prompt not configured for field ${body.field}` }, { status: 500 });
  }
  const model = (getSetting('gooby_rag_model') ?? 'gemma4-26b-heretic-128k').trim();

  await yieldToHigher();
  markRagActive(240);

  try {
    // Run sequentially: 3 parallel requests to the same not-yet-loaded model
    // race the llama-swap loader and reliably trip the 120s budget on the
    // gemma4-26b-heretic cold start. The first call pays the cold load; the
    // next two are cache-warm.
    const candidates: Array<{ text: string; tone: string }> = [];
    for (const { tone, temperature } of TONES) {
      const text = await callOne(systemPrompt, buildUserPrompt(body, tone), model, temperature);
      if (text) candidates.push({ text, tone });
    }
    if (candidates.length === 0) {
      return json({ error: 'Rewrite failed — no candidates returned' }, { status: 502 });
    }
    return json({ candidates });
  } finally {
    clearRagActive();
  }
};
