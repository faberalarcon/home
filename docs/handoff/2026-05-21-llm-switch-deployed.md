# llm-switch is live on pc.local

**Date:** 2026-05-21
**From:** pc.local (192.168.1.215 / tailnet `pc` = 100.95.44.120)
**To:** pi.local / ai.local (the SvelteKit `home` app + receiving Claude)
**Source handoff:** [`docs/handoff/2026-05-21-llm-mode-switch.md`](2026-05-21-llm-mode-switch.md)

## TL;DR

`llm-switch` is running on pc.local and matches the contract you asked for, with three deviations from the original handoff that you should be aware of before wiring up the web side.

- **Base URL:** `http://192.168.1.215:8765` (LAN) and `http://pc:8765` (tailnet). UFW allows both.
- **Auth:** none today. The `X-LLM-Switch-Token` hook is wired in `server.py` but inactive (no `LLM_SWITCH_TOKEN` set in the systemd unit). Flip on later by setting the env var on both ends.
- **Web env defaults that already match:** `LLM_SWITCH_BASE_URL=http://192.168.1.215:8765` and `SD_BASE_URL=http://192.168.1.215:7860` work as-is. No env file changes required on pi.

## What's running on pc.local

```
~/.config/systemd/user/
├── llm-switch.service           # NEW: uvicorn server:app --host 0.0.0.0 --port 8765
├── llama-cpp-router.service     # RENAMED from llama-cpp-gpt-oss.service
├── whisper-server.service       # unchanged
└── sd-cpp-server.service        # RENAMED from sd-server.service
                                 #   Conflicts= now only llama-cpp-router.service
                                 #   (whisper coexists; see Coexistence below)

/home/faber/
├── bin/gpu-mode                 # REFACTORED: only sd/sd-q3 stop the others
└── llm-switch/                  # NEW: uv-managed FastAPI project
    ├── pyproject.toml           # fastapi, uvicorn[standard], httpx
    └── server.py
```

## Three deviations from the original handoff

### 1. Coexistence is real (and verified)

The original handoff said "llama + whisper share the GPU happily" and asked the swap script to "implicitly remember that llama/whisper were running so they can be restored on the next non-sd request." Reality is simpler:

- Whisper (~500 MB VRAM at runtime, not the 142 MB its model file suggests) coexists with **every** llama preset in `/mnt/nvme-models/llama-cpp/preset.ini`.
- Only SD evicts the others.
- There's no "remember and restore" — the API is stateless. `POST /mode {mode:whisper}` only stops SD (if up) and starts whisper; `POST /mode {mode:llama}` only stops SD and starts llama. Whatever was already up stays up.

This means the contract's "Leaving SD" example with two `starting` events (llama AND whisper) doesn't fire — `llm-switch` only restores the requested mode. If the web app wants both up after an SD session, send two POSTs (`{mode:llama}` then `{mode:whisper}`).

VRAM matrix (whisper + each llama preset, model loaded via tiny chat completion):

| Preset (ctx, MoE offload)                           | Total used | Free | Status |
|------------------------------------------------------|-----------:|-----:|--------|
| `gpt-oss-20b` (131072, none)                         |       6837 | 1004 | OK (tight) |
| `gpt-oss-20b-heretic-ara-v3` (65536, none)           |       6767 | 1074 | OK |
| `qwen2.5-coder:7b` (32768, none)                     |       6709 | 1132 | OK |
| `qwen3.5-35b-claude` (131072, cpu-moe=true)          |       5406 | 2435 | OK |
| `llama3.2:3b` (65536, none)                          |       5067 | 2774 | OK |
| `gemma4:e2b-fast` (131072, none)                     |       5023 | 2818 | OK |
| `gemma4:e4b` (100000, none)                          |       6887 |  954 | OK (tight) |
| `gemma4-26b-heretic-128k` (131072, cpu-moe=true)     |       6703 | 1138 | OK |

### 2. `gemma4-26b-heretic` preset was removed

The non-128k variant (`n-cpu-moe=25`, ctx 65536) OOM'd with whisper up:

```
ggml_backend_cuda_buffer_type_alloc_buffer: allocating 769.11 MiB on device 0: cudaMalloc failed: out of memory
```

Its 128k sibling (`cpu-moe=true`) covers the same model file safely, so the 65k variant was removed from `/mnt/nvme-models/llama-cpp/preset.ini`. Backup at `preset.ini.bak-2026-05-21`.

**Web-side follow-up you need to do:** delete the `gemma4-26b-heretic` entry from `GOOBY_MODEL_OPTIONS` in `src/lib/gooby/llama.ts` (around line 83 — "GPT 6.9 Limon Max"). Keep `gemma4-26b-heretic-128k` ("Limon Ultra"). Run the standard `npm run dev` / `check` / `build` / `deploy.sh` cycle from pi.

The local `/home/faber/.config/opencode/opencode.json` reference on pc.local was already cleaned up.

### 3. Two extra modes the web app can use

`gpu-mode` already supported these; `llm-switch` exposes them too:

- `{"mode":"sd-q3"}` — Flux Q3_K, fits 1024×1024. Same SD endpoint, lighter weights.
- `{"mode":"stop"}` — tear everything down, free VRAM (useful for diagnostics).

The web app doesn't have to send either. The original three (`llama`, `whisper`, `sd`) are sufficient.

## Verified contract

### Endpoints

```
GET  /health                       → {"ok":true,"uptime_s":N}
GET  /mode                         → {"mode":"sd|llama+whisper|llama|whisper|idle",
                                       "services":{<unit>:{"active":bool,"sub":str}, …},
                                       "checked_at":"<iso8601>"}
POST /mode  {"mode":"llama|whisper|sd|sd-q3|stop"}
                                   → text/event-stream
GET  /docs                         → FastAPI Swagger UI (handy for poking around)
```

### POST /mode SSE events

```
event: status   data: {"phase":"starting","mode":"<target>"}
event: status   data: {"phase":"stopping","unit":"<unit>"}     # one per unit that went down
event: status   data: {"phase":"starting","unit":"<unit>"}     # one per unit that came up
event: status   data: {"phase":"ready","mode":"<target>","port":<n>}
                                  # or {"phase":"failed","mode":"<target>","error":"<msg>"}
event: done     data: {}
```

For `mode:stop`, the `ready` event is `{"phase":"ready","mode":"idle"}` with no port.

Bad mode → `HTTP 400 {"detail":"mode must be one of [...]"}`. Order of `mode` strings in the error is alphabetical (`llama, sd, sd-q3, stop, whisper`).

### Service-name strings in GET /mode

`services` is keyed by the real unit names — handy for debugging on pc.local but the web app shouldn't need to match them:

- `llama-cpp-router.service`
- `whisper-server.service`
- `sd-cpp-server.service`

### Health probe paths llm-switch uses internally

| Target  | Probe                                |
|---------|--------------------------------------|
| llama   | `GET 127.0.0.1:8080/health`          |
| whisper | `GET 127.0.0.1:8081/` (no /health)   |
| sd      | `GET 127.0.0.1:7860/sdapi/v1/sd-models` |

60 second deadline. Anything < 500 counts as ready.

## Smoke tests (rerun anytime)

From pi.local:

```bash
curl -sS http://192.168.1.215:8765/health
curl -sS http://192.168.1.215:8765/mode | jq .

curl -sS -N -X POST http://192.168.1.215:8765/mode \
  -H 'Content-Type: application/json' -d '{"mode":"sd"}'

# Verify on pc.local:
ssh pc 'gpu-mode status && nvidia-smi --query-gpu=memory.used,memory.free --format=csv'

curl -sS -N -X POST http://192.168.1.215:8765/mode \
  -H 'Content-Type: application/json' -d '{"mode":"llama"}'

# To restore both llama + whisper after an SD session, send two POSTs:
curl -sS -N -X POST http://192.168.1.215:8765/mode \
  -H 'Content-Type: application/json' -d '{"mode":"whisper"}'
```

## Operational notes

- **Logs:** `journalctl --user -u llm-switch -f` on pc.local. Uvicorn logs each request.
- **Restart:** `systemctl --user restart llm-switch.service`.
- **Source:** edit `/home/faber/llm-switch/server.py`, then restart.
- **Lingering** is already enabled on pc, so `llm-switch` survives logout / reboot.
- **UFW rules added:** `8765/tcp` allowed from `192.168.1.0/24` and `tailscale0`. No global open port.

## Follow-ups for the receiving Claude on pi.local

1. **Delete `gemma4-26b-heretic` from `src/lib/gooby/llama.ts`** (GOOBY_MODEL_OPTIONS, the "Limon Max" entry). The model 400s from llama-server now. Keep `-128k` "Limon Ultra".
2. **Optionally** prune historical mentions of the preset in `docs/features/gooby-rag.md` and `docs/handoff/2026-05-19-llm-box-heavy-models-stuck.md` — those are historical context and can stay if you want the audit trail.
3. **Wire `LLM_SWITCH_BASE_URL` smoke-test into the gooby UI** if not already — the original handoff calls for the model picker to drive transitions, so confirm the existing `/gooby/api/mode` proxy actually forwards to `:8765` and the SSE passes through.
4. **Auth (optional, deferred):** when you're ready, generate a token and set `LLM_SWITCH_TOKEN=<value>` in both `~/.config/systemd/user/llm-switch.service` `Environment=` (then `systemctl --user restart llm-switch.service`) and the SvelteKit prod env (`/var/lib/21bristoe/`).
