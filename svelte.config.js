import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const defaultTrustedOrigins = [
  'https://21bristoe.com',
  'https://www.21bristoe.com',
  'https://admin.21bristoe.com',
  'https://drink-hub.21bristoe.com',
  'https://stats.21bristoe.com',
  'https://ai.tail9b2fcb.ts.net'
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
    csrf: { trustedOrigins }
  }
};

export default config;
