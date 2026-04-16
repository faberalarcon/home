import { getStates, getHistory, ENTITIES } from '$lib/server/home-assistant';
import { getDailyForecast } from '$lib/server/weather';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  // HA returns [] when start precedes its stored data — fall back to shorter window
  async function getTVHistory(entityId: string): Promise<{ state: string; last_changed: string }[]> {
    const long = await getHistory(entityId, thirtyDaysAgo).catch(() => []);
    if (long.length > 0) return long;
    return getHistory(entityId, tenDaysAgo).catch(() => []);
  }

  const [haStates, indoorHistory, outdoorHistory, bedroomTVHistory, livingTVHistory, forecast] =
    await Promise.all([
      getStates(Object.values(ENTITIES)).catch(() => new Map()),
      getHistory(ENTITIES.indoorTemp, sevenDaysAgo).catch(() => []),
      getHistory(ENTITIES.outdoorTemp, sevenDaysAgo).catch(() => []),
      getTVHistory(ENTITIES.bedroomTV),
      getTVHistory(ENTITIES.livingRoomTV),
      getDailyForecast().catch(() => [])
    ]);

  const get = (key: keyof typeof ENTITIES) => {
    const s = haStates.get(ENTITIES[key]);
    return s ? { state: s.state, attrs: s.attributes } : null;
  };

  // Bucket indoor temp history into hourly averages over last 7 days
  function bucketHourly(
    history: { state: string; last_changed: string }[],
    buckets: number = 48
  ): { time: string; value: number }[] {
    if (!history.length) return [];
    const now = Date.now();
    const oldest = now - buckets * 3600000;
    const bucketMs = (now - oldest) / buckets;
    const result: { sum: number; count: number }[] = Array.from({ length: buckets }, () => ({ sum: 0, count: 0 }));

    for (const entry of history) {
      const val = parseFloat(entry.state);
      if (isNaN(val)) continue;
      const ts = new Date(entry.last_changed).getTime();
      if (ts < oldest) continue;
      const idx = Math.min(Math.floor((ts - oldest) / bucketMs), buckets - 1);
      result[idx].sum += val;
      result[idx].count++;
    }

    return result.map((b, i) => {
      const ts = new Date(oldest + i * bucketMs + bucketMs / 2);
      const label = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
      return { time: label, value: b.count > 0 ? Math.round((b.sum / b.count) * 10) / 10 : NaN };
    }).filter((b) => !isNaN(b.value));
  }

  // Estimate TV on-hours per day from state history
  function tvOnHoursPerDay(history: { state: string; last_changed: string }[]): { date: string; hours: number }[] {
    if (!history.length) return [];
    const dayMap: Record<string, number> = {};

    for (let i = 0; i < history.length - 1; i++) {
      const curr = history[i];
      const next = history[i + 1];
      if (curr.state !== 'on' && curr.state !== 'playing') continue;
      const start = new Date(curr.last_changed).getTime();
      const end = new Date(next.last_changed).getTime();
      const hours = (end - start) / 3600000;
      const date = new Date(curr.last_changed).toISOString().split('T')[0];
      dayMap[date] = (dayMap[date] ?? 0) + hours;
    }

    return Object.entries(dayMap)
      .map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const indoorBuckets = bucketHourly(indoorHistory, 56);
  const outdoorBuckets = bucketHourly(outdoorHistory, 56);
  const bedroomTVDays = tvOnHoursPerDay(bedroomTVHistory);
  const livingTVDays = tvOnHoursPerDay(livingTVHistory);

  return {
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
      bedroomTVHours: bedroomTVDays,
      livingTVHours: livingTVDays
    },
    forecast
  };
};
