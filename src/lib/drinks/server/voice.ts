import { db } from './db';
import { drinks, profiles, type Drink, type Profile } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSetting } from './db/settings';
import { isDrinksActive } from './llm-priority';
import { llamaBaseUrl, whisperBaseUrl } from '$lib/server/llama-endpoint';

const TRANSCRIBE_TIMEOUT_MS = 30_000;
const PARSE_TIMEOUT_MS = 60_000;
const YIELD_POLL_MS = 200;
const YIELD_MAX_WAIT_MS = 8_000;

async function yieldToDrinks(): Promise<void> {
  const start = Date.now();
  while (isDrinksActive() && Date.now() - start < YIELD_MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, YIELD_POLL_MS));
  }
}

export interface Transcription {
  text: string;
  durationMs: number;
}

export function buildWhisperVocab(profileList: Profile[], menu: Drink[]): string {
  const members = profileList.map((p) => p.name).filter(Boolean).join(', ');
  const drinkNames = menu.map((d) => d.name).filter(Boolean).join(', ');
  const parts: string[] = ['21 Bristoe.'];
  if (members) parts.push(`Members: ${members}.`);
  if (drinkNames) parts.push(`Drinks: ${drinkNames}.`);
  return parts.join(' ');
}

export async function transcribe(audio: Buffer, mime: string, prompt?: string): Promise<Transcription> {
  const start = Date.now();
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(audio)], { type: mime || 'audio/webm' }), 'order.webm');
  form.set('temperature', '0');
  form.set('response_format', 'json');
  if (prompt && prompt.trim()) form.set('prompt', prompt.trim());

  const response = await fetch(`${whisperBaseUrl()}/inference`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`whisper non-ok ${response.status}: ${body.slice(0, 200)}`);
  }
  const payload = (await response.json().catch(() => null)) as { text?: string } | null;
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  return { text, durationMs: Date.now() - start };
}

export interface ParsedOrderItem {
  drink_id: number;
  quantity: number;
  notes: string | null;
}

export interface ParsedAmbiguity {
  field: 'profile' | 'drink';
  transcript_fragment: string;
  candidates: Array<{ id: number; label: string }>;
}

export interface ParsedOrder {
  profile_id: number | null;
  items: ParsedOrderItem[];
  confidence: 'high' | 'medium' | 'low';
  ambiguities: ParsedAmbiguity[];
}

function buildSystemPrompt(menu: Drink[], profileList: Profile[]): string {
  const profilesPart = profileList
    .map((p) => `- id=${p.id}, name="${p.name}"`)
    .join('\n');
  const menuPart = menu
    .map((d) => `- id=${d.id}, name="${d.name}", category=${d.category}${d.description ? `, "${d.description.slice(0, 80)}"` : ''}`)
    .join('\n');
  return [
    'You translate a spoken drink order into strict JSON. Map names to the closest id from the lists below.',
    '',
    'Profiles:',
    profilesPart || '(none)',
    '',
    'Menu:',
    menuPart || '(none)',
    '',
    'Rules:',
    '- Output ONLY the JSON object specified by the schema. No prose, no markdown.',
    '- Use profile_id=null when the speaker does not name a person.',
    '- quantity is a positive integer (default 1).',
    '- For each unresolved profile/drink fragment, add an ambiguities entry with up to 3 candidates.',
    '- Set confidence "high" only when every drink + profile resolves cleanly; "low" when no items resolve.',
    '- The transcript comes from speech-to-text and may contain phonetic errors; map fragments to the closest-sounding profile/drink from the lists above.'
  ].join('\n');
}

function tryParseJson(content: string): ParsedOrder | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeParsedOrder(parsed);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return normalizeParsedOrder(parsed);
    } catch {
      return null;
    }
  }
}

function normalizeParsedOrder(raw: any): ParsedOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const profile_id = typeof raw.profile_id === 'number' && Number.isInteger(raw.profile_id)
    ? raw.profile_id
    : null;
  const items: ParsedOrderItem[] = Array.isArray(raw.items)
    ? raw.items
        .filter((it: any) => it && typeof it.drink_id === 'number')
        .map((it: any) => ({
          drink_id: Math.trunc(it.drink_id),
          quantity: Number.isInteger(it.quantity) && it.quantity > 0 ? it.quantity : 1,
          notes: typeof it.notes === 'string' && it.notes.trim() ? it.notes.trim() : null
        }))
    : [];
  const confidence: ParsedOrder['confidence'] =
    raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low'
      ? raw.confidence
      : items.length > 0
        ? 'medium'
        : 'low';
  const ambiguities: ParsedAmbiguity[] = Array.isArray(raw.ambiguities)
    ? raw.ambiguities
        .filter((a: any) => a && (a.field === 'profile' || a.field === 'drink'))
        .map((a: any) => ({
          field: a.field,
          transcript_fragment: typeof a.transcript_fragment === 'string' ? a.transcript_fragment : '',
          candidates: Array.isArray(a.candidates)
            ? a.candidates
                .filter((c: any) => c && typeof c.id === 'number')
                .slice(0, 3)
                .map((c: any) => ({ id: c.id, label: typeof c.label === 'string' ? c.label : String(c.id) }))
            : []
        }))
    : [];
  return { profile_id, items, confidence, ambiguities };
}

export async function parseOrder(transcript: string): Promise<ParsedOrder> {
  await yieldToDrinks();
  const menu = db.select().from(drinks).where(eq(drinks.active, true)).all();
  const profileList = db.select().from(profiles).where(eq(profiles.active, true)).all();
  const systemPrompt = buildSystemPrompt(menu, profileList);
  const model = (getSetting('gooby_rag_model') ?? 'gemma4-26b-heretic-128k').trim();

  const response = await fetch(`${llamaBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(PARSE_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0,
      max_tokens: 600,
      chat_template_kwargs: { enable_thinking: false, reasoning_effort: 'low' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transcript: "${transcript}"\n\nReturn the JSON now.` }
      ]
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`parseOrder non-ok ${response.status}: ${body.slice(0, 200)}`);
  }
  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('parseOrder: empty content');
  }
  const parsed = tryParseJson(content);
  if (!parsed) throw new Error('parseOrder: invalid JSON');
  return parsed;
}

export function isVoiceConfigured(): boolean {
  return whisperBaseUrl().length > 0;
}
