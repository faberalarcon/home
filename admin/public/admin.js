'use strict';

const API = '';
const MEDIA_BASE = 'https://21bristoe.com';
let manifest = { images: [] };
let dragSrc = null;

// Escape user-provided strings for safe HTML insertion
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Load images ---
async function loadImages() {
  try {
    const res = await fetch(`${API}/api/images`);
    manifest = await res.json();
    renderGrid();
  } catch {
    showToast('Failed to load images', 'error');
  }
}

function renderGrid() {
  const grid = document.getElementById('imageGrid');
  const count = document.getElementById('countBadge');
  count.textContent = manifest.images.length;

  if (manifest.images.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">🖼️</div>
        <p>No photos yet — upload some above to start the slideshow!</p>
      </div>`;
    return;
  }

  grid.innerHTML = manifest.images.map((img, i) => `
    <div class="image-card" draggable="true" data-filename="${img.filename}" data-index="${i}">
      <img src="${MEDIA_BASE}/uploads/${img.filename}" alt="${escHtml(img.originalName || img.filename)}" loading="lazy" />
      <div class="image-card-body">
        <span class="drag-handle" title="Drag to reorder" aria-hidden="true">⠿</span>
        <span class="image-card-name">${escHtml(img.originalName || img.filename)}</span>
        <button class="btn-delete" data-delete-filename="${img.filename}" title="Delete photo" aria-label="Delete ${escHtml(img.originalName || img.filename)}">✕</button>
      </div>
    </div>
  `).join('');

  // Event delegation for delete — avoids inline onclick handlers
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    const filename = btn.dataset.deleteFilename;
    if (filename) deleteImage(filename);
  }, { once: true }); // re-registered on each renderGrid call

  // Drag-to-reorder
  grid.querySelectorAll('.image-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragSrc = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      grid.querySelectorAll('.image-card').forEach(c => c.classList.remove('drag-target'));
      if (card !== dragSrc) card.classList.add('drag-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-target'));
    card.addEventListener('drop', async e => {
      e.preventDefault();
      card.classList.remove('drag-target');
      if (dragSrc === card) return;

      // Reorder in manifest
      const fromIdx = parseInt(dragSrc.dataset.index);
      const toIdx = parseInt(card.dataset.index);
      const imgs = [...manifest.images];
      const [moved] = imgs.splice(fromIdx, 1);
      imgs.splice(toIdx, 0, moved);
      manifest.images = imgs;
      renderGrid();

      // Persist reorder
      await fetch(`${API}/api/images/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: imgs.map(i => i.filename) }),
      });
      showToast('Order saved', 'success');
    });
  });
}

// --- Upload ---
async function uploadFiles(files) {
  if (!files.length) return;
  const wrap = document.getElementById('progressWrap');
  const bar = document.getElementById('progressBar');
  wrap.style.display = 'block';
  bar.style.width = '10%';

  const formData = new FormData();
  for (const f of files) formData.append('images', f);

  try {
    bar.style.width = '50%';
    const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
    bar.style.width = '90%';
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    const ok = data.uploaded.filter(u => !u.error).length;
    const fail = data.uploaded.filter(u => u.error).length;
    showToast(
      fail > 0
        ? `${ok} uploaded, ${fail} failed`
        : `${ok} photo${ok !== 1 ? 's' : ''} uploaded!`,
      fail > 0 ? 'error' : 'success'
    );
    await loadImages();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    bar.style.width = '100%';
    setTimeout(() => { wrap.style.display = 'none'; bar.style.width = '0%'; }, 600);
  }
}

// --- Delete ---
async function deleteImage(filename) {
  if (!confirm(`Delete this photo?`)) return;
  try {
    const res = await fetch(`${API}/api/images/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Photo deleted', 'success');
    await loadImages();
  } catch {
    showToast('Delete failed', 'error');
  }
}

// --- Limón profile photo ---
async function loadLimonImage() {
  try {
    const res = await fetch(`${API}/api/limon-image`);
    const data = await res.json();
    renderLimonCard(data);
  } catch {
    showToast('Failed to load Limón photo', 'error');
  }
}

function renderLimonCard(data) {
  const section = document.getElementById('limonSection');
  if (data.exists && data.url) {
    section.innerHTML = `
      <div class="limon-card">
        <img src="${MEDIA_BASE}${data.url}?t=${Date.now()}" alt="Limón profile photo" class="limon-preview" />
        <div class="limon-card-body">
          <span class="limon-card-label">Current photo</span>
          <div class="limon-card-actions">
            <label class="btn-replace">
              Replace
              <input type="file" accept="image/*" class="limon-file-input" />
            </label>
            <button class="btn-delete-limon" aria-label="Remove Limón photo">Remove</button>
          </div>
        </div>
      </div>`;
    section.querySelector('.limon-file-input').addEventListener('change', e => {
      const files = Array.from(e.target.files);
      if (files.length) uploadLimonImage(files[0]);
    });
    section.querySelector('.btn-delete-limon').addEventListener('click', deleteLimonImage);
  } else {
    section.innerHTML = `
      <div class="limon-empty">
        <span class="limon-empty-icon">🐕</span>
        <p>No photo set — upload one to replace the emoji placeholder on the site.</p>
        <label class="btn-upload-limon">
          Upload photo
          <input type="file" accept="image/*" class="limon-file-input" />
        </label>
      </div>`;
    section.querySelector('.limon-file-input').addEventListener('change', e => {
      const files = Array.from(e.target.files);
      if (files.length) uploadLimonImage(files[0]);
    });
  }
}

async function uploadLimonImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch(`${API}/api/limon-image`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    showToast('Limón photo updated!', 'success');
    await loadLimonImage();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteLimonImage() {
  if (!confirm('Remove Limón profile photo?')) return;
  try {
    const res = await fetch(`${API}/api/limon-image`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Remove failed');
    showToast('Photo removed', 'success');
    await loadLimonImage();
  } catch {
    showToast('Remove failed', 'error');
  }
}

// --- Drop zone ---
const zone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

fileInput.addEventListener('change', () => uploadFiles(Array.from(fileInput.files)));
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  uploadFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
});

// --- Toast ---
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

loadImages();
loadLimonImage();
