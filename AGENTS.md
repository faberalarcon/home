# Repository Guidelines

## Project Structure & Module Organization

`home` is the unified repo for the `21bristoe.com` domain. The Astro 6 homepage lives in `src/`: pages in `src/pages/`, shared layouts in `src/layouts/`, Astro components in `src/components/`, scripts in `src/scripts/`, and global styles in `src/styles/`. Drink Hub lives in `apps/drink-hub/` and is served at `/drinks/`. Stats lives in `apps/stats/` and is served at `/stats/`. Shared styling lives in `packages/bristoe-theme/`. Static files copied as-is live in `public/`. The upload admin app is in `admin/` with Express server code and public assets. Deployment scripts, nginx config, and systemd units are in `deploy/`; generated output is `dist/`, `apps/*/build/`, and `apps/*/.svelte-kit/`.

## Build, Test, and Development Commands

- `npm install` installs root workspace dependencies.
- `npm run dev` starts the Astro homepage locally at `http://localhost:4321`.
- `npm run dev:drink-hub` starts Drink Hub locally at `http://localhost:5173/drinks/`.
- `npm run dev:stats` starts Stats locally at `http://localhost:5174/stats/`.
- `npm run build` builds the homepage, Drink Hub, and Stats.
- `npm run check` runs Svelte checks for Drink Hub and Stats.
- `npm run preview` previews the built site.
- `cd admin && npm install` installs admin app dependencies.
- `cd admin && npm run dev` runs the admin server with `node --watch`.
- `./deploy/validate.sh` runs production validation checks.
- `./deploy/deploy.sh` builds all three public apps, backs up, syncs, rebuilds app containers, validates, and reloads nginx.

## Coding Style & Naming Conventions

Use Astro/Svelte components with two-space indentation and TypeScript where scripts already use it. Keep page files route-oriented in `src/pages/` or `apps/*/src/routes/` and reusable UI in `src/components/` or `apps/*/src/lib/components/`. Follow the shared Tailwind 4 tokens in `packages/bristoe-theme/bristoe-theme.css`; names like `warm-*` and `sage-*` are semantic aliases and should not be renamed casually.

## Testing Guidelines

There is no unit test suite. After any code or config change, run `npm run build`, resolve every error, then smoke test affected pages locally with `npm run dev`, `npm run dev:drink-hub`, `npm run dev:stats`, or `npm run preview`. Run `npm run check` when changing either SvelteKit app. Run `./deploy/validate.sh` when deployment behavior, nginx config, admin behavior, or public routes change.

## Required Post-Change Workflow

For every code or config change, rebuild and verify before publishing: run the checks above, smoke test changed pages, redeploy with `./deploy/deploy.sh`, commit only touched files, and push with `git push origin main`. If any step fails, fix the root cause and repeat the workflow.

## Commit & Pull Request Guidelines

Recent commits use short, human-style messages with prefixes like `fix:`, `feat:`, and `docs:` when useful. Commit only after rebuild, checks, smoke tests, and redeploy succeed. PRs should summarize user-visible changes, list verification commands, link related issues when available, and include screenshots for layout or visual updates. Do not include AI attribution.

## Security & Configuration Tips

Never commit production secrets, uploaded media, or generated `dist/`. The admin panel relies on nginx proxy auth, rate limiting, upload validation, and `ADMIN_SHARED_SECRET`; treat `admin/` and `deploy/nginx/` edits as security-sensitive.
