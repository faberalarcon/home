# Repository Guidelines

## Project Structure & Module Organization

`home` is the unified repo for the `21bristoe.com` domain. Home, Drink Hub, Stats, and Admin run from one root SvelteKit app in `src/`. Routes live in `src/routes/`: Home at `/`, Drink Hub under `/drinks/`, Stats under `/stats/`, and Admin under `/admin/`. Shared UI and server modules live in `src/lib/`, with app-specific modules under `src/lib/home`, `src/lib/drinks`, `src/lib/stats`, and `src/lib/admin`. Shared styling lives in `packages/bristoe-theme/` and `src/styles/`. Static files copied as-is live in `public/`. Deployment scripts and nginx config live in `deploy/`; generated output is `build/` and `.svelte-kit/`.

## Build, Test, and Development Commands

- `npm install` installs root workspace dependencies.
- `npm run dev` starts the unified SvelteKit app locally at `http://localhost:5173`.
- `npm run build` builds Home, Drink Hub, Stats, and Admin together.
- `npm run check` runs Svelte checks for the unified app.
- `npm run preview` previews the built site.
- `./deploy/validate.sh` runs production validation checks.
- `./deploy/deploy.sh` builds the unified app, rebuilds the `21bristoe-site` container, validates, and reloads nginx.

## Coding Style & Naming Conventions

Use Svelte components with two-space indentation and TypeScript where scripts already use it. Keep page files route-oriented in `src/routes/` and reusable UI in `src/lib/`. Follow the shared Tailwind 4 tokens in `packages/bristoe-theme/bristoe-theme.css`; names like `warm-*` and `sage-*` are semantic aliases and should not be renamed casually.

All UI changes must be optimized for mobile portrait viewing. Check narrow viewports for horizontal overflow, clipped controls, keyboard-safe composer behavior, and readable tap targets before considering the change complete.

## Testing Guidelines

There is no unit test suite. After any code or config change, run `npm run check` and `npm run build`, resolve every error, then smoke test affected pages locally with `npm run dev` or `npm run preview`. Run `./deploy/validate.sh` when deployment behavior, nginx config, admin behavior, or public routes change.

## Required Post-Change Workflow

For every code or config change, rebuild and verify before publishing: run the checks above, smoke test changed pages, redeploy with `./deploy/deploy.sh`, commit only touched files, and push with `git push origin main`. If any step fails, fix the root cause and repeat the workflow.

## Commit & Pull Request Guidelines

Recent commits use short, human-style messages with prefixes like `fix:`, `feat:`, and `docs:` when useful. Commit only after rebuild, checks, smoke tests, and redeploy succeed. PRs should summarize user-visible changes, list verification commands, link related issues when available, and include screenshots for layout or visual updates. Do not include AI attribution.

## Security & Configuration Tips

Never commit production secrets, uploaded media, or generated `build/`. The admin panel relies on nginx proxy auth, rate limiting, upload validation, and `ADMIN_SHARED_SECRET`; treat `src/lib/admin/`, `src/routes/admin/`, and `deploy/nginx/` edits as security-sensitive.
