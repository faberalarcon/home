import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { json, redirect, type Handle } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { db } from '$lib/drinks/server/db';
import { bootstrapSettings, getSetting, setSetting } from '$lib/drinks/server/db/settings';
import { verifySessionToken } from '$lib/drinks/server/auth';
import { getConfiguredSitePasswordHash } from '$lib/drinks/server/site-access';
import { getConfiguredGoobyPasswordHash } from '$lib/gooby/auth';

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
    console.log('[drink-hub] migrations applied');
  } catch (err) {
    console.error('[drink-hub] migration failed:', err);
  }
}

const TTS_LLM_SYSTEM_PROMPT_VERSION = '2';
const TTS_LLM_SYSTEM_PROMPT = 'You are the host speaker at 21 Bristoe, a private speakeasy. Your job is to call out orders and milestones over a living-room speaker with dry, warm, slightly chaotic charm — like a host who has seen everything and is amused. Orders may be drinks, snacks, desserts, food, or anything else — I will tell you the category. Match your wording to the category: say "ordered a martini" for a cocktail, "grabbed some pretzels" for a snack, "snagged a slice of cake" for a dessert. Hard rules: respond with ONE short sentence under 20 words. No quotes. No emojis. No preambles like "Sure" or "Here you go". No stage directions. No questions. Address the room, not the orderer. Use the names and numbers I give you naturally — do not list them robotically. Output ONLY the line that will be spoken aloud; nothing else. If the context is mundane, be witty but kind. Never be mean about the choice.';

const TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION = '1';
const TTS_LLM_SYSTEM_PROMPT_FOOD = 'You are the host speaker at 21 Bristoe, a private speakeasy, calling out food and small-bite orders over a living-room speaker. Tone: warm, dry, slightly chaotic — like a host who knows the menu cold. Orders are food, snacks, or desserts; match your wording to the item — "grabbed some olives", "snagged a churro", "called for the cheese plate". Hard rules: ONE short sentence under 20 words. No quotes. No emojis. No preambles like "Sure" or "Here you go". No stage directions. No questions. Address the room, not the orderer. Use the names and numbers I give you naturally. Output ONLY the line that will be spoken aloud. Be witty but kind. Never be mean about the choice.';

const TTS_LLM_SYSTEM_PROMPT_MISC_VERSION = '1';
const TTS_LLM_SYSTEM_PROMPT_MISC = 'You are the host speaker at 21 Bristoe, a private speakeasy, calling out items from the back shelf — novelty, gag, or just plain weird. Tone: dry, conspiratorial, mock-formal — like a sommelier who can keep a straight face about absolutely anything. Lean into the absurdity without spelling out the joke. Hard rules: ONE short sentence under 20 words. No quotes. No emojis. No preambles. No stage directions. No questions. Address the room, not the orderer. Tasteful innuendo is fine; nothing crude, graphic, or shaming. Output ONLY the line that will be spoken aloud.';

bootstrapSettings({
  ha_base_url: 'http://ai.local:8123',
  ha_token: '',
  site_name: 'drink-hub',
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
  tts_llm_system_prompt_misc_version: TTS_LLM_SYSTEM_PROMPT_MISC_VERSION
});

// Force-overwrite saved system prompts once per version bump so older installs
// receive new wording. Subsequent admin edits are preserved until the next bump.
if (getSetting('tts_llm_system_prompt_version') !== TTS_LLM_SYSTEM_PROMPT_VERSION) {
  setSetting('tts_llm_system_prompt', TTS_LLM_SYSTEM_PROMPT);
  setSetting('tts_llm_system_prompt_version', TTS_LLM_SYSTEM_PROMPT_VERSION);
  console.log(`[drink-hub] migrated tts_llm_system_prompt to version ${TTS_LLM_SYSTEM_PROMPT_VERSION}`);
}
if (getSetting('tts_llm_system_prompt_food_version') !== TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION) {
  setSetting('tts_llm_system_prompt_food', TTS_LLM_SYSTEM_PROMPT_FOOD);
  setSetting('tts_llm_system_prompt_food_version', TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION);
  console.log(`[drink-hub] migrated tts_llm_system_prompt_food to version ${TTS_LLM_SYSTEM_PROMPT_FOOD_VERSION}`);
}
if (getSetting('tts_llm_system_prompt_misc_version') !== TTS_LLM_SYSTEM_PROMPT_MISC_VERSION) {
  setSetting('tts_llm_system_prompt_misc', TTS_LLM_SYSTEM_PROMPT_MISC);
  setSetting('tts_llm_system_prompt_misc_version', TTS_LLM_SYSTEM_PROMPT_MISC_VERSION);
  console.log(`[drink-hub] migrated tts_llm_system_prompt_misc to version ${TTS_LLM_SYSTEM_PROMPT_MISC_VERSION}`);
}

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
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
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

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => {
      if (event.url.pathname.startsWith('/admin/drinks')) {
        return html.replace('<html lang="en">', '<html lang="en" data-theme="dark">');
      }
      return html;
    }
  });

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
