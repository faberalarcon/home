# 21bristoe.com — Family Homepage

## What this is
Static homepage for the household at 21 Bristoe St, Meades Crossing, Taneytown MD.
Built with Astro 6 + Tailwind CSS 4, deployed as static HTML via nginx on a Raspberry Pi.

## The household
- **Faber** and **Kasey** (the humans)
- **Limón** — golden retriever

## Stack
- Astro 6 (static output, zero client JS)
- Tailwind CSS 4 (via @tailwindcss/vite)
- @astrojs/sitemap

## Key paths
- Source: `src/`
  - `src/layouts/` — shared HTML layouts
  - `src/pages/` — routes (file = URL)
  - `src/components/` — reusable Astro components
  - `src/assets/images/` — local images (optimized at build time by Astro)
  - `src/styles/global.css` — Tailwind + custom design tokens
- Build output: `dist/` (gitignored, built on server)
- Nginx config: `deploy/nginx/21bristoe.com.conf`
- Deploy script: `deploy/deploy.sh`
- Public assets: `public/` (copied to dist/ as-is)

## Build & Deploy
```bash
npm run dev           # local dev server at localhost:4321
npm run build         # produces dist/
./deploy/deploy.sh    # build + deploy to /var/www/21bristoe.com + reload nginx
```

## Server
- Raspberry Pi (ARM64) at 192.168.1.177, public IP 24.170.229.234
- nginx 1.26.3 serving static files from /var/www/21bristoe.com
- SSL via certbot (Let's Encrypt), auto-renewing
- Existing subdomain: drink-hub.21bristoe.com (separate config, don't touch)

## Canonical URL
https://21bristoe.com (www redirects to non-www)

## Design tokens
- Warm amber/gold: `#b8860b` (primary)
- Sage green: `#6b8e6b` (secondary)
- Warm cream: `#fdf8f0` (background)
- Georgia/serif for headings, system sans-serif for body

## Current implementation status
See plan: ~/.claude/plans/generic-watching-papert.md

## Phase progress
- [x] Phase 0: Git setup ✓
- [x] Phase 1: Astro scaffolding ✓
- [x] Phase 2: Homepage UI build ✓ (all 7 sections + 404)
- [x] Phase 3: Content & personalization ✓ (placeholder assets; real photos TBD)
- [ ] Phase 4: Infrastructure & SSL
- [ ] Phase 5: Endpoint validation & launch

## Image assets status
Placeholder images are in place (solid color PNGs). Replace with real photos:
- `public/og-image.png` → replace with a 1200×630 lifestyle/home photo
- `public/apple-touch-icon.png` → replace with real icon art
- `public/icon-192.png`, `public/icon-512.png` → replace with real icon art
- See `src/assets/images/IMAGES.md` for the full list of component images needed

## Next step
**Phase 4: Infrastructure & SSL**
1. Create `deploy/nginx/21bristoe.com.conf`
2. Install nginx config and update `/etc/nginx/sites-available/default`
3. Run certbot for 21bristoe.com + www.21bristoe.com
4. Deploy build to `/var/www/21bristoe.com`
5. Create `deploy/deploy.sh`

DNS must resolve publicly before certbot will work:
`dig 21bristoe.com @8.8.8.8` should return 24.170.229.234
