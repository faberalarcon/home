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

---

## Security operations

### Rotating the shared site password

1. Generate a new password hash:
   ```bash
   node -e "const {scryptSync}=require('crypto'); console.log(scryptSync('NEWPASSWORD','drink-hub-site-password',32).toString('hex'))"
   ```
2. Set `SITE_PASSWORD_HASH=<hash>` in your `.env` (or environment) and remove `SITE_PASSWORD` if set.
3. Restart the container: `docker compose restart drink-hub`.
4. All existing `site_session` cookies are invalidated immediately because they are HMAC'd against the old hash.
5. Distribute the new password to household members.

### Rotating the admin password

The admin credential now lives in the database, not `.env`. Two ways to rotate:

- **From the admin panel:** log in at `/admin/login`, then **Settings → Change admin password**. This bumps the admin session epoch, so every other admin session is signed out immediately.
- **If you've lost the admin password:** on the same page, use **Reset admin password**. It requires re-entering the *house* password, generates a random 16-character temp, prints it to the server logs (`docker compose logs drink-hub`), and signs you out. Log back in with the temp and change it.

If you've lost *both* the admin password and the house password, delete the admin credential rows from the database and restart so the bootstrap generates a new temporary password:

```bash
docker compose exec drink-hub sh -c "sqlite3 /app/data/drink-hub.db \"DELETE FROM settings WHERE key IN ('admin_password_hash','admin_password_salt','admin_password_must_reset','admin_session_epoch');\""
docker compose restart drink-hub
docker compose logs drink-hub | grep 'INITIAL ADMIN PASSWORD'
```

### Reviewing auth and rate-limit logs

Failed logins and rate-limit events are written to stdout with the prefix `[auth]` or `[rate-limit]`:

```bash
docker compose logs drink-hub | grep -E '\[(auth|rate-limit)\]'
```

Each log line includes an ISO timestamp and the client IP. Passwords and PINs are never logged.

### Recovering from suspected abuse

1. Rotate the site password immediately (see above) to force all sessions to re-authenticate.
2. If an admin session may be compromised, rotate the admin PIN as well.
3. Review order history in `/admin/orders` for unexpected entries and use the delete/restore controls as needed.
4. Check logs for the abusive IP and, if on a network you control, block it at the router or nginx level.

### Restoring from backup after compromise

See [backup-restore.md](./backup-restore.md) for database restore procedures.

After restoring:
1. Rotate both the site password and admin PIN.
2. Rebuild and restart the container: `docker compose up -d --build`.
3. Verify the app starts cleanly: `docker compose logs -f drink-hub`.
