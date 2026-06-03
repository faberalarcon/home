# Printer metrics collector — install (Phase B, when the K2 Pro is on the network)

The site code degrades gracefully without any of this; these steps light up the
**history charts** on `/stats/printer` by running the JSONL collector on a timer.
The live status / temps / camera work from env config alone (no collector needed).

## 1. Confirm Moonraker is reachable

```bash
curl http://<printer-ip>:7125/printer/info
```

If it fails, the K2 Pro likely needs rooting / developer mode / a Fluidd-style
install to expose Moonraker on 7125. Any reachable Moonraker base works.

Discover the real object + sensor names (the chamber sensor name in particular):

```bash
curl 'http://<printer-ip>:7125/printer/objects/list'
curl 'http://<printer-ip>:7125/server/webcams/list'   # snapshot URL
```

## 2. Configure env

Site container — set in `home/.env` and redeploy (`./deploy/deploy.sh`):

```
PRINTER_BASE_URL=http://<printer-ip>:7125
PRINTER_SNAPSHOT_URL=http://<printer-ip>/webcam/?action=snapshot
PRINTER_CHAMBER_OBJECT=<exact object name from objects/list, if not default>
PRINTER_NAME=K2 Pro
```

Collector — create `/etc/21bristoe-printer.env`:

```
PRINTER_BASE_URL=http://<printer-ip>:7125
PRINTER_CHAMBER_OBJECT=<same as above, if needed>
```

## 3. Install the collector + timer

```bash
sudo mkdir -p /usr/local/lib/21bristoe-printer-metrics
sudo cp deploy/printer-metrics/collect-printer-metrics.mjs /usr/local/lib/21bristoe-printer-metrics/
sudo cp deploy/systemd/21bristoe-printer-metrics.service /etc/systemd/system/
sudo cp deploy/systemd/21bristoe-printer-metrics.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now 21bristoe-printer-metrics.timer
```

## 4. Verify

```bash
sudo systemctl start 21bristoe-printer-metrics.service   # one manual run
tail -n2 /var/lib/bristoe-stats/printer-metrics.jsonl    # sample written?
systemctl list-timers '21bristoe-printer-metrics*'
```

Then load `/stats/printer` — live tiles populate, history fills in over the next
few sample intervals (timer runs every 2 minutes).
