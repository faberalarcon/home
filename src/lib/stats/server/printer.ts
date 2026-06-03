import { readFile } from 'node:fs/promises';
import { env } from '$env/dynamic/private';
import { fixtureHistory, fixtureStatus } from './printer-fixtures';

// 3D printer (Creality K2 Pro) stats. Connection target is Moonraker
// (Klipper JSON-RPC, default port 7125), driven entirely by PRINTER_BASE_URL
// so any reachable Moonraker endpoint works without code changes.
//
// Two data paths, mirroring existing conventions:
//   - getPrinterStatus(): LIVE Moonraker fetch on page load (Home Assistant
//     style), falling back to the latest JSONL sample, then fixture, then
//     an unconfigured/empty state. Never throws.
//   - getPrinterHistory(): reads the collector's JSONL (Pi telemetry style)
//     and bucketizes for trend charts.
//
// Device is not on the network yet: with no PRINTER_BASE_URL set everything
// degrades to `configured: false` and the UI renders an "awaiting printer"
// state. Set PRINTER_FIXTURE=1 to render representative sample data.

const PRINTER_TIMEOUT = 5000;
const DATA_FILE = '/var/lib/bristoe-stats/printer-metrics.jsonl';

export type PrinterState = 'standby' | 'printing' | 'paused' | 'complete' | 'error' | 'unknown';
export type PrinterHistoryRange = '7d' | '30d' | '90d';
export type PrinterStatusSource = 'live' | 'jsonl' | 'fixture' | 'none';

export interface PrinterLifetime {
  totalJobs: number;
  totalTimeS: number;
  totalFilamentMm: number;
  completed: number;
  cancelled: number;
}

export interface PrinterStatus {
  configured: boolean;
  available: boolean;
  source: PrinterStatusSource;
  sampleAt: number | null;
  name: string;
  state: PrinterState;
  job: {
    filename: string | null;
    progressPct: number;
    elapsedS: number;
    remainingS: number | null;
  } | null;
  temps: {
    nozzleC: number | null;
    nozzleTarget: number | null;
    bedC: number | null;
    bedTarget: number | null;
    chamberC: number | null;
  };
  lifetime: PrinterLifetime | null;
  recentJobs: Array<{
    filename: string;
    status: string;
    durationS: number;
    filamentMm: number;
    at: number;
  }>;
}

export interface PrinterSample {
  t: number;
  state: PrinterState;
  progressPct: number;
  nozzleC: number | null;
  nozzleTarget: number | null;
  bedC: number | null;
  bedTarget: number | null;
  chamberC: number | null;
  filename: string | null;
  printDurationS: number;
  filamentUsedMm: number;
  lifetime: PrinterLifetime | null;
}

export interface PrinterTempPoint {
  time: string;
  t: number;
  nozzleC: number;
  bedC: number;
  chamberC: number;
}

export interface PrinterHistory {
  available: boolean;
  range: PrinterHistoryRange;
  temps: PrinterTempPoint[];
  printHours: Array<{ day: string; hours: number }>;
}

function fixtureEnabled(): boolean {
  return env.PRINTER_FIXTURE === '1' || env.PRINTER_FIXTURE === 'true';
}

function baseUrl(): string | null {
  const url = env.PRINTER_BASE_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
}

function printerName(): string {
  return env.PRINTER_NAME?.trim() || 'K2 Pro';
}

function emptyStatus(configured: boolean): PrinterStatus {
  return {
    configured,
    available: false,
    source: 'none',
    sampleAt: null,
    name: printerName(),
    state: 'unknown',
    job: null,
    temps: { nozzleC: null, nozzleTarget: null, bedC: null, bedTarget: null, chamberC: null },
    lifetime: null,
    recentJobs: []
  };
}

function normalizeState(raw: unknown): PrinterState {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'printing' || s === 'paused' || s === 'complete' || s === 'standby' || s === 'error') return s;
  if (s === 'cancelled' || s === 'canceled') return 'standby';
  return 'unknown';
}

async function moonrakerFetch<T>(path: string): Promise<T> {
  const url = baseUrl();
  if (!url) throw new Error('PRINTER_BASE_URL not configured');
  const res = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(PRINTER_TIMEOUT) });
  if (!res.ok) throw new Error(`Moonraker ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Object set queried from Moonraker. The chamber sensor name varies by config
// (Creality K2 exposes it under its own name) — override via env when known.
function chamberObject(): string {
  return env.PRINTER_CHAMBER_OBJECT?.trim() || 'temperature_sensor chamber_temp';
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

async function liveStatus(): Promise<PrinterStatus | null> {
  const chamber = chamberObject();
  const objects = ['print_stats', 'virtual_sdcard', 'display_status', 'extruder', 'heater_bed', 'toolhead', chamber];
  const query = objects.map((o) => encodeURIComponent(o)).join('&');

  type QueryResp = { result?: { status?: Record<string, Record<string, unknown>> } };
  const resp = await moonrakerFetch<QueryResp>(`/printer/objects/query?${query}`);
  const status = resp.result?.status;
  if (!status) return null;

  const printStats = status['print_stats'] ?? {};
  const vsd = status['virtual_sdcard'] ?? {};
  const display = status['display_status'] ?? {};
  const extruder = status['extruder'] ?? {};
  const bed = status['heater_bed'] ?? {};
  const chamberSensor = status[chamber] ?? {};

  const progress = num(vsd['progress']) ?? num(display['progress']) ?? 0;
  const state = normalizeState(printStats['state']);
  const elapsedS = Math.round(num(printStats['print_duration']) ?? 0);

  // Lifetime + recent jobs come from Moonraker's history plugin. Best-effort —
  // a printer without [history] configured just yields nulls.
  const [lifetime, recentJobs] = await Promise.all([liveLifetime(), liveRecentJobs()]);

  // Estimate remaining from progress when a duration is known and progress > 0.
  const remainingS = state === 'printing' && progress > 0.01 && elapsedS > 0
    ? Math.round(elapsedS / progress - elapsedS)
    : null;

  return {
    configured: true,
    available: true,
    source: 'live',
    sampleAt: Date.now(),
    name: printerName(),
    state,
    job: {
      filename: (printStats['filename'] as string) || null,
      progressPct: Math.round(progress * 1000) / 10,
      elapsedS,
      remainingS
    },
    temps: {
      nozzleC: num(extruder['temperature']),
      nozzleTarget: num(extruder['target']),
      bedC: num(bed['temperature']),
      bedTarget: num(bed['target']),
      chamberC: num(chamberSensor['temperature'])
    },
    lifetime,
    recentJobs
  };
}

async function liveLifetime(): Promise<PrinterLifetime | null> {
  try {
    type Totals = { result?: { job_totals?: { total_jobs?: number; total_time?: number; total_filament_used?: number } } };
    const resp = await moonrakerFetch<Totals>('/server/history/totals');
    const t = resp.result?.job_totals;
    if (!t) return null;
    return {
      totalJobs: Math.round(t.total_jobs ?? 0),
      totalTimeS: Math.round(t.total_time ?? 0),
      totalFilamentMm: Math.round(t.total_filament_used ?? 0),
      completed: 0,
      cancelled: 0
    };
  } catch {
    return null;
  }
}

async function liveRecentJobs(): Promise<PrinterStatus['recentJobs']> {
  try {
    type JobList = {
      result?: {
        jobs?: Array<{
          filename?: string;
          status?: string;
          print_duration?: number;
          filament_used?: number;
          end_time?: number;
        }>;
      };
    };
    const resp = await moonrakerFetch<JobList>('/server/history/list?limit=20&order=desc');
    const jobs = resp.result?.jobs ?? [];
    return jobs.map((j) => ({
      filename: j.filename || 'unknown',
      status: j.status || 'unknown',
      durationS: Math.round(j.print_duration ?? 0),
      filamentMm: Math.round(j.filament_used ?? 0),
      at: j.end_time ? Math.round(j.end_time * 1000) : 0
    }));
  } catch {
    return [];
  }
}

async function readSamples(): Promise<PrinterSample[]> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const out: PrinterSample[] = [];
    for (const line of raw.split('\n')) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (typeof obj.t === 'number') out.push(obj as PrinterSample);
      } catch {
        // skip malformed line
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  } catch {
    return [];
  }
}

function statusFromSample(s: PrinterSample): PrinterStatus {
  const completed = s.lifetime?.completed ?? 0;
  const cancelled = s.lifetime?.cancelled ?? 0;
  return {
    configured: true,
    available: true,
    source: 'jsonl',
    sampleAt: s.t,
    name: printerName(),
    state: s.state,
    job: {
      filename: s.filename,
      progressPct: s.progressPct,
      elapsedS: s.printDurationS,
      remainingS: s.state === 'printing' && s.progressPct > 1 && s.printDurationS > 0
        ? Math.round((s.printDurationS / (s.progressPct / 100)) - s.printDurationS)
        : null
    },
    temps: {
      nozzleC: s.nozzleC,
      nozzleTarget: s.nozzleTarget,
      bedC: s.bedC,
      bedTarget: s.bedTarget,
      chamberC: s.chamberC
    },
    lifetime: s.lifetime ? { ...s.lifetime, completed, cancelled } : null,
    recentJobs: []
  };
}

export async function getPrinterStatus(): Promise<PrinterStatus> {
  const configured = baseUrl() !== null;

  if (configured) {
    const live = await liveStatus().catch(() => null);
    if (live) return live;
    // Live failed — fall back to the freshest collected sample if present.
    const samples = await readSamples();
    if (samples.length) return statusFromSample(samples[samples.length - 1]);
    // Configured but unreachable and no samples yet.
    return { ...emptyStatus(true) };
  }

  if (fixtureEnabled()) return fixtureStatus();
  return emptyStatus(false);
}

function spanFor(range: PrinterHistoryRange): number {
  if (range === '90d') return 90 * 86_400_000;
  if (range === '30d') return 30 * 86_400_000;
  return 7 * 86_400_000;
}

function fmtLabel(t: number, mode: 'hour' | 'day'): string {
  const d = new Date(t);
  return mode === 'hour'
    ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Average temps into time buckets (same approach as pi-metrics bucketize).
function bucketizeTemps(samples: PrinterSample[], spanMs: number): PrinterTempPoint[] {
  if (!samples.length) return [];
  const end = Date.now();
  const start = end - spanMs;
  const bucketMs = spanMs <= 7 * 86_400_000 ? 30 * 60_000 : 6 * 3600_000;
  const mode: 'hour' | 'day' = spanMs <= 7 * 86_400_000 ? 'hour' : 'day';
  const count = Math.max(1, Math.round(spanMs / bucketMs));
  const bins = Array.from({ length: count }, () => ({ noz: 0, nozN: 0, bed: 0, bedN: 0, ch: 0, chN: 0 }));

  for (const s of samples) {
    if (s.t < start || s.t > end) continue;
    const idx = Math.min(count - 1, Math.floor((s.t - start) / bucketMs));
    const b = bins[idx];
    if (s.nozzleC != null) { b.noz += s.nozzleC; b.nozN++; }
    if (s.bedC != null) { b.bed += s.bedC; b.bedN++; }
    if (s.chamberC != null) { b.ch += s.chamberC; b.chN++; }
  }

  const out: PrinterTempPoint[] = [];
  for (let i = 0; i < count; i++) {
    const b = bins[i];
    if (!b.nozN && !b.bedN && !b.chN) continue;
    const t = start + i * bucketMs + bucketMs / 2;
    out.push({
      time: fmtLabel(t, mode),
      t,
      nozzleC: b.nozN ? Math.round((b.noz / b.nozN) * 10) / 10 : 0,
      bedC: b.bedN ? Math.round((b.bed / b.bedN) * 10) / 10 : 0,
      chamberC: b.chN ? Math.round((b.ch / b.chN) * 10) / 10 : 0
    });
  }
  return out;
}

// Print hours per day: count samples in 'printing' state, weighted by the gap
// to the previous sample (collector cadence), grouped by calendar day.
function printHoursByDay(samples: PrinterSample[], spanMs: number): Array<{ day: string; hours: number }> {
  const end = Date.now();
  const start = end - spanMs;
  const byDay = new Map<string, number>();
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    if (s.t < start || s.t > end) continue;
    if (s.state !== 'printing') continue;
    const dt = Math.min(s.t - samples[i - 1].t, 15 * 60_000); // cap gap at 15min
    const key = new Date(s.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    byDay.set(key, (byDay.get(key) ?? 0) + dt);
  }
  return [...byDay.entries()].map(([day, ms]) => ({ day, hours: Math.round((ms / 3600_000) * 10) / 10 }));
}

export async function getPrinterHistory(range: PrinterHistoryRange = '7d'): Promise<PrinterHistory> {
  if (baseUrl() === null && fixtureEnabled()) return fixtureHistory();

  const samples = await readSamples();
  if (!samples.length) return { available: false, range, temps: [], printHours: [] };

  const spanMs = spanFor(range);
  return {
    available: true,
    range,
    temps: bucketizeTemps(samples, spanMs),
    printHours: printHoursByDay(samples, spanMs)
  };
}
