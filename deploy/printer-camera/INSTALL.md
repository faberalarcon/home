# Printer camera snapshot bridge — install

> **STATUS: EXPERIMENTAL / NOT YET WIRED IN (future work).** The LAN live view
> (in-browser WebRTC on `/stats/printer`) is the shipped camera feature. This
> headless-Chromium service is the planned path for an *always-on / remote*
> JPEG snapshot (so `PRINTER_SNAPSHOT_URL` and the `<img>` light up off-LAN),
> but the end-to-end frame capture is **unverified** — `createOffer` works
> headless, full capture is untested. `aiortc` was tried first and cannot
> complete the K2's libpeer DTLS handshake. Do not enable in production yet.


The K2 Pro serves its camera **only over WebRTC** via a minimal "libpeer" stack.
There is no MJPEG/snapshot URL, and `aiortc` cannot complete its DTLS handshake
(ICE succeeds, DTLS times out). A real Chromium *can* (it's what the
DnG-Crafts/K2-Camera project relies on), so this bridge runs **system Chromium
headless**, loads `client.html` (which pulls decoded frames via
`MediaStreamTrackProcessor`), and re-exposes the latest frame as:

- `GET /snapshot` — latest frame as `image/jpeg`
- `GET /stream` — MJPEG
- `GET /health` — `{fresh}`
- `POST /signal` — internal same-origin signaling proxy to the printer

The SvelteKit `/stats/printer/snapshot` proxy fetches `PRINTER_SNAPSHOT_URL`
server-side, so the snapshot works on the LAN **and** remotely.

## 1. System Chromium (has H264; Playwright's bundled build does not)

```bash
sudo apt-get install -y chromium
chromium --version
```

## 2. Install code + venv

```bash
sudo mkdir -p /usr/local/lib/21bristoe-printer-camera
sudo cp deploy/printer-camera/cam-snap.py deploy/printer-camera/client.html /usr/local/lib/21bristoe-printer-camera/
sudo python3 -m venv /usr/local/lib/21bristoe-printer-camera/.venv
sudo /usr/local/lib/21bristoe-printer-camera/.venv/bin/pip install -r deploy/printer-camera/requirements.txt
# NOTE: do NOT run `playwright install` — we use system chromium via CAM_CHROMIUM.
```

## 3. Configure

Optional `/etc/21bristoe-printer-camera.env` (defaults shown):

```
CAM_SIGNALING_URL=http://192.168.1.176:8000/call/webrtc_local
CAM_BIND_HOST=127.0.0.1
CAM_BIND_PORT=8788
CAM_CHROMIUM=/usr/bin/chromium
CAM_STREAM_FPS=2
```

Site container — set in `home/.env` and redeploy (`./deploy/deploy.sh`):

```
PRINTER_SNAPSHOT_URL=http://127.0.0.1:8788/snapshot
```

> If the site runs in Docker without host networking, use the host gateway
> (e.g. `http://172.17.0.1:8788/snapshot`) or bind the bridge to that IP.

## 4. Install the service

```bash
sudo cp deploy/systemd/21bristoe-printer-camera.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now 21bristoe-printer-camera.service
```

## 5. Verify

```bash
curl -s -o /tmp/snap.jpg http://127.0.0.1:8788/snapshot && file /tmp/snap.jpg   # JPEG
curl -s http://127.0.0.1:8788/health
journalctl -u 21bristoe-printer-camera -n 30 --no-pager
```

## Notes
- Decoding 720p H264 in software is ~1 CPU core on a Pi; `CAM_STREAM_FPS` and the
  in-page throttle (~1.5 fps) keep it modest.
- `cam_app` may allow only a limited number of WebRTC peers; if the Creality app
  is connected at the same time the bridge may not get a stream.
