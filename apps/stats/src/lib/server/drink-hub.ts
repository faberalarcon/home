import { env } from '$env/dynamic/private';

const TIMEOUT = 5000;

export interface DrinkHubStats {
  totals: {
    allTime: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  leaderboard: {
    allTime: LeaderEntry[];
    today: LeaderEntry[];
    thisWeek: LeaderEntry[];
  };
  topDrinks: {
    allTime: DrinkEntry[];
    thisWeek: DrinkEntry[];
  };
  dowHistogram: { day: string; count: number }[];
  hourHistogram: { hour: number; count: number }[];
  dailyTimeline: { date: string; count: number }[];
  profiles: { id: number; name: string; color: string; avatarUrl: string | null }[];
  drinks: { id: number; name: string; category: string }[];
  funStats: {
    busiestDay: { date: string; count: number } | null;
    longestStreak: number;
    avgPerDay: number;
    firstOrderDate: string | null;
    signatureDrinks: { profileName: string; profileColor: string; drinkName: string; count: number }[];
    diversityScore: number;
    peakDay: string | null;
    peakHour: string | null;
  };
  meta: {
    resetAt: number;
    generatedAt: string;
  };
}

export interface LeaderEntry {
  id: number;
  name: string;
  color: string;
  avatarUrl: string | null;
  count: number;
}

export interface DrinkEntry {
  id: number;
  name: string;
  category: string;
  count: number;
}

export async function fetchDrinkHubStats(params?: URLSearchParams): Promise<DrinkHubStats | null> {
  const baseUrl = env.DRINK_HUB_URL || 'http://127.0.0.1:5173/drinks';
  let url = `${baseUrl}/api/stats`;
  if (params && params.toString()) {
    url += `?${params.toString()}`;
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`Drink Hub ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}
