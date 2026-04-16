'use strict';

const API = '';
const MEDIA_BASE = 'https://21bristoe.com';
let manifest = { images: [] };
let siteConfig = {};
let dragSrc = null;
let selectedFiles = new Set(); // D2: batch select

// Escape user-provided strings for safe HTML insertion
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtRelTime(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function fmtUptime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// --- D1: Stats ---
async function loadStats() {
  try {
    const res = await fetch(`${API}/api/stats`);
    const data = await res.json();
    document.getElementById('statPhotos').textContent = data.photoCount ?? '—';
    document.getElementById('statDisk').textContent = data.totalBytes != null ? fmtBytes(data.totalBytes) : '—';
    document.getElementById('statUpload').textContent = fmtRelTime(data.lastUpload);
    document.getElementById('statUptime').textContent = data.uptime != null ? fmtUptime(data.uptime) : '—';
  } catch {
    // stats are non-critical — fail silently
  }
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
  selectedFiles.clear();
  updateBatchBar();

  if (manifest.images.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">🖼️</div>
        <p>No photos yet — upload some above to start the slideshow!</p>
      </div>`;
    return;
  }

  const ogFile = manifest.ogImageFile || null;

  grid.innerHTML = manifest.images.map((img, i) => `
    <div class="image-card${selectedFiles.has(img.filename) ? ' selected' : ''}" draggable="true" data-filename="${img.filename}" data-index="${i}">
      <div class="image-card-img-wrap">
        <img src="${MEDIA_BASE}/uploads/${img.filename}" alt="${escHtml(img.originalName || img.filename)}" loading="lazy" />
        <div class="card-select-overlay" data-select-filename="${img.filename}"></div>
        <button class="btn-og-star${ogFile === img.filename ? ' active' : ''}" data-og-filename="${img.filename}" title="${ogFile === img.filename ? 'OG image (click to clear)' : 'Set as OG / social preview image'}" aria-label="Set as Open Graph image">⭐</button>
      </div>
      <div class="image-card-body">
        <span class="drag-handle" title="Drag to reorder" aria-hidden="true">⠿</span>
        <span class="image-card-name">${escHtml(img.originalName || img.filename)}</span>
        <button class="btn-delete" data-delete-filename="${img.filename}" title="Delete photo" aria-label="Delete ${escHtml(img.originalName || img.filename)}">✕</button>
      </div>
    </div>
  `).join('');

  // Event delegation: delete, OG star, batch select.
  // Why not { once: true }: the listener must survive multiple clicks, since
  // toggleOgImage/toggleSelect don't re-render the grid. grid.innerHTML = ...
  // above already wipes previous listeners on children, so we're not leaking.
  grid.onclick = e => {
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) { deleteImage(delBtn.dataset.deleteFilename); return; }

    const ogBtn = e.target.closest('.btn-og-star');
    if (ogBtn) { toggleOgImage(ogBtn.dataset.ogFilename); return; }

    const overlay = e.target.closest('.card-select-overlay');
    if (overlay) { toggleSelect(overlay.dataset.selectFilename, e.shiftKey); return; }
  };

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

      const fromIdx = parseInt(dragSrc.dataset.index);
      const toIdx = parseInt(card.dataset.index);
      const imgs = [...manifest.images];
      const [moved] = imgs.splice(fromIdx, 1);
      imgs.splice(toIdx, 0, moved);
      manifest.images = imgs;
      renderGrid();

      await fetch(`${API}/api/images/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: imgs.map(i => i.filename) }),
      });
      showToast('Order saved', 'success');
    });
  });
}

// --- D2: Batch select ---
function toggleSelect(filename, isShift) {
  if (selectedFiles.has(filename)) {
    selectedFiles.delete(filename);
  } else {
    if (!isShift) selectedFiles.clear();
    selectedFiles.add(filename);
  }
  // Re-render selection state without full re-render
  document.querySelectorAll('.image-card').forEach(card => {
    card.classList.toggle('selected', selectedFiles.has(card.dataset.filename));
  });
  updateBatchBar();
}

function updateBatchBar() {
  const bar = document.getElementById('batchBar');
  const countEl = document.getElementById('batchCount');
  if (selectedFiles.size > 0) {
    bar.removeAttribute('hidden');
    countEl.textContent = `${selectedFiles.size} selected`;
  } else {
    bar.setAttribute('hidden', '');
  }
}

async function batchDelete() {
  if (selectedFiles.size === 0) return;
  if (!confirm(`Delete ${selectedFiles.size} photo${selectedFiles.size !== 1 ? 's' : ''}?`)) return;
  try {
    const res = await fetch(`${API}/api/images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: Array.from(selectedFiles) }),
    });
    if (!res.ok) throw new Error('Batch delete failed');
    const data = await res.json();
    showToast(`${data.deleted} photo${data.deleted !== 1 ? 's' : ''} deleted`, 'success');
    selectedFiles.clear();
    await loadImages();
    await loadStats();
  } catch {
    showToast('Batch delete failed', 'error');
  }
}

document.getElementById('batchDeleteBtn').addEventListener('click', batchDelete);
document.getElementById('batchCancelBtn').addEventListener('click', () => {
  selectedFiles.clear();
  document.querySelectorAll('.image-card.selected').forEach(c => c.classList.remove('selected'));
  updateBatchBar();
});

// --- B4: OG image ---
async function toggleOgImage(filename) {
  const isCurrentOg = manifest.ogImageFile === filename;
  try {
    if (isCurrentOg) {
      const res = await fetch(`${API}/api/og-image`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      manifest.ogImageFile = null;
      showToast('OG image cleared', 'success');
    } else {
      const res = await fetch(`${API}/api/images/${encodeURIComponent(filename)}/og`, { method: 'POST' });
      if (!res.ok) throw new Error();
      manifest.ogImageFile = filename;
      showToast('OG image set — rebuild to apply', 'success');
    }
    // Update star buttons without full re-render
    document.querySelectorAll('.btn-og-star').forEach(btn => {
      const active = btn.dataset.ogFilename === manifest.ogImageFile;
      btn.classList.toggle('active', active);
      btn.title = active ? 'OG image (click to clear)' : 'Set as OG / social preview image';
    });
  } catch {
    showToast('Failed to update OG image', 'error');
  }
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
    const ok = data.uploaded.filter(u => !u.error);
    const fail = data.uploaded.filter(u => u.error).length;

    // D3: size savings summary
    let savingsMsg = '';
    if (ok.length === 1 && ok[0].originalBytes && ok[0].savedBytes) {
      const pct = Math.round((1 - ok[0].savedBytes / ok[0].originalBytes) * 100);
      if (pct > 0) savingsMsg = ` · saved ${pct}% (${fmtBytes(ok[0].originalBytes)} → ${fmtBytes(ok[0].savedBytes)})`;
    } else if (ok.length > 1) {
      const origTotal = ok.reduce((s, u) => s + (u.originalBytes || 0), 0);
      const savedTotal = ok.reduce((s, u) => s + (u.savedBytes || 0), 0);
      if (origTotal > 0 && savedTotal > 0 && origTotal > savedTotal) {
        const pct = Math.round((1 - savedTotal / origTotal) * 100);
        savingsMsg = ` · saved ${pct}% (${fmtBytes(origTotal)} → ${fmtBytes(savedTotal)})`;
      }
    }

    showToast(
      fail > 0
        ? `${ok.length} uploaded, ${fail} failed`
        : `${ok.length} photo${ok.length !== 1 ? 's' : ''} uploaded!${savingsMsg}`,
      fail > 0 ? 'error' : 'success'
    );
    await loadImages();
    await loadStats();
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
    await loadStats();
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

// --- A4 + A5: Site content editor ---
const DEFAULT_MEMBERS = [
  { name: 'Faber',  emoji: '👨', role: 'Co-owner',          bio: 'Loves a good cocktail, a well-crafted home project, and getting into the weeds on anything tech.' },
  { name: 'Kasey',  emoji: '👩', role: 'Co-owner',          bio: 'Great cook, great eye for design, and the reason 21 Bristoe actually feels like a home.' },
  { name: 'Limón',  emoji: '🐕', role: 'Chief Joy Officer', bio: 'Certified zoomie expert. Will greet you at the door, steal your spot on the couch, and charm everyone in the room.' },
];

const DEFAULT_TIPS = [
  { icon: '🚗', title: 'Parking',       body: "There's usually room in the driveway, plus easy street parking on Bristoe Station Rd right out front." },
  { icon: '🚪', title: 'The Door',      body: 'Come to the front door — ring the bell and give us just a moment.' },
  { icon: '🐕', title: 'Meeting Limón', body: "She will be very excited to meet you. She's friendly — just be ready for an enthusiastic welcome (and possibly a zoomie)." },
  { icon: '📶', title: 'Guest Wi-Fi',   body: 'Ask us for the guest network name and password when you arrive.' },
];

async function loadSiteConfig() {
  try {
    const res = await fetch(`${API}/api/site-config`);
    siteConfig = await res.json();
  } catch {
    siteConfig = {};
  }
  renderMemberEditor();
  renderTipEditor();
}

function renderMemberEditor() {
  const container = document.getElementById('memberEditor');
  const members = siteConfig.members && siteConfig.members.length
    ? siteConfig.members
    : DEFAULT_MEMBERS;

  container.innerHTML = members.map((m, i) => {
    const memberKey = (m.name || DEFAULT_MEMBERS[i]?.name || '').toLowerCase();
    const hasPhoto = !!m.photoFile;
    const photoUrl = hasPhoto ? `${MEDIA_BASE}/uploads/${m.photoFile}?t=${Date.now()}` : null;
    return `
      <div class="member-row" data-member-index="${i}">
        <div class="member-photo-col">
          ${hasPhoto
            ? `<img class="member-thumb" src="${escHtml(photoUrl)}" alt="${escHtml(m.name)} photo" />
               <label class="btn-sm btn-amber member-photo-label">
                 Replace <input type="file" accept="image/*" class="member-photo-input" data-member="${memberKey}" />
               </label>
               <button class="btn-sm btn-outline-red member-photo-remove" data-member="${memberKey}">Remove</button>`
            : `<div class="member-thumb-placeholder">${escHtml(m.emoji || '👤')}</div>
               <label class="btn-sm btn-amber member-photo-label">
                 Upload <input type="file" accept="image/*" class="member-photo-input" data-member="${memberKey}" />
               </label>`
          }
        </div>
        <div class="member-fields">
          <div class="field-row">
            <label>Name</label>
            <input type="text" class="field-input member-name" value="${escHtml(m.name || '')}" data-field="name" />
          </div>
          <div class="field-row">
            <label>Emoji</label>
            <input type="text" class="field-input field-emoji member-emoji" value="${escHtml(m.emoji || '')}" data-field="emoji" />
          </div>
          <div class="field-row">
            <label>Role</label>
            <input type="text" class="field-input member-role" value="${escHtml(m.role || '')}" data-field="role" />
          </div>
          <div class="field-row">
            <label>Bio</label>
            <textarea class="field-input member-bio" rows="2" data-field="bio">${escHtml(m.bio || '')}</textarea>
          </div>
        </div>
      </div>`;
  }).join('');

  // Member photo upload/remove events
  container.querySelectorAll('.member-photo-input').forEach(input => {
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) uploadMemberPhoto(e.target.dataset.member, file);
    });
  });
  container.querySelectorAll('.member-photo-remove').forEach(btn => {
    btn.addEventListener('click', () => deleteMemberPhoto(btn.dataset.member));
  });
}

function renderTipEditor() {
  const container = document.getElementById('tipEditor');
  const tips = siteConfig.visitorTips && siteConfig.visitorTips.length
    ? siteConfig.visitorTips
    : DEFAULT_TIPS;

  container.innerHTML = tips.map((t, i) => `
    <div class="tip-row" data-tip-index="${i}">
      <div class="field-row tip-fields">
        <input type="text" class="field-input field-emoji tip-icon" value="${escHtml(t.icon || '')}" placeholder="🏠" data-field="icon" title="Icon (emoji)" />
        <input type="text" class="field-input tip-title" value="${escHtml(t.title || '')}" placeholder="Title" data-field="title" />
        <textarea class="field-input tip-body" rows="2" placeholder="Description" data-field="body">${escHtml(t.body || '')}</textarea>
        <button class="btn-sm btn-outline-red tip-remove" data-tip-index="${i}" title="Remove tip">✕</button>
      </div>
    </div>`).join('');

  container.querySelectorAll('.tip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const tips = getTipsFromEditor();
      tips.splice(parseInt(btn.dataset.tipIndex), 1);
      if (!siteConfig.visitorTips) siteConfig.visitorTips = DEFAULT_TIPS.slice();
      siteConfig.visitorTips = tips;
      renderTipEditor();
    });
  });
}

function getMembersFromEditor() {
  const rows = document.querySelectorAll('.member-row');
  const base = siteConfig.members && siteConfig.members.length
    ? siteConfig.members
    : DEFAULT_MEMBERS;
  return Array.from(rows).map((row, i) => {
    const m = { ...(base[i] || {}) };
    row.querySelectorAll('[data-field]').forEach(el => {
      m[el.dataset.field] = el.value.trim();
    });
    return m;
  });
}

function getTipsFromEditor() {
  const rows = document.querySelectorAll('.tip-row');
  return Array.from(rows).map(row => {
    const t = {};
    row.querySelectorAll('[data-field]').forEach(el => {
      t[el.dataset.field] = el.value.trim();
    });
    return t;
  });
}

document.getElementById('addTipBtn').addEventListener('click', () => {
  if (!siteConfig.visitorTips) {
    siteConfig.visitorTips = DEFAULT_TIPS.slice();
  }
  siteConfig.visitorTips.push({ icon: '📌', title: '', body: '' });
  renderTipEditor();
});

async function saveContent() {
  const members = getMembersFromEditor();
  const visitorTips = getTipsFromEditor();
  siteConfig.members = members;
  siteConfig.visitorTips = visitorTips;

  try {
    const res = await fetch(`${API}/api/site-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteConfig),
    });
    if (!res.ok) throw new Error('Save failed');
    showToast('Content saved — rebuild to publish', 'success');
  } catch {
    showToast('Save failed', 'error');
  }
}

document.getElementById('saveContentBtn').addEventListener('click', saveContent);

// --- Member photo upload/delete ---
async function uploadMemberPhoto(member, file) {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch(`${API}/api/member-photo/${encodeURIComponent(member)}`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    showToast(`${member} photo updated — rebuild to publish`, 'success');
    await loadSiteConfig();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteMemberPhoto(member) {
  if (!confirm(`Remove ${member}'s profile photo?`)) return;
  try {
    const res = await fetch(`${API}/api/member-photo/${encodeURIComponent(member)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Remove failed');
    showToast('Photo removed — rebuild to publish', 'success');
    await loadSiteConfig();
  } catch {
    showToast('Remove failed', 'error');
  }
}

// --- Rebuild ---
document.getElementById('rebuildBtn').addEventListener('click', async () => {
  if (!confirm('Rebuild and deploy the site now? This takes about 60 seconds.')) return;
  const btn = document.getElementById('rebuildBtn');
  btn.disabled = true;
  btn.textContent = '⟳ Rebuilding…';
  try {
    const res = await fetch(`${API}/api/rebuild`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Rebuild failed');
    showToast(data.message || 'Rebuild started!', 'success');
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '⟳ Rebuild Site';
    }, 90000);
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = '⟳ Rebuild Site';
  }
});

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
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

// --- Init ---
loadStats();
loadImages();
loadLimonImage();
loadSiteConfig();
