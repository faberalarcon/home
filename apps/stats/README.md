# 21 Bristoe Stats

Household dashboard for 21 Bristoe Station Rd, Taneytown MD.

A read-only stats dashboard pulling data from Home Assistant, Drink Hub, weather APIs, and generating fun household stats.

**Status:** Live in production at <https://21bristoe.com/stats/> from the unified `home` repo. The legacy `stats.21bristoe.com` host redirects here.

## Stack

- SvelteKit + adapter-node (SSR)
- Tailwind CSS 4
- Chart.js 4 + svelte-chartjs
- Docker + nginx reverse proxy

## Data Sources

- **Home Assistant** — climate, TVs, Xbox, security, network
- **Drink Hub** — order stats, leaderboards, trends
- **Open-Meteo** — Taneytown weather data
- **Generated** — Limón the golden retriever's stats

## Development

```bash
npm install
npm run dev    # http://localhost:5174/stats/
```

The SvelteKit base path defaults to `/stats`; override with `BASE_PATH` only for unusual local testing.

## Validation

```bash
npm run validate:local  # against http://localhost:5174/stats
npm run validate        # against https://21bristoe.com/stats
```

The validation script checks the main dashboard routes, `/api/health` JSON, security headers, and production HTTPS/SSL behavior.
Set `VALIDATE_BASE=http://127.0.0.1:<port>/stats` when validating a server on a non-default local port.

## Deploy

```bash
cd /home/faber/projects/home
./deploy/deploy.sh
```

## Environment

Copy `.env.example` to `.env` and fill in values. See `.env.example` for available variables.
