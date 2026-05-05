#!/usr/bin/env node
import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';

const OUT_PATH = '/var/lib/bristoe-stats/pi-metrics.jsonl';
const MAX_LINES = 2016; // 7d at 5-min cadence

function parseCpuLine(s) {
  const m = s.match(/^cpu\s+([\s\d]+)/);
  if (!m) return null;
  const fields = m[1].trim().split(/\s+/).map(Number);
  // user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice
  const [user=0, nice=0, system=0, idle=0, iowait=0, irq=0, softirq=0, steal=0] = fields;
  const idleAll = idle + iowait;
  const nonIdle = user + nice + system + irq + softirq + steal;
  return { idleAll, total: idleAll + nonIdle };
}

async function readCpuPct() {
  const a = parseCpuLine(await readFile('/proc/stat', 'utf8'));
  await sleep(500);
  const b = parseCpuLine(await readFile('/proc/stat', 'utf8'));
  if (!a || !b) return null;
  const totalDiff = b.total - a.total;
  const idleDiff = b.idleAll - a.idleAll;
  if (totalDiff <= 0) return 0;
  return Math.round(((totalDiff - idleDiff) / totalDiff) * 1000) / 10;
}

async function readMem() {
  const txt = await readFile('/proc/meminfo', 'utf8');
  const grab = (k) => {
    const m = txt.match(new RegExp(`^${k}:\\s+(\\d+)\\s+kB`, 'm'));
    return m ? Number(m[1]) : 0;
  };
  const totalKb = grab('MemTotal');
  const availKb = grab('MemAvailable');
  const usedKb = totalKb - availKb;
  return {
    memUsedMb: Math.round(usedKb / 1024),
    memTotalMb: Math.round(totalKb / 1024),
    memPct: totalKb > 0 ? Math.round((usedKb / totalKb) * 1000) / 10 : 0
  };
}

async function readTempC() {
  try {
    const raw = await readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
    const milli = Number(raw.trim());
    if (Number.isNaN(milli)) return null;
    return Math.round((milli / 1000) * 10) / 10;
  } catch {
    return null;
  }
}

async function readNet() {
  const txt = await readFile('/proc/net/dev', 'utf8');
  let rx = 0, tx = 0;
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([^:]+):\s*(.+)$/);
    if (!m) continue;
    const iface = m[1].trim();
    if (iface === 'lo') continue;
    if (iface.startsWith('docker') || iface.startsWith('veth') || iface.startsWith('br-')) continue;
    const parts = m[2].trim().split(/\s+/).map(Number);
    rx += parts[0] || 0;
    tx += parts[8] || 0;
  }
  return { rxBytes: rx, txBytes: tx };
}

async function readLoad() {
  const txt = await readFile('/proc/loadavg', 'utf8');
  const parts = txt.trim().split(/\s+/);
  return Number(parts[0]) || 0;
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
  const [cpuPct, mem, tempC, net, load1] = await Promise.all([
    readCpuPct(),
    readMem(),
    readTempC(),
    readNet(),
    readLoad()
  ]);
  const sample = {
    t: Date.now(),
    cpuPct,
    memPct: mem.memPct,
    memUsedMb: mem.memUsedMb,
    memTotalMb: mem.memTotalMb,
    tempC,
    rxBytes: net.rxBytes,
    txBytes: net.txBytes,
    load1
  };
  await appendAndPrune(JSON.stringify(sample));
}

main().catch((err) => {
  console.error('[pi-metrics] collect failed:', err);
  process.exit(1);
});
