<script lang="ts">
  import { onMount } from 'svelte';
  import '$lib/admin/admin.css';

  onMount(() => {
    import('$lib/admin/admin-client.js');
  });
</script>

<svelte:head>
  <title>21 Bristoe — Admin</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<header>
  <div>
    <h1>21 Bristoe — Admin</h1>
    <p>Manage photos, content, and site settings</p>
  </div>
  <div class="header-actions">
    <button id="rebuildBtn" class="btn-rebuild" title="Refresh runtime content">⟳ Refresh Content</button>
    <a href="https://21bristoe.com" class="home-link" target="_blank" rel="noopener noreferrer">View site →</a>
  </div>
</header>

<div class="stats-strip" id="statsStrip">
  <div class="stat-card"><span class="stat-value" id="statPhotos">—</span><span class="stat-label">Photos</span></div>
  <div class="stat-card"><span class="stat-value" id="statDisk">—</span><span class="stat-label">Disk used</span></div>
  <div class="stat-card"><span class="stat-value" id="statUpload">—</span><span class="stat-label">Last upload</span></div>
  <div class="stat-card"><span class="stat-value" id="statUptime">—</span><span class="stat-label">Uptime</span></div>
  <div class="stat-card"><span class="stat-value" id="statVisitors">—</span><span class="stat-label">Unique visitors</span></div>
</div>

<div class="container">
  <div class="content-card">
    <h3 class="content-card-title">Visitor Counter</h3>
    <p class="content-card-desc">Unique visitors shown in the site footer. Reset if inflated by bots.</p>
    <div class="visitor-reset-row">
      <span id="visitorCountDisplay">— unique visitors recorded</span>
      <button class="btn-sm btn-outline-red" id="resetVisitorBtn">Reset count</button>
    </div>
  </div>

  <hr class="section-divider" />

  <div class="upload-zone" id="dropZone">
    <input type="file" id="fileInput" accept="image/*" multiple />
    <div class="icon">📷</div>
    <h2>Drop photos here or click to browse</h2>
    <p>JPEG, PNG, WebP, HEIC · Up to 20MB each · Converted to JPEG automatically</p>
  </div>

  <div class="progress-wrap" id="progressWrap">
    <div class="progress-bar" id="progressBar"></div>
  </div>

  <div class="section-header">
    <h2>Limón Profile Photo</h2>
    <span class="hint">Shown in the Limón spotlight section</span>
  </div>
  <div class="limon-section" id="limonSection"></div>

  <hr class="section-divider" />

  <div class="section-header">
    <h2>Site Content</h2>
    <span class="hint">Changes are read by the site at runtime</span>
  </div>

  <div class="content-card">
    <h3 class="content-card-title">Hero Text</h3>
    <p class="content-card-desc">Edit the subtitle and location line shown on the homepage hero.</p>
    <div id="heroEditor"></div>
  </div>

  <div class="content-card">
    <h3 class="content-card-title">Household Members</h3>
    <p class="content-card-desc">Edit each member's role, bio, and profile photo.</p>
    <div id="memberEditor"></div>
  </div>

  <div class="content-card">
    <h3 class="content-card-title">Limón Details</h3>
    <p class="content-card-desc">Edit the Limón spotlight section — name, bio, facts, and quote.</p>
    <div id="limonEditor"></div>
  </div>

  <div class="content-card">
    <h3 class="content-card-title">Quick Links</h3>
    <p class="content-card-desc">Edit the links shown in the Quick Links section. Up to 10 links. Use ▲/▼ to reorder.</p>
    <div id="quickLinksEditor"></div>
    <button class="btn-add-tip" id="addQuickLinkBtn">+ Add link</button>
  </div>

  <div class="content-card">
    <h3 class="content-card-title">Neighborhood Highlights</h3>
    <p class="content-card-desc">Edit the neighborhood highlight cards. Up to 8 items. Use ▲/▼ to reorder.</p>
    <div id="neighborhoodEditor"></div>
    <button class="btn-add-tip" id="addNeighborhoodBtn">+ Add highlight</button>
  </div>

  <div class="content-card">
    <h3 class="content-card-title">Visitor Guide Tips</h3>
    <p class="content-card-desc">Edit the tips shown in the "Coming Over?" section. Use ▲/▼ to reorder.</p>
    <div id="tipEditor"></div>
    <button class="btn-add-tip" id="addTipBtn">+ Add tip</button>
  </div>

  <div class="content-card">
    <h3 class="content-card-title">Section Labels &amp; Headings</h3>
    <p class="content-card-desc">Override any heading, label, or description visible on the home page. Leave as-is to keep the defaults.</p>
    <div id="sectionTextEditor"></div>
    <div class="content-actions">
      <button class="btn-save-content" id="saveContentBtn">Save content changes</button>
    </div>
  </div>

  <hr class="section-divider" />

  <div class="slide-info">
    <strong>How it works:</strong> Photos appear in the slideshow on <a href="https://21bristoe.com" target="_blank" rel="noopener noreferrer">21bristoe.com</a> immediately after uploading.
    Drag cards to reorder. The slideshow plays in the order shown here.
    Star (⭐) a photo to use it as the social media preview image.
  </div>

  <div class="batch-bar" id="batchBar" hidden>
    <span id="batchCount">0 selected</span>
    <button class="btn-batch-delete" id="batchDeleteBtn">Delete selected</button>
    <button class="btn-batch-cancel" id="batchCancelBtn">Cancel</button>
  </div>

  <div class="section-header">
    <h2>Slideshow Photos</h2>
    <span class="count" id="countBadge">0</span>
    <span class="hint">Drag to reorder · Shift-click to multi-select</span>
  </div>

  <div class="image-grid" id="imageGrid"></div>
</div>

<div class="toast" id="toast"></div>
