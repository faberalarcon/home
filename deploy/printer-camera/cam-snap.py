#!/usr/bin/env python3
"""Headless-Chromium snapshot bridge for the Creality K2 Pro camera.

The K2 Pro serves its camera only over WebRTC via a minimal "libpeer" stack
that aiortc cannot complete a DTLS handshake with — but a real Chromium can
(it's what the DnG-Crafts/K2-Camera project relies on). This service runs
system Chromium headless, loads a tiny WebRTC client (client.html) that pulls
decoded frames via MediaStreamTrackProcessor, and re-exposes the latest frame
as a plain HTTP snapshot/MJPEG so the SvelteKit /stats/printer/snapshot proxy
(PRINTER_SNAPSHOT_URL) can serve it on the LAN and remotely.

Env:
  CAM_SIGNALING_URL  default http://192.168.1.176:8000/call/webrtc_local
  CAM_BIND_HOST      default 127.0.0.1
  CAM_BIND_PORT      default 8788
  CAM_CHROMIUM       default /usr/bin/chromium
  CAM_STREAM_FPS     default 2
"""

import asyncio
import base64
import os
import time
from pathlib import Path

import aiohttp
from aiohttp import web
from playwright.async_api import async_playwright

SIGNALING_URL = os.environ.get("CAM_SIGNALING_URL", "http://192.168.1.176:8000/call/webrtc_local")
BIND_HOST = os.environ.get("CAM_BIND_HOST", "127.0.0.1")
BIND_PORT = int(os.environ.get("CAM_BIND_PORT", "8788"))
CHROMIUM = os.environ.get("CAM_CHROMIUM", "/usr/bin/chromium")
STREAM_FPS = float(os.environ.get("CAM_STREAM_FPS", "2"))
CLIENT_HTML = (Path(__file__).parent / "client.html").read_text()

FRAME_STALE_S = 10.0


class FrameStore:
    def __init__(self) -> None:
        self.jpeg: bytes | None = None
        self.ts: float = 0.0

    def put(self, jpeg: bytes) -> None:
        self.jpeg = jpeg
        self.ts = time.monotonic()

    def fresh(self) -> bool:
        return self.jpeg is not None and (time.monotonic() - self.ts) < FRAME_STALE_S


store = FrameStore()


async def handle_index(request: web.Request) -> web.Response:
    return web.Response(text=CLIENT_HTML, content_type="text/html")


async def handle_signal(request: web.Request) -> web.Response:
    # Same-origin proxy so the in-page fetch isn't blocked by CORS; forward the
    # base64 offer to the printer and return its base64 answer.
    offer = await request.read()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                SIGNALING_URL,
                data=offer,
                headers={"Content-Type": "plain/text"},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                body = await resp.read()
    except Exception:
        return web.Response(status=502, text="printer signaling unreachable")
    return web.Response(body=body, content_type="text/plain")


async def handle_snapshot(request: web.Request) -> web.Response:
    if not store.fresh() or store.jpeg is None:
        return web.Response(status=503, text="camera frame unavailable")
    return web.Response(
        body=store.jpeg,
        content_type="image/jpeg",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


async def handle_stream(request: web.Request) -> web.StreamResponse:
    boundary = "frame"
    resp = web.StreamResponse(
        headers={
            "Content-Type": f"multipart/x-mixed-replace; boundary={boundary}",
            "Cache-Control": "no-store, max-age=0",
        }
    )
    await resp.prepare(request)
    interval = 1.0 / STREAM_FPS if STREAM_FPS > 0 else 0.5
    try:
        while True:
            if store.fresh() and store.jpeg is not None:
                f = store.jpeg
                await resp.write(
                    b"--" + boundary.encode() + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(f)).encode() + b"\r\n\r\n" + f + b"\r\n"
                )
            await asyncio.sleep(interval)
    except (asyncio.CancelledError, ConnectionResetError):
        pass
    return resp


async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"fresh": store.fresh()})


async def grab_loop(page) -> None:
    while True:
        try:
            data = await page.evaluate("window.__grab && window.__grab()")
            if data and isinstance(data, str) and data.startswith("data:image"):
                store.put(base64.b64decode(data.split(",", 1)[1]))
        except Exception as exc:  # noqa: BLE001
            print(f"[cam-snap] grab error: {exc}", flush=True)
        await asyncio.sleep(0.5)


async def main() -> None:
    app = web.Application()
    app.router.add_get("/", handle_index)
    app.router.add_post("/signal", handle_signal)
    app.router.add_get("/snapshot", handle_snapshot)
    app.router.add_get("/stream", handle_stream)
    app.router.add_get("/health", handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, BIND_HOST, BIND_PORT).start()
    print(f"[cam-snap] serving on http://{BIND_HOST}:{BIND_PORT} (signaling {SIGNALING_URL})", flush=True)

    pw = await async_playwright().start()
    print("[cam-snap] launching chromium…", flush=True)
    browser = await pw.chromium.launch(
        executable_path=CHROMIUM,
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--autoplay-policy=no-user-gesture-required",
            "--disable-gpu",
        ],
    )
    print("[cam-snap] chromium launched", flush=True)
    page = await browser.new_page()
    page.on("console", lambda m: print(f"[page] {m.type}: {m.text}", flush=True))
    page.on("pageerror", lambda e: print(f"[page error] {e}", flush=True))
    await page.goto(f"http://{BIND_HOST}:{BIND_PORT}/", wait_until="domcontentloaded", timeout=20000)
    print("[cam-snap] chromium client loaded", flush=True)
    await grab_loop(page)


if __name__ == "__main__":
    asyncio.run(main())
