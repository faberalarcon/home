import { fetch, type Dispatcher } from 'undici';
import { db } from './db/index';
import { haEventsLog } from './db/schema';
import { getSetting, setSetting } from './db/settings';
import { buildPinnedDispatcher, validateOutboundUrl } from './url-allowlist';

const TIMEOUT_MS = 3000;

type ResolvedHaTarget = { url: string; token: string; dispatcher: Dispatcher };

async function resolveHaTarget(path: string): Promise<ResolvedHaTarget | { error: string }> {
  const baseUrl = getSetting('ha_base_url') ?? '';
  const token = getSetting('ha_token') ?? '';
  if (!token) return { error: 'no token configured' };
  if (!baseUrl) return { error: 'no base URL configured' };

  const check = await validateOutboundUrl(baseUrl);
  if (!check.ok || !check.url || !check.addresses?.length) {
    return { error: check.error ?? 'invalid HA base URL' };
  }

  const clean = `${check.url.origin}${check.url.pathname.replace(/\/$/, '')}`;
  return { url: `${clean}${path}`, token, dispatcher: buildPinnedDispatcher(check.addresses) };
}

/**
 * Shared HA health probe — validates the base URL, pins DNS, and issues a
 * single bearer-authenticated GET to /api/. Returns the upstream Response
 * (caller closes it) or an error string. Used by admin pages so we don't
 * duplicate the validation/pinning logic.
 */
export async function haHealthFetch(
  baseUrl: string,
  token: string,
  timeoutMs: number
): Promise<{ ok: true; status: number } | { ok: false; error: string }> {
  if (!baseUrl || !token) return { ok: false, error: 'URL and token are required' };
  const check = await validateOutboundUrl(baseUrl);
  if (!check.ok || !check.url || !check.addresses?.length) {
    return { ok: false, error: check.error ?? 'invalid HA base URL' };
  }
  const dispatcher = buildPinnedDispatcher(check.addresses);
  const cleanOrigin = `${check.url.origin}${check.url.pathname.replace(/\/$/, '')}`;
  try {
    const res = await fetch(`${cleanOrigin}/api/`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
      dispatcher
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Health probe for /api/health. Returns 'unconfigured' when HA isn't set up,
 * 'ok' when HA responds 2xx, 'degraded' on any other failure (invalid URL,
 * network error, non-2xx). Always routes through validateOutboundUrl so a
 * misconfigured ha_base_url never leaks the bearer token.
 */
export async function probeHa(timeoutMs = 2000): Promise<'ok' | 'degraded' | 'unconfigured'> {
  const resolved = await resolveHaTarget('/api/');
  if ('error' in resolved) {
    // Only 'no token' / 'no base URL' counts as unconfigured; a bad URL is degraded.
    if (resolved.error === 'no token configured' || resolved.error === 'no base URL configured') {
      return 'unconfigured';
    }
    return 'degraded';
  }
  try {
    const res = await fetch(resolved.url, {
      headers: { Authorization: `Bearer ${resolved.token}` },
      signal: AbortSignal.timeout(timeoutMs),
      dispatcher: resolved.dispatcher
    });
    return res.ok ? 'ok' : 'degraded';
  } catch {
    return 'degraded';
  }
}

export async function callService(
  domain: string,
  service: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const resolved = await resolveHaTarget(
    `/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`
  );
  if ('error' in resolved) return { success: false, error: resolved.error };
  const { url, token, dispatcher } = resolved;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
      dispatcher
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
  const resolved = await resolveHaTarget(`/api/states/${encodeURIComponent(entityId)}`);
  if ('error' in resolved) return null;
  const { url, token, dispatcher } = resolved;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(
      url,
      { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, dispatcher }
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
  const payloadJson = JSON.stringify(payload);

  const logAndReturn = (success: boolean, errorMsg: string) => {
    db.insert(haEventsLog).values({ eventType, payload: payloadJson, success, error: errorMsg }).run();
    console.warn(`[ha] ${eventType} skipped: ${errorMsg}`);
    setSetting('ha_last_error', `${eventType}: ${errorMsg}`);
    return { success, error: errorMsg };
  };

  const resolved = await resolveHaTarget(`/api/events/${encodeURIComponent(eventType)}`);
  if ('error' in resolved) return logAndReturn(false, resolved.error);
  const { url, token, dispatcher } = resolved;

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
      signal: controller.signal,
      dispatcher
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
