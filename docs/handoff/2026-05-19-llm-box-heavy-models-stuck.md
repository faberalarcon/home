# LLM-box handoff — heavy models stuck / failed to load

**Date:** 2026-05-19
**LLM box:** `pc` / `192.168.1.215`
**Sister doc:** [`docs/handoff/llm-box-rag-whisper.md`](./llm-box-rag-whisper.md)
**Repo side:** drinks voice ordering is unblocked by switching `drinks_parse_model` to `gemma4:e2b` (commit landing alongside this doc). Heavy-model recovery is still needed for `gooby_rag_model` (RAG + `/admin` rewrite) and `daily_brief_model` quality.

## Symptom

- Initial state (~18:00): `POST .215:8080/v1/chat/completions` with `model="gemma4-26b-heretic-128k"` hung indefinitely (>120s); `/v1/models` showed it in `status: "loading"`.
- After a long cold-load completed during the session, the 26B preset became healthy (568ms warm RTT).
- **New symptom (~19:30):** requesting `gemma4:e2b` while 26B is the loaded instance leaves e2b in `status: "loading"` for 10+ minutes with no progress. The router (`/props` reports `role: "router"`, `max_instances: 2`) appears unable to spawn the e2b sub-process. Earlier in the same session, e2b loaded and served in <1s — so the model files and command-line preset are fine; the swap/spawn itself is wedged.
- Whisper (`.215:8081`) remains healthy throughout — `/inference` on a 1s WAV returns 200 in ~1.0s.
- llama-server itself responds — `GET .215:8080/health` returns 200 in <10ms and `/v1/models` returns the full preset list.

The combined picture: whichever model lands in VRAM first stays healthy; every attempted swap thereafter wedges the candidate model in `loading` and never resolves. This blocks any setting that points at a not-currently-loaded model.

## Model status snapshot (`GET .215:8080/v1/models`)

| Model | Status | exit_code |
|---|---|---|
| `gemma4:e2b` | **loaded** | — |
| `gemma4-26b-heretic-128k` | **loading** (wedged) | — |
| `gemma4-26b-heretic` | unloaded | **1** |
| `embeddinggemma` | unloaded | **1** |
| `gpt-oss-20b` | unloaded | **1** |
| `llama3.2:3b-fast` | unloaded | **1** |
| `qwen3:8b-fast` | unloaded | **1** |
| `gemma4:e2b-fast`, `gemma4:e4b`, `deepseek-r1:8b*`, `gpt-oss-20b-*`, `qwen3:8b`, `qwen2.5-coder:7b`, `llama3.2:3b`, `ggml-org/embeddinggemma-300M-qat-q4_0-GGUF:Q4_0` | unloaded | 10 (likely transient/swap) |

`exit_code=1` on `embeddinggemma` is the most worrying — RAG indexing depends on it. `exit_code=1` on `gemma4-26b-heretic` (the non-128k preset) suggests a real load failure (OOM, missing file, or CUDA fault), and the 128k preset is now stuck mid-load trying to swap it in.

## Reproducer

From any peer (Pi or laptop):

```bash
# fast (loaded) — works:
curl -sS --max-time 5 -X POST http://192.168.1.215:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemma4:e2b","stream":false,"max_tokens":10,
       "messages":[{"role":"user","content":"hi"}]}'

# heavy (wedged) — hangs:
curl -sS --max-time 120 -X POST http://192.168.1.215:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemma4-26b-heretic-128k","stream":false,"max_tokens":10,
       "messages":[{"role":"user","content":"hi"}]}'
```

## Ask

On the LLM box:

1. **Tail the swap-manager / llama-server log** for the most recent load attempt of `gemma4-26b-heretic-128k` and `gemma4-26b-heretic`. Look for OOM, `failed to load model`, missing mmproj, CUDA out-of-memory, or stuck mmap.
2. **Verify file presence and integrity:**
   - `/mnt/nvme-models/llama-cpp/gemma-4-26B-A4B-it-ultra-uncensored-heretic-Q4_K_M.gguf`
   - `/mnt/nvme-models/llama-cpp/mmproj-gemma-4-26B-A4B-it-Q8_0.gguf`
   - `/mnt/nvme-models/llama-cpp/gpt-oss-20b-mxfp4.gguf`
   - any embeddinggemma artifact the `embeddinggemma` preset points at
3. **Free VRAM** — `nvidia-smi`; the 8 GB 3070 can't hold a 26B + mmproj simultaneously with anything else resident. The `gemma4-26b-heretic-128k` preset uses `--n-gpu-layers all` (no `--cpu-moe`/`--n-cpu-moe` offload) while the non-128k variant uses `--n-cpu-moe 25`. If VRAM is the issue, the 128k preset will never load on this card. Consider editing the preset to add `--cpu-moe` or reduce `--n-gpu-layers`.
4. **Force-kill any wedged loader** and restart the swap manager so `status: "loading"` clears. Confirm `/v1/models` no longer shows `gemma4-26b-heretic-128k` in `loading`.
5. Re-probe with the reproducer above and report the time-to-first-token for the 26B preset.

## Impact while unresolved

| Surface | Effect |
|---|---|
| Drinks voice ordering (`/drinks/api/voice`) | **Unblocked** — now uses `gemma4:e2b` via `drinks_parse_model`. |
| GoobyGPT RAG (`/gooby/api/*`) | Generation calls fail at the 20–60s timeout; falls back to no-LLM behavior. |
| Admin rewrite (`/admin/api/rewrite`) | Returns 502 on every call. |
| Daily brief (`stats/brief`) | Bootstrap default still points at the 26B preset — brief generation will fail until the model is back. |
| RAG re-index | If `embeddinggemma` preset is genuinely broken (`exit_code=1`), the timer in `deploy/21bristoe-rag-reindex.timer` will fail silently. Worth confirming. |

## Pi-side fallback (shipped)

Indirection added: `drinks_parse_model` (in `src/hooks.server.ts` bootstrap, read in `src/lib/drinks/server/voice.ts` parseOrder). System prompt now includes an explicit JSON schema block so small models also produce the right shape.

First attempt defaulted to `gemma4:e2b` — backed out after the swap wedge surfaced. Current default and force-overwrite migration target: `gemma4-26b-heretic-128k` (the only preset currently loadable on the box). Once the LLM box is healthy again and `gemma4:e2b` swaps freely, set `drinks_parse_model = 'gemma4:e2b'` via the admin settings table — it's the right size for the task and frees the 26B for RAG.

If 26B itself goes back down, parseOrder will time out at 20s. There's no automatic fallback chain; the user will see "Voice processing failed" and can retype.

Anything else still pointing at presets that need a swap (`tts_llm_model = gemma4:e2b`, `daily_brief_model = gemma4-26b-heretic-128k`) is exposed to the same wedge until the router is fixed.
