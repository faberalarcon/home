import { readFile } from 'node:fs/promises';

const DATA_FILE = '/var/lib/bristoe-stats/visitors.json';

export interface VisitorStats {
  count: number;
  updatedAt: string | null;
}

export interface VisitorCountry {
  code: string;
  name: string;
  count: number;
  percent: number;
}

export interface VisitorRegion {
  key: string;
  countryCode: string;
  countryName: string;
  region: string;
  count: number;
  percent: number;
}

export interface VisitorCity {
  key: string;
  countryCode: string;
  countryName: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  count: number;
  percent: number;
}

export interface VisitorDaily {
  date: string;
  count: number;
}

export interface VisitorGeoStats {
  status: 'ok' | 'stale' | 'unavailable';
  error: string | null;
  source: string;
  attribution: { label: string; href: string };
  database: { package: string; version: string };
  updatedAt: string | null;
  locatedCount: number;
  unknownCount: number;
  countryCount: number;
  regionCount: number;
  cityCount: number;
  byCountry: VisitorCountry[];
  byRegion: VisitorRegion[];
  byCity: VisitorCity[];
  daily: VisitorDaily[];
}

export interface VisitorLocationStats extends VisitorStats {
  geo: VisitorGeoStats | null;
}

async function readVisitorData(): Promise<Record<string, any> | null> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readCount(data: Record<string, any> | null): number | null {
  if (!data) return null;
  if (typeof data.count === 'number') return data.count;
  if (Array.isArray(data.uniqueHashes)) return data.uniqueHashes.length;
  return null;
}

function cleanGeo(geo: Record<string, any> | null | undefined): VisitorGeoStats | null {
  if (!geo || typeof geo !== 'object') return null;
  return {
    status: ['ok', 'stale', 'unavailable'].includes(geo.status) ? geo.status : 'unavailable',
    error: typeof geo.error === 'string' ? geo.error : null,
    source: typeof geo.source === 'string' ? geo.source : 'Unknown source',
    attribution: {
      label: typeof geo.attribution?.label === 'string' ? geo.attribution.label : 'IP Geolocation by DB-IP',
      href: typeof geo.attribution?.href === 'string' ? geo.attribution.href : 'https://db-ip.com/'
    },
    database: {
      package: typeof geo.database?.package === 'string' ? geo.database.package : '',
      version: typeof geo.database?.version === 'string' ? geo.database.version : ''
    },
    updatedAt: typeof geo.updatedAt === 'string' ? geo.updatedAt : null,
    locatedCount: Number(geo.locatedCount) || 0,
    unknownCount: Number(geo.unknownCount) || 0,
    countryCount: Number(geo.countryCount) || 0,
    regionCount: Number(geo.regionCount) || 0,
    cityCount: Number(geo.cityCount) || 0,
    byCountry: Array.isArray(geo.byCountry) ? geo.byCountry : [],
    byRegion: Array.isArray(geo.byRegion) ? geo.byRegion : [],
    byCity: Array.isArray(geo.byCity) ? geo.byCity : [],
    daily: Array.isArray(geo.daily) ? geo.daily : []
  };
}

export async function getUniqueVisitorCount(): Promise<VisitorStats | null> {
  const data = await readVisitorData();
  const count = readCount(data);
  if (count == null) return null;
  return { count, updatedAt: data?.updatedAt ?? null };
}

export async function getVisitorLocationStats(): Promise<VisitorLocationStats | null> {
  const data = await readVisitorData();
  const count = readCount(data);
  if (count == null) return null;
  return {
    count,
    updatedAt: data?.updatedAt ?? null,
    geo: cleanGeo(data?.geo)
  };
}
