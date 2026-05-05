# Phase 1 — MVP Ordering

**Status:** ✅ Complete

## Goal

Get the end-to-end happy path working on the Pi: a phone on the LAN can pick a profile, order a drink, and see it show up in the recent feed. No Home Assistant integration yet — that's Phase 2.

## What shipped

### Scaffolding
- SvelteKit 2 + Svelte 5 project with `adapter-node`
- Tailwind CSS v4 via `@tailwindcss/vite`
- TypeScript + `svelte-check`
- Drizzle ORM + `better-sqlite3`
- Docker multi-stage build + `docker-compose.yml`

### Database
- Schema in `src/lib/server/db/schema.ts` covering all six tables (`profiles`, `drinks`, `orders`, `milestones`, `settings`, `ha_events_log`) — future phases reuse this as-is.
- Drizzle migrations generated into `drizzle/`.
- Migrations auto-run on server start via `src/hooks.server.ts`, so Docker doesn't need a separate migrate step.
- SQLite stored at `DATABASE_PATH` (default `./data/drink-hub.db`), WAL mode, foreign keys on.
- Seed script (`npm run db:seed`) populates 4 profiles and 6 drinks, idempotently.

### Routes

| Route | File | What it does |
|---|---|---|
| `/` | `src/routes/+page.svelte` | Profile picker grid. Tap a name → stored in `localStorage` → navigates to `/menu`. |
| `/menu` | `src/routes/menu/+page.svelte` | Drinks grouped by category. Tap a drink → confirm modal → `POST /api/orders`. Haptic feedback + toast on success. |
| `/recent` | `src/routes/recent/+page.svelte` | Last 50 orders with profile avatar and relative timestamps. |
| `POST /api/orders` | `src/routes/api/orders/+server.ts` | Inserts order, returns `{ order, counts: { allTime, today } }`. |

### Client state
- `src/lib/profile.ts` — Svelte store backed by `localStorage` for the currently-selected profile. Survives reloads; tap the profile chip in the header to switch.

### Deployment
- `Dockerfile` — multi-stage Node 22 build. Includes `python3 make g++` in the build stage so `better-sqlite3` compiles on arm64.
- `docker-compose.yml` — exposes `5173:3000`, mounts `./data` as a volume, `restart: unless-stopped`.

## Verification

Run locally:
```bash
npm install
npm run db:migrate && npm run db:seed
npm run dev
```

Then:
```bash
curl -s http://localhost:5173/ -o /dev/null -w "%{http_code}\n"           # 200
curl -s http://localhost:5173/menu -o /dev/null -w "%{http_code}\n"       # 200
curl -s http://localhost:5173/recent -o /dev/null -w "%{http_code}\n"     # 200
curl -s -X POST http://localhost:5173/api/orders \
  -H 'content-type: application/json' \
  -d '{"profileId":1,"drinkId":1}'
# {"order":{...},"counts":{"allTime":1,"today":1}}
```

On the Pi:
```bash
docker compose up -d --build
# visit http://<pi-ip>:5173 from a phone on the LAN
```

## Known gaps (intentional — addressed in later phases)

- **No HA dispatch yet.** Ordered drinks are recorded but don't trigger anything. → Phase 2.
- **No admin UI.** Menu and profiles are edited via the seed script / SQL. → Phase 3.
- **No milestones or stats page.** → Phase 4.
- **No PWA, no kiosk view, no backups.** → Phase 5.
- **No drink images yet** — menu shows a fallback emoji tile. Image upload lands in Phase 3.

## Key files

- `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `drizzle.config.ts`
- `src/hooks.server.ts`
- `src/lib/server/db/{schema,index,migrate,seed}.ts`
- `src/lib/profile.ts`
- `src/routes/+layout.svelte`, `+page.svelte`, `+page.server.ts`
- `src/routes/menu/+page.svelte`, `+page.server.ts`
- `src/routes/recent/+page.svelte`, `+page.server.ts`
- `src/routes/api/orders/+server.ts`
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.gitignore`
