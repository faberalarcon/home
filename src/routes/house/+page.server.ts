import { getStates, getHistory, ENTITIES } from '$lib/server/home-assistant';
import { getDailyForecast } from '$lib/server/weather';
import type { PageServerLoad } from './$types';

const RANGES = {
  '1d': { days: 1, buckets: 24, bucketMs: 3600000, bucketLabel: 'hour' },
  '7d': { days: 7, buckets: 7, bucketMs: 86400000, bucketLabel: 'day' },
  '30d': { days: 30, buckets: 30, bucketMs: 86400000, bucketLabel: 'day' },
  '90d': { days: 90, buckets: 90, bucketMs: 86400000, bucketLabel: 'day' }
} as const;

type RangeKey = keyof typeof RANGES;

function parseRange(v: string | null): RangeKey {
  if (v === '1d' || v === '7d' || v === '30d' || v === '90d') return v;
  return '7d';
}

export const load: PageServerLoad = async ({ url }) => {
  const range = parseRange(url.searchParams.get('range'));
  const { days, buckets, bucketMs, bucketLabel } = RANGES[range];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rangeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    haStates,
    indoorHistory,
    outdoorHistory,
    bedroomTVHistory,
    livingTVHistory,
    forecast
  ] = await Promise.all([
    getStates(Object.values(ENTITIES)).catch(() => new Map()),
    getHistory(ENTITIES.indoorTemp, sevenDaysAgo).catch(() => []),
    getHistory(ENTITIES.outdoorTemp, sevenDaysAgo).catch(() => []),
    getHistory(ENTITIES.bedroomTV, rangeStart).catch(() => []),
    getHistory(ENTITIES.livingRoomTV, rangeStart).catch(() => []),
    getDailyForecast().catch(() => [])
  ]);

  const get = (key: keyof typeof ENTITIES) => {
    const s = haStates.get(ENTITIES[key]);
    return s ? { state: s.state, attrs: s.attributes } : null;
  };

  // Hourly-bucketed mean for temp lines over last 7 days
  function bucketHourly(
    history: { state: string; last_changed: string }[],
    buckets = 48
  ): { time: string; value: number }[] {
    if (!history.length) return [];
    const now = Date.now();
    const oldest = now - buckets * 3600000;
    const bucketSize = (now - oldest) / buckets;
    const result: { sum: number; count: number }[] = Array.from({ length: buckets }, () => ({ sum: 0, count: 0 }));

    for (const entry of history) {
      const val = parseFloat(entry.state);
      if (isNaN(val)) continue;
      const ts = new Date(entry.last_changed).getTime();
      if (ts < oldest) continue;
      const idx = Math.min(Math.floor((ts - oldest) / bucketSize), buckets - 1);
      result[idx].sum += val;
      result[idx].count++;
    }

    return result
      .map((b, i) => {
        const ts = new Date(oldest + i * bucketSize + bucketSize / 2);
        const label = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
        return { time: label, value: b.count > 0 ? Math.round((b.sum / b.count) * 10) / 10 : NaN };
      })
      .filter((b) => !isNaN(b.value));
  }

  // Compute on-hours per bucket. Each point = one slot (day or hour) within the requested range.
  // Every bucket is emitted, even zero, so rolling window always shows the full shape.
  function tvOnHoursPerBucket(
    history: { state: string; last_changed: string }[]
  ): { time: string; hours: number; key: string }[] {
    const now = Date.now();
    const oldest = now - buckets * bucketMs;
    const slots = Array.from({ length: buckets }, () => 0);

    // Walk state segments, clamp each to [oldest, now], then split across bucket boundaries
    const sorted = [...history].sort(
      (a, b) => new Date(a.last_changed).getTime() - new Date(b.last_changed).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i];
      const isOn = curr.state === 'on' || curr.state === 'playing';
      if (!isOn) continue;
      const start = new Date(curr.last_changed).getTime();
      const end = i + 1 < sorted.length ? new Date(sorted[i + 1].last_changed).getTime() : now;

      let segStart = Math.max(start, oldest);
      const segEnd = Math.min(end, now);
      if (segEnd <= segStart) continue;

      while (segStart < segEnd) {
        const idx = Math.min(Math.floor((segStart - oldest) / bucketMs), buckets - 1);
        const bucketEndTs = oldest + (idx + 1) * bucketMs;
        const chunkEnd = Math.min(segEnd, bucketEndTs);
        slots[idx] += (chunkEnd - segStart) / 3600000;
        segStart = chunkEnd;
      }
    }

    return slots.map((h, i) => {
      const ts = new Date(oldest + i * bucketMs + bucketMs / 2);
      const label =
        bucketLabel === 'hour'
          ? ts.toLocaleTimeString('en-US', { hour: 'numeric' })
          : ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const key =
        bucketLabel === 'hour'
          ? ts.toISOString().slice(0, 13)
          : ts.toISOString().slice(0, 10);
      return { time: label, hours: Math.round(h * 10) / 10, key };
    });
  }

  // Count oldest available TV data point so we can show "X of Y days" annotation
  function oldestDataAge(history: { last_changed: string }[]): number | null {
    if (!history.length) return null;
    const oldest = history.reduce(
      (min, e) => Math.min(min, new Date(e.last_changed).getTime()),
      Date.now()
    );
    return Math.max(0, Math.floor((Date.now() - oldest) / 86400000));
  }

  const indoorBuckets = bucketHourly(indoorHistory, 56);
  const outdoorBuckets = bucketHourly(outdoorHistory, 56);
  const bedroomTVBuckets = tvOnHoursPerBucket(bedroomTVHistory);
  const livingTVBuckets = tvOnHoursPerBucket(livingTVHistory);

  return {
    range,
    tvCoverage: {
      bedroomDays: oldestDataAge(bedroomTVHistory),
      livingDays: oldestDataAge(livingTVHistory),
      requestedDays: days
    },
    ha: {
      available: haStates.size > 0,
      indoor: get('indoorTemp'),
      humidity: get('humidity'),
      hvac: get('hvacMode'),
      outdoor: get('outdoorTemp'),
      alarm: get('alarm'),
      livingTV: get('livingRoomTV'),
      bedroomTV: get('bedroomTV'),
      xbox: get('xbox'),
      gamerscore: get('gamerscore'),
      nowPlaying: get('nowPlaying'),
      download: get('downloadSpeed'),
      upload: get('uploadSpeed')
    },
    charts: {
      indoorTemp: indoorBuckets,
      outdoorTemp: outdoorBuckets,
      bedroomTVHours: bedroomTVBuckets,
      livingTVHours: livingTVBuckets
    },
    forecast
  };
};
