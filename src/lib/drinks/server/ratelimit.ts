// Multi-key, multi-context in-memory rate limiter.
// Keys are composed of: context + IP + optional session/id suffix.
// All state is in-process; acceptable for a single-node deployment.

import { getSetting, setSetting } from './db/settings';

interface Bucket {
  tokens: number;
  lastRefill: number;
  windowCount: number;
  windowStart: number;
}

// Limit profiles: { refillMs, burst, windowMs, windowMax }
interface LimitProfile {
  refillMs: number;  // ms between token refills
  burst: number;     // max tokens (= max burst size)
  windowMs: number;  // rolling window length
  windowMax: number; // max requests in that window
}

const PROFILES: Record<string, LimitProfile> = {
  // Order placement: 1 order per 3 s, max 10 per minute
  order: { refillMs: 3_000, burst: 1, windowMs: 60_000, windowMax: 10 },
  // Site login: 5 attempts per 5 minutes
  login: { refillMs: 60_000, burst: 5, windowMs: 5 * 60_000, windowMax: 5 },
  // GoobyGPT login: 5 attempts per 5 minutes
  'gooby-login': { refillMs: 60_000, burst: 5, windowMs: 5 * 60_000, windowMax: 5 },
  // Admin login: 3 attempts per 5 minutes (per IP bucket).
  // A separate global persistent backoff (see checkAdminLoginGlobal) makes
  // rotating X-Forwarded-For ineffective against the admin endpoint.
  'admin-login': { refillMs: 100_000, burst: 3, windowMs: 5 * 60_000, windowMax: 3 },
  // SSE: 10 new connections per minute
  sse: { refillMs: 6_000, burst: 10, windowMs: 60_000, windowMax: 10 },
  // Voice ordering: 1 transcript per 5s, 12 per minute
  voice: { refillMs: 5_000, burst: 1, windowMs: 60_000, windowMax: 12 },
};

const buckets = new Map<string, Bucket>();

// Periodically sweep stale buckets to prevent unbounded memory growth.
const SWEEP_INTERVAL_MS = 10 * 60_000;
const MAX_BUCKET_AGE_MS = 30 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > MAX_BUCKET_AGE_MS && now - bucket.lastRefill > MAX_BUCKET_AGE_MS) {
      buckets.delete(key);
    }
  }
}, SWEEP_INTERVAL_MS).unref();

export function checkRateLimit(
  context: keyof typeof PROFILES,
  ip: string,
  secondary = ''
): { allowed: boolean; retryAfter?: number } {
  const profile = PROFILES[context] ?? PROFILES.order;
  const key = `${context}:${ip}:${secondary}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: profile.burst, lastRefill: now, windowCount: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  // Reset rolling window
  if (now - bucket.windowStart >= profile.windowMs) {
    bucket.windowCount = 0;
    bucket.windowStart = now;
  }

  // Refill tokens
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= profile.refillMs) {
    bucket.tokens = Math.min(profile.burst, bucket.tokens + Math.floor(elapsed / profile.refillMs));
    bucket.lastRefill = now;
  }

  // Every attempt counts toward the rolling window, allowed or not — otherwise a
  // sustained burst never trips windowMax once the token bucket is empty.
  bucket.windowCount++;

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((profile.refillMs - (now - bucket.lastRefill)) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }
  if (bucket.windowCount > profile.windowMax) {
    const retryAfter = Math.ceil((profile.windowMs - (now - bucket.windowStart)) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  bucket.tokens--;
  return { allowed: true };
}

/**
 * Global (IP-independent) persistent backoff for admin-login failures.
 *
 * Rationale: the per-IP limiter above is defeated by X-Forwarded-For rotation
 * whenever the app runs behind a reverse proxy that populates the client
 * address header. This second check is keyed on nothing the attacker can
 * rotate, so 10k-PIN / dictionary brute-force slows to a crawl regardless of
 * how many source IPs they have.
 *
 * Escalation schedule (consecutive failures since last success):
 *   1–2   → 0s
 *   3–5   → 5s
 *   6–9   → 60s
 *  10–19  → 300s (5 min)
 *  20+    → 1800s (30 min)
 */
export function checkAdminLoginGlobal(): { allowed: boolean; retryAfter?: number } {
  const until = Number(getSetting('admin_login_lockout_until') ?? '0') || 0;
  const now = Date.now();
  if (until > now) {
    return { allowed: false, retryAfter: Math.ceil((until - now) / 1000) };
  }
  return { allowed: true };
}

function escalationSeconds(failures: number): number {
  if (failures < 3) return 0;
  if (failures < 6) return 5;
  if (failures < 10) return 60;
  if (failures < 20) return 300;
  return 1800;
}

export function recordAdminLoginFailure(): void {
  const failures = (Number(getSetting('admin_login_failures') ?? '0') || 0) + 1;
  setSetting('admin_login_failures', String(failures));
  const cooldown = escalationSeconds(failures);
  if (cooldown > 0) {
    setSetting('admin_login_lockout_until', String(Date.now() + cooldown * 1000));
    console.warn(`[auth] admin-login global backoff armed: ${cooldown}s after ${failures} failures`);
  }
}

export function clearAdminLoginFailures(): void {
  setSetting('admin_login_failures', '0');
  setSetting('admin_login_lockout_until', '0');
}
