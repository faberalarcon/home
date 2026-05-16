import { getSetting } from './db/settings';
import { fetchLlamaModels, probeGoobyModelLoad } from '$lib/gooby/llama';

const DEFAULT_LLAMA_BASE_URL = 'http://192.168.1.215:8080';

function llamaBaseUrl(): string {
  return (process.env.LLAMA_BASE_URL ?? DEFAULT_LLAMA_BASE_URL).replace(/\/+$/, '');
}

function isEnabled(): boolean {
  const raw = getSetting('tts_llm_enabled');
  return raw === 'true' || raw === '1';
}

function targetModel(): string {
  return (getSetting('tts_llm_model') ?? 'gemma4:e2b').trim();
}

function timeoutMs(): number {
  const v = Number(getSetting('tts_llm_timeout_ms') ?? '3000');
  return Number.isFinite(v) && v > 0 ? v : 3000;
}

function maxTokens(): number {
  const v = Number(getSetting('tts_llm_max_tokens') ?? '60');
  return Number.isFinite(v) && v > 0 ? v : 60;
}

function systemPrompt(): string {
  return (getSetting('tts_llm_system_prompt') ?? '').trim();
}

export function sanitizeQuip(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/\r\n/g, '\n').trim();
  if (!s) return null;
  // Strip reasoning blocks (closed or dangling).
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/<think>[\s\S]*$/i, '').trim();
  if (!s) return null;
  // First non-empty line only.
  const firstLine = s.split('\n').map((l) => l.trim()).find(Boolean);
  if (!firstLine) return null;
  s = firstLine;
  // Strip wrapping matched quotes/backticks.
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'],
    ['‘', '’']
  ];
  for (const [open, close] of pairs) {
    if (s.startsWith(open) && s.endsWith(close) && s.length >= 2) {
      s = s.slice(1, -1).trim();
    }
  }
  // Drop common preambles.
  s = s
    .replace(/^(sure|certainly|of course|here you go|here['’]s|okay|ok|alright|got it)[!,.:\-—\s]+/i, '')
    .trim();
  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ');
  if (!s) return null;
  if (s.length > 180) return null;
  return s;
}

export interface OrderQuipContext {
  profileName: string;
  drinkName: string;
  allTimeCount: number;
  todayCount: number;
}

export interface MilestoneQuipContext {
  milestoneName: string;
  scope: string;
  threshold: number;
  profileName: string;
  drinkName: string;
}

async function callLlama(userPrompt: string): Promise<string | null> {
  const sys = systemPrompt();
  if (!sys) return null;
  const model = targetModel();

  // Cheap up-front probe — if target not loaded, fire-and-forget a load so the
  // next order is warm, and skip this announcement's LLM call entirely.
  try {
    const models = await fetchLlamaModels();
    const target = models.find((m) => m.id === model);
    if (!target || target.status !== 'loaded') {
      console.log(`[tts-llm] target model "${model}" not loaded (status=${target?.status ?? 'missing'}); falling back, preloading`);
      probeGoobyModelLoad(model).catch(() => {});
      return null;
    }
  } catch (err) {
    console.warn('[tts-llm] model probe failed:', err instanceof Error ? err.message : err);
    return null;
  }

  try {
    const response = await fetch(`${llamaBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs()),
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: maxTokens(),
        temperature: 0.9,
        // Suppress chain-of-thought for models whose chat template honors it
        // (gemma 4 thinking, gpt-oss thinking). Ignored otherwise.
        chat_template_kwargs: { enable_thinking: false, reasoning_effort: 'low' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    if (!response.ok) {
      console.warn(`[tts-llm] chat completion non-ok: ${response.status}`);
      return null;
    }
    const payload = await response.json().catch(() => null);
    const message = payload?.choices?.[0]?.message;
    const content = typeof message?.content === 'string' ? message.content : '';
    const reasoning = typeof message?.reasoning_content === 'string' ? message.reasoning_content : '';
    const candidate = content.trim() || reasoning.trim();
    if (!candidate) return null;
    return sanitizeQuip(candidate);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (reason.toLowerCase().includes('abort')) {
      console.warn('[tts-llm] timeout');
    } else {
      console.warn('[tts-llm] call failed:', reason);
    }
    return null;
  }
}

export async function generateOrderQuip(ctx: OrderQuipContext): Promise<string | null> {
  if (!isEnabled()) return null;
  const userPrompt = `Order: ${ctx.profileName} just ordered a ${ctx.drinkName}. They've had ${ctx.todayCount} today, ${ctx.allTimeCount} all-time.`;
  return callLlama(userPrompt);
}

export async function generateMilestoneQuip(ctx: MilestoneQuipContext): Promise<string | null> {
  if (!isEnabled()) return null;
  const userPrompt = `Milestone "${ctx.milestoneName}" hit: scope ${ctx.scope}, threshold ${ctx.threshold}. ${ctx.profileName} ordered a ${ctx.drinkName}.`;
  return callLlama(userPrompt);
}
