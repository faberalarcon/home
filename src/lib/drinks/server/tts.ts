import { getSetting } from './db/settings';
import { callService, getLightState } from './ha';
import { generateOrderQuip, generateMilestoneQuip, type OrderItem } from './tts-llm';
import { markDrinksActive } from './llm-priority';

// Message pools per milestone category, cycled in order.
// Keys are checked against the milestone's haTriggerEvent first (exact match),
// then fall back to threshold+scope for the legacy built-in milestones.
const MILESTONE_MESSAGES: Record<string, string[]> = {
  // --- built-in (legacy threshold+scope keys) ---
  first_daily: [
    'And so it begins. First drink of the day!',
    'Day one, drink one. Let the evening commence.',
    'The opening ceremony is officially underway.',
    'First sip of the day. No turning back now.',
    'And they are off!'
  ],
  five: [
    'Five drinks! The party is officially warming up.',
    'High five! Drink number five is in the books.',
    'Five down. Absolutely no signs of slowing.',
    'Five drinks in and the vibe is immaculate.',
    'Drink five. Legendary pace.'
  ],
  ten: [
    'Ten drinks. You are absolute legends.',
    'Double digits! This is a proper party now.',
    'T-E-N. Someone is having a very good time.',
    'Ten drinks achieved. The hall of fame awaits.',
    'Double digits. History is being made tonight.'
  ],
  fifteen: [
    'Fifteen drinks! This party is not messing around.',
    'One-five. The legend counter is going up.',
    'Fifteen rounds in. Commitment level: elite.',
    'Fifteen drinks. The bar has been set impossibly high.',
    'Drink number fifteen. Someone is definitely winning tonight.'
  ],
  twenty: [
    'Twenty drinks! Absolutely historic. Frame this moment.',
    'Two zero. This is not a party, this is a movement.',
    'Twenty drinks in. The stuff of legends. Future generations will speak of this.',
    'Twenty. The scoreboard is embarrassed. Impressive stuff.',
    'Drink twenty. The liver has left the chat. Everyone else is thriving.'
  ],

  // --- per-person milestones ---
  three_personal: [
    'Third personal drink! Warmed up and ready to go.',
    'Three down personally. The vibe is officially locked in.',
    'Drink three, personally. No longer just warming up.',
    'Personal round three. The trajectory is looking very interesting.',
    'Three in. Solid foundation. Let\'s see where this goes.'
  ],
  five_personal: [
    'Five personal drinks! Now we are talking.',
    'Personal high five! Drink number five for this individual.',
    'Five drinks, personally. This person is not playing around.',
    'Their fifth personal drink. Absolute dedication to the cause.',
    'Personal five. The commitment is real and it is spectacular.'
  ],
  eight_personal: [
    'Eight personal drinks. An absolutely elite performance.',
    'Personal drink eight. Someone is going for the high score.',
    'Eight rounds personally. The dedication here is something else entirely.',
    'Their eighth drink. Historically good. Medically questionable. Universally respected.',
    'Personal eight. We are witnessing something special tonight.'
  ],
  ten_personal: [
    'Ten personal drinks! A true champion of the evening.',
    'Double digits, personally! This is an all-time performance.',
    'Their tenth personal drink. A complete and total legend.',
    'Personal ten. Hall of fame. Right now. Immediately.',
    'Ten personal rounds. There are no words. Only respect.'
  ],

  // --- keyed by HA trigger event name ---
  all_time_15: [
    'Fifteen orders all time. The drinks log is officially a historic landmark.',
    'All-time drink fifteen! We are legends. Absolute, hydrated legends.',
    'Number fifteen, all-time. The scoreboard is getting embarrassing — in the best way.',
    'Fifteen all-time orders. The liver has filed a formal complaint. It was denied.',
    "We've hit fifteen all-time. Someone frame this moment."
  ],
  '6_7_drink_profile': [
    'Personal drink number six! Someone is not here to play games. They are here to win.',
    'Six personal orders. The body is a temple. This person is doing renovations.',
    'Drink six, personally. Going where few have gone before and looking fantastic doing it.',
    'Six drinks in personally. This is commitment. This is dedication. This is inspiring.',
    'Their sixth personal drink. Honestly? Respect. Absolute respect.'
  ]
};

const counters: Record<string, number> = {};

function nextMessage(key: string): string | null {
  const pool = MILESTONE_MESSAGES[key];
  if (!pool?.length) return null;
  const idx = (counters[key] ?? 0) % pool.length;
  counters[key] = idx + 1;
  return pool[idx];
}

function peekMessage(key: string): string | null {
  const pool = MILESTONE_MESSAGES[key];
  if (!pool?.length) return null;
  return pool[(counters[key] ?? 0) % pool.length];
}

function milestoneKey(threshold: number, scope: string, haTriggerEvent = ''): string | null {
  // Exact match by HA event name first — covers any admin-defined milestone
  if (haTriggerEvent && MILESTONE_MESSAGES[haTriggerEvent]) return haTriggerEvent;
  // Per-profile personal milestones
  if (scope === 'per_profile') {
    if (threshold === 3) return 'three_personal';
    if (threshold === 5) return 'five_personal';
    if (threshold === 8) return 'eight_personal';
    if (threshold === 10) return 'ten_personal';
  }
  // Total/daily/weekly milestones by threshold
  if (scope === 'daily' && threshold === 1) return 'first_daily';
  if (threshold === 5) return 'five';
  if (threshold === 10) return 'ten';
  if (threshold === 15) return 'fifteen';
  if (threshold === 20) return 'twenty';
  return null;
}

/** Returns the next TTS quip for a milestone, advancing the pool counter. */
export function nextMilestoneMessage(threshold: number, scope: string, haTriggerEvent: string): string | null {
  const key = milestoneKey(threshold, scope, haTriggerEvent);
  return key ? nextMessage(key) : null;
}

/** Peeks at the next TTS quip without advancing the counter. Used for HA event payloads. */
export function previewMilestoneText(threshold: number, scope: string, haTriggerEvent: string): string | null {
  const key = milestoneKey(threshold, scope, haTriggerEvent);
  return key ? peekMessage(key) : null;
}

// Per-profile rate limit: max 3 announcements per 60 seconds
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;
const profileTimestamps = new Map<number, number[]>();

function isRateLimited(profileId: number): boolean {
  const now = Date.now();
  const times = (profileTimestamps.get(profileId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) {
    profileTimestamps.set(profileId, times);
    return true;
  }
  times.push(now);
  profileTimestamps.set(profileId, times);
  return false;
}

// Sequential queue — processes one job at a time so announcements don't overlap
type TtsJob = {
  profileId: number;
  profileName: string;
  items: OrderItem[];
  allTimeCount?: number;
  todayCount?: number;
  firedMilestones: Array<{ name: string; threshold: number; scope: string; haTriggerEvent?: string }>;
};

/**
 * Natural-language join of items for TTS fallback / HA event payload.
 * 1× Martini → "martini"; 2× Flan → "2 flan"; mixed → oxford-comma list with "and".
 */
export function formatItemsForSpeech(items: OrderItem[]): string {
  const parts = items.map((it) => (it.quantity > 1 ? `${it.quantity} ${it.name}` : it.name));
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

const queue: TtsJob[] = [];
let processing = false;

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      try {
        await doAnnounce(job);
      } catch (err) {
        console.error('[tts] announcement failed, skipping:', err);
      }
      // Brief pause between consecutive announcements
      if (queue.length > 0) await new Promise((r) => setTimeout(r, 400));
    }
  } finally {
    processing = false;
  }
}

/** Returns a fully-saturated random RGB color as a [r, g, b] triple. */
function randomVibrantRgb(): [number, number, number] {
  const h = Math.random();
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const q = 1 - f;
  let r: number, g: number, b: number;
  switch (i % 6) {
    case 0: [r, g, b] = [1, f, 0]; break;
    case 1: [r, g, b] = [q, 1, 0]; break;
    case 2: [r, g, b] = [0, 1, f]; break;
    case 3: [r, g, b] = [0, q, 1]; break;
    case 4: [r, g, b] = [f, 0, 1]; break;
    default: [r, g, b] = [1, 0, q]; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pulse the configured lights entity twice with a random vivid color, then restore. */
async function flashLights(): Promise<void> {
  const entityId = (getSetting('lights_entity_id') ?? '').trim();
  if (!entityId) return;

  // Capture current state so we can restore afterwards
  const prev = await getLightState(entityId);

  const rgb = randomVibrantRgb();
  const on = (color: [number, number, number]) =>
    callService('light', 'turn_on', { entity_id: entityId, rgb_color: color, brightness: 255 });
  const off = () => callService('light', 'turn_off', { entity_id: entityId });

  // Two rapid color pulses
  await on(rgb);
  await sleep(350);
  await off();
  await sleep(200);
  await on(randomVibrantRgb()); // second pulse gets its own random color
  await sleep(350);
  await off();
  await sleep(150);

  // Restore previous state
  if (prev?.on) {
    const restore: Record<string, unknown> = { entity_id: entityId };
    if (prev.brightness !== undefined) restore.brightness = prev.brightness;
    if (prev.rgb !== undefined) restore.rgb_color = prev.rgb;
    else if (prev.colorTemp !== undefined) restore.color_temp = prev.colorTemp;
    await callService('light', 'turn_on', restore);
  }
  // If lights were already off, leave them off
}

type TtsConfig = {
  domain: string;
  service: string;
  serviceData: Record<string, string>;
};

function buildTtsConfig(message: string): { ok: true; config: TtsConfig } | { ok: false; reason: string } {
  const enabled = getSetting('tts_enabled');
  if (!enabled || enabled === 'false' || enabled === '0') {
    return { ok: false, reason: 'tts_enabled is off' };
  }

  const mediaPlayerId = (getSetting('tts_entity_id') ?? '').trim();
  if (!mediaPlayerId) {
    return { ok: false, reason: 'tts_entity_id is empty — set it in /admin/drinks/settings' };
  }

  const engineId = (getSetting('tts_engine_id') ?? '').trim();
  const svcRaw = (getSetting('tts_service') ?? 'tts/speak').trim();
  const slash = svcRaw.indexOf('/');
  if (slash < 1) {
    return { ok: false, reason: `tts_service "${svcRaw}" is malformed (expected "domain/service")` };
  }
  const domain = svcRaw.slice(0, slash);
  const service = svcRaw.slice(slash + 1);

  const serviceData: Record<string, string> =
    service === 'speak' && engineId
      ? { entity_id: engineId, media_player_entity_id: mediaPlayerId, message }
      : { entity_id: mediaPlayerId, message };

  return { ok: true, config: { domain, service, serviceData } };
}

async function ttsCall(message: string): Promise<void> {
  const built = buildTtsConfig(message);
  if (!built.ok) {
    console.warn(`[tts] skipped: ${built.reason}`);
    return;
  }
  const { domain, service, serviceData } = built.config;

  // Fire TTS and light flash in parallel — light flash is non-critical
  const [result] = await Promise.all([
    callService(domain, service, serviceData),
    flashLights()
  ]);
  if (!result.success) {
    console.error(`[tts] ${domain}/${service} failed: ${result.error}`);
  }
}

/** Speak a fixed test message and return a structured result for surfacing in the admin UI. */
export async function runTtsTest(message: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const built = buildTtsConfig(message);
  if (!built.ok) {
    return { ok: false, error: built.reason };
  }
  const { domain, service, serviceData } = built.config;
  try {
    const result = await callService(domain, service, serviceData);
    if (!result.success) {
      return { ok: false, error: `${domain}/${service}: ${result.error}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function doAnnounce(job: TtsJob): Promise<void> {
  const llmOrder = await generateOrderQuip({
    profileName: job.profileName,
    items: job.items,
    allTimeCount: job.allTimeCount,
    todayCount: job.todayCount
  });
  const base = llmOrder ?? `${job.profileName} ordered ${formatItemsForSpeech(job.items)}.`;

  let extra: string | null = null;
  for (const m of job.firedMilestones) {
    const llmMilestone = await generateMilestoneQuip({
      milestoneName: m.name,
      scope: m.scope,
      threshold: m.threshold,
      profileName: job.profileName,
      items: job.items
    });
    if (llmMilestone) {
      extra = llmMilestone;
      break;
    }
    const key = milestoneKey(m.threshold, m.scope, m.haTriggerEvent ?? '');
    if (key) {
      extra = nextMessage(key);
      if (extra) break;
    }
  }

  await ttsCall(extra ? `${base} ${extra}` : base);
}

/** Speak any arbitrary message through TTS — bypasses rate limiting and queue. */
export async function speakText(message: string): Promise<void> {
  await ttsCall(message);
}

export function announceDrinkOrder(
  profileId: number,
  profileName: string,
  items: OrderItem[],
  allTimeCount: number | undefined,
  todayCount: number | undefined,
  firedMilestones: Array<{ name: string; threshold: number; scope: string; haTriggerEvent?: string }>
): void {
  markDrinksActive();
  if (isRateLimited(profileId)) {
    console.log(`[tts] rate limit hit for profile ${profileId}, dropping announcement`);
    return;
  }
  queue.push({ profileId, profileName, items, allTimeCount, todayCount, firedMilestones });
  processQueue().catch((err) => console.error('[tts] queue error:', err));
}
