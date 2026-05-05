# Phase 3 — Admin Panel

**Status:** ✅ Done

## Goal

Make drink-hub configurable by a non-technical housemate. Everything that currently requires editing seed scripts or SQL should be doable from a browser.

## Scope

All admin screens live under `/admin`. Per the approved plan, there's **no authentication** — the Pi is LAN-only and we picked "named profiles, no password" for ordering. We can add a PIN lock later if needed (single setting → middleware in `hooks.server.ts`).

## Deliverables

### `/admin` — dashboard
- Cards linking to each subsection
- Quick stats (total orders, total drinks, HA connection status)

### `/admin/drinks`
- Table of all drinks, sortable by category + sort_order
- Create / edit form with:
  - Name, description, category, active toggle, sort_order
  - HA trigger event (free-text; dropdown suggestion from existing values)
  - **Image upload** — multipart POST → saved to `data/uploads/drinks/<id>-<slug>.<ext>`
  - Use `sharp` to resize to 512×512 and generate a thumbnail at 128×128

### `/admin/profiles`
- Table of profiles
- Create / edit form: name, color picker, avatar upload, active toggle

### `/admin/milestones`
- Table of milestones
- Create / edit form:
  - Name, threshold (integer), scope dropdown (`all_time`, `daily`, `weekly`, `per_drink`, `per_profile`)
  - Drink / profile selector (conditional on scope)
  - HA trigger event
  - Enabled toggle
- Note: the evaluator itself lands in Phase 4 — this phase just does CRUD.

### `/admin/settings`
- HA base URL
- HA long-lived token (password input, never echoed back)
- Site name
- "Test HA connection" button → calls a server action that hits `/api/config` on HA and reports success/failure

### `/admin/ha-log`
- Last 50 rows from `ha_events_log` with filtering by success/failure
- "Clear log" button

## Shared infrastructure

- **File uploads** — `src/lib/server/uploads.ts`: handles multipart parsing, sharp resize, writes to `data/uploads/...`, returns a public URL like `/uploads/drinks/foo.webp`.
- **Static serving** — SvelteKit doesn't serve arbitrary filesystem paths in production. Add a `src/routes/uploads/[...path]/+server.ts` that reads from `data/uploads/` with path traversal protection.
- **Form actions** — use SvelteKit's `export const actions` pattern for all CRUD so we get progressive enhancement for free.
- **Shared UI** — minimal table + form components in `src/lib/components/admin/`.

## Data model

No schema changes. `settings` table already exists from Phase 1. Uploads are just filesystem paths stored in `drinks.image_url` / `profiles.avatar_url`.

## Verification

1. Open `/admin/drinks`, add a new drink with an uploaded image.
2. Visit `/menu` — new drink appears with its image.
3. Restart the container — drink + image still there (volume mount works).
4. Open `/admin/settings`, paste a bad HA token, click "Test HA connection" → clear error message.
5. Fix the token → success.
6. Add a drink with `ha_trigger_event = test_event`, order it, check `/admin/ha-log` for the dispatch row.

## Key files (to be created)

- `src/routes/admin/+layout.svelte` — admin chrome / nav
- `src/routes/admin/+page.svelte` — dashboard
- `src/routes/admin/drinks/{+page.svelte,+page.server.ts}`
- `src/routes/admin/profiles/{+page.svelte,+page.server.ts}`
- `src/routes/admin/milestones/{+page.svelte,+page.server.ts}`
- `src/routes/admin/settings/{+page.svelte,+page.server.ts}`
- `src/routes/admin/ha-log/{+page.svelte,+page.server.ts}`
- `src/routes/uploads/[...path]/+server.ts`
- `src/lib/server/uploads.ts`
- `src/lib/components/admin/*.svelte`

New dependency: `sharp` (pins a native binary — verify arm64 in the Docker build).

## Risks / decisions

- **No auth.** If we ever expose the Pi outside the LAN, `/admin` must be locked down first. Add a banner on the admin pages reminding us.
- **Sharp on arm64** — prebuilt binaries exist for `linux-arm64`; add to the Dockerfile build stage if needed.
