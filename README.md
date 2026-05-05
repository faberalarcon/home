# 21bristoe.com

Unified site repo for 21 Bristoe St — Faber, Kasey, and Limón. The homepage, Drink Hub, and Stats are maintained here and served from one `21bristoe.com` domain.

**Status:** Live in production at <https://21bristoe.com>. Drink Hub is served at <https://21bristoe.com/drinks/> and Stats at <https://21bristoe.com/stats/>. Admin panel remains at <https://admin.21bristoe.com>. See [`CLAUDE.md`](./CLAUDE.md) for the change-workflow and operational notes.

## Tech stack

- [Astro 6](https://astro.build) — static homepage
- [SvelteKit](https://svelte.dev/docs/kit/introduction) — Drink Hub and Stats apps
- [Tailwind CSS 4](https://tailwindcss.com) — styling
- Docker Compose — app containers
- nginx — web server (Raspberry Pi)
- Let's Encrypt — SSL

## Local development

```bash
npm install
npm run dev             # homepage at http://localhost:4321
npm run dev:drink-hub  # Drink Hub at http://localhost:5173/drinks/
npm run dev:stats      # Stats at http://localhost:5174/stats/
```

The root package uses npm workspaces for `apps/*` and `packages/*`.

## Building

```bash
npm run build
npm run check
```

Homepage output goes to `dist/`; app output goes to each app's `build/`.

## Deployment

Run the deploy script from the server:

```bash
./deploy/deploy.sh
```

This will:
1. Build the homepage, Drink Hub, and Stats (`npm run build`)
2. Create a timestamped backup of the current deployment
3. Sync `dist/` to `/var/www/21bristoe.com/`
4. Create an untracked root `.env` from selected legacy app secrets if one does not already exist
5. Retire legacy Drink Hub and Stats containers, then rebuild them with root Docker Compose
6. Retire the old enabled Drink Hub and Stats vhosts into timestamped backups
7. Install the unified nginx config, reload nginx, and run validation

## Rollback

```bash
LATEST_BACKUP=$(ls -td /var/www/21bristoe.com.bak-* | head -1)
sudo rm -rf /var/www/21bristoe.com
sudo mv "$LATEST_BACKUP" /var/www/21bristoe.com
sudo systemctl reload nginx
```

## Production

- URL: https://21bristoe.com
- Drink Hub: https://21bristoe.com/drinks/
- Stats: https://21bristoe.com/stats/
- Server: Raspberry Pi at 192.168.1.177
- SSL: Let's Encrypt, auto-renewing via certbot
