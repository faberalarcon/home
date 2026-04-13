// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://21bristoe.com',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Prevent Vite from inlining small scripts/assets — keeps script-src 'self' in CSP valid
      assetsInlineLimit: 0,
    },
  },
  integrations: [sitemap()],
  build: {
    assets: '_assets',
  },
});
