# Voice Ordering (Drinks Hub)

**Status:** Deferred / not yet implemented. This document is the executable spec.
**Owner:** TBD.
**Last updated:** 2026-05-18.

---

## Goal

Add a mic button to the Drinks Hub (`/drinks/menu` and `/drinks/kiosk`). Tap → record → transcribe via a local Whisper STT service on the llama box → parse transcript with the local LLM into `{profile_id, items[]}` → confirm → submit to the existing `/api/orders` endpoint.

Closes the voice loop. TTS already speaks orders out; STT lets orders come in.

---

## Two-part split

This work spans two machines:

- **Section A — `home` repo integration.** Runs on the Raspberry Pi (`192.168.1.177`). SvelteKit changes only.
- **Section B — Handoff brief for fresh Claude session on the LLM box (`192.168.1.215`).** Deploys `whisper.cpp/server` as a systemd service.

Section A can be drafted in advance, but cannot ship until Section B is complete and the endpoint is reachable.

---

## Section A — Home-repo integration spec

### Env-var contract

Add to `.env` (and document in `deploy/`):

```
WHISPER_BASE_URL=http://192.168.1.215:8081
WHISPER_MODEL=base.en   # informational; actual model is pinned on the LLM box
```

If `WHISPER_BASE_URL` is unset or unreachable, the mic button must be hidden (graceful degradation — same pattern as `tts_llm_enabled` setting).

### Server modules

**`src/lib/drinks/server/voice.ts`** (new) — two exports:

```ts
export async function transcribe(audio: Buffer, mime: string): Promise<{ text: string; durationMs: number }>;

export async function parseOrder(
  transcript: string,
  context: { menu: Drink[]; profiles: Profile[] }
): Promise<ParsedOrder>;
```

`transcribe` POSTs `multipart/form-data` to `${WHISPER_BASE_URL}/inference` with field `file` containing the audio blob, plus `temperature=0` and `response_format=json`. Expects whisper.cpp server response `{ text: string }` (see Section B for the exact contract).

`parseOrder` calls llama.cpp (`/v1/chat/completions`) with model `gemma4-26b-heretic-128k` (long context fits the full menu + profile list) and a strict JSON schema:

```ts
type ParsedOrder = {
  profile_id: number | null;
  items: Array<{ drink_id: number; quantity: number; notes: string | null }>;
  confidence: 'high' | 'medium' | 'low';
  ambiguities: Array<{ field: 'profile' | 'drink'; transcript_fragment: string; candidates: Array<{ id: number; label: string }> }>;
};
```

Use `response_format: { type: 'json_schema', json_schema: {...} }` to enforce the shape. Fall back to a strict JSON-only system prompt + `JSON.parse` if the model doesn't honor schema mode.

Coordinate with `src/lib/drinks/server/llm-priority.ts` — voice parsing must yield to in-progress TTS quip generation. Voice is user-initiated and tolerates 2–3s; quips are time-critical.

### Endpoint

**`src/routes/drinks/api/voice/+server.ts`** (new) — POST handler:

1. Read `request.formData()`, extract `audio` blob.
2. Validate: size ≤ 5 MB, mime in `{audio/webm, audio/ogg, audio/wav}`, duration ≤ 30s (whisper.cpp returns duration; reject after transcribe if needed).
3. Call `transcribe()` → `parseOrder()`.
4. If `confidence === 'high'` and no ambiguities, return `{ preview, autoSubmit: true }`.
5. Otherwise return `{ preview, autoSubmit: false }` — client shows a confirmation UI with candidate resolutions.
6. Apply existing per-IP rate limit (1 voice req / 5s) — extend `src/lib/drinks/server/rate-limit.ts`.

### UI

**`src/lib/drinks/components/VoiceOrderButton.svelte`** (new):

- Mic icon button. On press, requests `getUserMedia({ audio: true })`.
- Uses `MediaRecorder` API with `audio/webm;codecs=opus` (best browser support, smallest payload).
- Records up to 15 seconds. Visual pulse + countdown timer.
- On stop: POST blob to `/drinks/api/voice`.
- Renders parsed preview: profile name + items + confidence badge.
- Ambiguity flow: dropdown for each unresolved field, "Confirm" submits via existing order POST.

Mount on:
- `src/routes/drinks/menu/+page.svelte` — floating button bottom-right.
- `src/routes/drinks/kiosk/+page.svelte` — if mic available on the kiosk hardware; otherwise hidden.

### Verification

```bash
# Server-side: confirm whisper reachable
curl -sf "$WHISPER_BASE_URL/health"

# E2E: record a clip, post it
curl -X POST http://localhost:6173/drinks/api/voice \
  -F "audio=@sample.webm;type=audio/webm" \
  -H "Cookie: session=$VALID_SESSION"
# expect: { preview: {...}, autoSubmit: bool }
```

Browser test cases:
- "two margaritas for Faber" → high confidence, auto-submit, TTS announces.
- "a beer for me" (ambiguous profile) → preview with profile dropdown.
- "something refreshing for Tatiana" (off-menu) → preview with nearest match + notes.
- 30-second silent recording → graceful empty-transcript message.

### Critical files

- `src/lib/drinks/server/voice.ts` (new)
- `src/routes/drinks/api/voice/+server.ts` (new)
- `src/lib/drinks/components/VoiceOrderButton.svelte` (new)
- `src/lib/drinks/server/rate-limit.ts` (extend)
- `src/lib/drinks/server/llm-priority.ts` (register voice as yielding consumer)
- `src/routes/drinks/menu/+page.svelte` (mount button)
- `src/routes/drinks/kiosk/+page.svelte` (mount button)
- `.env` (add `WHISPER_BASE_URL`)

---

## Section B — Handoff brief for fresh Claude session on the LLM box

> **For the receiving Claude:** You're being invoked on the LLM box at `192.168.1.215`. You have no prior context. Your job is to stand up `whisper.cpp/server` as a systemd service on port 8081, reachable from the home-site Pi at `192.168.1.177`. Existing service on port 8080 (`llama-swap` / `llama.cpp` HTTP server) must not be disturbed. Report back when complete.

### Prereq checks

Run these first and confirm before installing anything:

```bash
# 1. Confirm we're on the right host
hostname -I | tr ' ' '\n' | grep -q '^192\.168\.1\.215' && echo "OK: on LLM box" || echo "WRONG HOST — abort"

# 2. Confirm llama.cpp service on 8080 is up and untouched
curl -sf http://127.0.0.1:8080/health && echo "OK: llama.cpp running"

# 3. Confirm port 8081 is free
ss -tlnp | grep -q ':8081 ' && echo "8081 BUSY — investigate before continuing" || echo "OK: 8081 free"

# 4. Confirm we have build deps
which gcc make cmake git || echo "MISSING build deps — install before continuing"

# 5. Note hardware accel availability — record for build flag selection
nvidia-smi 2>/dev/null || echo "no NVIDIA GPU"
ls /dev/dri/ 2>/dev/null || echo "no integrated GPU"
nproc  # CPU fallback baseline
```

If any check fails, stop and report rather than working around it.

### Install

```bash
# Clone into a sibling of the existing llama.cpp install (likely /opt or ~/)
# Use the same parent dir as llama.cpp — verify with:
ls -la /opt/llama.cpp 2>/dev/null || ls -la ~/llama.cpp 2>/dev/null

# Clone whisper.cpp
sudo git clone https://github.com/ggerganov/whisper.cpp.git /opt/whisper.cpp
cd /opt/whisper.cpp

# Build server binary
# - With NVIDIA GPU: WHISPER_CUDA=1 make -j$(nproc) server
# - With Vulkan/integrated: WHISPER_VULKAN=1 make -j$(nproc) server
# - CPU-only: make -j$(nproc) server
make -j$(nproc) server   # pick the right flag based on prereq check 5

# Download base.en model (~140MB, English-only, fast)
bash ./models/download-ggml-model.sh base.en

# Quick sanity test
./build/bin/whisper-server --help | head -20
```

Upgrade path (do not do now): swap `base.en` for `medium.en` (~1.5GB) once latency profile is confirmed acceptable. Better accuracy on accented speech and noisy environments.

### systemd unit

Write `/etc/systemd/system/whisper-server.service` with **exactly these contents**:

```ini
[Unit]
Description=whisper.cpp HTTP transcription server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=whisper
Group=whisper
WorkingDirectory=/opt/whisper.cpp
ExecStart=/opt/whisper.cpp/build/bin/whisper-server \
  --host 0.0.0.0 \
  --port 8081 \
  --model /opt/whisper.cpp/models/ggml-base.en.bin \
  --threads 4 \
  --processors 1
Restart=always
RestartSec=5
# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/whisper.cpp/build
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Create the service user if it doesn't exist:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin whisper || true
sudo chown -R whisper:whisper /opt/whisper.cpp
```

Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now whisper-server.service
sudo systemctl status whisper-server.service --no-pager
journalctl -u whisper-server.service -n 30 --no-pager
```

### Firewall / network exposure

Only expose on the LAN and Tailscale, **not WAN**. Adjust to the firewall in use:

```bash
# ufw (if present)
sudo ufw status numbered
sudo ufw allow from 192.168.1.0/24 to any port 8081 proto tcp comment 'whisper LAN'
sudo ufw allow from 100.64.0.0/10  to any port 8081 proto tcp comment 'whisper Tailscale'
sudo ufw reload

# nftables / iptables: confirm equivalent rules, do NOT open 8081 to 0.0.0.0
```

Confirm the home Pi can reach it:

```bash
# From the LLM box, sanity
curl -sf http://127.0.0.1:8081/health || echo "local probe failed — DO NOT trust this alone"

# THEN ssh to the home Pi (192.168.1.177) and repeat from there:
ssh faber@192.168.1.177 'curl -sf http://192.168.1.215:8081/health'
# expect: 200 OK
```

(Note: don't infer reachability from `127.0.0.1` alone — same memory note as the Tailscale loopback gotcha. Probe from a peer.)

### Endpoint contract

`home` will POST to `http://192.168.1.215:8081/inference`:

- Method: `POST`
- Content-Type: `multipart/form-data`
- Fields:
  - `file` — audio blob (webm/opus, wav, ogg, mp3)
  - `temperature` — `0`
  - `response_format` — `json`
- Response: `application/json` with `{ "text": "<transcript>" }`. May include additional fields (timings, segments) — ignore them.

Reference: <https://github.com/ggerganov/whisper.cpp/tree/master/examples/server> — check that the installed commit's server binary matches this contract; the API has been stable since mid-2024 but verify.

### Verification (must pass before reporting done)

```bash
# 1. Service is active and not in restart loop
systemctl is-active whisper-server.service
systemctl show whisper-server.service -p NRestarts

# 2. Health endpoint
curl -sf http://127.0.0.1:8081/health

# 3. End-to-end transcription with a known clip
# Grab a public-domain sample (or record one with: arecord -d 3 -f cd /tmp/test.wav)
curl -s -X POST http://127.0.0.1:8081/inference \
  -F "file=@/opt/whisper.cpp/samples/jfk.wav" \
  -F "temperature=0" \
  -F "response_format=json" | jq .
# expect: { "text": "...Ask not what your country can do for you...", ... }

# 4. Cross-host reachability from home Pi
ssh faber@192.168.1.177 'curl -s -X POST http://192.168.1.215:8081/inference \
  -F "file=@/tmp/test.wav" -F "temperature=0" -F "response_format=json" | jq -r .text'

# 5. llama.cpp on 8080 still healthy and unaffected
curl -sf http://127.0.0.1:8080/health
```

### What to report back

When complete, return to the dispatching session with:

1. ✅/❌ for each prereq check.
2. Build flags used (CUDA/Vulkan/CPU) and observed `make` time.
3. Model installed and its path.
4. Confirmation `systemctl is-active whisper-server.service` returns `active`.
5. Sample transcript from cross-host curl (#4 above).
6. `curl -sf http://127.0.0.1:8080/health` still returning 200.
7. Any deviations from this brief and why.

If you couldn't complete a step, do not improvise — stop and report what blocked you.

---

## Open questions (resolve before kicking off Section A)

- Which audio format does `MediaRecorder` produce reliably on the kiosk's browser? Test on actual hardware before committing to webm-only.
- Does the kiosk Pi have a working USB mic? If not, voice ordering is mobile-only and the kiosk gets a QR code that opens `/drinks/menu` on a phone instead.
- Is `gemma4-26b-heretic-128k` fast enough for parseOrder under the existing `llm-priority` coordination? If parse latency >3s consistently, consider a smaller model for parsing only.
