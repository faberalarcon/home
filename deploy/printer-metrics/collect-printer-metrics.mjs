#!/usr/bin/env node
// Collects 3D printer (Moonraker) metrics into a JSONL file consumed by the
// stats site (src/lib/stats/server/printer.ts -> getPrinterHistory).
//
// No-op until the printer is on the network: if PRINTER_BASE_URL is unset the
// script exits 0 quietly, so the timer can be enabled before the device exists.
//
// Env:
//   PRINTER_BASE_URL        Moonraker base, e.g. http://192.168.1.50:7125  (required)
//   PRINTER_CHAMBER_OBJECT  chamber sensor object name (default below)
import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const OUT_PATH = '/var/lib/bristoe-stats/printer-metrics.jsonl';
const MAX_LINES = 2880; // 4 days at 2-min cadence
const TIMEOUT_MS = 5000;

const BASE = (process.env.PRINTER_BASE_URL || '').trim().replace(/\/$/, '');
const CHAMBER = (process.env.PRINTER_CHAMBER_OBJECT || 'temperature_sensor chamber_temp').trim();

async function mfetch(p) {
  const res = await fetch(`${BASE}${p}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Moonraker ${res.status} on ${p}`);
  return res.json();
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function normalizeState(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (['printing', 'paused', 'complete', 'standby', 'error'].includes(s)) return s;
  if (s === 'cancelled' || s === 'canceled') return 'standby';
  return 'unknown';
}

async function collect() {
  const objects = ['print_stats', 'virtual_sdcard', 'display_status', 'extruder', 'heater_bed', 'toolhead', CHAMBER];
  const query = objects.map((o) => encodeURIComponent(o)).join('&');
  const resp = await mfetch(`/printer/objects/query?${query}`);
  const status = resp?.result?.status ?? {};

  const ps = status['print_stats'] ?? {};
  const vsd = status['virtual_sdcard'] ?? {};
  const display = status['display_status'] ?? {};
  const extruder = status['extruder'] ?? {};
  const bed = status['heater_bed'] ?? {};
  const chamber = status[CHAMBER] ?? {};

  let lifetime = null;
  try {
    const totals = await mfetch('/server/history/totals');
    const t = totals?.result?.job_totals;
    if (t) {
      lifetime = {
        totalJobs: Math.round(t.total_jobs ?? 0),
        totalTimeS: Math.round(t.total_time ?? 0),
        totalFilamentMm: Math.round(t.total_filament_used ?? 0),
        completed: 0,
        cancelled: 0
      };
    }
  } catch {
    // history plugin not configured — leave lifetime null
  }

  const progress = num(vsd['progress']) ?? num(display['progress']) ?? 0;
  return {
    t: Date.now(),
    state: normalizeState(ps['state']),
    progressPct: Math.round(progress * 1000) / 10,
    nozzleC: num(extruder['temperature']),
    nozzleTarget: num(extruder['target']),
    bedC: num(bed['temperature']),
    bedTarget: num(bed['target']),
    chamberC: num(chamber['temperature']),
    filename: ps['filename'] || null,
    printDurationS: Math.round(num(ps['print_duration']) ?? 0),
    filamentUsedMm: Math.round(num(ps['filament_used']) ?? 0),
    lifetime
  };
}

async function ensureDir(p) {
  const dir = path.dirname(p);
  try { await access(dir, constants.W_OK); }
  catch { await mkdir(dir, { recursive: true }); }
}

async function appendAndPrune(line) {
  await ensureDir(OUT_PATH);
  let existing = '';
  try { existing = await readFile(OUT_PATH, 'utf8'); } catch {}
  const lines = existing.split('\n').filter(Boolean);
  lines.push(line);
  const trimmed = lines.slice(-MAX_LINES);
  await writeFile(OUT_PATH, trimmed.join('\n') + '\n', { mode: 0o644 });
}

async function main() {
  if (!BASE) {
    // Printer not configured yet — nothing to do.
    return;
  }
  const sample = await collect();
  await appendAndPrune(JSON.stringify(sample));
}

main().catch((err) => {
  console.error('[printer-metrics] collect failed:', err.message ?? err);
  process.exit(1);
});
