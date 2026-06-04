import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const defaultTrustedOrigins = [
  'https://21bristoe.com',
  'https://www.21bristoe.com',
  'https://admin.21bristoe.com',
  'https://stats.21bristoe.com'
];

const envTrustedOrigins = (process.env.CSRF_TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const trustedOrigins = Array.from(new Set([...defaultTrustedOrigins, ...envTrustedOrigins]));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    files: {
      assets: 'public'
    },
    csrf: { trustedOrigins },
    // Nonce-based CSP: SvelteKit injects a per-response nonce into its own inline
    // scripts so 'unsafe-inline' can be dropped from script-src. This header is
    // the source of truth — the old static CSP in hooks.server.ts / nginx was
    // removed (nginx cannot mint matching per-request nonces).
    // style-src keeps 'unsafe-inline' for inline style="" attributes (e.g. app.html).
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'wasm-unsafe-eval'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'https://21bristoe.com', 'data:', 'blob:'],
        'connect-src': ['self', 'https://21bristoe.com'],
        'font-src': ['self'],
        'object-src': ['none'],
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['self']
      }
    }
  }
};

export default config;
