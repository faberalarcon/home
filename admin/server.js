'use strict';

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/21bristoe-media';
const MANIFEST_PATH = path.join(UPLOADS_DIR, 'manifest.json');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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
function auditLog(action, details, req) {
  const ip = req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  console.log(`[AUDIT] ${new Date().toISOString()} action=${action} ip=${ip} ${details}`);
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

// --- Defense-in-depth: verify requests came through the nginx HTTPS proxy ---
// nginx always sets X-Forwarded-Proto: https; direct localhost hits will be rejected.
function requireProxy(req, res, next) {
  if (IS_PRODUCTION && req.headers['x-forwarded-proto'] !== 'https') {
    console.warn(`[WARN] Direct access attempt blocked: ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'Direct access not permitted' });
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

// --- Static admin UI ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Apply proxy guard to all API routes
app.use('/api', requireProxy);

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

          const entry = {
            filename,
            originalName: file.originalname,
            uploaded: new Date().toISOString(),
            url: `/uploads/${filename}`,
          };
          manifest.images.unshift(entry); // newest first
          results.push(entry);
          auditLog('upload', `file=${filename} original=${file.originalname}`, req);
        } catch (err) {
          console.error(`[ERROR] Upload failed for ${file.originalname}:`, err.message);
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
