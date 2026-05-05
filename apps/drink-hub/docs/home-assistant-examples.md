# Home Assistant Integration Examples

drink-hub fires HA events via the REST API whenever a drink is ordered or a milestone is hit. Your HA automations listen for those events using `trigger.platform: event`.

---

## Setup: Generate a Long-Lived Access Token

1. Open Home Assistant → click your **Profile** (bottom-left avatar).
2. Scroll to **Long-Lived Access Tokens** → **Create token**.
3. Give it a name like `drink-hub` and copy the token — you only see it once.
4. In drink-hub, go to **`/admin/settings`** and paste the token into the HA token field. Set the base URL to your HA address (e.g. `http://ai.local:8123`). Click **Test HA connection** to verify.

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

### 4. Milestone — fire a custom event when 10 drinks are ordered today

Configure in `/admin/milestones`:
- **Name**: 10 drinks tonight
- **Threshold**: 10
- **Scope**: daily
- **HA trigger event**: `ten_drinks_tonight`

drink-hub fires this event automatically when the daily count hits exactly 10.
The milestone payload includes `milestone`, `threshold`, `scope`, `profile`, and `drink`.

```yaml
alias: drink-hub — 10 drinks milestone
trigger:
  - platform: event
    event_type: ten_drinks_tonight
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

The milestone re-fires the next day automatically (daily scope resets at midnight local time).

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

Go to **`/admin/ha-log`** to see the last 50 dispatch attempts with success/error details and timestamps. Use the filter buttons to show only failures.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `no token configured` in container logs | Run the INSERT above to set `ha_token` |
| `HTTP 401` in `ha_events_log.error` | Token is wrong or expired — generate a new one |
| `fetch failed` / connection error | Verify `ha_base_url` is reachable from the container: `docker exec drink-hub curl -s http://homeassistant.local:8123/api/` |
| Event fires but automation doesn't trigger | Confirm the automation's `event_type` matches the drink's `ha_trigger_event` exactly (case-sensitive) |
| HA says "unknown service tts.speak" | Your HA version may use `tts.google_say` or `tts.cloud_say` — check your TTS integration |
