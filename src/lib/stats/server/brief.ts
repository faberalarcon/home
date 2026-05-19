import { readFile } from 'node:fs/promises';
import { eq, sql, desc, count } from 'drizzle-orm';
import { db } from '$lib/drinks/server/db';
import { dailyBriefs, drinks, orders, profiles, haEventsLog } from '$lib/drinks/server/db/schema';
import { getSetting } from '$lib/drinks/server/db/settings';
import { callService } from '$lib/drinks/server/ha';
import { getCurrentWeather, getDailyForecast, weatherCodeToDescription } from './weather';
import { getUniqueVisitorCount } from './visitors';

const DEFAULT_BRIEF_MODEL = 'gemma4-26b-heretic-128k';
const PI_METRICS_FILE = '/var/lib/bristoe-stats/pi-metrics.jsonl';
const LOCAL_TZ = 'America/New_York';

export interface BriefFacts {
  date: string;
  drinks: {
    total: number;
    topDrink: { name: string; count: number } | null;
    topDrinker: { name: string; count: number } | null;
    byCategory: { category: string; count: number }[];
  };
  pi: {
    samples: number;
    peakTempC: number | null;
    peakLoad: number | null;
    avgCpuPct: number | null;
  };
  weather: {
    currentF: number | null;
    currentDesc: string | null;
    yesterdayHighF: number | null;
    yesterdayLowF: number | null;
    rainInches: number | null;
  };
  visitors: { total: number | null };
  ha: { events24h: number; errors24h: number; lastError: string | null };
}

export interface BriefRecord {
  id: number;
  date: string;
  narrative: string;
  payload: BriefFacts;
  model: string | null;
  createdAt: number;
}

function llamaBaseUrl(): string {
  return (process.env.LLAMA_BASE_URL ?? 'http://192.168.1.215:8080').replace(/\/+$/, '');
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function localDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LOCAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function localDayBoundsSec(dateKey: string): { startSec: number; endSec: number } {
  // dateKey is YYYY-MM-DD in LOCAL_TZ. Find the UTC instant for 00:00 local that day,
  // and the UTC instant for 24h later.
  const [y, m, d] = dateKey.split('-').map(Number);
  // Start with a UTC midnight, then nudge by the TZ offset for that calendar day.
  const utcMidnight = Date.UTC(y, m - 1, d);
  const tzOffsetMin = tzOffsetMinutesAt(utcMidnight, LOCAL_TZ);
  const startMs = utcMidnight + tzOffsetMin * 60_000;
  return { startSec: Math.floor(startMs / 1000), endSec: Math.floor(startMs / 1000) + 86_400 };
}

function tzOffsetMinutesAt(utcMs: number, tz: string): number {
  // Returns minutes to ADD to a UTC timestamp to get wall-clock time in tz.
  // Negative for zones west of UTC.
  const date = new Date(utcMs);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const wall = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === '24' ? '0' : map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((wall - utcMs) / 60_000);
}

export function yesterdayKey(reference: Date = new Date()): string {
  const todayKey = localDateKey(reference);
  const { startSec } = localDayBoundsSec(todayKey);
  return localDateKey(new Date((startSec - 86_400) * 1000 + 12 * 3_600_000));
}

interface PiSample {
  t: number;
  cpuPct?: number | null;
  tempC?: number | null;
  load1?: number | null;
}

async function readPiSamples(startMs: number, endMs: number): Promise<PiSample[]> {
  try {
    const raw = await readFile(PI_METRICS_FILE, 'utf8');
    const out: PiSample[] = [];
    for (const line of raw.split('\n')) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (typeof obj.t !== 'number') continue;
        if (obj.t < startMs || obj.t >= endMs) continue;
        out.push(obj);
      } catch {
        // skip malformed line
      }
    }
    return out;
  } catch {
    return [];
  }
}

function aggregatePi(samples: PiSample[]): BriefFacts['pi'] {
  if (samples.length === 0) {
    return { samples: 0, peakTempC: null, peakLoad: null, avgCpuPct: null };
  }
  let peakTemp: number | null = null;
  let peakLoad: number | null = null;
  let cpuSum = 0;
  let cpuCount = 0;
  for (const s of samples) {
    if (typeof s.tempC === 'number' && (peakTemp === null || s.tempC > peakTemp)) peakTemp = s.tempC;
    if (typeof s.load1 === 'number' && (peakLoad === null || s.load1 > peakLoad)) peakLoad = s.load1;
    if (typeof s.cpuPct === 'number') {
      cpuSum += s.cpuPct;
      cpuCount += 1;
    }
  }
  return {
    samples: samples.length,
    peakTempC: peakTemp,
    peakLoad: peakLoad,
    avgCpuPct: cpuCount > 0 ? Math.round((cpuSum / cpuCount) * 10) / 10 : null
  };
}

function collectDrinkFacts(startSec: number, endSec: number): BriefFacts['drinks'] {
  const where = sql`${orders.status} != 'deleted' AND ${orders.createdAt} >= ${startSec} AND ${orders.createdAt} < ${endSec}`;

  const total = db.select({ c: count() }).from(orders).where(where).get()?.c ?? 0;

  const topDrinkRow = db
    .select({ name: drinks.name, c: count() })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(where)
    .groupBy(drinks.id)
    .orderBy(desc(count()))
    .limit(1)
    .get();

  const topDrinkerRow = db
    .select({ name: profiles.name, c: count() })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .where(where)
    .groupBy(profiles.id)
    .orderBy(desc(count()))
    .limit(1)
    .get();

  const byCategoryRows = db
    .select({ category: drinks.category, c: count() })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(where)
    .groupBy(drinks.category)
    .orderBy(desc(count()))
    .all();

  return {
    total,
    topDrink: topDrinkRow ? { name: topDrinkRow.name, count: topDrinkRow.c } : null,
    topDrinker: topDrinkerRow ? { name: topDrinkerRow.name, count: topDrinkerRow.c } : null,
    byCategory: byCategoryRows.map((r) => ({ category: r.category, count: r.c }))
  };
}

function collectHaFacts(startSec: number, endSec: number): BriefFacts['ha'] {
  const total = db
    .select({ c: count() })
    .from(haEventsLog)
    .where(sql`${haEventsLog.createdAt} >= ${startSec} AND ${haEventsLog.createdAt} < ${endSec}`)
    .get()?.c ?? 0;
  const errors = db
    .select({ c: count() })
    .from(haEventsLog)
    .where(sql`${haEventsLog.createdAt} >= ${startSec} AND ${haEventsLog.createdAt} < ${endSec} AND ${haEventsLog.success} = 0`)
    .get()?.c ?? 0;
  const lastErrorRow = db
    .select({ error: haEventsLog.error })
    .from(haEventsLog)
    .where(sql`${haEventsLog.createdAt} >= ${startSec} AND ${haEventsLog.createdAt} < ${endSec} AND ${haEventsLog.success} = 0`)
    .orderBy(desc(haEventsLog.createdAt))
    .limit(1)
    .get();
  return { events24h: total, errors24h: errors, lastError: lastErrorRow?.error ?? null };
}

async function collectWeatherFacts(targetDateKey: string): Promise<BriefFacts['weather']> {
  let currentF: number | null = null;
  let currentDesc: string | null = null;
  let yesterdayHighF: number | null = null;
  let yesterdayLowF: number | null = null;
  let rainInches: number | null = null;
  try {
    const current = await getCurrentWeather();
    currentF = Math.round(current.temperature);
    currentDesc = weatherCodeToDescription(current.weatherCode, current.isDay).text;
  } catch {
    // weather optional
  }
  try {
    const forecast = await getDailyForecast();
    const match = forecast.find((d) => d.date === targetDateKey);
    if (match) {
      yesterdayHighF = Math.round(match.tempMax);
      yesterdayLowF = Math.round(match.tempMin);
      rainInches = Math.round(match.precipitationSum * 100) / 100;
    }
  } catch {
    // forecast optional
  }
  return { currentF, currentDesc, yesterdayHighF, yesterdayLowF, rainInches };
}

export async function collectBriefFacts(dateKey: string = yesterdayKey()): Promise<BriefFacts> {
  const { startSec, endSec } = localDayBoundsSec(dateKey);
  const piSamples = await readPiSamples(startSec * 1000, endSec * 1000);
  const visitors = await getUniqueVisitorCount();
  const weather = await collectWeatherFacts(dateKey);
  return {
    date: dateKey,
    drinks: collectDrinkFacts(startSec, endSec),
    pi: aggregatePi(piSamples),
    weather,
    visitors: { total: visitors?.count ?? null },
    ha: collectHaFacts(startSec, endSec)
  };
}

function defaultSystemPrompt(): string {
  return (
    getSetting('daily_brief_system_prompt') ??
    'You are the steward of 21 Bristoe writing a one-paragraph daily brief for the household. Tone: warm, dry, observational — like a butler who has seen the whole day at once and is now reporting back. Use the structured facts I give you. Mention the drink count and top drink if non-zero; otherwise skip drinks. Mention the weather only if notable (rain, extreme temps). Mention Pi peak temp only if above 70C. Mention HA errors only if non-zero. Hard rules: 2-4 sentences total, under 60 words, no lists, no emojis, no quotes, no preamble. Output ONLY the brief paragraph.'
  );
}

function buildUserPrompt(facts: BriefFacts): string {
  return JSON.stringify(facts, null, 0);
}

export async function generateNarrative(
  facts: BriefFacts,
  modelOverride?: string
): Promise<{ narrative: string; model: string }> {
  const model = (modelOverride ?? getSetting('daily_brief_model') ?? DEFAULT_BRIEF_MODEL).trim();
  const url = `${llamaBaseUrl()}/v1/chat/completions`;
  const body = {
    model,
    max_tokens: 400,
    temperature: 0.7,
    messages: [
      { role: 'system', content: defaultSystemPrompt() },
      { role: 'user', content: buildUserPrompt(facts) }
    ],
    // Try to suppress thinking output if the chat template supports it.
    chat_template_kwargs: { enable_thinking: false }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000)
  });
  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? '';
  const narrative = sanitizeNarrative(raw);
  if (!narrative) {
    throw new Error('LLM returned empty narrative');
  }
  return { narrative, model };
}

export function sanitizeNarrative(raw: string): string {
  if (typeof raw !== 'string') return '';
  let s = raw.replace(/\r\n/g, '\n').trim();
  // Strip <think>...</think> blocks if the model leaked them.
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Drop common preambles.
  s = s.replace(/^(sure|okay|here(?:'s| is| you go)[^a-z]*)[:,]?\s*/i, '');
  // Collapse internal whitespace but preserve paragraph breaks.
  s = s.replace(/[ \t]+/g, ' ').trim();
  // Cap length defensively.
  if (s.length > 600) s = s.slice(0, 600).trim();
  return s;
}

export function persistBrief(
  facts: BriefFacts,
  narrative: string,
  model: string
): BriefRecord {
  const payload = JSON.stringify(facts);
  // Upsert by date so re-runs replace.
  const existing = db.select().from(dailyBriefs).where(eq(dailyBriefs.date, facts.date)).get();
  if (existing) {
    db.update(dailyBriefs)
      .set({ narrative, payload, model })
      .where(eq(dailyBriefs.date, facts.date))
      .run();
    return {
      id: existing.id,
      date: facts.date,
      narrative,
      payload: facts,
      model,
      createdAt:
        typeof existing.createdAt === 'number'
          ? existing.createdAt
          : Math.floor((existing.createdAt as unknown as Date).getTime() / 1000)
    };
  }
  const row = db
    .insert(dailyBriefs)
    .values({ date: facts.date, narrative, payload, model })
    .returning()
    .get();
  return {
    id: row.id,
    date: row.date,
    narrative: row.narrative,
    payload: facts,
    model: row.model ?? null,
    createdAt:
      typeof row.createdAt === 'number'
        ? row.createdAt
        : Math.floor((row.createdAt as unknown as Date).getTime() / 1000)
  };
}

export async function notifyHa(brief: BriefRecord): Promise<{ delivered: boolean; error?: string }> {
  const service = (getSetting('daily_brief_notify_service') ?? '').trim();
  if (!service) return { delivered: false, error: 'no notify service configured' };
  const [domain, name] = service.split('.');
  if (!domain || !name) return { delivered: false, error: `invalid service "${service}"` };
  const title = `21 Bristoe — ${brief.date}`;
  const message = brief.narrative.length > 180 ? `${brief.narrative.slice(0, 177)}…` : brief.narrative;
  const result = await callService(domain, name, { title, message });
  return { delivered: result.success, error: result.error };
}

export interface RunResult {
  brief: BriefRecord;
  notified: boolean;
  notifyError?: string;
}

export async function runDailyBrief(options: { date?: string; model?: string } = {}): Promise<RunResult> {
  const dateKey = options.date ?? yesterdayKey();
  const facts = await collectBriefFacts(dateKey);
  const { narrative, model } = await generateNarrative(facts, options.model);
  const brief = persistBrief(facts, narrative, model);
  const notify = await notifyHa(brief);
  return { brief, notified: notify.delivered, notifyError: notify.error };
}

export function listBriefs(limit = 30): BriefRecord[] {
  const rows = db
    .select()
    .from(dailyBriefs)
    .orderBy(desc(dailyBriefs.date))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    narrative: r.narrative,
    payload: safeParseFacts(r.payload),
    model: r.model ?? null,
    createdAt:
      typeof r.createdAt === 'number'
        ? r.createdAt
        : Math.floor((r.createdAt as unknown as Date).getTime() / 1000)
  }));
}

function safeParseFacts(raw: string): BriefFacts {
  try {
    return JSON.parse(raw) as BriefFacts;
  } catch {
    return {
      date: '',
      drinks: { total: 0, topDrink: null, topDrinker: null, byCategory: [] },
      pi: { samples: 0, peakTempC: null, peakLoad: null, avgCpuPct: null },
      weather: { currentF: null, currentDesc: null, yesterdayHighF: null, yesterdayLowF: null, rainInches: null },
      visitors: { total: null },
      ha: { events24h: 0, errors24h: 0, lastError: null }
    };
  }
}
