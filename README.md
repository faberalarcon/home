# 21bristoe.com

Personal family homepage for 21 Bristoe St — Faber, Kasey, and Limón the golden retriever. Located in Meades Crossing, Taneytown, Maryland.

**Status:** Live in production at <https://21bristoe.com>. Admin panel at <https://admin.21bristoe.com>. See [`CLAUDE.md`](./CLAUDE.md) for the change-workflow and operational notes.

## Tech stack

- [Astro 6](https://astro.build) — static site generator
- [Tailwind CSS 4](https://tailwindcss.com) — styling
- nginx — web server (Raspberry Pi)
- Let's Encrypt — SSL

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Building

```bash
npm run build
# Output in dist/
```

## Deployment

Run the deploy script from the server:

```bash
./deploy/deploy.sh
```

This will:
1. Build the site (`npm run build`)
2. Create a timestamped backup of the current deployment
3. Sync `dist/` to `/var/www/21bristoe.com/`
4. Reload nginx

## Rollback

```bash
LATEST_BACKUP=$(ls -td /var/www/21bristoe.com.bak-* | head -1)
sudo rm -rf /var/www/21bristoe.com
sudo mv "$LATEST_BACKUP" /var/www/21bristoe.com
sudo systemctl reload nginx
```

## Production

- URL: https://21bristoe.com
- Server: Raspberry Pi at 192.168.1.177
- SSL: Let's Encrypt, auto-renewing via certbot
