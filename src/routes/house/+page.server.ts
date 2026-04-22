import { getStates, getHistory, ENTITIES } from '$lib/server/home-assistant';
import { getDailyForecast, getHourlyOutdoorTemps, getCurrentWeather } from '$lib/server/weather';
import type { PageServerLoad } from './$types';

// All bucket alignment is pinned to NY time via Intl, independent of process.env.TZ.
const TZ = 'America/New_York';

const RANGES = {
  '1d': { days: 1, buckets: 24, bucketLabel: 'hour' },
  '7d': { days: 7, buckets: 7, bucketLabel: 'day' },
  '30d': { days: 30, buckets: 30, bucketLabel: 'day' },
  '90d': { days: 90, buckets: 90, bucketLabel: 'day' }
} as const;

type RangeKey = keyof typeof RANGES;

function parseRange(v: string | null): RangeKey {
  if (v === '1d' || v === '7d' || v === '30d' || v === '90d') return v;
  return '7d';
}

function localParts(ts: number, tz: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date(ts));
  const out: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') out[p.type] = p.value;
  return out;
}

function startOfLocalDay(ts: number, tz: string): number {
  const p = localParts(ts, tz);
  const h = Number(p.hour) % 24;
  const m = Number(p.minute);
  const s = Number(p.second);
  return ts - (h * 3600 + m * 60 + s) * 1000 - (ts % 1000);
}

function startOfLocalHour(ts: number, tz: string): number {
  const p = localParts(ts, tz);
  const m = Number(p.minute);
  const s = Number(p.second);
  return ts - (m * 60 + s) * 1000 - (ts % 1000);
}

// DST-safe: add +2h then snap back to local midnight. Works for any n because
// DST max shift is ±1h and a forward pad always lands in (or after) the target day.
function addLocalDays(midnightTs: number, n: number, tz: string): number {
  if (n === 0) return midnightTs;
  return startOfLocalDay(midnightTs + n * 86400000 + 2 * 3600000, tz);
}

function findBucket(edges: number[], ts: number): number {
  let lo = 0;
  let hi = edges.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (edges[mid] <= ts) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export const load: PageServerLoad = async ({ url }) => {
  const range = parseRange(url.searchParams.get('range'));
  const { buckets, bucketLabel, days } = RANGES[range];
  const now = Date.now();

  const bucketEdges: number[] = [];
  if (bucketLabel === 'day') {
    const today = startOfLocalDay(now, TZ);
    for (let i = 0; i <= buckets; i++) {
      bucketEdges.push(addLocalDays(today, i - (buckets - 1), TZ));
    }
  } else {
    const hourStart = startOfLocalHour(now, TZ);
    for (let i = 0; i <= buckets; i++) {
      bucketEdges.push(hourStart + (i - (buckets - 1)) * 3600000);
    }
  }
  const oldest = bucketEdges[0];
  const rightEdge = bucketEdges[buckets];

  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  // 24h pad so HA returns the state active at the oldest bucket boundary.
  const rangeStart = new Date(oldest - 24 * 3600000);

  const [
    haStates,
    indoorHistory,
    outdoorBuckets,
    currentOutdoor,
    bedroomTVHistory,
    livingTVHistory,
    forecast
  ] = await Promise.all([
    getStates(Object.values(ENTITIES)).catch(() => new Map()),
    getHistory(ENTITIES.indoorTemp, sevenDaysAgo, new Date(now)).catch(() => []),
    getHourlyOutdoorTemps(7).catch(() => []),
    getCurrentWeather().catch(() => null),
    getHistory(ENTITIES.bedroomTV, rangeStart, new Date(now)).catch(() => []),
    getHistory(ENTITIES.livingRoomTV, rangeStart, new Date(now)).catch(() => []),
    getDailyForecast().catch(() => [])
  ]);

  const get = (key: keyof typeof ENTITIES) => {
    const s = haStates.get(ENTITIES[key]);
    return s ? { state: s.state, attrs: s.attributes } : null;
  };

  function bucketHourly(
    history: { state: string; last_changed: string }[],
    count = 48
  ): { time: string; value: number }[] {
    if (!history.length) return [];
    const endTs = Date.now();
    const startTs = endTs - count * 3600000;
    const bucketSize = (endTs - startTs) / count;
    const result: { sum: number; count: number }[] = Array.from({ length: count }, () => ({ sum: 0, count: 0 }));

    for (const entry of history) {
      const val = parseFloat(entry.state);
      if (isNaN(val)) continue;
      const ts = new Date(entry.last_changed).getTime();
      if (ts < startTs) continue;
      const idx = Math.min(Math.floor((ts - startTs) / bucketSize), count - 1);
      result[idx].sum += val;
      result[idx].count++;
    }

    return result
      .map((b, i) => {
        const ts = new Date(startTs + i * bucketSize + bucketSize / 2);
        const label = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
        return { time: label, value: b.count > 0 ? Math.round((b.sum / b.count) * 10) / 10 : NaN };
      })
      .filter((b) => !isNaN(b.value));
  }

  const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' });
  const fmtHour = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric' });

  function tvOnHoursPerBucket(
    history: { state: string; last_changed: string }[]
  ): { time: string; hours: number; key: string }[] {
    const slots = Array.from({ length: buckets }, () => 0);

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
      const segEnd = Math.min(end, rightEdge, now);
      if (segEnd <= segStart) continue;

      while (segStart < segEnd) {
        const idx = findBucket(bucketEdges, segStart);
        if (idx < 0 || idx >= buckets) break;
        const chunkEnd = Math.min(segEnd, bucketEdges[idx + 1]);
        slots[idx] += (chunkEnd - segStart) / 3600000;
        segStart = chunkEnd;
      }
    }

    return slots.map((h, i) => {
      const edge = bucketEdges[i];
      const p = localParts(edge, TZ);
      const time = bucketLabel === 'hour' ? fmtHour.format(edge) : fmtDay.format(edge);
      const key =
        bucketLabel === 'hour'
          ? `${p.year}-${p.month}-${p.day}T${p.hour}`
          : `${p.year}-${p.month}-${p.day}`;
      return { time, hours: Math.round(h * 10) / 10, key };
    });
  }

  function oldestDataAge(history: { last_changed: string }[]): number | null {
    if (!history.length) return null;
    const earliest = history.reduce(
      (min, e) => Math.min(min, new Date(e.last_changed).getTime()),
      now
    );
    const earliestDay = startOfLocalDay(earliest, TZ);
    const todayMidnight = startOfLocalDay(now, TZ);
    return Math.max(0, Math.round((todayMidnight - earliestDay) / 86400000));
  }

  const indoorBuckets = bucketHourly(indoorHistory, 168);
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
      outdoor: currentOutdoor
        ? { state: String(Math.round(currentOutdoor.temperature * 10) / 10), attrs: {} }
        : null,
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
