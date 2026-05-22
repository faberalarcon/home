# LLM mode-switch control plane on pc.local

**Date:** 2026-05-21
**Owner:** pc.local (192.168.1.215)
**Consumer:** pi.local (192.168.1.177, the SvelteKit `home` app)

## Why

The LLM GPU box now hosts three GPU-backed services:

| Service                       | Port | Purpose                       | Coexistence |
|-------------------------------|-----:|-------------------------------|-------------|
| `llama-cpp-router.service`    | 8080 | OpenAI-compatible chat + embeddings | runs alongside whisper |
| `whisper-server.service`      | 8081 | `/inference` speech-to-text   | runs alongside llama |
| `sd-cpp-server.service`       | 7860 | stable-diffusion.cpp; both `/v1/images/generations` and `/sdapi/v1/txt2img` | **exclusive** — needs sole GPU |

llama + whisper share the GPU happily. Stable-diffusion.cpp does not — it must
own the GPU alone, so entering SD mode stops llama and whisper, and leaving SD
mode restores them.

There is already a host-side swap script, but pi.local has no programmatic way
to invoke it. The web app currently assumes llama-server is always up at 8080;
the new gooby image-gen UI needs to be able to ask "make sd the active mode"
before sending a prompt to SD, then return to llama for chat.

This handoff specifies a tiny HTTP service — **`llm-switch`** — that wraps the
existing swap script and exposes it over LAN + Tailscale so the web app can
drive transitions.

## Contract

### Endpoints

```
GET /mode
  → 200 application/json
  {
    "mode": "sd" | "normal",                # "normal" = SD down; llama+whisper may both be up
    "services": {
      "llama-cpp-router.service":  { "active": bool, "sub": "running"|"dead"|... },
      "whisper-server.service":    { "active": bool, "sub": "..." },
      "sd-cpp-server.service":     { "active": bool, "sub": "..." }
    },
    "checked_at": "2026-05-21T18:42:01Z"
  }

POST /mode
  Content-Type: application/json
  body: { "mode": "llama" | "whisper" | "sd" }

  Semantics:
    • mode=sd     — stop llama + whisper, start sd. Wait until sd is healthy.
                    Implicitly remembers that llama/whisper were running so
                    they can be restored on the next non-sd request.
    • mode=llama  — stop sd, ensure llama is running. Whisper is left as-is
                    (started if it was running before sd took over).
    • mode=whisper — stop sd, ensure whisper is running. Llama is left as-is.

  Streams text/event-stream:
    event: status
    data: {"phase":"starting","mode":"sd"}
    event: status
    data: {"phase":"stopping","unit":"llama-cpp-router.service"}
    event: status
    data: {"phase":"stopping","unit":"whisper-server.service"}
    event: status
    data: {"phase":"starting","unit":"sd-cpp-server.service"}
    event: status
    data: {"phase":"ready","mode":"sd","port":7860}
    event: done
    data: {}

  Leaving SD (mode=llama example):
    event: status
    data: {"phase":"starting","mode":"llama"}
    event: status
    data: {"phase":"stopping","unit":"sd-cpp-server.service"}
    event: status
    data: {"phase":"starting","unit":"llama-cpp-router.service"}
    event: status                              # whisper restored if it was running before SD
    data: {"phase":"starting","unit":"whisper-server.service"}
    event: status
    data: {"phase":"ready","mode":"llama","port":8080}
    event: done
    data: {}

  Failure path:
    event: status
    data: {"phase":"failed","mode":"sd","error":"unit failed to come up: ..."}
    event: done
    data: {}

GET /health
  → 200 application/json
  { "ok": true, "uptime_s": 123 }
```

The web app proxy at `/gooby/api/mode` already speaks this exact contract — it
forwards `mode` verbatim (`chat→llama`, `image→sd`, `transcribe→whisper`),
streams the SSE back to the browser, and tacks on a final `phase:"snapshot"`
event after the upstream `done`.

### Networking

- Listen `0.0.0.0:8765`.
- Reachable on LAN (`192.168.1.0/24`) and over the Tailscale tailnet.
- Block elsewhere via the host firewall (`ufw allow from 192.168.1.0/24 to any port 8765`, plus a tailnet allow).
- Optional shared-secret header `X-LLM-Switch-Token`, value from env `LLM_SWITCH_TOKEN`. If unset, no auth (current acceptable posture for the home LAN). The pi side already forwards this header when `LLM_SWITCH_TOKEN` is set in the SvelteKit app's env.

### Concurrency

Serialize swap requests with an `asyncio.Lock` (or equivalent). Concurrent
POSTs must queue, not race — two simultaneous transitions can leave the GPU
with neither model loaded.

## Suggested implementation (FastAPI)

```python
# /home/faber/llm-switch/server.py
import asyncio, subprocess, time
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
import httpx

SWAP_SCRIPT = "/usr/local/bin/llm-swap.sh"   # ← confirm real path with Faber
UNITS = {
    "llama":   ("llama-cpp-router.service", 8080, "/health"),
    "whisper": ("whisper-server.service",   8081, "/health"),
    "sd":      ("sd-cpp-server.service",    7860, "/sdapi/v1/sd-models"),
}

app = FastAPI()
lock = asyncio.Lock()
START_TIME = time.monotonic()

async def unit_status(name: str) -> dict:
    proc = await asyncio.create_subprocess_exec(
        "systemctl", "--user", "show", name,
        "--property=ActiveState,SubState",
        stdout=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    kv = dict(line.split("=", 1) for line in out.decode().splitlines() if "=" in line)
    return {"active": kv.get("ActiveState") == "active", "sub": kv.get("SubState", "")}

async def current_mode() -> str:
    for mode, (unit, _, _) in UNITS.items():
        st = await unit_status(unit)
        if st["active"]:
            return mode
    return "idle"

@app.get("/health")
async def health():
    return {"ok": True, "uptime_s": int(time.monotonic() - START_TIME)}

@app.get("/mode")
async def mode_get():
    services = {unit: await unit_status(unit) for unit, _, _ in UNITS.values()}
    return {
        "mode": await current_mode(),
        "services": services,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }

@app.post("/mode")
async def mode_post(body: dict):
    target = body.get("mode")
    if target not in UNITS:
        raise HTTPException(400, "Unknown mode")

    async def gen():
        async with lock:
            yield sse("status", {"phase": "starting", "mode": target})
            # Delegate to the existing swap script. It already encodes the
            # coexistence rules (sd is exclusive; llama+whisper can coexist;
            # leaving sd should restore the units that were up beforehand).
            try:
                proc = await asyncio.create_subprocess_exec(
                    SWAP_SCRIPT, target,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                )
                stdout, _ = await proc.communicate()
                if proc.returncode != 0:
                    yield sse("status", {
                        "phase": "failed",
                        "mode": target,
                        "error": stdout.decode().strip() or f"swap script exited {proc.returncode}",
                    })
                    yield sse("done", {})
                    return
            except Exception as exc:
                yield sse("status", {"phase": "failed", "mode": target, "error": str(exc)})
                yield sse("done", {})
                return

            # Poll target service /health up to 60s.
            unit, port, health_path = UNITS[target]
            deadline = time.monotonic() + 60
            ready = False
            async with httpx.AsyncClient(timeout=2.0) as client:
                while time.monotonic() < deadline:
                    try:
                        r = await client.get(f"http://127.0.0.1:{port}{health_path}")
                        if r.status_code < 500:
                            ready = True
                            break
                    except httpx.HTTPError:
                        pass
                    await asyncio.sleep(1.0)
            yield sse("status", {
                "phase": "ready" if ready else "failed",
                "mode": target,
                "port": port,
                **({} if ready else {"error": f"{unit} did not become healthy in 60s"}),
            })
            yield sse("done", {})

    return StreamingResponse(gen(), media_type="text/event-stream")

def sse(event: str, data: dict) -> bytes:
    import json
    return f"event: {event}\ndata: {json.dumps(data)}\n\n".encode()
```

### Systemd unit

```ini
# ~/.config/systemd/user/llm-switch.service
[Unit]
Description=LLM mode switch HTTP control plane
After=network.target

[Service]
Type=simple
Environment=PYTHONUNBUFFERED=1
WorkingDirectory=/home/faber/llm-switch
ExecStart=/home/faber/llm-switch/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8765
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
```

Enable with:

```bash
loginctl enable-linger faber   # if not already
systemctl --user daemon-reload
systemctl --user enable --now llm-switch.service
```

### Open items for pc.local

1. **Confirm the actual path of the existing swap script** and substitute it
   for `/usr/local/bin/llm-swap.sh` above. The script is expected to take a
   single argument (`llama|whisper|sd`) and exit non-zero on failure.
2. **Confirm sd-cpp-server unit name + port**. The contract assumes 7860 and
   the unit name above; adjust the `UNITS` dict if either differs.
3. **Decide on auth**. If you want the shared-secret header, set
   `LLM_SWITCH_TOKEN` in the unit's `Environment=` and pass the matching
   value to the SvelteKit container.

## Test plan

On pc.local:

```bash
curl -sS http://localhost:8765/health
curl -sS http://localhost:8765/mode
curl -sS -N -X POST http://localhost:8765/mode \
  -H 'Content-Type: application/json' \
  -d '{"mode":"sd"}'
# Expect SSE phases: starting → stopping → starting → ready (port 7860) → done
nvidia-smi   # confirm only sd-cpp-server owns VRAM
curl -sS http://localhost:7860/sdapi/v1/sd-models | jq '.[].title'
```

From pi.local (LAN):

```bash
curl -sS http://192.168.1.215:8765/mode
```

From pi.local through the web app:

1. Open `/gooby` in the browser; log in.
2. Tap the model picker → choose "Image — SD".
3. Loading dot, then "ready". Verify on pc.local: `sd-cpp-server.service` is `active`; `llama-cpp-router.service` and `whisper-server.service` are `inactive` (SD needs the GPU alone).
4. Send a prompt; assistant bubble renders the PNG inline.
5. Pick "Claude 4.6 Distill" (qwen3.5-35b-claude) → web app calls `/gooby/api/mode {mode:chat}`, then `/gooby/api/models {model:qwen3.5-35b-claude}`. Verify on pc.local: `sd-cpp-server.service` is `inactive`; `llama-cpp-router.service` is `active`; `whisper-server.service` is back to whatever state it had before SD took over (active if previously up).

## Web-side env

The SvelteKit app reads these new env vars (defaults shown):

```
LLM_SWITCH_BASE_URL=http://192.168.1.215:8765
LLM_SWITCH_TOKEN=                # optional, matches X-LLM-Switch-Token
SD_BASE_URL=http://192.168.1.215:7860
```

These are added next to the existing `LLAMA_BASE_URL` / `WHISPER_BASE_URL` in
`src/lib/server/llama-endpoint.ts`. Set them in the prod env file under
`/var/lib/21bristoe/` (alongside `LLAMA_BASE_URL`), or rely on the defaults if
the network layout is unchanged.

## Adjacent cleanup shipped at the same time

- Embedding preset was renamed on the LLM box from `embeddinggemma` →
  `ggml-org/embeddinggemma-300M-qat-q4_0-GGUF:Q4_0`. The web app's RAG layer
  was still hardcoding the old alias; both `src/hooks.server.ts` and
  `src/lib/gooby/server/rag.ts` are now updated, and a one-shot migration in
  `hooks.server.ts` rewrites any saved `gooby_rag_embed_model` setting that
  still reads `embeddinggemma`.
- `GOOBY_MODEL_OPTIONS` in `src/lib/gooby/llama.ts` gained `qwen3.5-35b-claude`
  (Claude 4.6 Distill) and a synthetic `sd:default` entry routed through the
  mode switch.
