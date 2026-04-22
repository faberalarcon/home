import { readFile } from 'node:fs/promises';

const DATA_FILE = '/var/lib/bristoe-stats/pi-metrics.jsonl';

export interface PiSample {
  t: number;
  cpuPct: number | null;
  memPct: number;
  memUsedMb: number;
  memTotalMb: number;
  tempC: number | null;
  rxBytes: number;
  txBytes: number;
  load1: number;
}

export interface PiPoint {
  time: string;
  t: number;
  cpuPct: number;
  memPct: number;
  tempC: number;
  netDownMBps: number;
  netUpMBps: number;
  load1: number;
}

export interface PiMetrics {
  available: boolean;
  latest: {
    t: number;
    cpuPct: number | null;
    memPct: number;
    memUsedMb: number;
    memTotalMb: number;
    tempC: number | null;
    load1: number;
    netDownMBps: number | null;
    netUpMBps: number | null;
  } | null;
  history: PiPoint[];
  range: '1d' | '7d';
}

async function readSamples(): Promise<PiSample[]> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const out: PiSample[] = [];
    for (const line of raw.split('\n')) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (typeof obj.t === 'number') out.push(obj as PiSample);
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

function toRates(samples: PiSample[]): Array<PiSample & { downMBps: number; upMBps: number }> {
  const out: Array<PiSample & { downMBps: number; upMBps: number }> = [];
  for (let i = 0; i < samples.length; i++) {
    const curr = samples[i];
    if (i === 0) {
      out.push({ ...curr, downMBps: 0, upMBps: 0 });
      continue;
    }
    const prev = samples[i - 1];
    const dt = (curr.t - prev.t) / 1000;
    // Ignore if gap too large (timer missed; counter may have rolled) — treat as 0.
    const reliable = dt > 0 && dt < 15 * 60 && curr.rxBytes >= prev.rxBytes && curr.txBytes >= prev.txBytes;
    const downBps = reliable ? (curr.rxBytes - prev.rxBytes) / dt : 0;
    const upBps = reliable ? (curr.txBytes - prev.txBytes) / dt : 0;
    out.push({
      ...curr,
      downMBps: Math.round((downBps / 1048576) * 100) / 100,
      upMBps: Math.round((upBps / 1048576) * 100) / 100
    });
  }
  return out;
}

function fmtLabel(t: number, bucketLabel: 'hour' | 'day'): string {
  const d = new Date(t);
  return bucketLabel === 'hour'
    ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Bucketable { t: number; cpuPct: number | null; memPct: number; tempC: number | null; load1: number; downMBps: number; upMBps: number; }

function bucketize(samples: Bucketable[], spanMs: number, bucketMs: number, bucketLabel: 'hour' | 'day'): PiPoint[] {
  if (!samples.length) return [];
  const end = Date.now();
  const start = end - spanMs;
  const count = Math.round(spanMs / bucketMs);
  const bins: Array<{ cpu: number; cpuN: number; mem: number; memN: number; temp: number; tempN: number; down: number; up: number; load: number; loadN: number; }> =
    Array.from({ length: count }, () => ({ cpu: 0, cpuN: 0, mem: 0, memN: 0, temp: 0, tempN: 0, down: 0, up: 0, load: 0, loadN: 0 }));
  const downCount: number[] = new Array(count).fill(0);

  for (const s of samples) {
    if (s.t < start || s.t > end) continue;
    const idx = Math.min(count - 1, Math.floor((s.t - start) / bucketMs));
    const b = bins[idx];
    if (s.cpuPct != null) { b.cpu += s.cpuPct; b.cpuN++; }
    b.mem += s.memPct; b.memN++;
    if (s.tempC != null) { b.temp += s.tempC; b.tempN++; }
    b.down += s.downMBps; b.up += s.upMBps; downCount[idx]++;
    b.load += s.load1; b.loadN++;
  }

  const out: PiPoint[] = [];
  for (let i = 0; i < count; i++) {
    const b = bins[i];
    if (b.memN === 0) continue;
    const t = start + i * bucketMs + bucketMs / 2;
    out.push({
      time: fmtLabel(t, bucketLabel),
      t,
      cpuPct: b.cpuN ? Math.round((b.cpu / b.cpuN) * 10) / 10 : 0,
      memPct: Math.round((b.mem / b.memN) * 10) / 10,
      tempC: b.tempN ? Math.round((b.temp / b.tempN) * 10) / 10 : 0,
      netDownMBps: downCount[i] ? Math.round((b.down / downCount[i]) * 100) / 100 : 0,
      netUpMBps: downCount[i] ? Math.round((b.up / downCount[i]) * 100) / 100 : 0,
      load1: b.loadN ? Math.round((b.load / b.loadN) * 100) / 100 : 0
    });
  }
  return out;
}

export async function getPiMetrics(range: '1d' | '7d' = '1d'): Promise<PiMetrics> {
  const samples = await readSamples();
  if (!samples.length) {
    return { available: false, latest: null, history: [], range };
  }
  const withRates = toRates(samples);
  const last = withRates[withRates.length - 1];

  const spanMs = range === '7d' ? 7 * 86400000 : 86400000;
  const bucketMs = range === '7d' ? 3600000 : 5 * 60000; // 7d -> hourly; 1d -> 5-min raw
  const bucketLabel: 'hour' | 'day' = 'hour';
  const history = bucketize(withRates, spanMs, bucketMs, bucketLabel);

  return {
    available: true,
    latest: {
      t: last.t,
      cpuPct: last.cpuPct,
      memPct: last.memPct,
      memUsedMb: last.memUsedMb,
      memTotalMb: last.memTotalMb,
      tempC: last.tempC,
      load1: last.load1,
      netDownMBps: last.downMBps,
      netUpMBps: last.upMBps
    },
    history,
    range
  };
}
