# Home Assistant Integration Examples

drink-hub fires HA events via the REST API whenever a drink is ordered or a milestone is hit. Your HA automations listen for those events using `trigger.platform: event`.

---

## Setup: Generate a Long-Lived Access Token

1. Open Home Assistant → click your **Profile** (bottom-left avatar).
2. Scroll to **Long-Lived Access Tokens** → **Create token**.
3. Give it a name like `drink-hub` and copy the token — you only see it once.
4. In drink-hub, update the `ha_token` setting (Phase 3 adds an admin UI; for now use SQLite directly):

```bash
# On the Pi, with the container running:
docker exec -it drink-hub sqlite3 /app/data/drink-hub.db \
  "INSERT INTO settings (key, value) VALUES ('ha_token', 'YOUR_TOKEN_HERE')
   ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
```

5. Also verify (or update) the HA base URL if yours differs from the default:

```bash
docker exec -it drink-hub sqlite3 /app/data/drink-hub.db \
  "INSERT INTO settings (key, value) VALUES ('ha_base_url', 'http://homeassistant.local:8123')
   ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
```

---

## Event payload

Every `drink_ordered` event (or whichever `ha_trigger_event` you set on a drink) includes:

```json
{
  "profile": "Alex",
  "drink": "Old Fashioned",
  "category": "cocktail",
  "count_today": 3,
  "count_all_time": 47
}
```

Access these in HA templates via `trigger.event.data.*`.

---

## Example automations

### 1. Speaker announcement on every order

```yaml
alias: drink-hub — announce order
trigger:
  - platform: event
    event_type: drink_ordered
action:
  - service: tts.speak
    target:
      entity_id: media_player.kitchen_speaker   # change to your speaker
    data:
      message: >
        {{ trigger.event.data.profile }} ordered
        {{ trigger.event.data.drink }}!
mode: queued
max: 5
```

### 2. Announce with drink count

```yaml
alias: drink-hub — announce with count
trigger:
  - platform: event
    event_type: drink_ordered
action:
  - service: tts.speak
    target:
      entity_id: media_player.kitchen_speaker
    data:
      message: >
        {{ trigger.event.data.profile }} is on drink number
        {{ trigger.event.data.count_today }} today.
        They ordered a {{ trigger.event.data.drink }}.
mode: queued
max: 5
```

### 3. Flash the lights on any order

```yaml
alias: drink-hub — flash lights on order
trigger:
  - platform: event
    event_type: drink_ordered
action:
  - repeat:
      count: 3
      sequence:
        - service: light.turn_on
          target: { area_id: living_room }   # change to your area
          data: { brightness_pct: 100 }
        - delay: "00:00:00.3"
        - service: light.turn_on
          target: { area_id: living_room }
          data: { brightness_pct: 40 }
        - delay: "00:00:00.3"
mode: single
```

### 4. Milestone — flash lights when 10 drinks ordered today (Phase 4 stub)

*In Phase 4, drink-hub will fire a configurable milestone event automatically.
For now you can approximate it by counting events in HA:*

```yaml
alias: drink-hub — 10 drinks today
trigger:
  - platform: event
    event_type: drink_ordered
    event_data:
      count_today: 10
action:
  - service: tts.speak
    target:
      entity_id: media_player.kitchen_speaker
    data:
      message: "10 drinks tonight. Pace yourselves."
  - service: light.turn_on
    target: { area_id: living_room }
    data:
      effect: colorloop
mode: single
```

### 5. Log every order to a persistent notification (useful for debugging)

```yaml
alias: drink-hub — debug log
trigger:
  - platform: event
    event_type: drink_ordered
action:
  - service: persistent_notification.create
    data:
      title: "drink-hub order"
      message: >
        {{ trigger.event.data.profile }} →
        {{ trigger.event.data.drink }}
        (#{{ trigger.event.data.count_all_time }} all time)
      notification_id: "drink_hub_last_order"   # overwrites each time
mode: queued
max: 10
```

---

## Checking the HA event log (drink-hub side)

Once Phase 3 admin panel is complete, `/admin/ha-log` shows every dispatch attempt with success/error. Until then, query SQLite directly:

```bash
docker exec -it drink-hub sqlite3 /app/data/drink-hub.db \
  "SELECT event_type, success, error, datetime(created_at, 'unixepoch', 'localtime') as at
   FROM ha_events_log ORDER BY id DESC LIMIT 20;"
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `no token configured` in container logs | Run the INSERT above to set `ha_token` |
| `HTTP 401` in `ha_events_log.error` | Token is wrong or expired — generate a new one |
| `fetch failed` / connection error | Verify `ha_base_url` is reachable from the container: `docker exec drink-hub curl -s http://homeassistant.local:8123/api/` |
| Event fires but automation doesn't trigger | Confirm the automation's `event_type` matches the drink's `ha_trigger_event` exactly (case-sensitive) |
| HA says "unknown service tts.speak" | Your HA version may use `tts.google_say` or `tts.cloud_say` — check your TTS integration |
