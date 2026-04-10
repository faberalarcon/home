import { getSetting } from './db/settings';
import { callService } from './ha';

// Message pools per milestone category, cycled in order
const MILESTONE_MESSAGES: Record<string, string[]> = {
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

function milestoneKey(threshold: number, scope: string): string | null {
  if (scope === 'daily' && threshold === 1) return 'first_daily';
  if (threshold === 5) return 'five';
  if (threshold === 10) return 'ten';
  return null;
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
  profileName: string;
  drinkName: string;
  firedMilestones: Array<{ threshold: number; scope: string }>;
};

const queue: TtsJob[] = [];
let processing = false;

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    await doAnnounce(job);
    // Brief pause between consecutive announcements
    if (queue.length > 0) await new Promise((r) => setTimeout(r, 400));
  }
  processing = false;
}

async function doAnnounce(job: TtsJob): Promise<void> {
  const enabled = getSetting('tts_enabled');
  if (!enabled || enabled === 'false' || enabled === '0') return;

  const mediaPlayerId = (getSetting('tts_entity_id') ?? '').trim();
  if (!mediaPlayerId) return;

  const engineId = (getSetting('tts_engine_id') ?? '').trim();

  const base = `${job.profileName} ordered a ${job.drinkName}.`;

  let extra: string | null = null;
  for (const m of job.firedMilestones) {
    const key = milestoneKey(m.threshold, m.scope);
    if (key) {
      extra = nextMessage(key);
      if (extra) break;
    }
  }

  const message = extra ? `${base} ${extra}` : base;

  const svcRaw = (getSetting('tts_service') ?? 'tts/speak').trim();
  const slash = svcRaw.indexOf('/');
  if (slash < 1) return;
  const domain = svcRaw.slice(0, slash);
  const service = svcRaw.slice(slash + 1);

  const serviceData: Record<string, string> =
    service === 'speak' && engineId
      ? { entity_id: engineId, media_player_entity_id: mediaPlayerId, message }
      : { entity_id: mediaPlayerId, message };

  const result = await callService(domain, service, serviceData);
  if (!result.success) {
    console.error(`[tts] ${domain}/${service} failed: ${result.error}`);
  }
}

export function announceDrinkOrder(
  profileId: number,
  profileName: string,
  drinkName: string,
  firedMilestones: Array<{ threshold: number; scope: string }>
): void {
  if (isRateLimited(profileId)) {
    console.log(`[tts] rate limit hit for profile ${profileId}, dropping announcement`);
    return;
  }
  queue.push({ profileName, drinkName, firedMilestones });
  processQueue().catch((err) => console.error('[tts] queue error:', err));
}
