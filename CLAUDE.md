# 21bristoe.com — Family Homepage

## Change workflow (always)

Every code change in this repo follows this cycle — no exceptions:

1. **Smoke test locally**: `npm run dev` (or `npm run build && npx astro preview`), curl the affected pages, grep for markers of the change.
2. **Rebuild**: `npm run build` — must succeed before any commit.
3. **Redeploy**: `./deploy/deploy.sh` — runs the 31-check validation suite as a gate.
4. **Commit**: stage only files you touched; use a conventional, human-style message (see existing `git log --oneline`).
5. **Push**: `git push origin main`.

If any step fails, fix the root cause and restart the cycle. Do not skip steps or batch changes across cycles.

---


## What this is
Static homepage for the household at 21 Bristoe Station Rd, Meades Crossing, Taneytown MD.
Built with Astro 6 + Tailwind CSS 4, deployed as static HTML via nginx on a Raspberry Pi.

## The household
- **Faber** and **Kasey** (the humans)
- **Limón** — golden retriever

## Stack
- Astro 6 (static output, zero client JS)
- Tailwind CSS 4 (via @tailwindcss/vite)
- @astrojs/sitemap
- suncalc — build-time sun/moon calculations for SkyStrip
- Admin panel: Node/Express at `admin/` (image uploads, port 3001)

## Key paths
- Source: `src/`
  - `src/layouts/` — shared HTML layouts
  - `src/pages/` — routes (file = URL)
  - `src/components/` — reusable Astro components
  - `src/components/Slideshow.astro` — hero slideshow (reads `/uploads/manifest.json` at runtime)
  - `src/components/SkyStrip.astro` — sunrise/sunset/moon phase bar (build-time, suncalc)
  - `src/components/WeatherCard.astro` — live weather widget (build-time fetch, Open-Meteo)
  - `src/components/VisitorGuide.astro` — collapsible visitor tips (HTML details/summary, zero JS)
  - `src/assets/images/` — local images (optimized at build time by Astro)
  - `src/styles/global.css` — Tailwind + custom design tokens
- Build output: `dist/` (gitignored, built on server)
- Nginx config: `deploy/nginx/21bristoe.com.ssl.conf`
- Deploy script: `deploy/deploy.sh`
- Validation script: `deploy/validate.sh` (31 checks including admin panel)
- Public assets: `public/` (copied to dist/ as-is)
- Uploaded photos: `/var/www/21bristoe-media/` (served at `/uploads/`, never wiped by deploy)

## Build & Deploy
```bash
npm run dev           # local dev server at localhost:4321
npm run build         # produces dist/
./deploy/deploy.sh    # build + backup + rsync + reload nginx
./deploy/validate.sh  # run 28-check validation suite
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
See plan: `docs/improvement-plan.md`

## Phase progress
- [x] Phase 0: Git setup ✓
- [x] Phase 1: Astro scaffolding ✓
- [x] Phase 2: Homepage UI build ✓ (all 7 sections + 404)
- [x] Phase 3: Content & personalization ✓ (placeholder assets; real photos TBD)
- [x] Phase 4: Infrastructure & SSL ✓
- [x] Phase 5: Endpoint validation & launch ✓ (28/28 checks passing)
- [x] Phase 6: Image admin panel + slideshow ✓
- [x] Phase 7: Admin panel security hardening ✓
- [x] Phase 8: Manifest safety & error handling ✓
- [x] Phase 9: Health check + expanded validation ✓ (31/31 checks)
- [x] Phase 10: Deploy script improvements ✓
- [x] Phase 11: CSP tightening + admin JS extraction ✓
- [x] Phase 12: SEO & structured data ✓
- [x] Phase A: Content enhancements ✓ (weather widget, sky strip, seasonal greetings, household cards, visitor guide)

## Image assets status
Placeholder images are in place (solid color PNGs). Replace with real photos:
- `public/og-image.png` → replace with a 1200×630 lifestyle/home photo
- `public/apple-touch-icon.png` → replace with real icon art
- `public/icon-192.png`, `public/icon-512.png` → replace with real icon art
- See `src/assets/images/IMAGES.md` for the full list of component images needed

## Image admin panel
- URL: `https://admin.21bristoe.com` ✓ SSL live
- Login: `faber` / (saved separately — change with: `sudo htpasswd /etc/nginx/.htpasswd-admin faber`)
- Service: `sudo systemctl status 21bristoe-admin`
- Uploads saved to: `/var/www/21bristoe-media/` (never wiped by `deploy.sh`)
- Served at: `https://21bristoe.com/uploads/`
- Features: drag-and-drop upload, reorder, delete — changes appear on homepage immediately
- Security (Phase 7): rate limiting (30 uploads/min, 60 API/min), shared-secret proxy auth
  (X-Admin-Auth must match ADMIN_SHARED_SECRET — anything that bypasses nginx is rejected,
  including local processes that try to spoof X-Forwarded-Proto), magic byte validation,
  global error handler, audit logging to journalctl
- View audit log: `sudo journalctl -u 21bristoe-admin --since "1 hour ago" | grep AUDIT`

### Provisioning the admin shared secret (one-time, per host)
```bash
SECRET=$(openssl rand -hex 32)
# 1. Express side — env file loaded by the systemd unit
echo "ADMIN_SHARED_SECRET=$SECRET" | sudo tee /etc/21bristoe-admin.env
sudo chmod 600 /etc/21bristoe-admin.env
sudo chown faber:faber /etc/21bristoe-admin.env
# 2. nginx side — included from admin.21bristoe.com.conf
printf 'proxy_set_header X-Admin-Auth "%s";\n' "$SECRET" | sudo tee /etc/nginx/admin-secret.conf
sudo chmod 600 /etc/nginx/admin-secret.conf
# 3. Reload both
sudo systemctl restart 21bristoe-admin && sudo nginx -t && sudo systemctl reload nginx
```
The admin server refuses to start in production without `ADMIN_SHARED_SECRET`.

## Build-time content (refreshed nightly)
The weather widget, sky strip, and seasonal greeting are computed at build time:
- **Weather**: Open-Meteo API (free, no key) — `src/components/WeatherCard.astro`
- **Sun/moon**: suncalc library, lat/lon 39.6576, -77.1763 — `src/components/SkyStrip.astro`
- **Seasonal note**: month-based logic in `src/components/Welcome.astro`
- **Nightly rebuild**: `sudo systemctl status 21bristoe-rebuild.timer` (fires 6am daily)
  - Install: `sudo cp deploy/21bristoe-rebuild.{service,timer} /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now 21bristoe-rebuild.timer`

## Site is LIVE
- https://21bristoe.com — serving the homepage
- SSL cert: Let's Encrypt, valid until 2026-07-11, auto-renews
- All 31 endpoint/SSL/security/redirect checks passing

## Deploy
```bash
./deploy/deploy.sh          # build + backup + rsync + reload nginx
./deploy/validate.sh        # run full validation suite
```

## SSL cert renewal
Managed automatically by certbot timer. Manual check:
```bash
sudo certbot renew --dry-run
sudo certbot certificates
```
