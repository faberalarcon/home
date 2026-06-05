# Printer camera snapshot bridge — install

> **STATUS: VERIFIED (2026-06-04).** End-to-end capture confirmed on the Pi —
> headless system Chromium completes the K2's libpeer DTLS handshake (`aiortc`
> cannot) and yields real 1280×720 JPEG frames. The bridge is **print-gated**:
> it only holds the printer's WebRTC peer while a print is active
> (printing/paused), so it decodes ~0 frames (≈no CPU) when idle. This mirrors
> the site's server-side gate — `/stats/printer/snapshot` and `/stats/printer/webrtc`
> return 404 unless a print is active. Snapshot works off-LAN (served through the
> public site); the in-browser **live view** still needs LAN/tailnet reachability
> to the printer.


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

`/etc/21bristoe-printer-camera.env` — bind to the Docker bridge gateway so the
site container can reach it (the site runs in a bridged container, not host net):

```
CAM_SIGNALING_URL=http://192.168.1.176:8000/call/webrtc_local
CAM_PRINTER_URL=http://192.168.1.176:7125
CAM_BIND_HOST=172.17.0.1
CAM_BIND_PORT=8788
CAM_CHROMIUM=/usr/bin/chromium
CAM_STREAM_FPS=2
```

Site container — set in `home/.env` and redeploy (`./deploy/deploy.sh`). The
container resolves `ai.local` to the host gateway via compose `extra_hosts`:

```
PRINTER_SNAPSHOT_URL=http://ai.local:8788/snapshot
```

> `CAM_BIND_HOST=172.17.0.1` exposes the bridge only on the Docker bridge (not
> the LAN). The snapshot/webrtc routes are gated to active prints server-side,
> so the JPEG is never served while idle.

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
