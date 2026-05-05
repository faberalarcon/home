# Repository Guidelines

## Project Structure & Module Organization

`stats` is a read-only SvelteKit dashboard for household metrics. Source files are in `src/`: page routes under `src/routes/`, shared UI components under `src/lib/components/`, and server data clients under `src/lib/server/`. Static fonts live in `static/fonts/`. Deployment assets are under `deploy/`, including nginx config, backup scripts, and Pi metrics systemd units. Build output is generated in `build/` and should not be edited.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` starts Vite on `0.0.0.0:5174`.
- `npm run check` runs `svelte-kit sync` and `svelte-check`.
- `npm run build` creates the production build.
- `npm run preview` serves the built app with Vite preview.
- `npm run start` runs the adapter-node build with `node build/index.js`.
- `npm run validate:local` validates local routes, health JSON, and headers.
- `npm run validate` validates production routes, HTTPS, SSL, health, and headers.
- `docker compose build && docker compose up -d` rebuilds and restarts the container.

## Coding Style & Naming Conventions

Use TypeScript and Svelte 5 patterns already present in `src/routes` and `src/lib`. Indent with two spaces. Put reusable visual elements in `src/lib/components/` and external data access in `src/lib/server/`. Keep route names short and descriptive, such as `drinks`, `pi`, and `backups`. Reuse existing chart and dashboard components before adding new ones.

## Testing Guidelines

There is no separate unit test suite. After any code or config change, run `npm run check` and `npm run build`, resolve every error, then smoke test affected routes, especially `/`, `/house`, `/drinks`, `/visitors`, `/pi`, and `/backups`, depending on the changed data source. Run `npm run validate:local` when a local server is running and `npm run validate` after redeploy.

## Required Post-Change Workflow

For every code or config change, rebuild and verify before publishing: run the checks above, smoke test changed routes, redeploy with `docker compose build && docker compose up -d`, run `npm run validate`, commit only touched files, and push with `git push origin main`. If any step fails, fix the root cause and repeat the workflow.

## Commit & Pull Request Guidelines

Commit history uses concise human-written subjects, sometimes with prefixes such as `fix:`, `style:`, or `docs:`. Commit only after rebuild, checks, smoke tests, and redeploy succeed. PRs should state the changed dashboard behavior, affected routes, verification commands, and include screenshots for visual changes. Do not add AI attribution.

## Security & Configuration Tips

Use `.env.example` as the source for required environment variables. Do not commit `.env`, generated `build/`, or local metric artifacts. Be careful with Home Assistant, weather, visitor, backup, and Drink Hub integrations because failures should degrade gracefully in the dashboard.
