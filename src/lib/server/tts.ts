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

let lastAnnouncedAt = 0;
const COOLDOWN_MS = 60_000;

export async function announceDrinkOrder(
  profileName: string,
  drinkName: string,
  firedMilestones: Array<{ threshold: number; scope: string }>
): Promise<void> {
  const enabled = getSetting('tts_enabled');
  if (!enabled || enabled === 'false' || enabled === '0') return;

  // tts_entity_id = the media player (e.g. media_player.living_room_speaker)
  const mediaPlayerId = (getSetting('tts_entity_id') ?? '').trim();
  if (!mediaPlayerId) return;

  // tts_engine_id = the TTS engine entity (e.g. tts.google_translate_en_com)
  // Optional — only needed for tts/speak. Falls back to media player entity for legacy services.
  const engineId = (getSetting('tts_engine_id') ?? '').trim();

  const now = Date.now();
  if (now - lastAnnouncedAt < COOLDOWN_MS) return;
  lastAnnouncedAt = now;

  const base = `${profileName} ordered a ${drinkName}.`;

  let extra: string | null = null;
  for (const m of firedMilestones) {
    const key = milestoneKey(m.threshold, m.scope);
    if (key) {
      extra = nextMessage(key);
      if (extra) break;
    }
  }

  const message = extra ? `${base} ${extra}` : base;

  // Service stored as "domain/service", e.g. "tts/speak"
  const svcRaw = (getSetting('tts_service') ?? 'tts/speak').trim();
  const slash = svcRaw.indexOf('/');
  if (slash < 1) return;
  const domain = svcRaw.slice(0, slash);
  const service = svcRaw.slice(slash + 1);

  // tts/speak uses entity_id for the engine and media_player_entity_id for the player.
  // Legacy services (cloud_say, google_translate_say) use entity_id for the player.
  const serviceData: Record<string, string> =
    service === 'speak' && engineId
      ? { entity_id: engineId, media_player_entity_id: mediaPlayerId, message }
      : { entity_id: mediaPlayerId, message };

  const result = await callService(domain, service, serviceData);
  if (!result.success) {
    console.error(`[tts] ${domain}/${service} failed: ${result.error}`);
  }
}
