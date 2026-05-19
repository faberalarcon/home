# LLM-box handoff — heavy models stuck / failed to load

**Date:** 2026-05-19
**LLM box:** `pc` / `192.168.1.215`
**Sister doc:** [`docs/handoff/llm-box-rag-whisper.md`](./llm-box-rag-whisper.md)
**Repo side:** drinks voice ordering is unblocked by switching `drinks_parse_model` to `gemma4:e2b` (commit landing alongside this doc). Heavy-model recovery is still needed for `gooby_rag_model` (RAG + `/admin` rewrite) and `daily_brief_model` quality.

## Symptom

- `POST .215:8080/v1/chat/completions` with `model="gemma4-26b-heretic-128k"` hangs indefinitely (>120s); curl returns `Operation timed out`.
- Whisper (`.215:8081`) is healthy — `/inference` on a 1s WAV returns 200 in ~1.0s.
- llama-server itself responds — `GET .215:8080/health` returns 200 in <10ms and `/v1/models` returns the full preset list.

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

## Pi-side fallback (already shipped)

`drinks_parse_model = 'gemma4:e2b'` (bootstrapped in `src/hooks.server.ts`, read in `src/lib/drinks/server/voice.ts` parseOrder, with explicit JSON schema in the system prompt so the small model produces the expected shape). Voice ordering survives heavy-model outages from now on.

If the heavy model stays down for >1 day, consider also pointing `gooby_rag_model` at a still-working preset (e.g. one of the `gpt-oss-20b` variants if recovered, or the 26B non-128k if `--cpu-moe` brings it back). Don't do this preemptively — `gemma4:e2b` is too small for RAG quality.
