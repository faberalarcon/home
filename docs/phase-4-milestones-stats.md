# Phase 4 — Milestones & Stats

**Status:** ⏳ Planned

## Goal

The fun layer. Add data-driven milestones ("10 drinks today → flash the lights") and a stats dashboard that updates live. This is where drink-hub stops being a glorified order form and starts being a party trick.

## Deliverables

### 1. Milestone evaluator — `src/lib/server/milestones.ts`

Runs inside the same transaction as order insert. Signature:

```ts
export function evaluateMilestones(tx, order: { profileId, drinkId, createdAt }): Milestone[]
```

Algorithm per milestone:
1. Skip if disabled.
2. Compute the relevant count based on `scope`:
   - `all_time` → `SELECT count(*) FROM orders`
   - `daily` → count since `unixepoch('now', 'start of day')`
   - `weekly` → count since start of ISO week
   - `per_drink` → count where `drink_id = milestone.drink_id`
   - `per_profile` → count where `profile_id = milestone.profile_id`
3. Check if `count === milestone.threshold` (exact match — we want the fire-once-on-crossing behavior).
4. For `daily` / `weekly` scopes, also check `last_fired_at` is outside the current window so it re-fires next day/week.
5. If crossed, update `last_fired_at` and add to the "fired" list.

Return the fired milestones; the caller dispatches their HA events via the Phase 2 `fireEvent` helper.

### 2. Order endpoint hook
- `POST /api/orders` calls the evaluator after insert.
- Dispatches any fired milestones' HA events alongside the per-drink event.
- Returns fired milestones in the response so the UI can show a celebration toast.

### 3. Stats page — `/stats`

Mobile-friendly, three sections:

1. **Counts strip** — today / this week / all time, big numbers.
2. **Leaderboard** — profiles ranked by order count today (tab to switch to "all time").
3. **Top drinks** — horizontal bar chart of top 5, all time. Raw SVG is fine — no chart library dependency needed unless it gets gnarly.

All data derived from `orders` via SQL, no counter columns.

### 4. Live updates — `/api/stream`

Server-Sent Events endpoint. On each successful order insert:
- Broadcast an event containing `{ order, counts, firedMilestones }` to all connected clients.
- `/stats` and the Phase 5 `/kiosk` subscribe and patch the DOM reactively.

Implementation: keep a `Set<ReadableStreamDefaultController>` in a module-level singleton. Push on order insert. Clean up on `request.signal.addEventListener('abort', ...)`.

## Data model

No new tables. We do add one optional column if needed:
- `milestones.last_fired_at` — already exists from Phase 1 schema ✅

## Verification

1. In admin panel, create a milestone `{ name: "First drink of the day", scope: "daily", threshold: 1, ha_trigger_event: "first_drink_of_day" }`.
2. Order a drink → `/api/orders` response includes the fired milestone, HA event fires, `last_fired_at` is set.
3. Order another drink the same day → milestone does **not** re-fire.
4. Change system clock or wait until tomorrow → order again → milestone fires again.
5. Open `/stats` on one device and `/menu` on another. Order from the menu — stats update within ~1 second without a refresh.
6. Create a milestone with `threshold: 3`, order 3 drinks, verify it fires exactly once.

## Key files (to be created)

- `src/lib/server/milestones.ts`
- `src/lib/server/stream.ts` — SSE broadcaster singleton
- `src/routes/api/stream/+server.ts`
- `src/routes/stats/{+page.svelte,+page.server.ts}`
- Modify: `src/routes/api/orders/+server.ts`

## Risks / decisions

- **Exact-match vs. greater-than-or-equal.** Exact match (`count === threshold`) is simpler and avoids double-firing but means if someone deletes an order and re-adds past the threshold, it won't fire again. Acceptable tradeoff — document it.
- **SSE vs. WebSockets.** SSE is simpler, one-way-to-client is all we need, and it works through SvelteKit without extra deps.
- **Memory leak risk** on the SSE broadcaster — make sure the abort cleanup is bulletproof.
- **Timezone** — SQLite `unixepoch('now', 'start of day')` is UTC. The Pi is local time. Need to pass an offset or use `'localtime'` modifier; pick one and document it.
