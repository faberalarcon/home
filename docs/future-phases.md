# Future Phases — Post-MVP Enhancements

Phases 1–5 are complete and deployed. A full audit of the codebase against the phase docs surfaced 42 gaps across correctness, missing features, and polish. They're grouped below into three follow-on phases.

- **Phase 6** is the only one with data-integrity risk — ship it before 7 or 8.
- **Phases 7 and 8** can be worked in any order or interleaved.
- **Two findings are intentionally dropped** (see bottom).

---

## Phase 6 — Correctness, Safety & Operational Hygiene

**Theme:** Make the existing system trustworthy before adding surface area. All HIGH-severity findings + the MEDIUM items that protect data and ops. No new user-visible features beyond "undo order".

### Deliverables

1. **Transactional milestone evaluation** — move `evaluateMilestones` inside the same `db.transaction(() => …)` as the order insert so concurrent orders can't double-fire a milestone.
   - Files: `src/lib/server/milestones.ts`, `src/routes/api/orders/+server.ts`
   - Verify: hammer `/api/orders` with 20 parallel curl POSTs; `ha_events_log` shows each milestone fires at most once per window.

2. **Day/week bucket comparison for milestones** — replace any "last_fired_at within N ms" logic with explicit SQLite `date(…, 'localtime')` bucket match so an idle gap doesn't suppress re-firing.
   - Files: `src/lib/server/milestones.ts`
   - Verify: set `last_fired_at` to 3 days ago on a daily milestone, insert an order → it fires.

3. **DELETE /api/orders/[id] + admin undo** — soft-delete (reuse the unused `orders.status` column) with 30-second undo toast on `/recent` and a delete button on `/admin/orders`. Broadcast via SSE so stats decrement live.
   - Files: `src/routes/api/orders/[id]/+server.ts` (new), `src/routes/admin/orders/+page.svelte`, `src/routes/recent/+page.svelte`, `src/lib/server/stream.ts`
   - Verify: place an order, delete, confirm `/stats` and `/kiosk` update within 1s.

4. **Rate limit `/api/orders`** — in-memory token bucket keyed by profile_id (1/3s, 10/min). Return 429 with `Retry-After`.
   - Files: `src/lib/server/ratelimit.ts` (new), `src/routes/api/orders/+server.ts`
   - Verify: loop 20 POSTs; only expected count succeeds.

5. **GET /api/orders with filters + pagination** — `?limit=&before=&profile_id=&drink_id=`. Refactor `/recent` to consume it, adds "load more".
   - Files: `src/routes/api/orders/+server.ts`, `src/routes/recent/+page.server.ts`, `src/routes/recent/+page.svelte`
   - Verify: `curl /api/orders?limit=5` returns JSON; `/recent` "load more" appends older entries.

6. **GET /api/health** — `{ status, db, ha, uptime, version }`. Wire into `docker-compose.yml` healthcheck.
   - Files: `src/routes/api/health/+server.ts` (new), `docker-compose.yml`
   - Verify: `docker inspect` reports `healthy`; blank HA token → reports `degraded`.

7. **Persistent HA connection banner in admin** — store `ha_last_error` in `settings`; warn in `/admin/+layout.svelte` if token missing or last call failed.
   - Files: `src/lib/server/ha.ts`, `src/routes/admin/+layout.svelte`, `src/lib/server/db/schema.ts`
   - Verify: clear token, reload any admin page → banner visible.

8. **Upload size + dimension validation** — reject >5 MB, downscale to max 1024px before sharp resize.
   - Files: `src/lib/server/uploads.ts`
   - Verify: upload 50 MB JPEG → rejected; 2 MB image → accepted and downscaled.

9. **SSE catch-up via `Last-Event-ID`** — ring buffer of last N broadcast events, replayed to reconnecting clients.
   - Files: `src/lib/server/stream.ts`, `src/routes/api/stream/+server.ts`
   - Verify: open `/recent`, restart server, place an order from another tab during restart → event arrives after reconnect.

10. **Activate `orders.status` column** — repurpose the unused field to back soft-delete (`placed | deleted`); update queries to filter `status != 'deleted'`.
    - Files: `src/lib/server/db/schema.ts`, drizzle migration, order queries
    - Verify: migration runs clean on a copy of `data/drink-hub.db`.

### Phase 6 end-to-end verification
- Concurrent-order hammer passes (item 1).
- Docker healthcheck shows `healthy`.
- Mis-pressed order can be undone from `/recent` and stats decrement live.
- Restart during active `/stats` session → SSE catches up cleanly.
- Full existing smoke test (order → HA event → milestone → kiosk update) still passes.

---

## Phase 7 — Power-User Features & API Surface

**Theme:** The ergonomic wins household users actually ask for, bundled so each page is touched once.

### Deliverables

1. **Multi-round ordering (cart flow)** — `/menu` collects a cart, single POST submits an array, server loops inserts in one transaction.
   - Files: `src/routes/menu/+page.svelte`, `src/routes/api/orders/+server.ts`
   - Verify: add 3 drinks, submit → 3 rows + HA event burst.

2. **Favorites & last-ordered on picker** — new `profile_favorites` table (or `profiles.favorite_drink_id`); profile picker shows "The usual" one-tap button + "last: X · 5m ago".
   - Files: `src/lib/server/db/schema.ts`, `src/routes/+page.svelte`, `src/routes/+page.server.ts`
   - Verify: order, return to picker, see indicator and working usual button.

3. **Drink recipe/notes view + edit** — surface existing `drinks.notes` on menu card expand and admin form.
   - Files: `src/routes/admin/drinks/+page.svelte`, `src/routes/menu/+page.svelte`
   - Verify: edit notes in admin, expand on menu → visible.

4. **Menu & admin search/filter** — client-side fuzzy filter input on `/menu`, `/admin/drinks`, `/admin/profiles`.
   - Files: `src/routes/menu/+page.svelte`, `src/routes/admin/drinks/+page.svelte`, `src/routes/admin/profiles/+page.svelte`
   - Verify: type "gin" → list narrows.

5. **Category whitelist** — drinks category becomes a settings-driven dropdown; migrate existing free-text to canonical values.
   - Files: `src/lib/server/db/schema.ts`, `src/routes/admin/settings/+page.svelte`, `src/routes/admin/drinks/+page.svelte`
   - Verify: admin form only offers known categories; typos merged.

6. **Stats: custom date range + today/week toggle on Top Drinks + day-of-week histogram** — date picker (query-param driven).
   - Files: `src/routes/stats/+page.server.ts`, `src/routes/stats/+page.svelte`
   - Verify: pick a date range → counts match manual SQL.

7. **CSV/JSON export** — `/admin/orders/export?format=csv&from=&to=`, streamed.
   - Files: `src/routes/admin/orders/export/+server.ts` (new), `src/routes/admin/orders/+page.svelte`
   - Verify: download CSV, row count matches DB.

8. **Edit order (reassign profile)** — PATCH endpoint + pencil icon on `/recent` for orders <5 min old; re-broadcasts SSE update.
   - Files: `src/routes/api/orders/[id]/+server.ts`, `src/routes/recent/+page.svelte`, `src/lib/server/stream.ts`
   - Verify: submit as wrong profile, reassign → `/stats` updates.

9. **Restore soft-deleted drinks in admin** — "show inactive" toggle + restore button.
   - Files: `src/routes/admin/drinks/+page.server.ts`, `src/routes/admin/drinks/+page.svelte`
   - Verify: deactivate then restore → reappears on `/menu`.

10. **Admin list pagination** — shared `Paginator.svelte` applied to drinks / profiles / orders / ha-log.
    - Files: `src/lib/components/Paginator.svelte` (new), `src/routes/admin/*/+page.server.ts`
    - Verify: seed 100 rows, navigate pages.

11. **Minimal API docs** — hand-written `docs/api.md` covering `/api/orders`, `/api/stream`, `/api/health`.
    - Files: `docs/api.md`
    - Verify: manual review against implementations.

### Phase 7 end-to-end verification
- Order 3 drinks as a cart, each appears in `/recent` and fires the HA event.
- "The usual" button on picker orders your last drink in 2 taps.
- Stats page with a custom date range matches `SELECT COUNT(*) … WHERE created_at BETWEEN …`.
- CSV export opens cleanly in a spreadsheet.

---

## Phase 8 — Polish, Accessibility & Deployment Ergonomics

**Theme:** Everything that makes the app feel finished. Lowest risk, can be shipped incrementally.

### Deliverables

1. **Keyboard navigation + focus rings** — arrow/tab on profile picker and menu grid, visible focus, `aria-label`s.
   - Files: `src/routes/+page.svelte`, `src/routes/menu/+page.svelte`, `src/app.css`
   - Verify: place a full order with keyboard only.

2. **Dynamic document title** — store-driven ("Drink Hub · 2 orders today", transient "Cheers!" post-submit).
   - Files: `src/routes/+layout.svelte`, `src/lib/stores/title.ts` (new)
   - Verify: watch tab title change after ordering.

3. **Admin PIN gate** — 4-digit PIN hashed in `settings`, 24h cookie, loopback bypass.
   - Files: `src/hooks.server.ts`, `src/routes/admin/+layout.server.ts`, `src/routes/admin/login/+page.svelte` (new)
   - Verify: clear cookie → `/admin` redirects to login.

4. **Dark mode toggle** — manual override in localStorage, system default fallback.
   - Files: `src/routes/+layout.svelte`, `src/app.css`, `src/lib/stores/theme.ts` (new)
   - Verify: toggle persists across reload.

5. **Browser notifications for milestones** — request permission from `/stats`, notify on SSE `milestone.fired`.
   - Files: `src/routes/stats/+page.svelte`, `src/service-worker.ts`
   - Verify: trigger a milestone → native notification.

6. **Service worker API caching (stale-while-revalidate)** — menu loads offline with banner.
   - Files: `src/service-worker.ts`
   - Verify: devtools offline → `/menu` still renders from cache.

7. **Kiosk element position rotation** — extend existing bg drift to also swap element layout variants every N minutes (burn-in prevention).
   - Files: `src/routes/kiosk/+page.svelte`
   - Verify: leave kiosk open → layout variant changes.

8. **Admin form loading spinners** — shared `<SubmitButton>` with pending state via `use:enhance`.
   - Files: `src/lib/components/SubmitButton.svelte` (new), all admin forms
   - Verify: throttled network → spinner visible.

9. **Multi-stage Dockerfile with cached deps layer** — `COPY package*.json` + `npm ci` before `COPY .`.
   - Files: `Dockerfile`
   - Verify: edit a route file, rebuild → `npm ci` layer cached.

10. **Explicit `TZ` env + config** — document in `.env.example`, set in compose, replace hardcoded `'localtime'` with an app-level helper.
    - Files: `.env.example`, `docker-compose.yml`, date-related query helpers
    - Verify: set `TZ=America/New_York`, daily buckets shift.

11. **CORS allowlist** — `CORS_ORIGINS` env var applied in `hooks.server.ts` to `/api/*` only.
    - Files: `src/hooks.server.ts`, `.env.example`
    - Verify: cross-origin fetch from LAN host succeeds when listed, fails otherwise.

### Phase 8 end-to-end verification
- Full order flow works via keyboard alone.
- PIN gate blocks `/admin` from a fresh browser.
- Dark mode survives reload.
- Docker rebuild after a source-only change skips `npm ci`.

---

## Critical Files (referenced across phases)

- `src/lib/server/milestones.ts` — transaction + bucket fix (P6)
- `src/routes/api/orders/+server.ts` — tx, rate limit, cart, GET list (P6, P7)
- `src/lib/server/stream.ts` — Last-Event-ID catch-up, delete/edit broadcasts (P6, P7)
- `src/lib/server/db/schema.ts` — status column, favorites, categories (P6, P7)
- `src/hooks.server.ts` — PIN gate, CORS (P8)
- `src/routes/admin/+layout.svelte` — HA banner (P6)
- `src/lib/server/uploads.ts` — size validation (P6)
- `Dockerfile`, `docker-compose.yml` — healthcheck, TZ, build cache (P6, P8)

---

## Dropped Findings

- **i18n scaffolding** — single household, all English. Not worth the tax.
- **WebSocket fallback for SSE** — LAN-only deployment, SSE works on every browser we use. Phase 6's `Last-Event-ID` catch-up covers the real pain (restart gaps).

---

## Security Hardening Roadmap

The app is now internet-exposed, so the next work should not be framed as feature polish. The hardening work is split into three follow-on phases that can be implemented after the current shared-password gate.

### Phase 9 — Edge Access & Authentication Hardening

Doc: [phase-9-edge-auth-hardening.md](./phase-9-edge-auth-hardening.md)

Focus:
- HTTPS enforcement and correct proxy headers
- re-enable CSRF protection
- nginx Basic Auth as a first-line shield
- remove weak admin defaults
- move all runtime secrets to env-backed config

### Phase 10 — App Abuse Resistance & Authorization Tightening

Doc: [phase-10-app-abuse-resistance.md](./phase-10-app-abuse-resistance.md)

Focus:
- IP + session aware rate limits
- explicit authorization on order mutation routes
- reduce exposure of recent/stats/kiosk/stream/uploads
- stronger request validation
- logout and session hygiene

### Phase 11 — Operational Security, Monitoring & Container Hardening

Doc: [phase-11-operational-security.md](./phase-11-operational-security.md)

Focus:
- stop publishing the app container directly
- run with a tighter container profile
- add security headers
- log auth failures and blocked requests
- document recovery and rotation procedures
