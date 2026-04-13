# 21bristoe.com — Enhancement Proposals

## Context
The site is live, stable (31/31 validation passing), and Phases 0-12 are complete. Current sections: Hero slideshow, Welcome, Neighborhood Highlights, Limón Spotlight (with uploadable photo), Quick Links, Footer. The site is intentionally minimal — zero client JS except for the slideshow and the Limón image fallback.

This plan proposes **new** enhancements grouped by category. They are *not* implementations — this is a menu for the user to pick from. Each idea includes a one-line pitch, complexity, and an implementation sketch that respects the existing constraints (strict CSP, static build, Pi-hosted, warm family aesthetic).

### Constraints every proposal must respect
- **CSP**: no `'unsafe-inline'` — any JS must compile to external `/_assets/*.js` via Astro, any CSS must live in `.css` files. Inline `style=` attributes are forbidden.
- **Static build**: no server-side rendering except via the existing admin Express app on :3001.
- **Pi budget**: lightweight dependencies only, no heavy analytics or third-party scripts.
- **Aesthetic**: warm amber/sage palette, Georgia display font, family-friendly tone.

---

## Category A — Content & Information

### A1. Live weather widget (Taneytown)
**Pitch:** Replace the static "Taneytown Weather" link card with a live widget showing current temp, conditions, and a 3-day forecast — build-time fetched during `astro build`, refreshed by a cron on the Pi.
**Complexity:** Small
**Approach:**
- Use **Open-Meteo** (`https://api.open-meteo.com/v1/forecast`) — free, no API key, no auth, ToS-friendly for personal sites. Returns JSON with `current_weather` + `daily` arrays.
- Fetch at build time in a new `src/components/WeatherCard.astro` using `await fetch(...)` in the frontmatter (Astro supports this natively for static builds).
- Add a systemd timer on the Pi that runs `./deploy/deploy.sh` every 6h so the widget stays fresh (or just rebuild nightly at 3am).
- Fall back gracefully to the existing static link card if the fetch fails at build time.
**Files:** new `src/components/WeatherCard.astro`, edit `src/components/QuickLinks.astro`, add `deploy/21bristoe-rebuild.timer` + `.service`.

### A2. Sunrise / sunset + moon phase ambient strip
**Pitch:** Thin strip under the hero showing today's sunrise, sunset, and current moon phase with a small icon — a quiet, ambient detail that makes the site feel "lived in."
**Complexity:** Small
**Approach:** Compute at build time from lat/lon (39.6576, -77.1763) using the `suncalc` npm package (pure JS, ~11kB, zero deps). Rebuilds daily via the same systemd timer as A1.
**Files:** new `src/components/SkyStrip.astro`, add `suncalc` to `package.json`.

### A3. Seasonal / time-of-day greeting
**Pitch:** The Welcome section's opening line changes based on the date: "Good autumn from 21 Bristoe," "Happy holidays from our household," etc. Subtle, warm, and zero infra cost.
**Complexity:** Tiny
**Approach:** Pure build-time logic in `Welcome.astro` frontmatter — compute the season/month and pick a greeting from a map. Rebuilds pick up seasonal changes automatically via A1's timer (if added) or whenever deploy runs.
**Files:** edit `src/components/Welcome.astro`.

### A4. "Meet the household" — individual member cards
**Pitch:** Expand Welcome from a single intro block into three short vignette cards (Faber, Kasey, Limón) with one sentence each about who they are, hobbies, or a favorite thing.
**Complexity:** Tiny
**Approach:** Pure Astro content — a new component or extension of `Welcome.astro`. No JS, no infra.
**Files:** edit `src/components/Welcome.astro` or split into `src/components/HouseholdCards.astro`.

### A5. Visitor guide ("Coming over?")
**Pitch:** A collapsible section with practical info for visitors: parking, door to use, pet quirks ("Limón is friendly but jumpy"), guest Wi-Fi network name, nearby parking tips.
**Complexity:** Small
**Approach:** Native HTML `<details>`/`<summary>` — zero JS required, fully accessible, styled via Tailwind. Optionally gated by a query param (`?visiting=1`) so it's only shown when the URL is shared intentionally.
**Files:** new `src/components/VisitorGuide.astro`, optional conditional include in `src/pages/index.astro`.

---

## Category B — Photos & Media

### B1. Photo gallery page
**Pitch:** Dedicated `/gallery` page showing all uploaded slideshow photos in a grid with click-to-enlarge lightbox. The admin panel already manages them — just add a public view.
**Complexity:** Small-Medium
**Approach:**
- New `src/pages/gallery.astro` that fetches `/uploads/manifest.json` at runtime (same pattern as `Slideshow.astro`).
- Lightbox as zero-dep CSS `:target` trick — click thumbnail → fragment URL → `<div id="photo-X" class="lightbox">` becomes visible via `:target { display: flex }`. Full CSP compliance, no JS.
- Optional: tiny custom JS (~30 lines, compiled to external file) for keyboard nav (arrow keys, Esc).
**Files:** new `src/pages/gallery.astro`, new `src/styles/gallery.css` or scoped styles.

### B2. Slideshow captions
**Pitch:** Per-photo captions shown as a subtle overlay on the hero slideshow ("Back porch, October 2025"). Admin gets an inline text field per image.
**Complexity:** Small-Medium
**Approach:**
- Extend `manifest.json` schema: add optional `caption` field per image (back-compatible).
- Admin panel: add a small editable caption input under each image card (PATCH endpoint `/api/images/:filename/caption`).
- `Slideshow.astro` reads the caption and renders it in a positioned `<figcaption>` below the controls.
**Files:** edit `admin/server.js`, `admin/public/admin.js`, `admin/public/admin.css`, `src/components/Slideshow.astro`.

### B3. Per-photo alt text (accessibility)
**Pitch:** Admin can set descriptive alt text per image (defaults to filename). Improves screen reader experience and SEO. Pairs naturally with B2.
**Complexity:** Tiny (if bundled with B2), Small standalone
**Approach:** Same as B2 but for an `alt` field. Slideshow already has `aria-label`s; this adds per-image context.
**Files:** same as B2.

### B4. Open Graph image per upload
**Pitch:** Let the admin designate one uploaded photo as the site's Open Graph preview (the image that shows when shared on iMessage, Slack, etc.), overriding the static `og-image.png`.
**Complexity:** Small
**Approach:** Add a "Set as OG image" button per photo in admin. Server copies the selected image to a fixed path (`/var/www/21bristoe-media/og-selected.jpg`) and updates a flag in manifest. `BaseLayout.astro` checks at build time and emits `<meta property="og:image">` accordingly. Needs a rebuild to take effect.
**Files:** edit `admin/server.js`, `admin/public/admin.js`, `src/layouts/BaseLayout.astro`.

---

## Category C — Interactivity & Polish

### C1. Astro View Transitions (cross-page animations)
**Pitch:** Only pays off once there are multiple pages (pairs with B1 gallery). Smooth crossfades between the homepage and gallery. Native Astro feature, opt-in per page.
**Complexity:** Tiny (once multi-page exists)
**Approach:** Add `<ClientRouter />` to `BaseLayout.astro`. Built-in Astro. Needs `prefers-reduced-motion` guard (already respected by the API).
**Files:** edit `src/layouts/BaseLayout.astro`.

### C2. Scroll progress bar
**Pitch:** Thin amber progress line pinned to the top of the viewport that fills as the user scrolls. A subtle polish detail.
**Complexity:** Tiny
**Approach:** Pure CSS using `animation-timeline: scroll()` (modern browsers). Graceful fallback: no bar on older browsers. Zero JS.
**Files:** edit `src/styles/global.css`, tiny `<div>` in `BaseLayout.astro`.

### C3. Dark mode
**Pitch:** System-preference-aware dark theme with warm sepia tones (not pure black — keeps the cozy feel). Respects `prefers-color-scheme` automatically; optional toggle if manual override is wanted.
**Complexity:** Medium
**Approach:**
- Add `@media (prefers-color-scheme: dark)` override rules in `global.css` — Tailwind 4 supports `@theme` for light/dark variants.
- Auto-only (no toggle): no JS needed, zero CSP impact.
- With toggle: ~20 lines of JS + `localStorage` + a `data-theme` attribute on `<html>`. External file, CSP-compliant.
**Files:** edit `src/styles/global.css`; optional new small `src/scripts/theme-toggle.ts` + button in `Header.astro`.

### C4. Scroll-triggered micro-animations
**Pitch:** Subtle fade-in and slide-up for each section as it enters the viewport. The site currently has zero scroll animation — adding restrained ones brings life without feeling busy.
**Complexity:** Small
**Approach:** Pure CSS using `animation-timeline: view()` + `@media (prefers-reduced-motion)` to disable. No JS, no CSP impact. Modern-browser-only with graceful degradation.
**Files:** edit `src/styles/global.css`, add classes to existing section components.

### C5. Keyboard shortcuts (power-user delight)
**Pitch:** Press `L` to jump to Limón, `N` for neighborhood, `Q` for quick links, `?` to show a shortcut overlay. Hidden easter egg for keyboard users.
**Complexity:** Tiny
**Approach:** ~20 lines of JS in a new `src/scripts/shortcuts.ts`, imported via `<script>` in `BaseLayout`. Compiles to external file, CSP-clean. Uses `element.scrollIntoView({ behavior: 'smooth' })` which respects reduced-motion.
**Files:** new `src/scripts/shortcuts.ts`, edit `src/layouts/BaseLayout.astro`.

---

## Category D — Admin Panel Enhancements

### D1. Admin dashboard stats
**Pitch:** Small stats row at the top of the admin panel: total photos, total disk used, last upload time, admin service uptime. Uses the existing `/api/health` endpoint plus a new `/api/stats`.
**Complexity:** Small
**Approach:** Extend `/api/health` or add `/api/stats` that reads `fs.statSync` on each image and sums sizes. Display in a 3-card strip above the upload zone.
**Files:** edit `admin/server.js`, `admin/public/index.html`, `admin/public/admin.js`, `admin/public/admin.css`.

### D2. Batch operations
**Pitch:** Shift-click to select multiple photos, then batch-delete or batch-reorder.
**Complexity:** Small-Medium
**Approach:** Purely client-side selection state in `admin.js`. Extend existing DELETE endpoint to accept a filename array, or loop client-side.
**Files:** edit `admin/public/admin.js`, `admin/public/admin.css`, `admin/server.js`.

### D3. Image optimization report
**Pitch:** After upload, show "Saved 73% — 4.2MB → 1.1MB" per image, so the user sees Sharp's work. A small trust/feedback win.
**Complexity:** Tiny
**Approach:** Server already has `file.buffer.length` (original) and can `fs.statSync` the output. Return both in the upload response. Admin JS displays the savings in the toast.
**Files:** edit `admin/server.js`, `admin/public/admin.js`.

---

## Category E — SEO & Meta

### E1. Enhanced JSON-LD with photos
**Pitch:** Add `ImageObject` entries to the existing `@graph` for each uploaded slideshow photo so Google understands there's a photo gallery (pairs naturally with B1).
**Complexity:** Tiny
**Approach:** At build time in `BaseLayout.astro`, read `manifest.json` and inject `ImageObject`s into the JSON-LD graph.
**Files:** edit `src/layouts/BaseLayout.astro`.

### E2. Atom/RSS feed for admin audit log (private)
**Pitch:** Privately-available feed (basic-auth protected) of upload/delete events so the household can subscribe to changes. Niche but neat.
**Complexity:** Small
**Approach:** Express endpoint `/api/audit.atom` that reads the last N lines from journalctl via a child process, returns Atom XML. Admin basic auth already protects it.
**Files:** edit `admin/server.js`.

---

## Top picks (opinionated recommendation)

If I had to pick a shortlist of 4 that pair well and maximize delight-per-effort:

1. **A1 Live weather widget** — high utility, free API, replaces an existing static card.
2. **A3 Seasonal greeting** — 10-minute change, huge personality boost.
3. **B1 Photo gallery page** — unlocks value from admin-panel uploads; leverages existing manifest.
4. **C4 Scroll-triggered micro-animations** — pure-CSS polish, modernizes the feel.

---

## Verification approach (applies to any picked phase)
- `npm run build` — site builds cleanly with zero warnings
- `./deploy/deploy.sh` — deploy runs its validation gate (31/31)
- Manual smoke in browser: exercise the new feature
- DevTools Console: zero CSP violations
- `./deploy/validate.sh` — expand with any new endpoint checks where relevant
- Commit + push per phase (same non-breaking cadence as Phases 7-12)

---

## Open questions for the user
1. Which **category** is most interesting: content (A), photos (B), interactivity/polish (C), admin (D), or SEO (E)?
2. Any hard **no**s (e.g., "no dark mode — I like it bright" or "no third-party API calls")?
3. Should we batch a few small ones (A3 + C4 + E1) into a single phase, or do one at a time?
4. For weather (A1): OK with a nightly rebuild cron, or prefer a fully client-side fetch (adds JS + API call on every page load)?
