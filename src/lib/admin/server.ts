import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { RequestEvent } from '@sveltejs/kit';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/21bristoe-media';
const MANIFEST_PATH = path.join(UPLOADS_DIR, 'manifest.json');
const SITE_CONFIG_PATH = path.join(UPLOADS_DIR, 'site-config.json');
const VISITOR_STATS_PATH = '/var/lib/bristoe-stats/visitors.json';
const LOCK_DIR = `${MANIFEST_PATH}.lock`;
const LOCK_TIMEOUT_MS = 5000;
const LIMON_PATH = path.join(UPLOADS_DIR, 'limon-profile.jpg');
const MEMBER_NAMES = ['faber', 'kasey', 'limon'];

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

interface RateBucket {
  resetAt: number;
  count: number;
}

const rateBuckets = new Map<string, RateBucket>();

function clientIp(event: RequestEvent) {
  // Only trust SvelteKit's getClientAddress(), which honors ADDRESS_HEADER /
  // XFF_DEPTH from adapter-node when configured. Reading X-Real-IP directly
  // from the inbound request would let any client rotate the value to bypass
  // per-IP rate limits and forge audit-log attribution.
  return event.getClientAddress();
}

export function checkAdminRateLimit(event: RequestEvent, kind: 'api' | 'upload') {
  const windowMs = 60_000;
  const max = kind === 'upload' ? 30 : 60;
  const key = `${kind}:${clientIp(event)}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { resetAt: now + windowMs, count: 1 });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= max;
}

function safe(v: unknown, max = 200) {
  if (v === undefined || v === null) return '';
  let s = String(v).replace(/[\x00-\x1f\x7f]/g, '?');
  if (s.length > max) s = `${s.slice(0, max)}...`;
  return s;
}

export function auditLog(action: string, details: string, event: RequestEvent) {
  console.log(`[AUDIT] ${new Date().toISOString()} action=${safe(action, 40)} ip=${safe(clientIp(event), 64)} ${safe(details, 400)}`);
}

function isValidImageBuffer(buffer: Buffer) {
  if (!buffer || buffer.length < 12) return false;
  const b = buffer;
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isGif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return isJpeg || isPng || isGif || isWebp;
}

async function withManifestLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      fs.mkdirSync(LOCK_DIR);
      break;
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() > deadline) throw new Error('Manifest lock timeout after 5s');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  try {
    return await fn();
  } finally {
    try { fs.rmdirSync(LOCK_DIR); } catch {}
  }
}

export function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { images: [], updated: new Date().toISOString() };
  }
}

function writeManifest(manifest: any) {
  manifest.updated = new Date().toISOString();
  const tmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmp, MANIFEST_PATH);
}

function readSiteConfig() {
  try {
    return JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeSiteConfig(config: any) {
  const tmp = `${SITE_CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
  fs.renameSync(tmp, SITE_CONFIG_PATH);
}

const SAFE_PHOTO_FILE = /^[a-zA-Z0-9_-]{1,72}\.(jpg|jpeg|png|webp)$/;
const SAFE_HREF = /^https?:\/\//;
const SITE_CONFIG_ALLOWED_KEYS = new Set(['members', 'visitorTips', 'hero', 'limon', 'quickLinks', 'neighborhoodHighlights', 'sectionText']);

function isPlainString(v: unknown, max: number) {
  return typeof v === 'string' && v.length <= max;
}

export function validateSiteConfig(input: any): { value?: any; error?: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { error: 'Body must be a JSON object' };
  }
  for (const key of Object.keys(input)) {
    if (!SITE_CONFIG_ALLOWED_KEYS.has(key)) return { error: `Unknown key: ${key}` };
  }

  const out: any = {};

  if ('members' in input) {
    if (!Array.isArray(input.members) || input.members.length > 10) return { error: 'members must be an array of 10 or fewer' };
    out.members = [];
    for (const m of input.members) {
      if (typeof m !== 'object' || m === null || Array.isArray(m)) return { error: 'each member must be an object' };
      const cleaned: any = {};
      for (const [field, max] of Object.entries({ name: 60, bio: 500, role: 60, emoji: 8 })) {
        if (field in m) {
          if (!isPlainString(m[field], max)) return { error: `member.${field} must be a string <=${max} chars` };
          cleaned[field] = m[field];
        }
      }
      if ('photoFile' in m && m.photoFile != null) {
        if (!isPlainString(m.photoFile, 80) || !SAFE_PHOTO_FILE.test(m.photoFile)) {
          return { error: 'member.photoFile must be a safe image filename' };
        }
        cleaned.photoFile = m.photoFile;
      }
      out.members.push(cleaned);
    }
  }

  if ('visitorTips' in input) {
    if (!Array.isArray(input.visitorTips) || input.visitorTips.length > 20) return { error: 'visitorTips must be an array of 20 or fewer' };
    out.visitorTips = input.visitorTips.map((t: any) => {
      if (typeof t !== 'object' || t === null || Array.isArray(t)) throw new Error('each tip must be an object');
      if (!isPlainString(t.title, 80)) throw new Error('tip.title must be a string <=80 chars');
      if (!isPlainString(t.body, 500)) throw new Error('tip.body must be a string <=500 chars');
      if ('icon' in t && !isPlainString(t.icon, 8)) throw new Error('tip.icon must be a string <=8 chars');
      return { title: t.title, body: t.body, ...(t.icon ? { icon: t.icon } : {}) };
    });
  }

  if ('hero' in input) {
    if (typeof input.hero !== 'object' || input.hero === null || Array.isArray(input.hero)) return { error: 'hero must be an object' };
    const h: any = {};
    if ('subtitle' in input.hero) {
      if (!isPlainString(input.hero.subtitle, 120)) return { error: 'hero.subtitle must be a string <=120 chars' };
      h.subtitle = input.hero.subtitle;
    }
    if ('location' in input.hero) {
      if (!isPlainString(input.hero.location, 120)) return { error: 'hero.location must be a string <=120 chars' };
      h.location = input.hero.location;
    }
    out.hero = h;
  }

  if ('limon' in input) {
    if (typeof input.limon !== 'object' || input.limon === null || Array.isArray(input.limon)) return { error: 'limon must be an object' };
    const l: any = {};
    for (const [field, max] of Object.entries({ name: 60, breed: 80, specialty: 80, hobbies: 80, mood: 80, quoteAttribution: 80, bio: 500, quote: 300 })) {
      if (field in input.limon) {
        if (!isPlainString(input.limon[field], max)) return { error: `limon.${field} must be a string <=${max} chars` };
        l[field] = input.limon[field];
      }
    }
    out.limon = l;
  }

  if ('quickLinks' in input) {
    if (!Array.isArray(input.quickLinks) || input.quickLinks.length > 10) return { error: 'quickLinks must be an array of 10 or fewer' };
    out.quickLinks = input.quickLinks.map((link: any) => {
      if (!isPlainString(link.title, 80)) throw new Error('quickLink.title must be a string <=80 chars');
      if (!isPlainString(link.description, 300)) throw new Error('quickLink.description must be a string <=300 chars');
      if (!isPlainString(link.href, 300) || !SAFE_HREF.test(link.href)) throw new Error('quickLink.href must be a valid http/https URL <=300 chars');
      return { title: link.title, description: link.description, href: link.href, ...(link.icon ? { icon: link.icon } : {}) };
    });
  }

  if ('neighborhoodHighlights' in input) {
    if (!Array.isArray(input.neighborhoodHighlights) || input.neighborhoodHighlights.length > 8) return { error: 'neighborhoodHighlights must be an array of 8 or fewer' };
    out.neighborhoodHighlights = input.neighborhoodHighlights.map((item: any) => {
      if (!isPlainString(item.title, 80)) throw new Error('neighborhoodHighlight.title must be a string <=80 chars');
      if (!isPlainString(item.description, 300)) throw new Error('neighborhoodHighlight.description must be a string <=300 chars');
      return { title: item.title, description: item.description, ...(item.icon ? { icon: item.icon } : {}) };
    });
  }

  if ('sectionText' in input) {
    if (typeof input.sectionText !== 'object' || input.sectionText === null || Array.isArray(input.sectionText)) return { error: 'sectionText must be an object' };
    out.sectionText = input.sectionText;
  }

  return { value: out };
}

async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

function cleanBaseName(name: string) {
  return path.basename(name, path.extname(name))
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toLowerCase()
    .substring(0, 60) || 'image';
}

export async function uploadImages(files: File[], event: RequestEvent) {
  if (files.length === 0) return { error: 'No files uploaded', status: 400 };
  const results: any[] = [];

  await withManifestLock(async () => {
    const manifest = readManifest();
    for (const file of files.slice(0, 20)) {
      const buffer = await fileToBuffer(file);
      if (buffer.length > 20 * 1024 * 1024) {
        results.push({ originalName: file.name, error: 'File exceeds 20MB' });
        continue;
      }
      if (!isValidImageBuffer(buffer)) {
        auditLog('upload_rejected', `original=${file.name} reason=invalid_signature`, event);
        results.push({ originalName: file.name, error: 'Invalid image file (signature check failed)' });
        continue;
      }
      const filename = `${cleanBaseName(file.name)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const destPath = path.join(UPLOADS_DIR, filename);
      await sharp(buffer)
        .rotate()
        .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toFile(destPath);

      const entry = {
        filename,
        originalName: file.name,
        uploaded: new Date().toISOString(),
        url: `/uploads/${filename}`,
        originalBytes: buffer.length,
        savedBytes: fs.statSync(destPath).size
      };
      manifest.images.unshift(entry);
      results.push(entry);
      auditLog('upload', `file=${filename} original=${file.name} originalBytes=${buffer.length} savedBytes=${entry.savedBytes}`, event);
    }
    writeManifest(manifest);
  });

  return { uploaded: results, total: readManifest().images.length };
}

export async function deleteImage(filenameParam: string, event: RequestEvent) {
  const filename = path.basename(filenameParam);
  return withManifestLock(async () => {
    const manifest = readManifest();
    manifest.images = manifest.images.filter((img: any) => img.filename !== filename);
    writeManifest(manifest);

    let fileRemoved = false;
    try {
      fs.unlinkSync(path.join(UPLOADS_DIR, filename));
      fileRemoved = true;
    } catch {}

    auditLog('delete', `file=${filename} fileRemoved=${fileRemoved}`, event);
    return { deleted: filename, fileRemoved, total: manifest.images.length };
  });
}

export async function reorderImages(order: unknown, event: RequestEvent) {
  if (!Array.isArray(order)) return { error: 'order must be an array of filenames', status: 400 };
  return withManifestLock(async () => {
    const manifest = readManifest();
    const imageMap = Object.fromEntries(manifest.images.map((img: any) => [img.filename, img]));
    manifest.images = order.filter((fn) => imageMap[String(fn)]).map((fn) => imageMap[String(fn)]);
    writeManifest(manifest);
    auditLog('reorder', `count=${manifest.images.length}`, event);
    return { reordered: true, total: manifest.images.length };
  });
}

export function adminStats() {
  const manifest = readManifest();
  let totalBytes = 0;
  let lastUpload: string | null = null;
  for (const img of manifest.images) {
    try { totalBytes += fs.statSync(path.join(UPLOADS_DIR, img.filename)).size; } catch {}
    if (!lastUpload || img.uploaded > lastUpload) lastUpload = img.uploaded;
  }
  let visitorCount: number | null = null;
  try {
    const vData = JSON.parse(fs.readFileSync(VISITOR_STATS_PATH, 'utf8'));
    visitorCount = typeof vData.count === 'number' ? vData.count : (Array.isArray(vData.uniqueHashes) ? vData.uniqueHashes.length : null);
  } catch {}
  return {
    photoCount: manifest.images.length,
    totalBytes,
    lastUpload,
    uptime: Math.round(process.uptime()),
    visitorCount
  };
}

export function resetVisitorCount(event: RequestEvent) {
  const now = new Date().toISOString();
  const fresh = { uniqueHashes: [], count: 0, createdAt: now, updatedAt: now };
  fs.mkdirSync(path.dirname(VISITOR_STATS_PATH), { recursive: true });
  fs.writeFileSync(`${VISITOR_STATS_PATH}.tmp`, JSON.stringify(fresh, null, 2), 'utf8');
  fs.renameSync(`${VISITOR_STATS_PATH}.tmp`, VISITOR_STATS_PATH);
  fs.writeFileSync(path.join(UPLOADS_DIR, 'visitor-count.json.tmp'), JSON.stringify({ count: 0, updatedAt: now }), 'utf8');
  fs.renameSync(path.join(UPLOADS_DIR, 'visitor-count.json.tmp'), path.join(UPLOADS_DIR, 'visitor-count.json'));
  auditLog('visitor_count_reset', 'count reset to 0', event);
  return { message: 'Visitor count reset' };
}

export function getSiteConfig() {
  return readSiteConfig();
}

export function updateSiteConfig(body: any, event: RequestEvent) {
  try {
    const result = validateSiteConfig(body);
    if (result.error) {
      auditLog('site_config_rejected', `reason=${result.error}`, event);
      return { error: result.error, status: 400 };
    }
    writeSiteConfig(result.value);
    auditLog('site_config_update', `keys=${Object.keys(result.value).join(',')}`, event);
    return { ok: true };
  } catch (err: any) {
    return { error: err.message || 'Invalid site config', status: 400 };
  }
}

export async function uploadFixedImage(file: File | null, target: 'limon' | string, event: RequestEvent) {
  if (!file) return { error: 'No file uploaded', status: 400 };
  const buffer = await fileToBuffer(file);
  if (!isValidImageBuffer(buffer)) {
    auditLog(`${target}_upload_rejected`, 'reason=invalid_signature', event);
    return { error: 'Invalid image file (signature check failed)', status: 400 };
  }

  const filename = target === 'limon' ? 'limon-profile.jpg' : `member-${target}.jpg`;
  const destPath = path.join(UPLOADS_DIR, filename);
  await sharp(buffer)
    .rotate()
    .resize(target === 'limon' ? { width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true } : { width: 400, height: 400, fit: 'cover' })
    .jpeg({ quality: 85, progressive: true })
    .toFile(destPath);

  if (target !== 'limon') {
    const cfg = readSiteConfig();
    if (!Array.isArray(cfg.members)) {
      cfg.members = MEMBER_NAMES.map((name) => ({ name: name.charAt(0).toUpperCase() + name.slice(1) }));
    }
    const idx = cfg.members.findIndex((m: any) => m.name && memberKey(m.name) === target);
    if (idx >= 0) cfg.members[idx].photoFile = filename;
    else cfg.members.push({ name: target.charAt(0).toUpperCase() + target.slice(1), photoFile: filename });
    writeSiteConfig(cfg);
  }

  auditLog(target === 'limon' ? 'limon_upload' : 'member_photo_upload', `target=${target} original=${file.name}`, event);
  return { ok: true, url: `/uploads/${filename}` };
}

export function deleteFixedImage(target: 'limon' | string, event: RequestEvent) {
  const filename = target === 'limon' ? 'limon-profile.jpg' : `member-${target}.jpg`;
  let fileRemoved = false;
  try {
    fs.unlinkSync(path.join(UPLOADS_DIR, filename));
    fileRemoved = true;
  } catch {}

  if (target !== 'limon') {
    try {
      const cfg = readSiteConfig();
      if (Array.isArray(cfg.members)) {
        const idx = cfg.members.findIndex((m: any) => m.name && memberKey(m.name) === target);
        if (idx >= 0) delete cfg.members[idx].photoFile;
        writeSiteConfig(cfg);
      }
    } catch {}
  }

  auditLog(target === 'limon' ? 'limon_delete' : 'member_photo_delete', `target=${target} fileRemoved=${fileRemoved}`, event);
  return { ok: true, fileRemoved };
}

export function limonImageStatus() {
  const exists = fs.existsSync(LIMON_PATH);
  return { exists, url: exists ? '/uploads/limon-profile.jpg' : null };
}

export function memberKey(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export async function setOgImage(filenameParam: string, event: RequestEvent) {
  const filename = path.basename(filenameParam);
  return withManifestLock(async () => {
    const manifest = readManifest();
    if (!manifest.images.some((img: any) => img.filename === filename)) {
      return { error: 'Image not found in manifest', status: 404 };
    }
    manifest.ogImageFile = filename;
    writeManifest(manifest);
    auditLog('set_og_image', `file=${filename}`, event);
    return { ok: true, ogImageFile: filename };
  });
}

export async function clearOgImage(event: RequestEvent) {
  return withManifestLock(async () => {
    const manifest = readManifest();
    delete manifest.ogImageFile;
    writeManifest(manifest);
    auditLog('clear_og_image', '', event);
    return { ok: true };
  });
}

export async function batchDelete(filenames: unknown, event: RequestEvent) {
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return { error: 'filenames must be a non-empty array', status: 400 };
  }
  return withManifestLock(async () => {
    const manifest = readManifest();
    const safeNames = filenames.map((f) => path.basename(String(f)));
    manifest.images = manifest.images.filter((img: any) => !safeNames.includes(img.filename));
    writeManifest(manifest);
    let removed = 0;
    for (const fn of safeNames) {
      try {
        fs.unlinkSync(path.join(UPLOADS_DIR, fn));
        removed++;
      } catch {}
    }
    auditLog('batch_delete', `count=${safeNames.length} removed=${removed}`, event);
    return { ok: true, deleted: safeNames.length, filesRemoved: removed, total: manifest.images.length };
  });
}
