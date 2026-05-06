import { statsSections } from '$lib/stats/stats-sections';

const SUCCESS_TTL_MS = 60_000;
const FAILURE_TTL_MS = 15_000;

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

const statsPaths = new Set(statsSections.map((section) => section.href));
const houseRanges = new Set(['1d', '7d', '30d', '90d']);
const piRanges = new Set(['1d', '7d']);
const drinkParams = new Set(['profile_id', 'drink_id', 'category', 'from', 'to']);

function sortParams(params: URLSearchParams): string {
  const sorted = [...params.entries()].sort(([aKey, aValue], [bKey, bValue]) => {
    if (aKey === bKey) return aValue.localeCompare(bValue);
    return aKey.localeCompare(bKey);
  });
  return new URLSearchParams(sorted).toString();
}

function normalizeDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(time) ? value : null;
}

function normalizePositiveInt(value: string | null): string | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value) > 0 ? String(Number(value)) : null;
}

function isSuccessfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return true;

  const data = value as Record<string, any>;
  if ('stats' in data && data.stats == null) return false;
  if ('ha' in data && data.ha?.available === false) return false;
  if ('pi' in data && data.pi?.available === false) return false;
  if ('manifest' in data && data.manifest?.available === false) return false;
  return true;
}

export function canonicalizeStatsHref(input: string | URL): string | null {
  const url = typeof input === 'string' ? new URL(input, 'http://stats.local') : input;
  const pathname = url.pathname === '' ? '/' : url.pathname;

  if (!statsPaths.has(pathname)) return null;
  const params = new URLSearchParams();

  if (pathname === '/house') {
    const range = url.searchParams.get('range');
    params.set('range', range && houseRanges.has(range) ? range : '7d');
  } else if (pathname === '/pi') {
    const range = url.searchParams.get('range');
    params.set('range', range && piRanges.has(range) ? range : '1d');
  } else if (pathname === '/drinks') {
    for (const key of drinkParams) {
      const raw = url.searchParams.get(key);
      if (!raw) continue;

      if (key === 'profile_id' || key === 'drink_id') {
        const normalized = normalizePositiveInt(raw);
        if (normalized) params.set(key, normalized);
      } else if (key === 'from' || key === 'to') {
        const normalized = normalizeDate(raw);
        if (normalized) params.set(key, normalized);
      } else {
        const trimmed = raw.trim();
        if (trimmed) params.set(key, trimmed.slice(0, 80));
      }
    }
  }

  const query = sortParams(params);
  return query ? `${pathname}?${query}` : pathname;
}

export async function withStatsCache<T>(url: URL, loader: () => Promise<T>): Promise<T> {
  const key = canonicalizeStatsHref(url);
  if (!key) return loader();

  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    if (cached.promise) return cached.promise;
    return cached.value as T;
  }

  const promise = loader();
  cache.set(key, {
    expiresAt: now + SUCCESS_TTL_MS,
    promise
  });

  try {
    const value = await promise;
    const ok = isSuccessfulValue(value);
    cache.set(key, {
      expiresAt: Date.now() + (ok ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
      value
    });
    return value;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export async function warmStatsCache<T>(href: string, loader: () => Promise<T>): Promise<'warmed' | 'skipped'> {
  const key = canonicalizeStatsHref(href);
  if (!key) return 'skipped';

  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return 'skipped';

  await withStatsCache(new URL(key, 'http://stats.local'), loader);
  return 'warmed';
}
