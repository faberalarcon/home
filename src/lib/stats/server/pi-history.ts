import { readFile } from 'node:fs/promises';
import { and, desc, gte, lt, sql } from 'drizzle-orm';
import { db } from '$lib/drinks/server/db';
import { piMetricsHistory } from '$lib/drinks/server/db/schema';

const JSONL_PATH = '/var/lib/bristoe-stats/pi-metrics.jsonl';

export interface PiHistoryPoint {
  t: number;
  cpuPct: number | null;
  memPct: number | null;
  tempC: number | null;
  load1: number | null;
}

interface JsonlSample {
  t: number;
  cpuPct?: number | null;
  memPct?: number | null;
  tempC?: number | null;
  load1?: number | null;
}

export async function ingestFromJsonl(path: string = JSONL_PATH): Promise<{ inserted: number; latest: PiHistoryPoint | null }> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return { inserted: 0, latest: null };
  }
  // Find the latest stored t so we only scan recent JSONL lines.
  const stored = db
    .select({ t: piMetricsHistory.t })
    .from(piMetricsHistory)
    .orderBy(desc(piMetricsHistory.t))
    .limit(1)
    .get();
  const cutoff = stored?.t ?? 0;

  const rows: JsonlSample[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line) as JsonlSample;
      if (typeof obj.t !== 'number') continue;
      if (obj.t <= cutoff) continue;
      rows.push(obj);
    } catch {
      // skip malformed line
    }
  }
  if (rows.length === 0) {
    return { inserted: 0, latest: latestRow() };
  }

  // SQLite has a parameter limit (~999); chunk to be safe.
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const result = db
      .insert(piMetricsHistory)
      .values(
        slice.map((s) => ({
          t: s.t,
          cpuPct: typeof s.cpuPct === 'number' ? s.cpuPct : null,
          memPct: typeof s.memPct === 'number' ? s.memPct : null,
          tempC: typeof s.tempC === 'number' ? s.tempC : null,
          load1: typeof s.load1 === 'number' ? s.load1 : null
        }))
      )
      .onConflictDoNothing()
      .run();
    inserted += result.changes ?? 0;
  }
  return { inserted, latest: latestRow() };
}

export function latestRow(): PiHistoryPoint | null {
  const row = db
    .select()
    .from(piMetricsHistory)
    .orderBy(desc(piMetricsHistory.t))
    .limit(1)
    .get();
  if (!row) return null;
  return {
    t: row.t,
    cpuPct: row.cpuPct ?? null,
    memPct: row.memPct ?? null,
    tempC: row.tempC ?? null,
    load1: row.load1 ?? null
  };
}

export function queryHistory(spanMs: number, bucketMs: number, mode: 'average' | 'peak' = 'average'): PiHistoryPoint[] {
  const now = Date.now();
  const start = now - spanMs;
  const rows = db
    .select()
    .from(piMetricsHistory)
    .where(and(gte(piMetricsHistory.t, start), lt(piMetricsHistory.t, now)))
    .orderBy(piMetricsHistory.t)
    .all();
  if (rows.length === 0) return [];

  const bucketCount = Math.max(1, Math.round(spanMs / bucketMs));
  type Bin = {
    cpu: number; cpuMax: number; cpuN: number;
    mem: number; memN: number;
    temp: number; tempMax: number; tempN: number;
    load: number; loadN: number;
  };
  const bins: Bin[] = Array.from({ length: bucketCount }, () => ({
    cpu: 0, cpuMax: 0, cpuN: 0,
    mem: 0, memN: 0,
    temp: 0, tempMax: 0, tempN: 0,
    load: 0, loadN: 0
  }));
  for (const row of rows) {
    const idx = Math.min(bucketCount - 1, Math.floor((row.t - start) / bucketMs));
    const b = bins[idx];
    if (typeof row.cpuPct === 'number') { b.cpu += row.cpuPct; b.cpuMax = Math.max(b.cpuMax, row.cpuPct); b.cpuN++; }
    if (typeof row.memPct === 'number') { b.mem += row.memPct; b.memN++; }
    if (typeof row.tempC === 'number') { b.temp += row.tempC; b.tempMax = Math.max(b.tempMax, row.tempC); b.tempN++; }
    if (typeof row.load1 === 'number') { b.load += row.load1; b.loadN++; }
  }

  const out: PiHistoryPoint[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const b = bins[i];
    if (b.memN === 0 && b.cpuN === 0 && b.tempN === 0) continue;
    const t = Math.round(start + i * bucketMs + bucketMs / 2);
    out.push({
      t,
      cpuPct: b.cpuN ? Math.round((mode === 'peak' ? b.cpuMax : b.cpu / b.cpuN) * 10) / 10 : null,
      memPct: b.memN ? Math.round((b.mem / b.memN) * 10) / 10 : null,
      tempC: b.tempN ? Math.round((mode === 'peak' ? b.tempMax : b.temp / b.tempN) * 10) / 10 : null,
      load1: b.loadN ? Math.round((b.load / b.loadN) * 100) / 100 : null
    });
  }
  return out;
}

export function rowCount(): number {
  const row = db.select({ c: sql<number>`count(*)` }).from(piMetricsHistory).get();
  return row?.c ?? 0;
}
