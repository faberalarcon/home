// Multi-key, multi-context in-memory rate limiter.
// Keys are composed of: context + IP + optional session/id suffix.
// All state is in-process; acceptable for a single-node deployment.

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
  // Admin login: 3 attempts per 5 minutes
  'admin-login': { refillMs: 100_000, burst: 3, windowMs: 5 * 60_000, windowMax: 3 },
  // SSE: 10 new connections per minute
  sse: { refillMs: 6_000, burst: 10, windowMs: 60_000, windowMax: 10 },
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

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((profile.refillMs - (now - bucket.lastRefill)) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }
  if (bucket.windowCount >= profile.windowMax) {
    const retryAfter = Math.ceil((profile.windowMs - (now - bucket.windowStart)) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  bucket.tokens--;
  bucket.windowCount++;
  return { allowed: true };
}
