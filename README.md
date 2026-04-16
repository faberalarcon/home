# 21 Bristoe Stats

Household dashboard for 21 Bristoe Station Rd, Taneytown MD.

A read-only stats dashboard pulling data from Home Assistant, Drink Hub, weather APIs, and generating fun household stats.

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
npm run dev    # http://localhost:5174
```

## Deploy

```bash
docker compose build
docker compose up -d
```

## Environment

Copy `.env.example` to `.env` and fill in values. See `.env.example` for available variables.
