# LLM-box handoff — embeddings + whisper.cpp live

**Date:** 2026-05-18
**LLM box:** `pc` / `192.168.1.215` (Tailscale `100.95.44.120`)
**Hardware:** RTX 3070 8 GB, CUDA 13.1, x86_64
**Sister docs:** [`docs/features/gooby-rag.md`](../features/gooby-rag.md) and [`docs/features/voice-ordering.md`](../features/voice-ordering.md). This file is the post-rollout truth — the spec docs were written pre-rollout and contain incorrect assumptions; read this first.

## Pi-side TL;DR

Wire these into the home repo / Drizzle settings as part of Section A:

```env
LLAMA_BASE_URL=http://192.168.1.215:8080        # unchanged
WHISPER_BASE_URL=http://192.168.1.215:8081      # new
WHISPER_MODEL=base.en                            # informational
```

```sql
-- Drizzle settings (override the spec doc's defaults)
gooby_rag_embed_model = 'embeddinggemma'   -- NOT 'nomic-embed-text'
gooby_rag_embed_dim   = '768'
gooby_rag_model       = 'gemma4-26b-heretic-128k'  -- spec default; co-resides with embedder
```

The Pi can call `/v1/embeddings` and `/inference` immediately — both are reachable on the LAN.

## Spec corrections (read carefully)

| Spec assumption | Actual on LLM box |
|---|---|
| `llama-swap` orchestrates models | llama.cpp's **preset router** (`llama-server --models-preset`) — config at `/home/faber/models/llama-cpp/preset.ini`, launcher `/home/faber/bin/llama-cpp-router-server`, systemd-user unit `llama-cpp-gpt-oss.service` |
| Embedding model: `nomic-embed-text-v1.5` Q4 | **EmbeddingGemma 300M Q8** via llama-server's built-in `--embd-gemma-default` flag (no manual GGUF download). 768-dim, mean-pooled. |
| Whisper system unit at `/etc/systemd/system/whisper-server.service` with `whisper:whisper` user | **systemd-user** unit at `~/.config/systemd/user/whisper-server.service` running as `faber`. Matches existing `llama-cpp-gpt-oss.service` pattern. |
| `make WHISPER_CUDA=1 server` | CUDA build FAILS on this host (CUDA 13.1 + GCC 15 — `__nv_fp8x2_e8m0` constructor disambiguation bug). Built **CPU-only** with `cmake -DGGML_CUDA=0 -DWHISPER_BUILD_SERVER=ON`. Performance is fine: 1.1s for an 11s JFK WAV. |
| whisper-server reads `multipart/form-data` directly | whisper-server's read path takes a **filesystem path**, not bytes. Requires `--convert` flag + `ffmpeg` system package to translate uploads. Both are in place. |

## Endpoints

### Embeddings — `POST http://192.168.1.215:8080/v1/embeddings`

```bash
curl -s -X POST http://192.168.1.215:8080/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"embeddinggemma","input":"the quick brown fox"}' \
  | jq '.data[0].embedding | length'
# → 768
```

- Model id: `embeddinggemma` (must match exactly in payloads and settings).
- Output: `data[0].embedding` is a 768-element `Float32` array. Mean-pooled, normalize on the client if you need cosine via dot product.
- First call after a service restart: ~3–5s (weights load from `LLAMA_CACHE`).
- Cache-hit calls: 4–8 ms.

### Transcription — `POST http://192.168.1.215:8081/inference`

```bash
curl -s -X POST http://192.168.1.215:8081/inference \
  -F "file=@order.webm;type=audio/webm" \
  -F "temperature=0" \
  -F "response_format=json"
# → {"text": "two margaritas for Faber"}
```

- Field name is `file` (not `audio_file`).
- `--convert` is on → accepts wav, mp3, webm/opus, ogg, m4a (anything ffmpeg can decode).
- Health: `GET /health` returns `{"status":"ok"}`.
- Performance: ~1.1s for an 11s WAV clip on CPU (4 threads). Drink orders are 2–5s, so expect 200–800ms.

## What changed on the LLM box

### `/home/faber/models/llama-cpp/preset.ini`
Added one section at the bottom:
```ini
[embeddinggemma]
embd-gemma-default = true
embeddings = true
pooling = mean
ctx-size = 2048
batch-size = 512
ubatch-size = 512
```

### `/home/faber/bin/llama-cpp-router-server`
Changed `--models-max 1` → `--models-max 2`. Two models can be resident simultaneously.

### `/home/faber/projects/whisper.cpp` (new)
Cloned `github.com/ggml-org/whisper.cpp`. Built CPU-only via cmake. Downloaded `models/ggml-base.en.bin` (~147 MB).

### `/home/faber/.config/systemd/user/whisper-server.service` (new)
```ini
[Unit]
Description=whisper.cpp HTTP transcription server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/faber/projects/whisper.cpp
ExecStart=/home/faber/projects/whisper.cpp/build/bin/whisper-server \
  --host 0.0.0.0 \
  --port 8081 \
  --model /home/faber/projects/whisper.cpp/models/ggml-base.en.bin \
  --threads 4 \
  --processors 1 \
  --convert
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```
Enabled + started; `loginctl enable-linger faber` set so it survives logout.

### System packages
`sudo apt-get install -y ffmpeg` (required by whisper-server's `--convert`).

### UFW rules (port 8081)
```
8081/tcp                ALLOW IN    192.168.1.0/24             # whisper from LAN
8081/tcp on tailscale0  ALLOW IN    Anywhere                   # whisper from Tailscale
8081/tcp (v6) on tailscale0  ALLOW IN    Anywhere (v6)
```

## Findings on context size

The embedder's `n_ctx_train` is **2048**. Sweep (standalone, --models-max=1):

| ctx-size | embed dim | VRAM (used) | result |
|---:|---:|---:|---|
| 2048 | 768 | 842 MiB | OK ← chosen |
| 4096 | 768 | 842 MiB | OK (RoPE-extended, quality may degrade) |
| 8192 | 768 | 842 MiB | OK (RoPE-extended) |
| 16384 | 768 | 842 MiB | OK (RoPE-extended) |
| 32768 | 768 | 842 MiB | OK (RoPE-extended) |
| 65536 | 768 | 842 MiB | OK (RoPE-extended) |
| 131072 | 768 | 842 MiB | OK (RoPE-extended) |

llama-server allocates the embedder KV cache lazily — VRAM is flat regardless of `ctx-size`. Going above `n_ctx_train` works mechanically but the model wasn't trained for it and retrieval quality is not guaranteed. Setting kept at **2048** since the spec's per-chunk budget (`gooby_rag_max_chunk_chars = 600` ≈ 150 tokens) is wildly inside that limit.

## Findings on model coexistence (at `--models-max=2`)

Both resident at the same time (no swap):

| Chat model | Coexists? | VRAM (chat+embed) | Notes |
|---|:-:|---:|---|
| `llama3.2:3b-fast` | ✅ | 6845 MiB | gpu-layers=all |
| `qwen3:8b-fast` | ✅ | 6623 MiB | gpu-layers=all |
| `gpt-oss-20b` | ✅ | 6745 MiB | MoE Q4, 131k ctx |
| `gemma4-26b-heretic-128k` | ✅ | 6931 MiB | works because preset has `cpu-moe = true` (all MoE experts on CPU) |
| `gemma4-26b-heretic` (non-128k) | ❌ | — | OOM. Preset has `n-cpu-moe = 25` (more experts on GPU) → needs ~1.5 GiB more than free |

So the spec's `gooby_rag_model = 'gemma4-26b-heretic-128k'` is **safe to use** alongside the embedder. Don't switch to the non-128k variant for RAG, or you'll thrash.

## Failure modes

**Loading a too-big model fails gracefully.** Triggering `gemma4-26b-heretic` returns HTTP 500 with `{"error":{"message":"model name=gemma4-26b-heretic failed to load","type":"server_error"}}` in ~190 ms. The router stays `active`. No restart needed.

**Side effect of failed load: the embedder can be evicted.** The router evicts an LRU slot to make room for the new model *before* attempting the load. If the load then fails, the slot is empty — the embedder is unloaded. Next embed call pays ~3 s to reload.

**No native pin/ttl.** llama-server's preset router has no `ttl: 0` / `pin` flag. Working strategy: Pi-side issues a no-op embed (`{"input":"warmup"}`) after any non-RAG chat call that may have caused a swap. Re-warm cost is ~3 s but doesn't impact the user-perceived RAG-query latency if done during idle moments.

## Verification transcript

```text
# Embedder dim
$ curl -s -X POST http://127.0.0.1:8080/v1/embeddings \
    -H 'Content-Type: application/json' \
    -d '{"model":"embeddinggemma","input":"the quick brown fox"}' | jq '.data[0].embedding | length'
768

# Both models resident
$ curl -s http://127.0.0.1:8080/v1/models | jq '.data[] | select(.status.value=="loaded") | .id'
"embeddinggemma"
"gpt-oss-20b"

# Whisper local
$ curl -s -X POST http://127.0.0.1:8081/inference \
    -F "file=@/home/faber/projects/whisper.cpp/samples/jfk.wav" \
    -F "temperature=0" -F "response_format=json"
{"text":" And so my fellow Americans, ask not what your country can\n do for you, ask what you can do for your country.\n"}

# Both services active
$ systemctl --user is-active llama-cpp-gpt-oss.service whisper-server.service
active
active
```

**Cross-host probe from Pi (`192.168.1.177`): NOT performed in this session** — the LLM box has no SSH key for the Pi. The Pi-side session should run the same two curls against `192.168.1.215:8080` and `:8081` as the first thing in its work.

## Open items for the Pi-side session (Section A of each doc)

### gooby-rag
- [ ] Drizzle migration `0007_gooby_rag.sql` per `docs/features/gooby-rag.md`.
- [ ] New server module `src/lib/gooby/server/rag.ts` (embed/embedBatch/upsertChunk/indexAll/retrieve).
- [ ] Settings defaults in `src/hooks.server.ts` — use `gooby_rag_embed_model = 'embeddinggemma'`, `gooby_rag_embed_dim = '768'`.
- [ ] Extend `src/lib/drinks/server/llm-priority.ts` for `gooby-rag-chat`, `gooby-rewrite`.
- [ ] Modify `src/lib/gooby/llama.ts:streamChatCompletion()` for `useSiteContext` flag.
- [ ] After any non-RAG chat call, fire a no-op embed (`/v1/embeddings` with `"input":"warmup"`) to keep the embedder warm — see "No native pin/ttl" above.
- [ ] Admin Rewrite endpoint + UI.
- [ ] Re-index timer / hook into admin saves.
- [ ] Cross-host probe (the verification step we skipped here).

### voice-ordering
- [ ] `src/lib/drinks/server/voice.ts` (`transcribe()`, `parseOrder()`).
- [ ] `src/routes/drinks/api/voice/+server.ts` (POST handler + rate limit).
- [ ] `src/lib/drinks/components/VoiceOrderButton.svelte` (MediaRecorder UI).
- [ ] Mount on `/drinks/menu` and `/drinks/kiosk`.
- [ ] `.env` entries (`WHISPER_BASE_URL`, optional `WHISPER_MODEL`).
- [ ] Cross-host probe.

## What is NOT done here

- No edits to the `home` repo source — only this handoff doc.
- No Drizzle migrations applied.
- No SvelteKit routes added.
- No `.env` updates on the Pi.
- No SSH-from-LLM-box-to-Pi cross-host probe (no key on this end).
