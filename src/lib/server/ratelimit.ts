// In-memory token bucket rate limiter keyed by profile_id.
// 1 order per 3 seconds, max 10 per minute.

interface Bucket {
  tokens: number;
  lastRefill: number;
  minuteCount: number;
  minuteStart: number;
}

const buckets = new Map<number, Bucket>();

export function checkRateLimit(profileId: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let bucket = buckets.get(profileId);

  if (!bucket) {
    bucket = { tokens: 1, lastRefill: now, minuteCount: 0, minuteStart: now };
    buckets.set(profileId, bucket);
  }

  // Reset minute window
  if (now - bucket.minuteStart >= 60_000) {
    bucket.minuteCount = 0;
    bucket.minuteStart = now;
  }

  // Refill: 1 token per 3 seconds
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= 3_000) {
    bucket.tokens = Math.min(1, bucket.tokens + Math.floor(elapsed / 3_000));
    bucket.lastRefill = now;
  }

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((3_000 - (now - bucket.lastRefill)) / 1000);
    return { allowed: false, retryAfter };
  }
  if (bucket.minuteCount >= 10) {
    const retryAfter = Math.ceil((60_000 - (now - bucket.minuteStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  bucket.tokens--;
  bucket.minuteCount++;
  return { allowed: true };
}
