# Repository Guidelines

## Project Structure & Module Organization

`drink-hub` is a SvelteKit 2 / Svelte 5 app for drink ordering. Application code lives in `src/`: routes in `src/routes/`, reusable client code in `src/lib/`, and server-only logic in `src/lib/server/`. Database schema and migrations are in `src/lib/server/db/`, `drizzle/`, and `drizzle.config.ts`. Static assets are in `static/`; deployment and nginx examples are in `deploy/`; operational notes live in `docs/`. Runtime SQLite data and uploads live under `data/` and should not be committed.

## Build, Test, and Development Commands

- `npm install` installs npm dependencies from `package-lock.json`.
- `npm run dev` starts Vite on `0.0.0.0:5173`.
- `npm run check` runs `svelte-kit sync` and `svelte-check`.
- `npm run build` builds the production app.
- `npm run start` runs `node build/index.js`.
- `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed` manage Drizzle migrations and seed data.
- `npm run validate:local` validates local public routes, auth gates, health JSON, and headers.
- `npm run validate` validates production routes, auth gates, HTTPS, SSL, health, and headers.
- `docker compose up -d --build` rebuilds and restarts the production-style container.

## Coding Style & Naming Conventions

Use TypeScript, Svelte components, and two-space indentation. Keep server-only code under `src/lib/server/`; expose route handlers through SvelteKit `+server.ts` and page data through `+page.server.ts`. Match existing CSS custom properties and Tailwind utility usage in `src/app.css` and components. Name routes with SvelteKit file conventions and helper modules with clear kebab-case or lower-case names.

## Testing Guidelines

There is no dedicated test runner. After any code or config change, run `npm run check` and `npm run build`, resolve every error, then smoke test affected pages or APIs locally. Run `npm run validate:local` when a local server is running and `npm run validate` after redeploy. For schema changes, generate migrations and verify `npm run db:migrate` against a disposable or backed-up database.

## Required Post-Change Workflow

For every code or config change, rebuild and verify before publishing: run the checks above, smoke test the changed behavior, redeploy with `docker compose up -d --build`, run `npm run validate`, commit only touched files, and push with `git push origin main`. If any step fails, fix the root cause and repeat the workflow.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, often `fix:`, `feat:`, `docs:`, or `style:`. Commit only after rebuild, checks, smoke tests, and redeploy succeed. Include what changed, how it was verified, and screenshots for visible UI changes. Do not include AI attribution.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local secrets. Never commit `.env`, `data/*.db`, uploads, or backup files. Treat auth, CSRF, rate limiting, Home Assistant URLs, and upload validation as security-sensitive paths.
