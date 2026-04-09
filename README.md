# 🍹 drink-hub

A tiny, self-hosted drink ordering site for the house. Runs on the Raspberry Pi alongside Home Assistant, serves a mobile-friendly menu on the local network, tracks orders per person, and dispatches fun automations through HA — speaker announcements, milestone light flashes, whatever you can wire up.

> **Status:** Phase 1 (MVP ordering) complete. See [docs/](./docs) for the phase plan.

---

## Features (by phase)

| Phase | Status | What it ships |
|---|---|---|
| [1 — MVP ordering](./docs/phase-1-mvp.md) | ✅ Done | Profile picker, drink menu, order API, recent feed, SQLite, Docker |
| [2 — Home Assistant integration](./docs/phase-2-home-assistant.md) | ⏳ Planned | Fire HA events on order, server-side HA client, reference automations |
| [3 — Admin panel](./docs/phase-3-admin-panel.md) | ⏳ Planned | CRUD for drinks/profiles/milestones/settings, image uploads |
| [4 — Milestones & stats](./docs/phase-4-milestones-stats.md) | ⏳ Planned | Milestone evaluator, stats dashboard, live SSE updates |
| [5 — Polish & tablet mode](./docs/phase-5-polish-tablet.md) | ⏳ Planned | Kiosk view, PWA, backups, final polish |

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
docker compose up -d --build
```

Then on any device on the LAN, browse to `http://<pi-ip>:5173`.

The `./data` directory is mounted as a volume so the SQLite database and uploaded images persist across rebuilds.

---

## Data model

Six tables managed by Drizzle (see `src/lib/server/db/schema.ts`):

- **profiles** — household members / guests (name, color, avatar)
- **drinks** — menu items (name, description, category, image, HA trigger event)
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
│   ├── hooks.server.ts              # runs migrations on boot
│   ├── lib/
│   │   ├── profile.ts               # client-side selected-profile store
│   │   └── server/
│   │       └── db/
│   │           ├── schema.ts
│   │           ├── index.ts
│   │           ├── migrate.ts
│   │           └── seed.ts
│   └── routes/
│       ├── +layout.svelte
│       ├── +page.svelte             # profile picker
│       ├── menu/
│       ├── recent/
│       └── api/orders/+server.ts
├── drizzle/                         # generated migrations
├── data/                            # gitignored; SQLite + uploads + backups
├── docs/                            # phase plans
├── Dockerfile
└── docker-compose.yml
```

---

## Docs

Each phase has a standalone doc under [`docs/`](./docs) that stays up-to-date as we implement it. Start with [Phase 1](./docs/phase-1-mvp.md) to understand the MVP.
