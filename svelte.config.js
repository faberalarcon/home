import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // LAN-only service with no auth — CSRF origin check causes false positives
    // because adapter-node defaults to https:// while the LAN runs on http://.
    csrf: { checkOrigin: false }
  }
};

export default config;
