# Troubleshooting

## Container won't start

```bash
docker compose logs drink-hub
```

Common causes:
- **Port 5173 in use** — another process is on that port. Change the host port in `docker-compose.yml` (`"5174:3000"` for example).
- **Database migration failed** — check logs for `migration failed`. Try `docker compose down && docker compose up -d` to retry.
- **Data directory permission error** — ensure `./data` is readable by the container user: `chmod -R 755 data/`.

---

## Home Assistant events not firing

| Symptom | Fix |
|---|---|
| `no token configured` in HA log | Go to `/admin/settings` and paste your HA long-lived token |
| `no base URL configured` | Set HA base URL to `http://ai.local:8123` (or your actual HA address) |
| `HTTP 401` | Token is wrong or expired — generate a new one in HA → Profile → Long-lived tokens |
| `Connection failed: fetch failed` | HA is unreachable from the container. Check `docker-compose.yml` has `extra_hosts: ["ai.local:host-gateway"]` |
| `HTTP 404` on `/api/events/...` | The event name is fine — this means HA accepted it but no automation listens for it |
| Event fires but automation doesn't trigger | The automation's `event_type` must match the drink's `ha_trigger_event` exactly (case-sensitive) |

**Test the connection** from `/admin/settings` → "Test HA connection".

---

## Admin panel forms return 403

This shouldn't happen with the current build (CSRF check is disabled for LAN-only operation). If you see it:
- Check you're accessing via `http://` not `https://`
- Restart the container: `docker compose restart drink-hub`

---

## Images not showing

- Check `data/uploads/` exists and has files
- The `/uploads/[...path]` route serves them — verify with `curl http://localhost:5173/uploads/drinks/1-my-drink.webp`
- If the container was rebuilt without the volume mount, uploads are lost — check `docker-compose.yml` has `./data:/app/data`

---

## Stats page not updating live

The `/api/stream` SSE endpoint keeps a long-lived connection. Common issues:
- **Nginx/reverse proxy timeout** — if you have a proxy in front, set `proxy_read_timeout 3600;` and `proxy_buffering off;`
- **Tab in background** — browsers throttle background tabs; the updates will catch up when you switch back
- **Ad blockers** — some block SSE endpoints; try a private window

---

## Kiosk shows stale data

The kiosk page subscribes to `/api/stream`. If the SSE connection drops:
- The browser will try to reconnect automatically (EventSource retries)
- Hard-reload the kiosk: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- If the Pi restarted, the container auto-restarts (`restart: unless-stopped`) within a few seconds

---

## PWA not installable

- Must be served over HTTPS, OR on `localhost`/LAN. LAN HTTP should work on Android Chrome.
- On iOS Safari, tap **Share → Add to Home Screen**.
- Clear site data and reload if the manifest isn't being picked up.

---

## Database locked error

```
SQLITE_BUSY: database is locked
```

This means two processes tried to write at the same time. The database runs in WAL mode which makes this rare. If it persists:
1. Stop the container.
2. Run `python3 -c "import sqlite3; sqlite3.connect('data/drink-hub.db').execute('pragma wal_checkpoint(TRUNCATE)')"`.
3. Restart.

---

## Restore after accidental data loss

See [backup-restore.md](./backup-restore.md).
