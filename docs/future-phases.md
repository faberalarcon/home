# Future Phases — Post-MVP Enhancements

Phases 1–9 are complete and deployed. Phase 8 is partially done. This document tracks what's shipped and what remains.

---

## Phase 6 — Correctness, Safety & Operational Hygiene ✅ Done

**Theme:** Make the existing system trustworthy before adding surface area.

1. ✅ **Transactional milestone evaluation** — `evaluateMilestones` runs inside the order-insert transaction; concurrent orders can't double-fire.
2. ✅ **Day/week bucket comparison for milestones** — SQLite `date(…, 'localtime')` bucket match; idle gaps don't suppress re-firing.
3. ✅ **DELETE /api/orders/[id] + undo** — soft-delete via `orders.status`; 30s undo toast on `/recent`; delete button on `/admin/orders`; SSE broadcasts decrement to stats/kiosk live.
4. ✅ **Rate limit `/api/orders`** — in-memory token bucket per profile_id; returns 429 + `Retry-After`.
5. ✅ **GET /api/orders with filters + pagination** — `?limit=&before=&profile_id=&drink_id=`; `/recent` uses "load more".
6. ✅ **GET /api/health** — `{ status, db, ha, uptime, version }`; wired into `docker-compose.yml` healthcheck.
7. ✅ **Persistent HA connection banner in admin** — `ha_last_error` stored in settings; warning banner visible on any admin page when token missing or last call failed.
8. ✅ **Upload size + dimension validation** — rejects >5 MB; downscales to max 1024px before sharp resize.
9. ✅ **SSE catch-up via `Last-Event-ID`** — ring buffer of recent events; replayed to reconnecting clients.
10. ✅ **Activate `orders.status` column** — `placed | deleted`; all order queries filter `status != 'deleted'`.

---

## Phase 7 — Power-User Features & API Surface ✅ Done

**Theme:** The ergonomic wins household users actually ask for.

1. ✅ **Multi-round ordering (cart flow)** — `/menu` collects a cart; single POST submits `drinkIds[]`; server inserts all in one transaction + fires HA events per drink + queues TTS.
2. ✅ **Favorites & last-ordered on picker** — profile picker shows "The usual · [drink]" one-tap button and "Last: [drink] · Xm ago" without schema changes (computed via SQL).
3. ✅ **Drink recipe/notes view + edit** — `drinks.notes` column (migration 0001); shown on menu card expand; editable in admin.
4. ✅ **Menu & admin search/filter** — client-side live filter on `/menu`, `/admin/drinks`, `/admin/profiles`.
5. ⬜ **Category whitelist** — free-text category still used; settings-driven dropdown not implemented.
6. ✅ **Day-of-week histogram** — bar chart on `/stats` using SQLite `strftime('%w', …)`. Custom date range not yet added.
7. ✅ **CSV/JSON export** — `/admin/orders/export?format=csv&from=&to=`; Export button on orders page.
8. ✅ **Edit order (reassign profile)** — inline reassign form in `/admin/orders`; PATCH endpoint re-broadcasts SSE.
9. ⬜ **Restore soft-deleted drinks** — "show inactive" toggle not yet built.
10. ✅ **Admin orders pagination** — 50/page cursor pagination on `/admin/orders`. (Shared `Paginator.svelte` for all lists not done.)
11. ⬜ **Minimal API docs** — `docs/api.md` not yet written.

---

## Phase 8 — Polish, Accessibility & Deployment Ergonomics ⚠ Partial

**Theme:** Everything that makes the app feel finished.

1. ⬜ **Keyboard navigation + focus rings** — arrow/tab on profile picker and menu grid, visible focus, `aria-label`s.
2. ✅ **Dynamic document title** — `pageTitle` store drives `<title>`; "Cheers! 🍹" transient after ordering.
3. ✅ **Admin PIN gate** — env-backed PIN (`ADMIN_PIN` / `ADMIN_PIN_HASH`), HMAC-signed 24h cookie, login page at `/admin/login`. *(Shipped as part of Phase 9.)*
4. ⬜ **Dark mode toggle** — manual override in localStorage, system default fallback.
5. ⬜ **Browser notifications for milestones** — request permission from `/stats`, notify on SSE `milestone.fired`.
6. ⬜ **Service worker API caching (stale-while-revalidate)** — menu loads offline with banner.
7. ⬜ **Kiosk element position rotation** — swap layout variants every N minutes for burn-in prevention.
8. ⬜ **Admin form loading spinners** — shared `<SubmitButton>` with pending state via `use:enhance`.
9. ⬜ **Multi-stage Dockerfile with cached deps layer** — `COPY package*.json` + `npm ci` before `COPY .`.
10. ✅ **Explicit `TZ` env** — set in `docker-compose.yml`; defaults to `America/New_York`.
11. ⬜ **CORS allowlist** — `CORS_ORIGINS` env var applied in `hooks.server.ts` to `/api/*` only.

---

## Remaining Work (Phase 8)

The items below are the only unshipped deliverables. They are all low-risk and can be picked up in any order.

| Item | Effort | Notes |
|---|---|---|
| Keyboard navigation + focus rings | Medium | `+page.svelte`, `menu/+page.svelte`, `app.css` |
| Dark mode toggle | Small | localStorage preference + Tailwind `dark:` classes |
| Browser notifications for milestones | Small | Notification API permission prompt on `/stats` |
| Service worker stale-while-revalidate | Medium | SvelteKit service worker file; menu offline banner |
| Kiosk layout rotation | Small | Extend existing drift timer in `kiosk/+page.svelte` |
| Admin form spinners (`SubmitButton`) | Small | Shared component + `use:enhance` on all admin forms |
| Multi-stage Dockerfile | Small | Cache `npm ci` layer separately from source |
| CORS allowlist | Small | `CORS_ORIGINS` env; `hooks.server.ts` `/api/*` guard |

---

## Dropped Findings

- **i18n scaffolding** — single household, all English. Not worth the tax.
- **WebSocket fallback for SSE** — LAN-only deployment, SSE works on every browser we use. Phase 6's `Last-Event-ID` catch-up covers the real pain (restart gaps).

---

## Security Hardening Roadmap

The app is now internet-exposed, so the next work should not be framed as feature polish. The hardening work is split into three follow-on phases that can be implemented after the current shared-password gate.

### Phase 9 — Edge Access & Authentication Hardening ✅ Done

Doc: [phase-9-edge-auth-hardening.md](./phase-9-edge-auth-hardening.md)

Focus:
- Shared site password gate (env-backed, HMAC-signed cookie)
- Admin PIN gate replacing DB-stored PIN (env-backed, constant-time verify)
- CSRF trusted origins via `CSRF_TRUSTED_ORIGINS` env var
- Hardened nginx config with HTTPS, proxy headers, security headers
- nginx Basic Auth: **reverted** — site now intranet-only via split DNS; the app's own password gate is sufficient

### Phase 10 — App Abuse Resistance & Authorization Tightening ✅ Done

Doc: [phase-10-app-abuse-resistance.md](./phase-10-app-abuse-resistance.md)

Focus:
- IP + session aware rate limits
- explicit authorization on order mutation routes
- reduce exposure of recent/stats/kiosk/stream/uploads
- stronger request validation
- logout and session hygiene

### Phase 11 — Operational Security, Monitoring & Container Hardening ✅ Done

Doc: [phase-11-operational-security.md](./phase-11-operational-security.md)

Focus:
- stop publishing the app container directly
- run with a tighter container profile
- add security headers
- log auth failures and blocked requests
- document recovery and rotation procedures

---

## Post-Phase Features

The following features were added outside the original phase plan:

- **BAC estimation** — Widmark formula BAC calculation using profile weight/biological sex and drink ABV/volume. Displayed on the stats leaderboard and kiosk view.
- **Light flash on TTS** — Milestone TTS announcements now flash a configured light entity with random vibrant colors, restoring previous light state afterward.
- **Footer** — Site footer with GitHub link and attribution.
