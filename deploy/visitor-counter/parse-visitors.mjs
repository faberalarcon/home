#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import crypto from 'node:crypto';

const NGINX_LOG_DIR = '/var/log/nginx';
const DATA_DIR = '/var/lib/bristoe-stats';
const DATA_FILE = path.join(DATA_DIR, 'visitors.json');
const PUBLIC_COUNT_FILE = '/var/www/21bristoe-media/visitor-count.json';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const BACKFILL = args.has('--backfill');

const BOT_UA = /bot|crawler|spider|curl|wget|scanner|httpclient|feed|monitor|preview|validator|facebookexternalhit|slurp|duckduck|semrush|ahrefs|petal/i;
const ASSET_PATH = /\.(css|js|mjs|map|png|jpe?g|webp|avif|ico|svg|woff2?|ttf|otf|gif|mp4|webm|json|xml|txt)(\?|$)/i;
const ASSET_DIR = /^\/(uploads|assets|_app|_astro|fonts)\//;
const SKIP_PATH = /^\/(health|api|favicon\.ico|robots\.txt|sitemap\.xml)(\/|$|\?)/;
// Common WP/exploit probes — not real visitors
const PROBE_PATH = /^\/(wp-|wordpress|xmlrpc|phpmyadmin|\.env|\.git|admin\.php|setup-config|vendor\/|cgi-bin|actuator|boaform|HNAP1|owa\/|autodiscover)/i;
const SKIP_HOST = /^(admin\.21bristoe\.com)$/i;

// Log formats:
//   legacy:    <ip> <ident> <user> [<time>] "METHOD path HTTP/x" status bytes "referer" "ua"
//   main_host: <host> <ip> <ident> <user> [<time>] "METHOD path HTTP/x" status bytes "referer" "ua"
// Optional leading host token is non-IP; IP may be v4 or v6.
const LOG_RE = /^(?:(\S+)\s+)?(\S+)\s+\S+\s+\S+\s+\[[^\]]+\]\s+"(\S+)\s+(\S+)\s+[^"]*"\s+(\d{3})\s+\S+\s+"[^"]*"\s+"([^"]*)"/;
const IP_LIKE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;

function hashVisitor(ip, ua) {
  return crypto.createHash('sha256').update(`${ip}\n${ua}`).digest('hex').slice(0, 16);
}

function parseLine(line) {
  const m = LOG_RE.exec(line);
  if (!m) return null;
  // m[1] = optional host, m[2] = ip, m[3] = method, m[4] = path, m[5] = status, m[6] = ua
  let host = m[1] || null;
  let ip = m[2];
  // If host looks like an IP, this is legacy format captured wrong — swap.
  if (host && IP_LIKE.test(host) && !IP_LIKE.test(ip)) {
    // Defensive: shouldn't happen with the regex above, but guard anyway.
    const tmp = host; host = null; ip = tmp;
  }
  return { host, ip, method: m[3], path: m[4], status: Number(m[5]), ua: m[6] };
}

function shouldCount(entry) {
  if (!entry) return false;
  if (entry.method !== 'GET') return false;
  if (entry.status < 200 || entry.status >= 400) return false;
  if (entry.host && SKIP_HOST.test(entry.host)) return false;
  if (BOT_UA.test(entry.ua || '')) return false;
  if (!entry.ua || entry.ua === '-' || entry.ua.length < 10) return false;
  const p = entry.path.split('?')[0];
  if (ASSET_DIR.test(p)) return false;
  if (ASSET_PATH.test(p)) return false;
  if (SKIP_PATH.test(p)) return false;
  if (PROBE_PATH.test(p)) return false;
  return true;
}

async function processStream(stream, seen, counters) {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    counters.total++;
    const e = parseLine(line);
    if (!shouldCount(e)) { counters.skipped++; continue; }
    const h = hashVisitor(e.ip, e.ua);
    if (!seen.has(h)) {
      seen.add(h);
      const hostKey = e.host || 'unknown';
      counters.byHost[hostKey] = (counters.byHost[hostKey] || 0) + 1;
    }
    counters.counted++;
  }
}

function listLogFiles({ includeRotated }) {
  const files = [];
  const current = path.join(NGINX_LOG_DIR, 'access.log');
  if (fs.existsSync(current)) files.push(current);
  if (includeRotated) {
    const rot1 = path.join(NGINX_LOG_DIR, 'access.log.1');
    if (fs.existsSync(rot1)) files.push(rot1);
    for (let i = 2; i <= 14; i++) {
      const f = path.join(NGINX_LOG_DIR, `access.log.${i}.gz`);
      if (fs.existsSync(f)) files.push(f);
    }
  } else {
    // hourly run: also read .1 (plain) to catch the transition hour around rotation
    const rot1 = path.join(NGINX_LOG_DIR, 'access.log.1');
    if (fs.existsSync(rot1)) files.push(rot1);
  }
  return files;
}

function loadExisting() {
  if (!fs.existsSync(DATA_FILE)) {
    return { uniqueHashes: [], createdAt: new Date().toISOString() };
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.uniqueHashes)) data.uniqueHashes = [];
    return data;
  } catch (err) {
    console.error(`[visitors] failed to read existing file, starting fresh: ${err.message}`);
    return { uniqueHashes: [], createdAt: new Date().toISOString() };
  }
}

function writeData(data) {
  if (DRY_RUN) {
    console.log('[visitors] --dry-run: would write', DATA_FILE);
    return;
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);

  // Write a small public file served at /uploads/visitor-count.json so the
  // homepage footer can fetch the live count without a full site rebuild.
  try {
    const pub = { count: data.count, updatedAt: data.updatedAt };
    const pubTmp = `${PUBLIC_COUNT_FILE}.tmp`;
    fs.writeFileSync(pubTmp, JSON.stringify(pub));
    fs.renameSync(pubTmp, PUBLIC_COUNT_FILE);
  } catch (err) {
    console.warn(`[visitors] could not write public count file: ${err.message}`);
  }
}

async function main() {
  const existing = loadExisting();
  const seen = new Set(existing.uniqueHashes);
  const initialCount = seen.size;
  const counters = { total: 0, counted: 0, skipped: 0, byHost: {} };

  const files = listLogFiles({ includeRotated: BACKFILL });
  console.log(`[visitors] scanning ${files.length} file(s)${BACKFILL ? ' (backfill)' : ''}${DRY_RUN ? ' (dry-run)' : ''}`);

  for (const file of files) {
    try {
      const stream = file.endsWith('.gz')
        ? fs.createReadStream(file).pipe(zlib.createGunzip())
        : fs.createReadStream(file);
      await processStream(stream, seen, counters);
    } catch (err) {
      console.error(`[visitors] failed to read ${file}: ${err.message}`);
    }
  }

  const finalCount = seen.size;
  const added = finalCount - initialCount;

  const data = {
    uniqueHashes: Array.from(seen),
    count: finalCount,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRun: {
      mode: BACKFILL ? 'backfill' : 'incremental',
      linesScanned: counters.total,
      linesCounted: counters.counted,
      linesSkipped: counters.skipped,
      added,
      byHost: counters.byHost
    }
  };

  writeData(data);
  console.log(`[visitors] total unique: ${finalCount} (+${added}), scanned ${counters.total} lines, counted ${counters.counted}, skipped ${counters.skipped}`);
  if (Object.keys(counters.byHost).length) {
    console.log(`[visitors] new uniques by host:`, counters.byHost);
  }
}

main().catch((err) => {
  console.error('[visitors] fatal:', err);
  process.exit(1);
});
