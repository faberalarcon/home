'use strict';

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/21bristoe-media';
const MANIFEST_PATH = path.join(UPLOADS_DIR, 'manifest.json');
const SITE_CONFIG_PATH = path.join(UPLOADS_DIR, 'site-config.json');
const DEPLOY_SCRIPT = process.env.DEPLOY_SCRIPT || '/home/faber/projects/home/deploy/deploy.sh';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET || '';

if (IS_PRODUCTION && !ADMIN_SHARED_SECRET) {
  console.error('[FATAL] ADMIN_SHARED_SECRET is required in production. Refusing to start.');
  process.exit(1);
}

// Ensure uploads directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- Magic byte validation ---
// Verifies file buffer against known image signatures (not just client-provided MIME type)
function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 12) return false;
  const b = buffer;
  const isJpeg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  const isPng  = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  const isGif  = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
  // WebP: RIFF....WEBP
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                 b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return isJpeg || isPng || isGif || isWebp;
}

// --- Audit logging (captured by journalctl via stdout) ---
// Strip CR/LF and other control chars from any value that may be attacker-
// controlled (originalname, header values, filenames in route params/body).
// Without this, an upload with originalname="a.jpg\n[AUDIT] action=delete ..."
// would forge fake audit-log entries that look identical to real ones.
function safe(v, max = 200) {
  if (v === undefined || v === null) return '';
  let s = String(v);
  // Drop ASCII control chars (incl. CR, LF, NUL, ESC) and DEL.
  s = s.replace(/[\x00-\x1f\x7f]/g, '?');
  if (s.length > max) s = s.slice(0, max) + '…';
  return s;
}

function auditLog(action, details, req) {
  const ipRaw = req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  console.log(`[AUDIT] ${new Date().toISOString()} action=${safe(action, 40)} ip=${safe(ipRaw, 64)} ${safe(details, 400)}`);
}

// --- Rate limiters ---
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many upload requests — please wait a moment' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests — please wait a moment' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Defense-in-depth: shared-secret check between nginx and this app ---
// nginx injects `X-Admin-Auth: <secret>` from /etc/nginx/admin-secret.conf.
// In production, requests without a matching secret are rejected — preventing
// any process that can reach localhost:3001 (or forge X-Forwarded-Proto) from
// hitting these endpoints. Constant-time compare to avoid timing oracles.
function requireProxyAuth(req, res, next) {
  if (!IS_PRODUCTION) return next();
  const supplied = req.headers['x-admin-auth'] || '';
  const expected = ADMIN_SHARED_SECRET;
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn(`[WARN] Auth-failed admin request blocked: ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// --- Multer: accept images into memory, then process with sharp ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// --- Site-config schema validation ---
// site-config.json is read at build time by Astro components and rendered into
// the public homepage. We allowlist exactly the shapes the templates consume,
// to prevent arbitrary JSON from being persisted and surfaced to visitors.

const SAFE_PHOTO_FILE = /^[a-zA-Z0-9_-]{1,72}\.(jpg|jpeg|png|webp)$/;
const MAX_MEMBERS = 10;
const MAX_TIPS = 20;
const SITE_CONFIG_ALLOWED_KEYS = new Set(['members', 'visitorTips']);

function isPlainString(v, max) {
  return typeof v === 'string' && v.length <= max;
}

function validateSiteConfig(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { error: 'Body must be a JSON object' };
  }
  for (const key of Object.keys(input)) {
    if (!SITE_CONFIG_ALLOWED_KEYS.has(key)) {
      return { error: `Unknown key: ${key}` };
    }
  }
  const out = {};

  if ('members' in input) {
    if (!Array.isArray(input.members)) return { error: 'members must be an array' };
    if (input.members.length > MAX_MEMBERS) return { error: `members exceeds ${MAX_MEMBERS}` };
    out.members = [];
    for (const m of input.members) {
      if (typeof m !== 'object' || m === null || Array.isArray(m)) {
        return { error: 'each member must be an object' };
      }
      const cleaned = {};
      if ('name' in m) {
        if (!isPlainString(m.name, 60)) return { error: 'member.name must be a string ≤60 chars' };
        cleaned.name = m.name;
      }
      if ('bio' in m) {
        if (!isPlainString(m.bio, 500)) return { error: 'member.bio must be a string ≤500 chars' };
        cleaned.bio = m.bio;
      }
      if ('role' in m) {
        if (!isPlainString(m.role, 60)) return { error: 'member.role must be a string ≤60 chars' };
        cleaned.role = m.role;
      }
      if ('emoji' in m) {
        if (!isPlainString(m.emoji, 8)) return { error: 'member.emoji must be a string ≤8 chars' };
        cleaned.emoji = m.emoji;
      }
      if ('photoFile' in m && m.photoFile !== null && m.photoFile !== undefined) {
        if (!isPlainString(m.photoFile, 80) || !SAFE_PHOTO_FILE.test(m.photoFile)) {
          return { error: 'member.photoFile must be a safe image filename' };
        }
        cleaned.photoFile = m.photoFile;
      }
      out.members.push(cleaned);
    }
  }

  if ('visitorTips' in input) {
    if (!Array.isArray(input.visitorTips)) return { error: 'visitorTips must be an array' };
    if (input.visitorTips.length > MAX_TIPS) return { error: `visitorTips exceeds ${MAX_TIPS}` };
    out.visitorTips = [];
    for (const t of input.visitorTips) {
      if (typeof t !== 'object' || t === null || Array.isArray(t)) {
        return { error: 'each tip must be an object' };
      }
      const cleaned = {};
      if (!isPlainString(t.title, 80)) return { error: 'tip.title must be a string ≤80 chars' };
      if (!isPlainString(t.body, 500)) return { error: 'tip.body must be a string ≤500 chars' };
      if ('icon' in t && !isPlainString(t.icon, 8)) return { error: 'tip.icon must be a string ≤8 chars' };
      cleaned.title = t.title;
      cleaned.body = t.body;
      if (t.icon) cleaned.icon = t.icon;
      out.visitorTips.push(cleaned);
    }
  }

  return { value: out };
}

// --- Manifest helpers ---

const LOCK_DIR = MANIFEST_PATH + '.lock';
const LOCK_TIMEOUT_MS = 5000;

// Acquire a filesystem lock before manifest read-modify-write to prevent race conditions.
// Uses mkdirSync which is atomic on Linux/POSIX filesystems.
async function withManifestLock(fn) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      fs.mkdirSync(LOCK_DIR);
      break; // lock acquired
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() > deadline) throw new Error('Manifest lock timeout after 5s');
      await new Promise(r => setTimeout(r, 50));
    }
  }
  try {
    return await fn();
  } finally {
    try { fs.rmdirSync(LOCK_DIR); } catch { /* ignore — lock cleanup */ }
  }
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { images: [], updated: new Date().toISOString() };
  }
}

// Atomic write: write to .tmp then rename (rename is atomic on Linux) to
// prevent a corrupt manifest.json if the process crashes mid-write.
function writeManifest(manifest) {
  manifest.updated = new Date().toISOString();
  const tmp = MANIFEST_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmp, MANIFEST_PATH);
}

// Apply shared-secret guard to ALL routes (static UI + API + rebuild).
// Must come before the static handler so unauthed clients can't even fetch index.html.
app.use(requireProxyAuth);

// --- Static admin UI ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- API: health check ---
app.get('/api/health', (_req, res) => {
  const manifest = readManifest();
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    imageCount: manifest.images.length,
    manifestValid: true,
  });
});

// --- API: list images ---
app.get('/api/images', apiLimiter, (_req, res) => {
  const manifest = readManifest();
  res.json(manifest);
});

// --- API: upload images ---
app.post('/api/upload', uploadLimiter, upload.array('images', 20), async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const results = [];

  try {
    await withManifestLock(async () => {
      const manifest = readManifest();

      for (const file of req.files) {
        try {
          // Validate magic bytes — MIME type is client-provided and not trustworthy
          if (!isValidImageBuffer(file.buffer)) {
            auditLog('upload_rejected', `original=${file.originalname} reason=invalid_signature`, req);
            results.push({ originalName: file.originalname, error: 'Invalid image file (signature check failed)' });
            continue;
          }

          const base = path.basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .toLowerCase()
            .substring(0, 60);
          const timestamp = Date.now();
          const filename = `${base}-${timestamp}.jpg`;
          const destPath = path.join(UPLOADS_DIR, filename);

          await sharp(file.buffer)
            .rotate() // auto-rotate from EXIF
            .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, progressive: true })
            .toFile(destPath);

          const originalBytes = file.buffer.length;
          const savedBytes = fs.statSync(destPath).size;
          const entry = {
            filename,
            originalName: file.originalname,
            uploaded: new Date().toISOString(),
            url: `/uploads/${filename}`,
            originalBytes,
            savedBytes,
          };
          manifest.images.unshift(entry); // newest first
          results.push(entry);
          auditLog('upload', `file=${filename} original=${file.originalname} originalBytes=${originalBytes} savedBytes=${savedBytes}`, req);
        } catch (err) {
          console.error(`[ERROR] Upload failed for ${safe(file.originalname, 80)}:`, err.message);
          results.push({ originalName: file.originalname, error: err.message });
        }
      }

      writeManifest(manifest);
    });
  } catch (err) {
    return next(err);
  }

  const manifest = readManifest();
  res.json({ uploaded: results, total: manifest.images.length });
});

// --- API: delete image ---
app.delete('/api/images/:filename', apiLimiter, async (req, res, next) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(UPLOADS_DIR, filename);

  try {
    await withManifestLock(async () => {
      const manifest = readManifest();
      manifest.images = manifest.images.filter(img => img.filename !== filename);
      writeManifest(manifest);

      let fileRemoved = false;
      try {
        fs.unlinkSync(filePath);
        fileRemoved = true;
      } catch (err) {
        console.warn(`[WARN] Could not delete file ${filename}: ${err.message}`);
      }

      auditLog('delete', `file=${filename} fileRemoved=${fileRemoved}`, req);
      res.json({ deleted: filename, fileRemoved, total: manifest.images.length });
    });
  } catch (err) {
    next(err);
  }
});

// --- API: Limón profile photo (fixed path, not in manifest) ---
const LIMON_PATH = path.join(UPLOADS_DIR, 'limon-profile.jpg');

app.get('/api/limon-image', apiLimiter, (_req, res) => {
  const exists = fs.existsSync(LIMON_PATH);
  res.json({ exists, url: exists ? `/uploads/limon-profile.jpg` : null });
});

app.post('/api/limon-image', uploadLimiter, upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    if (!isValidImageBuffer(req.file.buffer)) {
      auditLog('limon_upload_rejected', `reason=invalid_signature`, req);
      return res.status(400).json({ error: 'Invalid image file (signature check failed)' });
    }

    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toFile(LIMON_PATH);

    auditLog('limon_upload', `original=${req.file.originalname}`, req);
    res.json({ ok: true, url: `/uploads/limon-profile.jpg` });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/limon-image', apiLimiter, (req, res) => {
  let fileRemoved = false;
  try {
    fs.unlinkSync(LIMON_PATH);
    fileRemoved = true;
  } catch (err) {
    console.warn(`[WARN] Could not delete limon-profile.jpg: ${err.message}`);
  }
  auditLog('limon_delete', `fileRemoved=${fileRemoved}`, req);
  res.json({ ok: true, fileRemoved });
});

// --- API: reorder images (drag-and-drop reorder) ---
app.put('/api/images/reorder', apiLimiter, async (req, res, next) => {
  const { order } = req.body; // array of filenames in new order
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of filenames' });
  }

  try {
    await withManifestLock(async () => {
      const manifest = readManifest();
      const imageMap = Object.fromEntries(manifest.images.map(img => [img.filename, img]));
      manifest.images = order
        .filter(fn => imageMap[fn])
        .map(fn => imageMap[fn]);
      writeManifest(manifest);
      auditLog('reorder', `count=${manifest.images.length}`, req);
      res.json({ reordered: true, total: manifest.images.length });
    });
  } catch (err) {
    next(err);
  }
});

// --- API: stats (D1) ---
app.get('/api/stats', apiLimiter, (_req, res) => {
  const manifest = readManifest();
  let totalBytes = 0;
  let lastUpload = null;
  for (const img of manifest.images) {
    const fp = path.join(UPLOADS_DIR, img.filename);
    try { totalBytes += fs.statSync(fp).size; } catch { /* file missing */ }
    if (!lastUpload || img.uploaded > lastUpload) lastUpload = img.uploaded;
  }
  res.json({
    photoCount: manifest.images.length,
    totalBytes,
    lastUpload,
    uptime: Math.round(process.uptime()),
  });
});

// --- API: site config (A4 / A5) ---
app.get('/api/site-config', apiLimiter, (_req, res) => {
  try {
    const raw = fs.readFileSync(SITE_CONFIG_PATH, 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.json({});
  }
});

app.put('/api/site-config', apiLimiter, async (req, res, next) => {
  try {
    const result = validateSiteConfig(req.body);
    if (result.error) {
      auditLog('site_config_rejected', `reason=${result.error}`, req);
      return res.status(400).json({ error: result.error });
    }
    const cfg = result.value;
    // Atomic write
    const tmp = SITE_CONFIG_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
    fs.renameSync(tmp, SITE_CONFIG_PATH);
    auditLog('site_config_update', `keys=${Object.keys(cfg).join(',')}`, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- API: member photo upload (A4) ---
const MEMBER_NAMES = ['faber', 'kasey', 'limon'];

app.post('/api/member-photo/:member', uploadLimiter, upload.single('image'), async (req, res, next) => {
  const member = req.params.member.toLowerCase();
  if (!MEMBER_NAMES.includes(member)) return res.status(400).json({ error: 'Unknown member' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    if (!isValidImageBuffer(req.file.buffer)) {
      auditLog('member_photo_rejected', `member=${member} reason=invalid_signature`, req);
      return res.status(400).json({ error: 'Invalid image file (signature check failed)' });
    }

    const filename = `member-${member}.jpg`;
    const destPath = path.join(UPLOADS_DIR, filename);
    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 400, height: 400, fit: 'cover' })
      .jpeg({ quality: 85, progressive: true })
      .toFile(destPath);

    // Update site-config.json with the photoFile for this member.
    // Re-validate the existing on-disk config so a tampered file (from before
    // schema validation existed) cannot be silently propagated forward.
    let cfg = {};
    try {
      const existing = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'));
      const v = validateSiteConfig(existing);
      cfg = v.error ? {} : v.value;
    } catch { /* new file */ }
    if (!Array.isArray(cfg.members)) {
      cfg.members = MEMBER_NAMES.map(n => ({ name: n.charAt(0).toUpperCase() + n.slice(1) }));
    }
    const idx = cfg.members.findIndex(m => m.name && m.name.toLowerCase() === member);
    if (idx >= 0) cfg.members[idx].photoFile = filename;
    else cfg.members.push({ name: member.charAt(0).toUpperCase() + member.slice(1), photoFile: filename });
    const tmp = SITE_CONFIG_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
    fs.renameSync(tmp, SITE_CONFIG_PATH);

    auditLog('member_photo_upload', `member=${member} file=${filename}`, req);
    res.json({ ok: true, url: `/uploads/${filename}` });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/member-photo/:member', apiLimiter, (req, res) => {
  const member = req.params.member.toLowerCase();
  if (!MEMBER_NAMES.includes(member)) return res.status(400).json({ error: 'Unknown member' });

  const filename = `member-${member}.jpg`;
  const filePath = path.join(UPLOADS_DIR, filename);
  let fileRemoved = false;
  try { fs.unlinkSync(filePath); fileRemoved = true; } catch { /* ignore */ }

  // Clear photoFile in site-config
  try {
    let cfg = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'));
    if (Array.isArray(cfg.members)) {
      const idx = cfg.members.findIndex(m => m.name && m.name.toLowerCase() === member);
      if (idx >= 0) delete cfg.members[idx].photoFile;
      const tmp = SITE_CONFIG_PATH + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
      fs.renameSync(tmp, SITE_CONFIG_PATH);
    }
  } catch { /* config not found */ }

  auditLog('member_photo_delete', `member=${member} fileRemoved=${fileRemoved}`, req);
  res.json({ ok: true, fileRemoved });
});

// --- API: set OG image (B4) ---
app.post('/api/images/:filename/og', apiLimiter, async (req, res, next) => {
  const filename = path.basename(req.params.filename);
  try {
    await withManifestLock(async () => {
      const manifest = readManifest();
      const exists = manifest.images.some(img => img.filename === filename);
      if (!exists) return res.status(404).json({ error: 'Image not found in manifest' });
      manifest.ogImageFile = filename;
      writeManifest(manifest);
      auditLog('set_og_image', `file=${filename}`, req);
      res.json({ ok: true, ogImageFile: filename });
    });
  } catch (err) {
    next(err);
  }
});

// --- API: clear OG image (B4) ---
app.delete('/api/og-image', apiLimiter, async (req, res, next) => {
  try {
    await withManifestLock(async () => {
      const manifest = readManifest();
      delete manifest.ogImageFile;
      writeManifest(manifest);
      auditLog('clear_og_image', '', req);
      res.json({ ok: true });
    });
  } catch (err) {
    next(err);
  }
});

// --- API: batch delete (D2) ---
app.delete('/api/images', apiLimiter, async (req, res, next) => {
  const { filenames } = req.body;
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ error: 'filenames must be a non-empty array' });
  }

  try {
    await withManifestLock(async () => {
      const manifest = readManifest();
      const safeNames = filenames.map(f => path.basename(String(f)));
      manifest.images = manifest.images.filter(img => !safeNames.includes(img.filename));
      writeManifest(manifest);

      let removed = 0;
      for (const fn of safeNames) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, fn)); removed++; } catch { /* ignore */ }
      }
      auditLog('batch_delete', `count=${safeNames.length} removed=${removed}`, req);
      res.json({ ok: true, deleted: safeNames.length, filesRemoved: removed, total: manifest.images.length });
    });
  } catch (err) {
    next(err);
  }
});

// --- API: trigger site rebuild (D1 rebuild button) ---
let rebuildInProgress = false;
app.post('/api/rebuild', apiLimiter, (req, res) => {
  if (rebuildInProgress) {
    return res.status(409).json({ error: 'A rebuild is already in progress' });
  }
  rebuildInProgress = true;
  auditLog('rebuild_triggered', '', req);
  res.json({ ok: true, message: 'Rebuild started — the site will update in about 60 seconds.' });

  execFile(DEPLOY_SCRIPT, { timeout: 120000 }, (err, stdout, stderr) => {
    rebuildInProgress = false;
    if (err) {
      console.error('[ERROR] Rebuild failed:', err.message, stderr);
    } else {
      console.log('[INFO] Rebuild completed successfully.');
      auditLog('rebuild_complete', `stdout_lines=${stdout.split('\n').length}`, req);
    }
  });
});

// --- Global error handler (4-param signature required by Express) ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({ error: 'Server error' });
});

// --- Start ---
app.listen(PORT, '127.0.0.1', () => {
  console.log(`21bristoe admin running on http://127.0.0.1:${PORT}`);
  console.log(`Uploads directory: ${UPLOADS_DIR}`);
  console.log(`Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
});
