'use strict';

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/21bristoe-media';
const MANIFEST_PATH = path.join(UPLOADS_DIR, 'manifest.json');

// Ensure uploads directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer: accept images into memory, then process with sharp
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// --- Manifest helpers ---

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { images: [], updated: new Date().toISOString() };
  }
}

function writeManifest(manifest) {
  manifest.updated = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// --- Static admin UI ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- API: list images ---
app.get('/api/images', (_req, res) => {
  const manifest = readManifest();
  res.json(manifest);
});

// --- API: upload images ---
app.post('/api/upload', upload.array('images', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const manifest = readManifest();
  const results = [];

  for (const file of req.files) {
    try {
      // Sanitize filename and ensure .jpg extension
      const base = path.basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .toLowerCase()
        .substring(0, 60);
      const timestamp = Date.now();
      const filename = `${base}-${timestamp}.jpg`;
      const destPath = path.join(UPLOADS_DIR, filename);

      // Process with sharp: convert to JPEG, max 1920px wide, quality 85
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
    } catch (err) {
      results.push({ originalName: file.originalname, error: err.message });
    }
  }

  writeManifest(manifest);
  res.json({ uploaded: results, total: manifest.images.length });
});

// --- API: delete image ---
app.delete('/api/images/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(UPLOADS_DIR, filename);
  const manifest = readManifest();

  // Remove from manifest
  manifest.images = manifest.images.filter(img => img.filename !== filename);
  writeManifest(manifest);

  // Delete file (ignore if already gone)
  try { fs.unlinkSync(filePath); } catch {}

  res.json({ deleted: filename, total: manifest.images.length });
});

// --- API: reorder images (drag-and-drop reorder) ---
app.put('/api/images/reorder', (req, res) => {
  const { order } = req.body; // array of filenames in new order
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of filenames' });
  }
  const manifest = readManifest();
  const imageMap = Object.fromEntries(manifest.images.map(img => [img.filename, img]));
  manifest.images = order
    .filter(fn => imageMap[fn])
    .map(fn => imageMap[fn]);
  writeManifest(manifest);
  res.json({ reordered: true, total: manifest.images.length });
});

// --- Start ---
app.listen(PORT, '127.0.0.1', () => {
  console.log(`21bristoe admin running on http://127.0.0.1:${PORT}`);
  console.log(`Uploads directory: ${UPLOADS_DIR}`);
});
