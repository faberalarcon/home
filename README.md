# 21bristoe.com

Unified SvelteKit repo for the 21 Bristoe household site. Home, Drinks, Stats, and the protected Admin panel now run from this repo and one Docker container.

**Canonical repo:** <https://github.com/faberalarcon/home>

## Live URLs

- Home: <https://21bristoe.com>
- Drinks: <https://21bristoe.com/drinks/>
- Stats: <https://21bristoe.com/stats/>
- Admin: <https://admin.21bristoe.com/admin/>

Legacy `stats.21bristoe.com` redirects to the canonical path URL.

## Stack

- SvelteKit + Svelte 5
- Tailwind CSS 4
- Shared theme package: `packages/bristoe-theme`
- SQLite + Drizzle for Drinks
- Docker Compose, nginx, Let's Encrypt

## Development

```bash
npm install
npm run dev
```

Local routes:

- `http://localhost:5173/`
- `http://localhost:5173/drinks/`
- `http://localhost:5173/stats/`
- `http://localhost:5173/admin/`

## Build And Validate

```bash
npm run check
npm run build
npm run preview
VALIDATE_BASE=http://localhost:4173 ./deploy/validate.sh --local
```

## Deployment

```bash
./deploy/deploy.sh
```

The deploy script builds the unified SvelteKit app, prepares existing data directories, rebuilds the `21bristoe-site` container, installs nginx configs, retires legacy app containers/admin service, reloads nginx, and runs validation.

Production data remains outside the repo:

- Drinks SQLite/uploads: `/var/lib/21bristoe/drink-hub`
- Home/Admin media: `/var/www/21bristoe-media`
- Stats host data: `/var/lib/bristoe-stats`, `/var/lib/bristoe-backup`, `/mnt/usbbackup`
