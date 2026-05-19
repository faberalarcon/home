import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '$lib/drinks/server/db';
import { drinks, orders, goobyEmbeddings, dailyBriefs } from '$lib/drinks/server/db/schema';
import { getSetting } from '$lib/drinks/server/db/settings';
import { isDrinksActive } from '$lib/drinks/server/llm-priority';
import { llamaBaseUrl } from '$lib/server/llama-endpoint';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/21bristoe-media';
const SITE_CONFIG_PATH = path.join(UPLOADS_DIR, 'site-config.json');

const EMBED_MODEL_DEFAULT = 'embeddinggemma';
const EMBED_DIM_DEFAULT = 768;
const TOP_K_DEFAULT = 8;
const MAX_CHUNK_CHARS_DEFAULT = 600;
const YIELD_POLL_MS = 250;
const YIELD_MAX_WAIT_MS = 8_000;
const EMBED_TIMEOUT_MS = 30_000;

function embedModel(): string {
  return (getSetting('gooby_rag_embed_model') ?? EMBED_MODEL_DEFAULT).trim();
}

function embedDim(): number {
  const v = Number(getSetting('gooby_rag_embed_dim') ?? String(EMBED_DIM_DEFAULT));
  return Number.isFinite(v) && v > 0 ? v : EMBED_DIM_DEFAULT;
}

function topK(): number {
  const v = Number(getSetting('gooby_rag_top_k') ?? String(TOP_K_DEFAULT));
  return Number.isFinite(v) && v > 0 ? v : TOP_K_DEFAULT;
}

function maxChunkChars(): number {
  const v = Number(getSetting('gooby_rag_max_chunk_chars') ?? String(MAX_CHUNK_CHARS_DEFAULT));
  return Number.isFinite(v) && v > 0 ? v : MAX_CHUNK_CHARS_DEFAULT;
}

export function isRagEnabled(): boolean {
  const raw = getSetting('gooby_rag_enabled');
  return raw === 'true' || raw === '1';
}

async function yieldToDrinks(): Promise<void> {
  const start = Date.now();
  while (isDrinksActive() && Date.now() - start < YIELD_MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, YIELD_POLL_MS));
  }
}

function normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s);
  if (n === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

function dot(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

function packVector(v: Float32Array): Buffer {
  return Buffer.from(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
}

function unpackVector(buf: Buffer): Float32Array {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(ab);
}

async function fetchEmbeddings(inputs: string[]): Promise<Float32Array[]> {
  if (inputs.length === 0) return [];
  await yieldToDrinks();
  const response = await fetch(`${llamaBaseUrl()}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    body: JSON.stringify({ model: embedModel(), input: inputs })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`embeddings request failed ${response.status}: ${body.slice(0, 200)}`);
  }
  const payload = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  if (data.length !== inputs.length) {
    throw new Error(`embeddings count mismatch: requested ${inputs.length}, got ${data.length}`);
  }
  return data.map((entry: any) => {
    const arr = Array.isArray(entry?.embedding) ? entry.embedding : [];
    const v = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) v[i] = Number(arr[i]);
    return normalize(v);
  });
}

export async function embed(text: string): Promise<Float32Array> {
  const [vec] = await fetchEmbeddings([text]);
  return vec;
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  return fetchEmbeddings(texts);
}

export async function warmupEmbedder(): Promise<void> {
  try {
    await fetch(`${llamaBaseUrl()}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      body: JSON.stringify({ model: embedModel(), input: 'warmup' })
    });
  } catch {
    // Fire-and-forget; warmup failures are non-fatal.
  }
}

export function upsertChunk(
  sourceType: string,
  sourceId: string,
  text: string,
  vector: Float32Array
): void {
  const blob = packVector(vector);
  db.insert(goobyEmbeddings)
    .values({
      sourceType,
      sourceId,
      text,
      vector: blob,
      dim: vector.length,
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .onConflictDoUpdate({
      target: [goobyEmbeddings.sourceType, goobyEmbeddings.sourceId],
      set: {
        text,
        vector: blob,
        dim: vector.length,
        updatedAt: Math.floor(Date.now() / 1000)
      }
    })
    .run();
}

function readSiteConfig(): any {
  try {
    return JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function chunkBySize(text: string, max: number): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const paragraphs = clean.split(/\n\n+/);
  const out: string[] = [];
  let buf = '';
  for (const para of paragraphs) {
    if ((buf + '\n\n' + para).trim().length <= max) {
      buf = (buf ? buf + '\n\n' : '') + para;
      continue;
    }
    if (buf) {
      out.push(buf.trim());
      buf = '';
    }
    if (para.length <= max) {
      buf = para;
      continue;
    }
    const sentences = para.split(/(?<=[.!?])\s+/);
    let sBuf = '';
    for (const s of sentences) {
      if ((sBuf + ' ' + s).trim().length <= max) {
        sBuf = (sBuf ? sBuf + ' ' : '') + s;
      } else {
        if (sBuf) out.push(sBuf.trim());
        if (s.length <= max) {
          sBuf = s;
        } else {
          for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
          sBuf = '';
        }
      }
    }
    if (sBuf) buf = sBuf;
  }
  if (buf) out.push(buf.trim());
  return out;
}

interface CorpusItem {
  sourceType: string;
  sourceId: string;
  text: string;
}

function buildDrinkItems(): CorpusItem[] {
  const rows = db.select().from(drinks).all();
  return rows
    .filter((d) => d.active)
    .map((d) => {
      const parts = [`${d.name} (category: ${d.category})`];
      if (d.description) parts.push(d.description);
      if (d.notes) parts.push(`Notes: ${d.notes}`);
      if (d.abv != null) parts.push(`ABV ${d.abv}%`);
      if (d.volumeMl != null) parts.push(`${d.volumeMl} mL`);
      return {
        sourceType: 'drink',
        sourceId: `drink:${d.id}`,
        text: parts.join('. ')
      };
    });
}

function buildOrderSummaryItems(): CorpusItem[] {
  const yesterday = Math.floor(Date.now() / 1000) - 86_400;
  const rows = db
    .select({
      drinkId: orders.drinkId,
      name: drinks.name,
      total: sql<number>`count(*)`,
      yesterdayCount: sql<number>`sum(case when ${orders.createdAt} >= ${yesterday} then 1 else 0 end)`
    })
    .from(orders)
    .innerJoin(drinks, sql`${drinks.id} = ${orders.drinkId}`)
    .groupBy(orders.drinkId, drinks.name)
    .all();
  return rows
    .filter((r) => Number(r.total) > 0)
    .map((r) => ({
      sourceType: 'order_summary',
      sourceId: `order:${r.drinkId}`,
      text: `${r.name}: ${r.total} orders all-time, ${r.yesterdayCount ?? 0} in the last 24h.`
    }));
}

function buildAdminMemberItems(cfg: any): CorpusItem[] {
  if (!Array.isArray(cfg.members)) return [];
  return cfg.members
    .filter((m: any) => m && typeof m.name === 'string' && (m.bio || m.role))
    .map((m: any) => ({
      sourceType: 'admin_member',
      sourceId: `member:${String(m.name).toLowerCase()}`,
      text: [
        `Household member: ${m.name}${m.role ? ` (${m.role})` : ''}.`,
        m.bio || ''
      ]
        .filter(Boolean)
        .join(' ')
    }));
}

function buildAdminTipItems(cfg: any): CorpusItem[] {
  if (!Array.isArray(cfg.visitorTips)) return [];
  return cfg.visitorTips
    .filter((t: any) => t && typeof t.title === 'string' && typeof t.body === 'string')
    .map((t: any, i: number) => ({
      sourceType: 'admin_tip',
      sourceId: `tip:${i}:${t.title.toLowerCase().slice(0, 32)}`,
      text: `Visitor tip — ${t.title}. ${t.body}`
    }));
}

function buildAdminNeighborhoodItems(cfg: any): CorpusItem[] {
  if (!Array.isArray(cfg.neighborhoodHighlights)) return [];
  return cfg.neighborhoodHighlights
    .filter((h: any) => h && typeof h.title === 'string' && typeof h.description === 'string')
    .map((h: any, i: number) => ({
      sourceType: 'admin_tip',
      sourceId: `neighborhood:${i}:${h.title.toLowerCase().slice(0, 32)}`,
      text: `Neighborhood highlight — ${h.title}. ${h.description}`
    }));
}

function buildAdminLimonItems(cfg: any): CorpusItem[] {
  const l = cfg.limon || {};
  const fields: string[] = [];
  if (l.name) fields.push(`Name: ${l.name}.`);
  if (l.breed) fields.push(`Breed: ${l.breed}.`);
  if (l.specialty) fields.push(`Specialty: ${l.specialty}.`);
  if (l.hobbies) fields.push(`Hobbies: ${l.hobbies}.`);
  if (l.mood) fields.push(`Mood: ${l.mood}.`);
  if (l.bio) fields.push(l.bio);
  if (l.quote) fields.push(`Quote: "${l.quote}"${l.quoteAttribution ? ` — ${l.quoteAttribution}` : ''}.`);
  if (fields.length === 0) return [];
  return [{ sourceType: 'admin_limon', sourceId: 'limon', text: fields.join(' ') }];
}

function buildStatsSnapshotItems(): CorpusItem[] {
  const rows = db
    .select({ date: dailyBriefs.date, narrative: dailyBriefs.narrative })
    .from(dailyBriefs)
    .orderBy(sql`${dailyBriefs.date} desc`)
    .limit(7)
    .all();
  if (rows.length === 0) return [];
  const text = rows
    .reverse()
    .map((r) => `${r.date}: ${r.narrative}`)
    .join('\n');
  return [{ sourceType: 'stats_snapshot', sourceId: 'last7d', text }];
}

function gatherCorpus(): CorpusItem[] {
  const cfg = readSiteConfig();
  const raw = [
    ...buildDrinkItems(),
    ...buildOrderSummaryItems(),
    ...buildAdminMemberItems(cfg),
    ...buildAdminTipItems(cfg),
    ...buildAdminNeighborhoodItems(cfg),
    ...buildAdminLimonItems(cfg),
    ...buildStatsSnapshotItems()
  ];
  const max = maxChunkChars();
  const out: CorpusItem[] = [];
  for (const item of raw) {
    const chunks = chunkBySize(item.text, max);
    if (chunks.length <= 1) {
      out.push({ ...item, text: chunks[0] ?? item.text });
    } else {
      chunks.forEach((c, i) => {
        out.push({
          sourceType: item.sourceType,
          sourceId: `${item.sourceId}#${i}`,
          text: c
        });
      });
    }
  }
  return out;
}

const BATCH_SIZE = 16;

export async function indexAll(): Promise<{ inserted: number; updated: number; removed: number }> {
  await yieldToDrinks();
  const items = gatherCorpus();
  const existingRows = db
    .select({ sourceType: goobyEmbeddings.sourceType, sourceId: goobyEmbeddings.sourceId })
    .from(goobyEmbeddings)
    .all();
  const existing = new Set(existingRows.map((r) => `${r.sourceType}::${r.sourceId}`));
  const seen = new Set<string>();

  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const vectors = await fetchEmbeddings(slice.map((it) => it.text));
    slice.forEach((it, idx) => {
      const key = `${it.sourceType}::${it.sourceId}`;
      seen.add(key);
      if (existing.has(key)) updated++;
      else inserted++;
      upsertChunk(it.sourceType, it.sourceId, it.text, vectors[idx]);
    });
  }

  let removed = 0;
  for (const key of existing) {
    if (seen.has(key)) continue;
    const [sourceType, sourceId] = key.split('::');
    db.delete(goobyEmbeddings)
      .where(sql`${goobyEmbeddings.sourceType} = ${sourceType} and ${goobyEmbeddings.sourceId} = ${sourceId}`)
      .run();
    removed++;
  }

  return { inserted, updated, removed };
}

export interface RetrievedChunk {
  sourceType: string;
  sourceId: string;
  text: string;
  score: number;
}

export async function retrieve(query: string, k?: number): Promise<RetrievedChunk[]> {
  const limit = k ?? topK();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryVec = await embed(trimmed);
  const dim = embedDim();
  if (queryVec.length !== dim) {
    console.warn(`[gooby-rag] query vec dim ${queryVec.length} != setting ${dim}; using actual length`);
  }

  const rows = db
    .select({
      sourceType: goobyEmbeddings.sourceType,
      sourceId: goobyEmbeddings.sourceId,
      text: goobyEmbeddings.text,
      vector: goobyEmbeddings.vector,
      dim: goobyEmbeddings.dim
    })
    .from(goobyEmbeddings)
    .all();

  const scored: RetrievedChunk[] = [];
  for (const r of rows) {
    if (!(r.vector instanceof Buffer)) continue;
    if (r.dim !== queryVec.length) continue;
    const vec = unpackVector(r.vector);
    scored.push({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      text: r.text,
      score: dot(queryVec, vec)
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export function chunkCount(): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(goobyEmbeddings).get();
  return Number(row?.n ?? 0);
}
