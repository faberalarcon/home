# Site-Aware GoobyGPT (RAG)

**Status:** Deferred / not yet implemented. This document is the executable spec.
**Owner:** TBD.
**Last updated:** 2026-05-18.
**Prereq blocker:** No embedding model is currently loaded on the llama.cpp box at `192.168.1.215:8080` — `/v1/embeddings` returns `501 Not Implemented`. Section B must complete before Section A can ship.

---

## Goal

Give GoobyGPT awareness of live site state — drink menu, recent orders, admin-managed home content (member bios, neighborhood tips, Limón spotlight), and the last 7 days of stats. Two surfaces:

1. **Chat toggle.** "Use site context" on `/gooby` — when on, relevant chunks are retrieved and prepended to the system message before the LLM call.
2. **Admin Rewrite button.** Every multi-line text field in `/admin/` gains an "AI Rewrite" action that returns 3 candidate rewrites in the same tone/length.

Both surfaces use `gemma4-26b-heretic-128k` so the long context fits ~20 retrieved chunks comfortably.

---

## Two-part split

- **Section A — `home` repo integration.** SvelteKit + Drizzle changes. Cannot ship until embeddings work.
- **Section B — Handoff brief for fresh Claude session on the LLM box (`192.168.1.215`).** Add an embedding model under llama-swap, ensure `--embeddings` flag, verify `/v1/embeddings` reachable.

---

## Section A — Home-repo integration spec

### Configuration

New Drizzle settings (bootstrap defaults in `src/hooks.server.ts` alongside the existing brief defaults):

```
gooby_rag_enabled = 'true'
gooby_rag_model = 'gemma4-26b-heretic-128k'
gooby_rag_embed_model = 'nomic-embed-text'   # see Section B for the exact id surfaced by llama-swap
gooby_rag_top_k = '8'
gooby_rag_max_chunk_chars = '600'
```

### Database

New Drizzle migration `drizzle/0007_gooby_rag.sql`:

```sql
CREATE TABLE gooby_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,        -- 'drink' | 'order_summary' | 'admin_member' | 'admin_tip' | 'admin_limon' | 'stats_snapshot'
  source_id TEXT NOT NULL,          -- stable id within source_type, used for upsert
  text TEXT NOT NULL,
  vector BLOB NOT NULL,             -- Float32Array packed little-endian
  dim INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_gooby_embeddings_source ON gooby_embeddings(source_type, source_id);
```

Schema entry in `src/lib/drinks/server/db/schema.ts`:

```ts
export const goobyEmbeddings = sqliteTable('gooby_embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  text: text('text').notNull(),
  vector: blob('vector').notNull(),
  dim: integer('dim').notNull(),
  updatedAt: integer('updated_at').notNull()
});
```

### Server module — `src/lib/gooby/server/rag.ts` (new)

```ts
export async function embed(text: string): Promise<Float32Array>;
export async function embedBatch(texts: string[]): Promise<Float32Array[]>;
export function upsertChunk(sourceType: string, sourceId: string, text: string, vector: Float32Array): void;
export async function indexAll(): Promise<{ inserted: number; updated: number; removed: number }>;
export async function retrieve(query: string, k?: number): Promise<Array<{ sourceType: string; sourceId: string; text: string; score: number }>>;
```

`embed` POSTs to `${LLAMA_BASE_URL}/v1/embeddings` with `{ model, input }`. Reuse the URL resolver pattern from `src/lib/drinks/server/tts-llm.ts:llamaBaseUrl()`. Packing: `Buffer.from(new Float32Array(vec).buffer)`.

`indexAll` collects:
- Every active drink (`name + description + category`)
- A rolling per-drink popularity summary ("Coors Banquet: 47 orders all-time, 8 yesterday")
- Each admin member bio
- Each visitor tip / neighborhood card
- Limón spotlight blurb
- Last 7 days of stats summary (one chunk: drinks count, top items, Pi peak temp, weather highlights)

Chunks are bounded by `gooby_rag_max_chunk_chars` (split on sentence/newline boundaries). Idempotent via `(source_type, source_id)` unique index — re-running `indexAll` overwrites stale vectors and deletes rows whose source_id no longer appears.

`retrieve(query, k=8)` embeds the query, fetches all rows, computes cosine similarity in JS (corpus is < 10k chunks; one pass is fine for now), returns the top-K with their original text.

### Coordination

Extend `src/lib/drinks/server/llm-priority.ts` to register two new consumers:
- `gooby-rag-chat` — yields to `tts-quip` (existing); equal to `gooby-chat`.
- `gooby-rewrite` — yields to all others, runs only when idle.

If the priority module signals "wait", show a brief "model busy, retrying" UI state instead of failing.

### Chat hook

Modify `src/lib/gooby/llama.ts:streamChatCompletion()`:

```ts
async function streamChatCompletion(opts: {
  messages: Message[];
  model?: string;
  useSiteContext?: boolean;
}) {
  if (opts.useSiteContext) {
    const lastUser = opts.messages.filter(m => m.role === 'user').pop();
    if (lastUser) {
      const chunks = await retrieve(lastUser.content, getSettingInt('gooby_rag_top_k', 8));
      if (chunks.length > 0) {
        const ctx = chunks.map(c => `[${c.sourceType}] ${c.text}`).join('\n\n');
        opts.messages = [
          { role: 'system', content: `Site context (use only what's relevant):\n${ctx}` },
          ...opts.messages
        ];
      }
    }
    opts.model = opts.model ?? getSetting('gooby_rag_model') ?? 'gemma4-26b-heretic-128k';
  }
  // ... existing flow
}
```

### Re-indexing

- Nightly: invoke `indexAll()` from a new step in `21bristoe-rebuild.service` (or its own systemd timer, modeled on `21bristoe-brief.timer`).
- On-demand: re-index the affected source_type whenever admin saves matching content. Hook into the existing save paths in `src/lib/admin/server.ts` (drinks CRUD, site-config update, member-photo upload). Cheap: only the changed source_type re-runs, not the whole corpus.
- On boot: in `hooks.server.ts`, if the row count is 0, kick off `indexAll()` once.

### Admin Rewrite

**`src/routes/admin/api/rewrite/+server.ts`** (new, POST):

Body shape:
```ts
{
  field: 'member_bio' | 'limon_spotlight' | 'neighborhood_tip' | 'visitor_tip' | 'drink_description',
  current: string,
  context?: Record<string, string>   // optional: member name, drink category, etc.
}
```

Returns:
```ts
{ candidates: [{ text: string; tone: string }, ...] }   // exactly 3
```

Field-type-aware system prompts stored as settings (`rewrite_prompt_member_bio`, `rewrite_prompt_drink_description`, etc.) so admin can tune them.

Reuse the existing per-IP admin rate limiter at `src/lib/admin/server.ts:32-46`.

### Admin UI

Extend `src/lib/admin/admin-client.js` with a "Rewrite" button next to every multi-line textarea that maps to a known field. Click → opens a small overlay → POSTs to `/admin/api/rewrite` → renders three candidates → click any to replace the textarea content. Keyboard: `Esc` to close, number keys 1-3 to pick a candidate.

### UI toggle on /gooby

Add a checkbox above the chat input: "Use site context". Defaults to on. Persist preference in `localStorage`. When unchecked, the existing chat flow continues unmodified.

### Critical files

- `drizzle/0007_gooby_rag.sql` (new)
- `drizzle/meta/_journal.json` (append entry)
- `src/lib/drinks/server/db/schema.ts` (extend with `goobyEmbeddings`)
- `src/lib/gooby/server/rag.ts` (new)
- `src/lib/gooby/llama.ts` (extend `streamChatCompletion`)
- `src/lib/drinks/server/llm-priority.ts` (extend registry)
- `src/routes/admin/api/rewrite/+server.ts` (new)
- `src/lib/admin/admin-client.js` (Rewrite button UI)
- `src/routes/gooby/+page.svelte` (useSiteContext toggle)
- `src/hooks.server.ts` (bootstrap defaults + boot-time indexAll)
- `deploy/21bristoe-rag-reindex.{timer,service}` (new, OR a step in `21bristoe-rebuild.service`)

### Verification

```bash
# Toggle on in Gooby, ask:
"What drinks were popular yesterday?"
# Expected: answer cites the actual leaderboard, not generic LLM trivia.

"Rewrite Limón's bio to be punchier."
# Expected: refuses without /admin context; with admin Rewrite button, returns 3 candidates.

# Admin endpoint:
curl -X POST https://admin.21bristoe.com/admin/api/rewrite \
  -H "Content-Type: application/json" \
  -d '{"field":"drink_description","current":"A fizzy drink","context":{"category":"cocktail"}}'
# Expected: 200 + 3 candidates
```

Add to `./deploy/validate.sh`:
- `/admin/api/rewrite` returns 401 unauthenticated (proves it's behind admin auth).
- A boot-log line `[gooby-rag] indexed N chunks` after the unified container starts.

---

## Section B — Handoff brief for fresh Claude session on the LLM box

> **For the receiving Claude:** You're being invoked on the LLM box at `192.168.1.215`. You have no prior context. Your job is to load an embedding model under the existing `llama-swap` setup so that `POST /v1/embeddings` returns 200 instead of `501 Not Implemented`. Existing chat models (gpt-oss-20b, gemma4-26b-heretic-*, etc.) must keep working. Report back when complete.

### Prereq checks

```bash
# 1. Confirm we're on the right host
hostname -I | tr ' ' '\n' | grep -q '^192\.168\.1\.215' && echo "OK: on LLM box" || echo "WRONG HOST — abort"

# 2. Inventory the current llama-swap (or llama.cpp) setup
ps -ef | grep -E 'llama|swap' | grep -v grep
ls /etc/llama-swap/ 2>/dev/null
ls /opt/llama-swap/ 2>/dev/null
ls ~/.config/llama-swap/ 2>/dev/null
# locate the config yaml — usually `config.yaml` listing models, commands, ports

# 3. Confirm /v1/embeddings currently returns 501 (sanity)
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8080/v1/embeddings \
  -H 'Content-Type: application/json' -d '{"model":"gpt-oss-20b","input":"x"}'
# expect: 501

# 4. Note GPU / accel availability
nvidia-smi 2>/dev/null | head -20
ls /dev/dri/ 2>/dev/null
free -h
```

If `llama-swap` is not the orchestrator (e.g. raw llama.cpp `llama-server` directly), stop and report — the config path below will be wrong.

### Install an embedding model

Recommended model: `nomic-embed-text-v1.5` (137M params, 768-dim, F32 ~550MB or Q4 ~150MB). Alternative: `bge-small-en-v1.5` (33M, 384-dim, ~60MB) if RAM is tight.

```bash
# Pick a downloads dir consistent with existing models
ls /opt/models 2>/dev/null || ls ~/models 2>/dev/null

# Download Nomic GGUF (Q4_K_M is a good speed/quality tradeoff for an embedder)
cd /opt/models  # or wherever existing models live
curl -L -o nomic-embed-text-v1.5.Q4_K_M.gguf \
  https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf
```

### Add to `llama-swap` config

Find the config file (likely `/etc/llama-swap/config.yaml` or similar — confirmed via Prereq #2). Add a new model entry. The key requirement is `--embeddings` on the `llama-server` command line; without it the endpoint stays `501`.

```yaml
# Add under `models:`
nomic-embed-text:
  cmd: |
    /opt/llama.cpp/build/bin/llama-server
    --model /opt/models/nomic-embed-text-v1.5.Q4_K_M.gguf
    --embeddings
    --port ${PORT}
    --host 127.0.0.1
    --ctx-size 2048
    --pooling mean
    --batch-size 512
    --ubatch-size 512
  # llama-swap manages start/stop; embed model is cheap so keep it warm
  ttl: 0   # never unload
  # If config supports priority / always-loaded:
  preload: true
```

Adjust paths to match the existing entries — the prereq scan should reveal the exact binary path and port templating.

### Reload + verify

```bash
sudo systemctl restart llama-swap   # or whatever the unit is called — confirm via Prereq #2

# Wait for it to come up
for i in {1..30}; do
  if curl -sf http://127.0.0.1:8080/v1/models | grep -q nomic-embed-text; then
    echo "OK: model registered after ${i}s"
    break
  fi
  sleep 1
done

# Verify embeddings endpoint works
curl -s -X POST http://127.0.0.1:8080/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"nomic-embed-text","input":"the quick brown fox"}' | python3 -m json.tool | head -20
# expect: { "data": [{ "embedding": [...], ... }], ... } — non-empty float array

# Sanity: gpt-oss-20b chat still works
curl -s -X POST http://127.0.0.1:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-oss-20b","messages":[{"role":"user","content":"say hi"}],"max_tokens":20}' \
  | python3 -m json.tool | head -10

# Cross-host reachability from home Pi (don't trust loopback for tailnet checks)
ssh faber@192.168.1.177 'curl -s -X POST http://192.168.1.215:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"nomic-embed-text\",\"input\":\"hello\"}" | jq ".data[0].embedding | length"'
# expect: 768  (or 384 if you picked bge-small)
```

### What to report back

1. ✅/❌ for each prereq check.
2. Existing orchestrator confirmed (llama-swap version + config path).
3. Embedding model installed (name + GGUF path + size).
4. Confirmation that `/v1/embeddings` returns 200 with a non-empty float array.
5. Embedding dimensionality (768 / 384 / other) — needed for the home-repo schema migration.
6. Confirmation that an existing chat model (gpt-oss-20b) still responds.
7. Cross-host reachability verified from `192.168.1.177`.
8. Any deviations from this brief and why.

If you couldn't complete a step, stop and report — don't improvise.

---

## Open questions

- Should the embedding dim become a setting (`gooby_rag_embed_dim`) or be hardcoded once Section B picks a model? Lean: setting, with a one-time wipe-and-rebuild on dimension change.
- Re-index frequency: nightly may be too rare for drinks (admin updates the menu mid-day). On-demand re-index per source_type avoids this — start there.
- Should chat-title generation also use `gooby_rag_model`, or keep it on the lighter model for snappier UX? Lean: keep titles on existing fast model.
