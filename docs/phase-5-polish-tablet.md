# Phase 5 — Polish & Tablet Mode

**Status:** ⏳ Planned

## Goal

Make it feel finished. Add the wall-tablet kiosk view, turn the phone experience into an installable PWA, set up nightly backups, and write the final docs.

## Deliverables

### 1. Kiosk view — `/kiosk`

A full-screen always-on display for the wall tablet. Landscape-first, big typography, no chrome.

Layout (subject to iteration):
- **Top**: site name + live clock
- **Left 2/3**: "recently ordered" ticker — big card for the most recent order, fading older ones below
- **Right 1/3**: today's leaderboard (top 3 profiles) + today's total count
- **Footer**: most popular drink today

Subscribes to `/api/stream` (Phase 4) for live updates. New orders trigger a subtle pulse animation on the ticker.

No interactive elements — this is a display, not an ordering surface.

### 2. PWA

- `static/manifest.webmanifest` with name, short_name, theme_color, icons
- Generate icons in `static/icons/` (192, 512)
- Minimal service worker via SvelteKit's built-in service worker support at `src/service-worker.ts`:
  - Cache app shell on install
  - Network-first for API, cache-first for static assets
- Meta tags in `src/app.html` for iOS home-screen support

### 3. Haptics & micro-polish
- `navigator.vibrate(30)` on order confirm (already wired in Phase 1 — verify)
- Fade/slide animations on the menu modal
- Empty-state illustrations for `/recent`, `/stats`

### 4. Nightly backups

A tiny script `scripts/backup.sh` that:
1. Runs `sqlite3 data/drink-hub.db ".backup data/backups/$(date +%F).db"` (atomic snapshot, works even with WAL).
2. Deletes backup files older than 14 days.

Triggered by a cron inside the container. Add `cron` + `sqlite3` to the runtime Dockerfile layer, drop a crontab file that runs the script at 3am.

Alternative: run the cron on the Pi host instead of inside the container — simpler, but then requires host-level setup. Pick whichever matches how HA itself is backed up.

### 5. Final docs

- Update main README with finished feature list and screenshots
- `docs/home-assistant-examples.md` — expand with real-world automation recipes we actually use
- `docs/backup-restore.md` — how to restore from a nightly backup
- `docs/troubleshooting.md` — common issues + fixes

## Verification

1. Open `/kiosk` full-screen on the tablet, order a drink from a phone → ticker updates immediately.
2. On a phone, "Add to Home Screen" → launches in standalone mode, no browser chrome.
3. Kill wifi → reopen the PWA → app shell loads, API calls fail gracefully with a "you're offline" banner.
4. Wait for 3am (or run the backup script manually) → `data/backups/YYYY-MM-DD.db` exists and is a valid SQLite file.
5. Power-cycle the Pi → container auto-restarts, data intact, kiosk tablet recovers without manual intervention.
6. Restore from backup: stop container, copy a backup file to `data/drink-hub.db`, start container, verify data.

## Key files (to be created)

- `src/routes/kiosk/+page.svelte`, `+page.server.ts`
- `static/manifest.webmanifest`
- `static/icons/*`
- `src/service-worker.ts`
- `scripts/backup.sh`
- `docs/home-assistant-examples.md` (expanded)
- `docs/backup-restore.md`
- `docs/troubleshooting.md`

## Risks / decisions

- **Tablet model / browser.** The PWA story is different on iPad Safari vs. Android Chrome vs. a Fire tablet. Confirm what tablet we're using and test early.
- **Cron inside container** adds complexity. Consider a dedicated lightweight sidecar container, or a host-level systemd timer. Decide at the start of the phase.
- **Kiosk burn-in** — a static layout on an always-on screen can burn in over time. Add a subtle background gradient shift / position jitter on a slow timer.
