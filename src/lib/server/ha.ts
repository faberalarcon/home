import { db } from './db/index';
import { haEventsLog } from './db/schema';
import { getSetting, setSetting } from './db/settings';

const TIMEOUT_MS = 3000;

export async function callService(
  domain: string,
  service: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getSetting('ha_base_url') ?? '';
  const token = getSetting('ha_token') ?? '';

  if (!token || !baseUrl) {
    return { success: false, error: 'HA not configured' };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) return { success: true };
    return { success: false, error: `HTTP ${res.status} ${res.statusText}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getLightState(entityId: string): Promise<{
  on: boolean;
  brightness?: number;
  rgb?: [number, number, number];
  colorTemp?: number;
} | null> {
  const baseUrl = getSetting('ha_base_url') ?? '';
  const token = getSetting('ha_token') ?? '';
  if (!token || !baseUrl) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/states/${encodeURIComponent(entityId)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = await res.json() as { state: string; attributes: Record<string, unknown> };
    const a = body.attributes;
    return {
      on: body.state === 'on',
      brightness: typeof a.brightness === 'number' ? a.brightness : undefined,
      rgb: Array.isArray(a.rgb_color) && a.rgb_color.length === 3
        ? a.rgb_color as [number, number, number]
        : undefined,
      colorTemp: typeof a.color_temp === 'number' ? a.color_temp : undefined
    };
  } catch {
    return null;
  }
}

export async function fireEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getSetting('ha_base_url') ?? '';
  const token = getSetting('ha_token') ?? '';
  const payloadJson = JSON.stringify(payload);

  const logAndReturn = (success: boolean, errorMsg: string) => {
    db.insert(haEventsLog).values({ eventType, payload: payloadJson, success, error: errorMsg }).run();
    console.warn(`[ha] ${eventType} skipped: ${errorMsg}`);
    setSetting('ha_last_error', `${eventType}: ${errorMsg}`);
    return { success, error: errorMsg };
  };

  if (!token) return logAndReturn(false, 'no token configured');
  if (!baseUrl) return logAndReturn(false, 'no base URL configured');

  const url = `${baseUrl.replace(/\/$/, '')}/api/events/${encodeURIComponent(eventType)}`;

  let success = false;
  let errorMsg: string | undefined;

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
      errorMsg = `HTTP ${res.status} ${res.statusText}`;
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  db.insert(haEventsLog)
    .values({
      eventType,
      payload: payloadJson,
      success,
      error: errorMsg ?? null
    })
    .run();

  if (!success && errorMsg) {
    console.error(`[ha] event ${eventType} failed: ${errorMsg}`);
    setSetting('ha_last_error', `${eventType}: ${errorMsg}`);
  } else if (success) {
    setSetting('ha_last_error', '');
  }

  return { success, error: errorMsg };
}
