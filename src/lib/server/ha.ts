import { db } from './db/index';
import { haEventsLog } from './db/schema';
import { getSetting } from './db/settings';

const TIMEOUT_MS = 3000;

export async function fireEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getSetting('ha_base_url') ?? '';
  const token = getSetting('ha_token') ?? '';
  const payloadJson = JSON.stringify(payload);

  const logAndReturn = (success: boolean, error: string) => {
    db.insert(haEventsLog).values({ eventType, payload: payloadJson, success, error }).run();
    console.warn(`[ha] ${eventType} skipped: ${error}`);
    return { success, error };
  };

  if (!token) return logAndReturn(false, 'no token configured');
  if (!baseUrl) return logAndReturn(false, 'no base URL configured');

  const url = `${baseUrl.replace(/\/$/, '')}/api/events/${encodeURIComponent(eventType)}`;

  let success = false;
  let error: string | undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: payloadJson,
      signal: controller.signal
    });

    clearTimeout(timer);

    if (res.ok) {
      success = true;
    } else {
      error = `HTTP ${res.status} ${res.statusText}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  db.insert(haEventsLog)
    .values({
      eventType,
      payload: payloadJson,
      success,
      error: error ?? null
    })
    .run();

  if (!success) {
    console.error(`[ha] event ${eventType} failed: ${error}`);
  }

  return { success, error };
}
