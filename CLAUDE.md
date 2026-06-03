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
- Camera: the K2 serves video **only over WebRTC** (custom base64 signaling on
  `webrtc_local`, port 8000 — same as the DnG-Crafts/K2-Camera project; stock
  Fluidd isn't wired to it). The page has an in-browser **LAN live view**:
  `/stats/printer/webrtc` (`+server.ts`) proxies signaling same-origin; media
  flows browser↔printer, so it works on the LAN only.
- Snapshot: `/stats/printer/snapshot` proxies `PRINTER_SNAPSHOT_URL` for the
  `<img>` (currently unset → "unavailable"). **TODO (future work):** an
  always-on/remote JPEG snapshot via a headless-Chromium bridge —
  `deploy/printer-camera/` (`cam-snap.py` + `client.html`, EXPERIMENTAL/unverified).
  `aiortc` was ruled out (cannot complete the K2's libpeer DTLS handshake).
- History charts: collector `deploy/printer-metrics/collect-printer-metrics.mjs`
  → JSONL at `/var/lib/bristoe-stats/printer-metrics.jsonl`, run by
  `deploy/systemd/21bristoe-printer-metrics.{service,timer}` (installed, 2-min cadence).
- Env: `PRINTER_BASE_URL`, `PRINTER_SNAPSHOT_URL`, `PRINTER_WEBRTC_URL`
  (defaults to host:8000), `PRINTER_CHAMBER_OBJECT`, `PRINTER_NAME`,
  `PRINTER_FIXTURE` (=1 to preview with sample data).
- Collector env: `/etc/21bristoe-printer.env`.
## Design tokens

The theme source is `packages/bristoe-theme/bristoe-theme.css`. Existing `warm-*` and `sage-*` aliases are retained for compatibility, but new UI should prefer the canonical semantic tokens where practical.
