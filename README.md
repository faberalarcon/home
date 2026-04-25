# 🍹 drink-hub

A tiny, self-hosted drink ordering site for the house. Runs on the Raspberry Pi alongside Home Assistant, serves a mobile-friendly menu on the local network, tracks orders per person, and dispatches fun automations through HA — speaker announcements, milestone light flashes, whatever you can wire up.

> **Status:** Live in production at <https://drink-hub.21bristoe.com>. Phases 1–11 complete. Phase 8 polish partially shipped — see [docs/future-phases.md](./docs/future-phases.md) for remaining items.

---

## Features (by phase)

| Phase | Status | What it ships |
|---|---|---|
| [1 — MVP ordering](./docs/phase-1-mvp.md) | ✅ Done | Profile picker, drink menu, order API, recent feed, SQLite, Docker |
| [2 — Home Assistant integration](./docs/phase-2-home-assistant.md) | ✅ Done | Fire HA events on order, server-side HA client, reference automations |
| [3 — Admin panel](./docs/phase-3-admin-panel.md) | ✅ Done | CRUD for drinks/profiles/milestones/settings, image uploads |
| [4 — Milestones & stats](./docs/phase-4-milestones-stats.md) | ✅ Done | Milestone evaluator, stats dashboard, live SSE updates |
| [5 — Polish & tablet mode](./docs/phase-5-polish-tablet.md) | ✅ Done | Kiosk view, PWA, nightly backups, final polish |
| 6 — Correctness & hygiene | ✅ Done | Transactional milestones, soft-delete + undo, rate limiting, health endpoint, SSE catch-up, HA error banner, upload validation |
| 7 — Power-user features | ✅ Done | Cart flow, profile picker "The usual" + last-ordered, drink notes, search/filter, admin orders page, CSV/JSON export, order reassign |
| 8 — Polish & deployment | ⚠ Partial | Dynamic title, TZ env, day-of-week histogram done; dark mode, keyboard nav, notifications, service worker, kiosk rotation, spinners remain |
| [9 — Security hardening](./docs/phase-9-edge-auth-hardening.md) | ✅ Done | Shared site password gate, env-backed admin PIN, HMAC session tokens, CSRF trusted origins, hardened nginx config |
| [10 — App abuse resistance](./docs/phase-10-app-abuse-resistance.md) | ✅ Done | IP+session rate limits, auth on mutation routes, request validation, logout/session hygiene |
| [11 — Operational security](./docs/phase-11-operational-security.md) | ✅ Done | Container hardening, security headers, auth failure logging, recovery runbooks |

---

## Stack

- **SvelteKit** (Svelte 5) + **adapter-node** — single process serves UI and API
- **SQLite** via **better-sqlite3** + **Drizzle ORM** — one file, zero config
- **Tailwind CSS v4** — mobile-first styling
- **Docker** — deployed as a sibling container to Home Assistant

---

## Quick start (development)

```bash
npm install
npx drizzle-kit generate     # only if schema changed
npm run db:migrate
npm run db:seed
npm run dev                  # http://localhost:5173
```

The SQLite database is written to `./data/drink-hub.db` (override with `DATABASE_PATH`).

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server on `0.0.0.0:5173` |
| `npm run build` | Build for production |
| `npm run start` | Run the production build (`node build/index.js`) |
| `npm run check` | Type-check with `svelte-check` |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed starter profiles and drinks (idempotent) |

---

## Deployment (Raspberry Pi, Docker)

Home Assistant already runs on the Pi as a Docker container, so drink-hub runs as a sibling container.

```bash
cp .env.example .env
# set SITE_PASSWORD_HASH and CSRF_TRUSTED_ORIGINS
docker compose up -d --build
```

Then on any device on the LAN, browse to `http://<pi-ip>:5173`.

The `./data` directory is mounted as a volume so the SQLite database and uploaded images persist across rebuilds.

### House password (shared)

Set either `SITE_PASSWORD` or `SITE_PASSWORD_HASH` to gate the entire site behind a single shared password. Prefer the hashed variant in `.env`.

### Admin password (secondary)

Admin access now uses a real password managed inside the database, separate from the shared house password. On first boot — if no admin credential is configured — the server generates a random 16-character temporary admin password and prints it prominently to stdout:

```
==============================================================
[drink-hub] INITIAL ADMIN PASSWORD: xxxxxxxxxxxxxxxx
[drink-hub] Log in at /admin/login and change it immediately.
==============================================================
```

Log in at `/admin/login`, go to **Settings → Change admin password**, and set something you'll remember. If you lose the admin password, the **Reset admin password** action on the same page will generate a new temporary one — it requires re-entering the house password and prints the new temp to the server logs.

To seed the admin password from the environment instead (e.g. for provisioning), set `ADMIN_PASSWORD=...` before first boot. The legacy `ADMIN_PIN` / `ADMIN_PIN_HASH` variables are deprecated and now ignored with a warning — 4-digit PINs are no longer supported.

For session signing, `SESSION_SECRET` may be set (≥32 chars); otherwise a random secret is auto-generated into the settings table on first boot and reused across restarts.

### Outbound-request safety

The admin settings page accepts a Home Assistant base URL that the server uses to send bearer-authenticated requests. Incoming URLs are validated and loopback/metadata targets (127/8, ::1, 169.254/16) are always refused. Private LAN ranges are allowed by default (the typical Home Assistant case); set `HA_STRICT_PUBLIC=1` on cloud deployments to also refuse private IPs.

Set `CSRF_TRUSTED_ORIGINS` to the public HTTPS origin served by nginx, for example `https://drinks.example.com`. This is used at build time so cross-site form posts are blocked while same-origin requests still work behind the reverse proxy.

An example hardened nginx config lives at [`deploy/nginx/drink-hub.conf.example`](./deploy/nginx/drink-hub.conf.example).

---

## Data model

Six tables managed by Drizzle (see `src/lib/server/db/schema.ts`):

- **profiles** — household members / guests (name, color, avatar, weight, biological sex for BAC)
- **drinks** — menu items (name, description, category, image, ABV, volume, HA trigger event)
- **orders** — every order ever placed (profile + drink + timestamp)
- **milestones** — data-driven triggers (threshold, scope, HA event)
- **settings** — key/value store for HA URL, token, site config
- **ha_events_log** — audit log of HA dispatches for debugging

---

## Project layout

```
drink-hub/
├── src/
│   ├── app.html, app.css, app.d.ts
│   ├── hooks.server.ts              # auth gates (site password, admin PIN), migrations on boot
│   ├── lib/
│   │   ├── profile.ts               # client-side selected-profile store
│   │   ├── stores/title.ts          # dynamic document title store
│   │   └── server/
│   │       ├── auth.ts              # HMAC session token helpers
│   │       ├── ha.ts                # HA event + service client
│   │       ├── bac.ts               # Widmark formula BAC estimation
│   │       ├── milestones.ts        # milestone evaluator (transactional)
│   │       ├── ratelimit.ts         # in-memory token bucket
│   │       ├── site-access.ts       # env-backed PIN/password config helpers
│   │       ├── stream.ts            # SSE broadcaster with Last-Event-ID ring buffer
│   │       ├── tts.ts               # queued TTS announcements via HA
│   │       ├── uploads.ts           # image upload + sharp resize + size validation
│   │       └── db/
│   │           ├── schema.ts
│   │           ├── index.ts
│   │           ├── migrate.ts
│   │           ├── seed.ts
│   │           └── settings.ts      # key/value settings helpers
│   └── routes/
│       ├── +layout.svelte
│       ├── +page.svelte             # profile picker (last-ordered + "The usual")
│       ├── login/                   # shared site password gate
│       ├── menu/                    # drink menu with cart, search, expandable notes
│       ├── recent/                  # recent orders feed
│       ├── api/
│       │   ├── orders/+server.ts    # GET (paginated) + POST (cart or single)
│       │   ├── orders/[id]/         # DELETE (soft) + PATCH (reassign)
│       │   ├── stream/+server.ts    # SSE stream with catch-up
│       │   └── health/+server.ts    # health probe (db, ha, uptime)
│       ├── uploads/[...path]/       # serves data/uploads/ files
│       ├── stats/                   # live stats dashboard (SSE, day-of-week histogram)
│       ├── kiosk/                   # wall-tablet always-on display
│       └── admin/                   # admin panel (env-backed PIN gate)
│           ├── login/               # PIN login page
│           ├── +layout.svelte
│           ├── +page.svelte         # dashboard
│           ├── drinks/              # drink CRUD + image upload + notes
│           ├── profiles/            # profile CRUD + avatar upload
│           ├── milestones/          # milestone CRUD
│           ├── orders/              # paginated order list + delete + reassign
│           │   └── export/          # CSV/JSON export endpoint
│           ├── settings/            # HA config, TTS config, PIN change
│           └── ha-log/              # HA event dispatch log
├── deploy/nginx/                    # example hardened nginx config
├── drizzle/                         # generated migrations
├── data/                            # gitignored; SQLite + uploads
├── docs/                            # phase plans + security docs
├── Dockerfile
└── docker-compose.yml
```

---

## Docs

Each phase has a standalone doc under [`docs/`](./docs) that stays up-to-date as we implement it. Start with [Phase 1](./docs/phase-1-mvp.md) to understand the MVP.

Planned enhancements are documented in [docs/future-phases.md](./docs/future-phases.md).
