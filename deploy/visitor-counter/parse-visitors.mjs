#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { createRequire } from 'node:module';
import maxmind from 'maxmind';

const require = createRequire(import.meta.url);

const NGINX_LOG_DIR = '/var/log/nginx';
const DATA_DIR = '/var/lib/bristoe-stats';
const DATA_FILE = path.join(DATA_DIR, 'visitors.json');
const PUBLIC_COUNT_FILE = '/var/www/21bristoe-media/visitor-count.json';
const DBIP_PACKAGE_DIR = path.dirname(require.resolve('@ip-location-db/dbip-city-mmdb/package.json'));
const DBIP_IPV4_FILE = path.join(DBIP_PACKAGE_DIR, 'dbip-city-ipv4.mmdb');
const DBIP_IPV6_FILE = path.join(DBIP_PACKAGE_DIR, 'dbip-city-ipv6.mmdb');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const BACKFILL = args.has('--backfill');

const BOT_UA = /bot|crawler|spider|curl|wget|scanner|httpclient|feed|monitor|preview|validator|facebookexternalhit|slurp|duckduck|semrush|ahrefs|petal|zgrab|python-requests|masscan|censys|internetdb|expanse/i;
const ASSET_PATH = /\.(css|js|mjs|map|png|jpe?g|webp|avif|ico|svg|woff2?|ttf|otf|gif|mp4|webm|json|xml|txt|webmanifest)(\?|$)/i;
const ASSET_DIR = /^\/(uploads|assets|_app|_astro|fonts)\//;
const SKIP_PATH = /^\/(health|api|favicon\.ico|robots\.txt|sitemap\.xml)(\/|$|\?)/;
const PROBE_PATH = /(^|\/)(wp-|wordpress|xmlrpc|phpmyadmin|\.env|\.git|admin\.php|setup-config|vendor\/|cgi-bin|actuator|boaform|HNAP1|owa\/|autodiscover|\.aws|debug\.php|info\.php|phpinfo\.php|php\.php|phpversion\.php|test\.php)/i;
const BRISTOE_HOST = /^([a-z0-9-]+\.)?21bristoe\.com$/i;
const SKIP_HOST = /^admin\.21bristoe\.com$/i;

// main_host: <host> <ip> <ident> <user> [<time>] "METHOD path HTTP/x" status bytes "referer" "ua"
// legacy:    <ip> <ident> <user> [<time>] "METHOD path HTTP/x" status bytes "referer" "ua"
const LOG_RE = /^(?:(\S+)\s+)?(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+[^"]*"\s+(\d{3})\s+\S+\s+"[^"]*"\s+"([^"]*)"/;
const IP_LIKE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;
const DATE_RE = /^(\d{2})\/(\w{3})\/(\d{4})/;
const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};
const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

function hashVisitor(ip, ua) {
  return crypto.createHash('sha256').update(`${ip}\n${ua}`).digest('hex').slice(0, 16);
}

function parseDay(time) {
  const m = DATE_RE.exec(time || '');
  if (!m) return 'unknown';
  return `${m[3]}-${MONTHS[m[2]] || '01'}-${m[1]}`;
}

function parseLine(line) {
  const m = LOG_RE.exec(line);
  if (!m) return null;
  let host = m[1] || null;
  let ip = m[2];
  if (host && IP_LIKE.test(host) && !IP_LIKE.test(ip)) {
    const tmp = host; host = null; ip = tmp;
  }
  return { host, ip, time: m[3], method: m[4], path: m[5], status: Number(m[6]), ua: m[7] };
}

function normalizedPath(pathname) {
  const p = pathname.split('?')[0].replace(/\/$/, '');
  return p || '/';
}

function isKnownAppRoute(host, pathname) {
  const p = normalizedPath(pathname);
  const h = (host || '').toLowerCase();
  if (h === '21bristoe.com' || h === 'www.21bristoe.com') {
    return p === '/' || p === '/gallery';
  }
  if (h === 'stats.21bristoe.com') {
    return ['/', '/house', '/drinks', '/pi', '/backups', '/visitors'].includes(p);
  }
  if (h === 'drink-hub.21bristoe.com') {
    return ['/', '/login', '/menu', '/recent', '/stats', '/kiosk'].includes(p);
  }
  return false;
}

function shouldCount(entry) {
  if (!entry) return false;
  if (entry.method !== 'GET') return false;
  if (entry.status < 200 || entry.status >= 400) return false;
  if (!entry.host || !BRISTOE_HOST.test(entry.host)) return false;
  if (SKIP_HOST.test(entry.host)) return false;
  if (!isIP(entry.ip)) return false;
  if (BOT_UA.test(entry.ua || '')) return false;
  if (!entry.ua || entry.ua === '-' || entry.ua.length < 10) return false;
  const p = entry.path.split('?')[0];
  if (ASSET_DIR.test(p)) return false;
  if (ASSET_PATH.test(p)) return false;
  if (SKIP_PATH.test(p)) return false;
  if (PROBE_PATH.test(p)) return false;
  if (!isKnownAppRoute(entry.host, entry.path)) return false;
  return true;
}

async function openGeoLookups() {
  try {
    const [ipv4, ipv6] = await Promise.all([
      maxmind.open(DBIP_IPV4_FILE, { cache: { max: 10000 } }),
      maxmind.open(DBIP_IPV6_FILE, { cache: { max: 10000 } })
    ]);
    return { available: true, ipv4, ipv6, error: null };
  } catch (err) {
    console.warn(`[visitors] geo lookup unavailable: ${err.message}`);
    return { available: false, ipv4: null, ipv6: null, error: err.message };
  }
}

function countryName(code) {
  if (!code) return 'Unknown';
  try {
    return COUNTRY_NAMES.of(code) || code;
  } catch {
    return code;
  }
}

function cleanPart(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function roundCoord(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : null;
}

function createGeoAccumulator(existingGeo) {
  const byCountry = new Map();
  const byRegion = new Map();
  const byCity = new Map();
  const daily = new Map();

  for (const row of existingGeo?.byCountry || []) {
    if (row?.code) byCountry.set(row.code, { ...row });
  }
  for (const row of existingGeo?.byRegion || []) {
    if (row?.key) byRegion.set(row.key, { ...row });
  }
  for (const row of existingGeo?.byCity || []) {
    if (row?.key) byCity.set(row.key, { ...row });
  }
  for (const row of existingGeo?.daily || []) {
    if (row?.date) daily.set(row.date, Number(row.count) || 0);
  }

  return {
    hashes: new Set(Array.isArray(existingGeo?.uniqueHashes) ? existingGeo.uniqueHashes : []),
    locatedCount: Number(existingGeo?.locatedCount) || 0,
    unknownCount: Number(existingGeo?.unknownCount) || 0,
    byCountry,
    byRegion,
    byCity,
    daily
  };
}

function increment(map, key, row) {
  const current = map.get(key);
  if (current) {
    current.count += 1;
    return;
  }
  map.set(key, { ...row, count: 1 });
}

function lookupGeo(ip, geoLookup) {
  if (!geoLookup.available) return null;
  const family = isIP(ip);
  try {
    return family === 6 ? geoLookup.ipv6.get(ip) : geoLookup.ipv4.get(ip);
  } catch {
    return null;
  }
}

function addGeo(entry, hash, geo, geoLookup) {
  if (geo.hashes.has(hash)) return;
  if (!geoLookup.available) return;

  geo.hashes.add(hash);
  const day = parseDay(entry.time);
  geo.daily.set(day, (geo.daily.get(day) || 0) + 1);

  const record = lookupGeo(entry.ip, geoLookup);
  const countryCode = cleanPart(record?.country_code).toUpperCase();
  if (!countryCode) {
    geo.unknownCount += 1;
    return;
  }

  const country = countryName(countryCode);
  const region = cleanPart(record?.state1) || cleanPart(record?.state2);
  const city = cleanPart(record?.city);
  geo.locatedCount += 1;

  increment(geo.byCountry, countryCode, { code: countryCode, name: country });

  if (region) {
    const regionKey = `${countryCode}|${region}`;
    increment(geo.byRegion, regionKey, { key: regionKey, countryCode, countryName: country, region });
  }

  if (city) {
    const cityKey = `${countryCode}|${region || ''}|${city}`;
    increment(geo.byCity, cityKey, {
      key: cityKey,
      countryCode,
      countryName: country,
      region: region || '',
      city,
      latitude: roundCoord(record?.latitude),
      longitude: roundCoord(record?.longitude)
    });
  }
}

async function processStream(stream, seen, geo, geoLookup, counters) {
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
    addGeo(e, h, geo, geoLookup);
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

function withPercent(rows, total) {
  const denominator = total > 0 ? total : 1;
  return rows
    .map((row) => ({ ...row, percent: Math.round((row.count / denominator) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count || String(a.name || a.region || a.city).localeCompare(String(b.name || b.region || b.city)));
}

function finalizeGeo(geo, geoLookup, existingGeo, now) {
  const totalLocated = geo.locatedCount + geo.unknownCount;
  const hasExisting = Boolean(existingGeo);
  const status = geoLookup.available ? 'ok' : hasExisting ? 'stale' : 'unavailable';
  const byCountry = withPercent(Array.from(geo.byCountry.values()), totalLocated);
  const byRegion = withPercent(Array.from(geo.byRegion.values()), totalLocated);
  const byCity = withPercent(Array.from(geo.byCity.values()), totalLocated);
  const daily = Array.from(geo.daily.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    status,
    error: geoLookup.available ? null : geoLookup.error,
    source: 'DB-IP Lite City MMDB',
    attribution: {
      label: 'IP Geolocation by DB-IP',
      href: 'https://db-ip.com/'
    },
    database: {
      package: '@ip-location-db/dbip-city-mmdb',
      version: require('@ip-location-db/dbip-city-mmdb/package.json').version
    },
    updatedAt: geoLookup.available ? now : existingGeo?.updatedAt ?? null,
    uniqueHashes: Array.from(geo.hashes),
    locatedCount: geo.locatedCount,
    unknownCount: geo.unknownCount,
    countryCount: byCountry.length,
    regionCount: byRegion.length,
    cityCount: byCity.length,
    byCountry,
    byRegion,
    byCity,
    daily
  };
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
  const seen = new Set(BACKFILL ? [] : existing.uniqueHashes);
  const initialCount = seen.size;
  const geo = createGeoAccumulator(BACKFILL ? null : existing.geo);
  const geoLookup = await openGeoLookups();
  const counters = { total: 0, counted: 0, skipped: 0, byHost: {} };

  const files = listLogFiles({ includeRotated: BACKFILL });
  console.log(`[visitors] scanning ${files.length} file(s)${BACKFILL ? ' (backfill)' : ''}${DRY_RUN ? ' (dry-run)' : ''}`);

  for (const file of files) {
    try {
      const stream = file.endsWith('.gz')
        ? fs.createReadStream(file).pipe(zlib.createGunzip())
        : fs.createReadStream(file);
      await processStream(stream, seen, geo, geoLookup, counters);
    } catch (err) {
      console.error(`[visitors] failed to read ${file}: ${err.message}`);
    }
  }

  const finalCount = seen.size;
  const added = finalCount - initialCount;
  const now = new Date().toISOString();
  const geoData = finalizeGeo(geo, geoLookup, existing.geo, now);

  const data = {
    uniqueHashes: Array.from(seen),
    count: finalCount,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    geo: geoData,
    lastRun: {
      mode: BACKFILL ? 'backfill' : 'incremental',
      linesScanned: counters.total,
      linesCounted: counters.counted,
      linesSkipped: counters.skipped,
      added,
      byHost: counters.byHost,
      geoStatus: geoData.status,
      locatedVisitors: geoData.locatedCount,
      unknownVisitors: geoData.unknownCount
    }
  };

  writeData(data);
  console.log(`[visitors] total unique: ${finalCount} (+${added}), scanned ${counters.total} lines, counted ${counters.counted}, skipped ${counters.skipped}`);
  console.log(`[visitors] geo: ${geoData.status}, located ${geoData.locatedCount}, unknown ${geoData.unknownCount}, countries ${geoData.countryCount}, regions ${geoData.regionCount}, cities ${geoData.cityCount}`);
  if (Object.keys(counters.byHost).length) {
    console.log('[visitors] new uniques by host:', counters.byHost);
  }
}

main().catch((err) => {
  console.error('[visitors] fatal:', err);
  process.exit(1);
});
