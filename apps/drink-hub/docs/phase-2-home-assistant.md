# Phase 2 — Home Assistant Integration

**Status:** ✅ Complete

## Goal

When someone orders a drink, Home Assistant should know about it — fire an HA event so automations can announce on the kitchen speaker, flash lights, log to a database, whatever.

## Approach

Use Home Assistant's **REST API** (`POST /api/events/<event_type>`) with a **long-lived access token**. No HA add-on required, no MQTT broker, no polling — drink-hub just pushes events and HA automations listen via `platform: event`.

The token is kept server-side only (never sent to the browser), stored in the `settings` table so the admin panel (Phase 3) can update it without a redeploy.

## Deliverables

1. **Settings bootstrap**
   - Helper `getSetting(key)` / `setSetting(key, value)` in `src/lib/server/db/settings.ts`.
   - On boot, seed `ha_base_url` (default `http://homeassistant.local:8123`) and `ha_token` (empty) if missing.

2. **HA client** — `src/lib/server/ha.ts`
   ```ts
   export async function fireEvent(eventType: string, payload: Record<string, unknown>): Promise<void>
   ```
   - Reads base URL and token from settings on each call (cheap, it's SQLite).
   - If token is missing, logs a warning and no-ops (don't break ordering).
   - Uses `fetch` with a short timeout (~3s).
   - **Always** writes a row to `ha_events_log` — success and failure — for the admin debugger in Phase 3.

3. **Order hook**
   - In `POST /api/orders`, after insert, if the drink has a non-null `ha_trigger_event`, call `fireEvent(drink.ha_trigger_event, { profile, drink, count_today, count_all_time })`.
   - Fire-and-forget (don't block the HTTP response on HA's reply, but still await to log the result — use `ctx.waitUntil`-style or just `await` with the timeout).

4. **Reference automation docs** — `docs/home-assistant-examples.md`
   - YAML for a speaker TTS automation listening on `event_type: drink_ordered`.
   - YAML for a "flash the lights on milestone" stub (wired up for Phase 4).
   - Instructions for generating a long-lived access token in HA.

## Data model

No schema changes. Uses existing `settings`, `ha_events_log`, and the `drinks.ha_trigger_event` column.

## Verification

1. Create a long-lived access token in HA (Profile → Security → Long-Lived Access Tokens).
2. Insert it via SQL for now (admin UI lands in Phase 3):
   ```sql
   INSERT INTO settings (key, value) VALUES ('ha_token', '<token>')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;
   ```
3. Create an HA automation:
   ```yaml
   trigger:
     - platform: event
       event_type: drink_ordered
   action:
     - service: tts.speak
       target: { entity_id: media_player.kitchen_speaker }
       data:
         message: "{{ trigger.event.data.profile }} ordered a {{ trigger.event.data.drink }}"
   ```
4. Order a drink from the site → hear the announcement.
5. Check `ha_events_log` table for a `success=1` row.
6. Kill HA → order again → site still returns 200, row logged with `success=0` and the error.

## Key files (to be created)

- `src/lib/server/db/settings.ts`
- `src/lib/server/ha.ts`
- `docs/home-assistant-examples.md`
- Modify: `src/routes/api/orders/+server.ts` (add dispatch call)
- Modify: `src/hooks.server.ts` (bootstrap default settings)

## Risks / decisions to make

- **Blocking vs non-blocking dispatch.** Leaning toward blocking with a ~3s timeout so the UI toast can report dispatch failures; revisit if HA latency becomes a problem.
- **Secret at rest.** Token lives in SQLite in plaintext. Acceptable for a home-LAN device; document that the `data/` volume should have tight file permissions.
