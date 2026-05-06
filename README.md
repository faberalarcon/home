# 21bristoe.com

Unified SvelteKit repo for the 21 Bristoe household site. Home, Drink Hub, Stats, and the protected Admin panel now run from this repo and one Docker container.

**Canonical repo:** <https://github.com/faberalarcon/home>

## Live URLs

- Home: <https://21bristoe.com>
- Drink Hub: <https://21bristoe.com/drinks/>
- Stats: <https://21bristoe.com/stats/>
- Admin: <https://admin.21bristoe.com/admin/>

Legacy `drink-hub.21bristoe.com` and `stats.21bristoe.com` redirect to the canonical path URLs.

## Stack

- SvelteKit + Svelte 5
- Tailwind CSS 4
- Shared theme package: `packages/bristoe-theme`
- SQLite + Drizzle for Drink Hub
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

- Drink Hub SQLite/uploads: `/var/lib/21bristoe/drink-hub`
- Home/Admin media: `/var/www/21bristoe-media`
- Stats host data: `/var/lib/bristoe-stats`, `/var/lib/bristoe-backup`, `/mnt/usbbackup`
