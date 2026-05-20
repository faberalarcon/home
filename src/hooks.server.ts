import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { json, redirect, type Handle } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { db } from '$lib/drinks/server/db';
import { bootstrapSettings, getSetting, setSetting } from '$lib/drinks/server/db/settings';
import { verifySessionToken } from '$lib/drinks/server/auth';
import { getConfiguredSitePasswordHash } from '$lib/drinks/server/site-access';
import { getConfiguredGoobyPasswordHash } from '$lib/gooby/auth';
import { ingestFromJsonl } from '$lib/stats/server/pi-history';
import { broadcast as broadcastStats } from '$lib/stats/server/stream';

const isProduction = process.env.NODE_ENV === 'production';
const rootAdminSecret = process.env.ADMIN_SHARED_SECRET ?? '';

if (isProduction && !rootAdminSecret) {
  console.error('[fatal] ADMIN_SHARED_SECRET is required in production. Refusing to start.');
  process.exit(1);
}

let migrated = false;
if (!migrated) {
  try {
    migrate(db, { migrationsFolder: './drizzle' });
    migrated = true;
    console.log('[drinks] migrations applied');
  } catch (err) {
    console.error('[drinks] migration failed:', err);
  }
}

const TTS_LLM_SYSTEM_PROMPT_VERSION = '2';
const TTS_LLM_SYSTEM_PROMPT = 'You are the host speaker at 21 Bristoe, a private speakeasy. Your job is to call out orders and milestones over a living-room speaker with dry, warm, slightly chaotic charm — like a host who has seen everything and is amused. Orders may be drinks, snacks, desserts, food, or anything else — I will tell you the category. Match your wording to the category: say "ordered a martini" for a cocktail, "grabbed some pretzels" for a snack, "snagged a slice of cake" for a dessert. Hard rules: respond with ONE short sentence under 20 words. No quotes. No emojis. No preambles like "Sure" or "Here you go". No stage directions. No questions. Address the room, not the orderer. Use the names and numbers I give you naturally — do not list them robotically. Output ONLY the line that will be spoken aloud; nothing else. If the context is mundane, be witty but kind. Never be mean about the choice.';

const TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION = '1';
const TTS_LLM_SYSTEM_PROMPT_FOOD = 'You are the host speaker at 21 Bristoe, a private speakeasy, calling out food and small-bite orders over a living-room speaker. Tone: warm, dry, slightly chaotic — like a host who knows the menu cold. Orders are food, snacks, or desserts; match your wording to the item — "grabbed some olives", "snagged a churro", "called for the cheese plate". Hard rules: ONE short sentence under 20 words. No quotes. No emojis. No preambles like "Sure" or "Here you go". No stage directions. No questions. Address the room, not the orderer. Use the names and numbers I give you naturally. Output ONLY the line that will be spoken aloud. Be witty but kind. Never be mean about the choice.';

const TTS_LLM_SYSTEM_PROMPT_MISC_VERSION = '1';
const TTS_LLM_SYSTEM_PROMPT_MISC = 'You are the host speaker at 21 Bristoe, a private speakeasy, calling out items from the back shelf — novelty, gag, or just plain weird. Tone: dry, conspiratorial, mock-formal — like a sommelier who can keep a straight face about absolutely anything. Lean into the absurdity without spelling out the joke. Hard rules: ONE short sentence under 20 words. No quotes. No emojis. No preambles. No stage directions. No questions. Address the room, not the orderer. Tasteful innuendo is fine; nothing crude, graphic, or shaming. Output ONLY the line that will be spoken aloud.';

const DAILY_BRIEF_SYSTEM_PROMPT_VERSION = '1';
const DAILY_BRIEF_SYSTEM_PROMPT = 'You are the steward of 21 Bristoe writing a one-paragraph daily brief for the household. Tone: warm, dry, observational — like a butler who has seen the whole day at once and is now reporting back. Use the structured facts I give you. Mention the drink count and top drink if non-zero; otherwise skip drinks. Mention the weather only if notable (rain, extreme temps). Mention Pi peak temp only if above 70C. Mention HA errors only if non-zero. Hard rules: 2-4 sentences total, under 60 words, no lists, no emojis, no quotes, no preamble. Output ONLY the brief paragraph.';

const REWRITE_PROMPT_VERSION = '1';
const REWRITE_PROMPT_MEMBER_BIO = 'You rewrite household-member bios for the 21 Bristoe site. Keep the same length, warmth, and dry humor. Match first/third person from the original. Output ONLY the rewritten bio — no preamble, no quotes, no list, no emojis. Stay under 500 characters.';
const REWRITE_PROMPT_DRINK_DESCRIPTION = 'You rewrite drink descriptions for the 21 Bristoe drinks menu. Punchy, evocative, single short paragraph. Keep ingredients/flavor cues that appear in the original. Output ONLY the rewritten description — no preamble, no quotes, no emojis. Stay under 400 characters.';
const REWRITE_PROMPT_NEIGHBORHOOD_TIP = 'You rewrite neighborhood-highlight cards for the 21 Bristoe home page. Inviting, locally specific, warm but not saccharine. Output ONLY the rewritten description — no preamble, no quotes, no emojis. Stay under 300 characters.';
const REWRITE_PROMPT_VISITOR_TIP = 'You rewrite visitor tips for the 21 Bristoe home page. Practical, friendly, two sentences max. Output ONLY the rewritten body — no preamble, no quotes, no emojis. Stay under 500 characters.';
const REWRITE_PROMPT_LIMON_SPOTLIGHT = 'You rewrite the Limón spotlight bio. Warm, affectionate, a little chaotic — like introducing a beloved golden retriever to a stranger. Output ONLY the rewritten bio — no preamble, no quotes, no emojis. Stay under 500 characters.';

bootstrapSettings({
  ha_base_url: 'http://ai.local:8123',
  ha_token: '',
  site_name: 'drinks',
  tts_llm_enabled: 'false',
  tts_llm_model: 'gemma4:e2b',
  tts_llm_timeout_ms: '3000',
  tts_llm_max_tokens: '60',
  tts_llm_preload_ttl_s: '60',
  tts_llm_system_prompt: TTS_LLM_SYSTEM_PROMPT,
  tts_llm_system_prompt_version: TTS_LLM_SYSTEM_PROMPT_VERSION,
  tts_llm_system_prompt_food: TTS_LLM_SYSTEM_PROMPT_FOOD,
  tts_llm_system_prompt_food_version: TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION,
  tts_llm_system_prompt_misc: TTS_LLM_SYSTEM_PROMPT_MISC,
  tts_llm_system_prompt_misc_version: TTS_LLM_SYSTEM_PROMPT_MISC_VERSION,
  daily_brief_model: 'gemma4-26b-heretic-128k',
  daily_brief_notify_service: '',
  daily_brief_system_prompt: DAILY_BRIEF_SYSTEM_PROMPT,
  daily_brief_system_prompt_version: DAILY_BRIEF_SYSTEM_PROMPT_VERSION,
  drinks_parse_model: 'gemma4-26b-heretic-128k',
  gooby_rag_enabled: 'true',
  gooby_rag_model: 'gemma4-26b-heretic-128k',
  gooby_rag_embed_model: 'embeddinggemma',
  gooby_rag_embed_dim: '768',
  gooby_rag_top_k: '8',
  gooby_rag_max_chunk_chars: '600',
  rewrite_prompt_member_bio: REWRITE_PROMPT_MEMBER_BIO,
  rewrite_prompt_drink_description: REWRITE_PROMPT_DRINK_DESCRIPTION,
  rewrite_prompt_neighborhood_tip: REWRITE_PROMPT_NEIGHBORHOOD_TIP,
  rewrite_prompt_visitor_tip: REWRITE_PROMPT_VISITOR_TIP,
  rewrite_prompt_limon_spotlight: REWRITE_PROMPT_LIMON_SPOTLIGHT,
  rewrite_prompt_version: REWRITE_PROMPT_VERSION
});

// Force-overwrite saved system prompts once per version bump so older installs
// receive new wording. Subsequent admin edits are preserved until the next bump.
if (getSetting('tts_llm_system_prompt_version') !== TTS_LLM_SYSTEM_PROMPT_VERSION) {
  setSetting('tts_llm_system_prompt', TTS_LLM_SYSTEM_PROMPT);
  setSetting('tts_llm_system_prompt_version', TTS_LLM_SYSTEM_PROMPT_VERSION);
  console.log(`[drinks] migrated tts_llm_system_prompt to version ${TTS_LLM_SYSTEM_PROMPT_VERSION}`);
}
if (getSetting('tts_llm_system_prompt_food_version') !== TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION) {
  setSetting('tts_llm_system_prompt_food', TTS_LLM_SYSTEM_PROMPT_FOOD);
  setSetting('tts_llm_system_prompt_food_version', TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION);
  console.log(`[drinks] migrated tts_llm_system_prompt_food to version ${TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION}`);
}
if (getSetting('tts_llm_system_prompt_misc_version') !== TTS_LLM_SYSTEM_PROMPT_MISC_VERSION) {
  setSetting('tts_llm_system_prompt_misc', TTS_LLM_SYSTEM_PROMPT_MISC);
  setSetting('tts_llm_system_prompt_misc_version', TTS_LLM_SYSTEM_PROMPT_MISC_VERSION);
  console.log(`[drinks] migrated tts_llm_system_prompt_misc to version ${TTS_LLM_SYSTEM_PROMPT_MISC_VERSION}`);
}
if (getSetting('daily_brief_system_prompt_version') !== DAILY_BRIEF_SYSTEM_PROMPT_VERSION) {
  setSetting('daily_brief_system_prompt', DAILY_BRIEF_SYSTEM_PROMPT);
  setSetting('daily_brief_system_prompt_version', DAILY_BRIEF_SYSTEM_PROMPT_VERSION);
  console.log(`[brief] migrated daily_brief_system_prompt to version ${DAILY_BRIEF_SYSTEM_PROMPT_VERSION}`);
}
// One-shot correction: the first deploy of drinks_parse_model defaulted to
// `gemma4:e2b`, but that preset is currently wedged in the llama-swap router
// on the LLM box (see docs/handoff/2026-05-19-llm-box-heavy-models-stuck.md).
// Force-flip any installs that already saved the bad value back to a model
// that's known-loadable. Admin can re-pick later.
if (getSetting('drinks_parse_model') === 'gemma4:e2b') {
  setSetting('drinks_parse_model', 'gemma4-26b-heretic-128k');
  console.log('[drinks] migrated drinks_parse_model away from wedged gemma4:e2b');
}

if (getSetting('rewrite_prompt_version') !== REWRITE_PROMPT_VERSION) {
  setSetting('rewrite_prompt_member_bio', REWRITE_PROMPT_MEMBER_BIO);
  setSetting('rewrite_prompt_drink_description', REWRITE_PROMPT_DRINK_DESCRIPTION);
  setSetting('rewrite_prompt_neighborhood_tip', REWRITE_PROMPT_NEIGHBORHOOD_TIP);
  setSetting('rewrite_prompt_visitor_tip', REWRITE_PROMPT_VISITOR_TIP);
  setSetting('rewrite_prompt_limon_spotlight', REWRITE_PROMPT_LIMON_SPOTLIGHT);
  setSetting('rewrite_prompt_version', REWRITE_PROMPT_VERSION);
  console.log(`[gooby-rag] migrated rewrite prompts to version ${REWRITE_PROMPT_VERSION}`);
}

async function bootstrapGoobyRagIndex(): Promise<void> {
  try {
    const { chunkCount, indexAll } = await import('$lib/gooby/server/rag');
    if (chunkCount() > 0) {
      console.log(`[gooby-rag] index has ${chunkCount()} chunks; skipping boot-on-empty`);
      return;
    }
    const result = await indexAll();
    console.log(`[gooby-rag] indexed ${result.inserted + result.updated} chunks (inserted=${result.inserted}, updated=${result.updated}, removed=${result.removed})`);
  } catch (err) {
    console.warn('[gooby-rag] boot-on-empty index failed:', err instanceof Error ? err.message : err);
  }
}
void bootstrapGoobyRagIndex();

const PI_INGEST_INTERVAL_MS = 5 * 60 * 1000;
async function ingestPiAndBroadcast(label: string): Promise<void> {
  try {
    const result = await ingestFromJsonl();
    if (result.inserted > 0 && result.latest) {
      console.log(`[pi-history] ${label}: ingested ${result.inserted} new samples`);
      broadcastStats('pi-tick', result.latest);
    }
  } catch (err) {
    console.warn(`[pi-history] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}
void ingestPiAndBroadcast('startup');
setInterval(() => {
  void ingestPiAndBroadcast('tick');
}, PI_INGEST_INTERVAL_MS).unref();

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://21bristoe.com data: blob:",
    "connect-src 'self' https://21bristoe.com",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), interest-cohort=()'
};

function isDrinkPublicPath(path: string): boolean {
  return (
    path === '/login' ||
    path === '/api/health' ||
    path === '/api/stats' ||
    path.startsWith('/_app/') ||
    path.startsWith('/icons/') ||
    path.startsWith('/uploads/') ||
    path === '/favicon.png' ||
    path === '/manifest.webmanifest' ||
    path === '/service-worker.js'
  );
}

function drinkRoutePath(pathname: string): string {
  if (pathname === '/drinks') return '/';
  if (pathname.startsWith('/drinks/')) return pathname.slice('/drinks'.length);
  return pathname;
}

function withDrinksBase(path: string): string {
  if (path === '/') return '/drinks';
  return `/drinks${path}`;
}

function isGoobyPublicPath(pathname: string): boolean {
  return (
    pathname === '/gooby/login' ||
    pathname.startsWith('/_app/') ||
    pathname === '/favicon.png' ||
    pathname === '/favicon.svg'
  );
}

function verifyRootAdminProxy(event: Parameters<Handle>[0]['event']): boolean {
  if (!isProduction) return true;
  const supplied = event.request.headers.get('x-admin-auth') ?? '';
  const expected = rootAdminSecret;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.rootAdminAuthenticated = verifyRootAdminProxy(event);
  event.locals.goobyPasswordEnabled = false;
  event.locals.goobyAuthenticated = false;

  if (event.url.pathname === '/admin') {
    throw redirect(308, '/admin/');
  }

  if (event.url.pathname.startsWith('/admin/')) {
    if (!event.locals.rootAdminAuthenticated) {
      console.warn(`[admin] blocked request without trusted proxy auth: ${event.request.method} ${event.url.pathname}`);
      return json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (event.url.pathname.startsWith('/drinks')) {
    const path = drinkRoutePath(event.url.pathname);

    const sitePasswordHash = getConfiguredSitePasswordHash();
    const siteToken = event.cookies.get('site_session');

    event.locals.sitePasswordEnabled = !!sitePasswordHash;
    event.locals.siteAuthenticated = event.locals.sitePasswordEnabled
      ? verifySessionToken(siteToken, 'site')
      : true;

    if (event.locals.sitePasswordEnabled && !event.locals.siteAuthenticated && !isDrinkPublicPath(path)) {
      if (path.startsWith('/api/')) {
        return json({ error: 'Authentication required' }, { status: 401 });
      }

      const pw = event.url.searchParams.get('pw');
      const cleanedSearch = new URLSearchParams(event.url.searchParams);
      cleanedSearch.delete('pw');
      const cleanedQs = cleanedSearch.toString();
      const next = `${path}${cleanedQs ? `?${cleanedQs}` : ''}`;
      const loginUrl = `${withDrinksBase('/login')}?next=${encodeURIComponent(next)}${pw ? `&pw=${encodeURIComponent(pw)}` : ''}`;
      throw redirect(303, loginUrl);
    }
  } else if (event.url.pathname.startsWith('/gooby')) {
    const goobyPasswordHash = getConfiguredGoobyPasswordHash();
    const goobyToken = event.cookies.get('gooby_session');

    event.locals.goobyPasswordEnabled = !!goobyPasswordHash;
    event.locals.goobyAuthenticated = event.locals.goobyPasswordEnabled
      ? verifySessionToken(goobyToken, 'gooby')
      : false;
    event.locals.sitePasswordEnabled = false;
    event.locals.siteAuthenticated = true;

    if ((!event.locals.goobyPasswordEnabled || !event.locals.goobyAuthenticated) && !isGoobyPublicPath(event.url.pathname)) {
      if (event.url.pathname.startsWith('/gooby/api/')) {
        return json(
          { error: event.locals.goobyPasswordEnabled ? 'Authentication required' : 'GoobyGPT password is not configured' },
          { status: event.locals.goobyPasswordEnabled ? 401 : 503 }
        );
      }

      const pw = event.url.searchParams.get('pw');
      const cleanedSearch = new URLSearchParams(event.url.searchParams);
      cleanedSearch.delete('pw');
      const cleanedQs = cleanedSearch.toString();
      const next = `${event.url.pathname}${cleanedQs ? `?${cleanedQs}` : ''}`;
      const loginUrl = `/gooby/login?next=${encodeURIComponent(next)}${pw ? `&pw=${encodeURIComponent(pw)}` : ''}`;
      throw redirect(303, loginUrl);
    }
  } else {
    event.locals.sitePasswordEnabled = false;
    event.locals.siteAuthenticated = true;
  }

  const response = await resolve(event);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  if (event.url.pathname === '/') {
    response.headers.set('Cache-Control', 'no-store');
  } else if (event.url.pathname.startsWith('/admin')) {
    // Admin pages must never be cached: stale HTML can render a form whose
    // action points at a legacy URL, which then 308s across origins and gets
    // the Origin header stripped, tripping the CSRF check.
    response.headers.set('Cache-Control', 'no-store');
  } else if (
    event.url.pathname === '/stats/' ||
    event.url.pathname === '/stats/drinks' ||
    event.url.pathname === '/stats/house'
  ) {
    response.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  }

  return response;
};
