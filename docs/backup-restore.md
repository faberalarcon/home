# Backup & Restore

drink-hub stores everything in a single SQLite file: `data/drink-hub.db`. Uploaded images live alongside it in `data/uploads/`. Back up both to be safe.

---

## Nightly backup (recommended)

`scripts/backup.sh` uses Python's built-in `sqlite3.backup()` — safe for WAL-mode databases without stopping the container.

### Set up a host cron job on the Pi

```bash
# Run once to test
cd /home/<your-user>/projects/drink-hub
./scripts/backup.sh

# Add to crontab (runs at 3am every day)
crontab -e
```

Add this line:
```
0 3 * * * /home/<your-user>/projects/drink-hub/scripts/backup.sh >> /home/<your-user>/projects/drink-hub/data/backup.log 2>&1
```

Backups are written to `data/backups/YYYY-MM-DD.db`. Files older than 14 days are pruned automatically.

### Back up uploads too

```bash
# Add alongside the db backup, or run separately
tar -czf data/backups/$(date +%F)-uploads.tar.gz data/uploads/
```

---

## Restore from backup

```bash
# 1. Stop the container
docker compose down

# 2. Replace the database
cp data/backups/2026-04-09.db data/drink-hub.db

# 3. (Optional) restore uploads
tar -xzf data/backups/2026-04-09-uploads.tar.gz

# 4. Start the container
docker compose up -d
```

The container runs migrations on boot so it will auto-apply any pending schema changes on top of the restored database.

---

## Verify a backup

```bash
python3 -c "
import sqlite3
db = sqlite3.connect('data/backups/2026-04-09.db')
print(db.execute('SELECT count(*) FROM orders').fetchone()[0], 'orders')
print(db.execute('SELECT count(*) FROM drinks').fetchone()[0], 'drinks')
db.close()
"
```

---

## Off-Pi backup

To copy the database off the Pi (e.g. to a laptop over SSH):

```bash
# From your laptop:
scp pi@<pi-ip>:/home/<user>/projects/drink-hub/data/drink-hub.db ./drink-hub-$(date +%F).db
```
