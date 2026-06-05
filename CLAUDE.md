# 21bristoe.com — Unified Site

## Change workflow

Every code/config change follows this cycle:

1. Smoke test locally with `npm run dev`.
2. Run `npm run check` and `npm run build`.
3. Deploy with `./deploy/deploy.sh` when production behavior changes.
4. Commit only touched files and push `main`.

If any step fails, fix the root cause and repeat.

## What this is

`home` is the single repo and runtime for 21 Bristoe:

- Home: `/`
- Gallery: `/gallery`
- Drinks: `/drinks/`
- Stats: `/stats/`
- Admin: `/admin/` behind `admin.21bristoe.com`

Canonical GitHub repo: <https://github.com/faberalarcon/home>

## Stack

- SvelteKit + Svelte 5 + adapter-node
- Tailwind CSS 4
- Shared theme: `packages/bristoe-theme`
- Drinks data: SQLite + Drizzle
- Admin image processing: `sharp`
- Stats integrations: Home Assistant, backup manifests, visitor stats
- Docker Compose + nginx + Let's Encrypt

## Key paths

- `src/routes/` — unified route tree
- `src/lib/home/` — Home content/UI helpers
- `src/lib/drinks/` — Drinks client/server modules
- `src/lib/stats/` — Stats client/server modules
- `src/lib/admin/` — Admin UI client and server helpers
- `src/styles/` — global, Drinks, and Stats CSS
- `packages/bristoe-theme/bristoe-theme.css` — canonical tokens
- `drizzle/` — Drinks migrations
- `public/` — static assets
- `deploy/` — nginx, deploy, validation, timers

## Commands

```bash
npm run dev
npm run check
npm run build
npm run preview
./deploy/validate.sh
./deploy/deploy.sh
```

## Server

- Raspberry Pi at `192.168.1.177`
- Public site container: `21bristoe-site`
- Local container port: `127.0.0.1:6173`
- nginx proxies public routes and admin routes to the unified SvelteKit app.
- Admin remains protected by Tailscale, nginx basic auth, and `X-Admin-Auth`.

## Production data

- Drinks SQLite/uploads: `/var/lib/21bristoe/drink-hub`
- Home/Admin media: `/var/www/21bristoe-media`
- Stats: `/var/lib/bristoe-stats`, `/var/lib/bristoe-backup`, `/mnt/usbbackup`

Do not commit production secrets, uploaded media, generated output, or runtime data.

## 3D printer (Creality K2 Pro)

Device is live at `192.168.1.176`. Moonraker (port 7125) is reachable; Fluidd
UI at port 4408. Connection driven by `PRINTER_BASE_URL`.

- Live status / temps / CFS box: `src/lib/stats/server/printer.ts` (live Moonraker
  fetch) + `src/routes/stats/printer/`. Print filenames are masked server-side
  (`maskFilename`) and blurred in the UI for privacy.
- CFS material box: parsed from the Moonraker `box` object (per-slot colour,
  material, remaining %, dry-box temp/humidity).
- Camera is **gated to active prints** (printing/paused) — enforced server-side
  via `isPrintActive()` in `printer.ts` (snapshot + webrtc routes 404 when idle),
  in the UI (`camAllowed` hides the section), and in the bridge (only captures
  while printing). The K2 serves video **only over WebRTC** (custom base64
  signaling on `webrtc_local`, port 8000 — same as the DnG-Crafts/K2-Camera
  project; stock Fluidd isn't wired to it).
- Live view: in-browser WebRTC on `/stats/printer`; `/stats/printer/webrtc`
  (`+server.ts`) proxies signaling same-origin; media flows browser↔printer, so
  it needs **LAN or tailnet** reachability to the printer (subnet route works).
- Snapshot (remote-capable): `/stats/printer/snapshot` proxies
  `PRINTER_SNAPSHOT_URL`. **VERIFIED + wired** via a headless-Chromium bridge —
  `deploy/printer-camera/` (`cam-snap.py` + `client.html`): system Chromium
  completes the K2's libpeer DTLS (which `aiortc` can't) and re-serves the latest
  decoded frame as JPEG. Runs as `21bristoe-printer-camera.service`, binds the
  Docker bridge gateway (`172.17.0.1:8788`); site reaches it via
  `PRINTER_SNAPSHOT_URL=http://ai.local:8788/snapshot`. Served through the public
  site → works off-LAN. See `deploy/printer-camera/INSTALL.md`.
- History charts: collector `deploy/printer-metrics/collect-printer-metrics.mjs`
  → JSONL at `/var/lib/bristoe-stats/printer-metrics.jsonl`, run by
  `deploy/systemd/21bristoe-printer-metrics.{service,timer}` (installed, 2-min cadence).
- Env: `PRINTER_BASE_URL`, `PRINTER_SNAPSHOT_URL`, `PRINTER_WEBRTC_URL`
  (defaults to host:8000), `PRINTER_CHAMBER_OBJECT`, `PRINTER_NAME`,
  `PRINTER_FIXTURE` (=1 to preview with sample data).
- Collector env: `/etc/21bristoe-printer.env`.
## Design tokens

The theme source is `packages/bristoe-theme/bristoe-theme.css`. Existing `warm-*` and `sage-*` aliases are retained for compatibility, but new UI should prefer the canonical semantic tokens where practical.
