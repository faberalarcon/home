# Repository Guidelines

## Project Structure & Module Organization

`home` is the Astro 6 static site for `21bristoe.com`. Main source is in `src/`: pages in `src/pages/`, shared layouts in `src/layouts/`, Astro components in `src/components/`, scripts in `src/scripts/`, and global styles in `src/styles/`. Static files copied as-is live in `public/`. The upload admin app is in `admin/` with Express server code and public assets. Deployment scripts, nginx config, and systemd units are in `deploy/`; generated output is `dist/`.

## Build, Test, and Development Commands

- `npm install` installs root site dependencies.
- `npm run dev` starts Astro locally at `http://localhost:4321`.
- `npm run build` generates the static site in `dist/`.
- `npm run preview` previews the built site.
- `cd admin && npm install` installs admin app dependencies.
- `cd admin && npm run dev` runs the admin server with `node --watch`.
- `./deploy/validate.sh` runs production validation checks.
- `./deploy/deploy.sh` builds, backs up, syncs, validates, and reloads nginx.

## Coding Style & Naming Conventions

Use Astro components with two-space indentation and TypeScript where scripts already use it. Keep page files route-oriented in `src/pages/` and reusable UI in `src/components/`. Follow existing Tailwind 4 token names in `src/styles/global.css`; names like `warm-*` and `sage-*` are semantic and should not be renamed casually.

## Testing Guidelines

There is no unit test suite. After any code or config change, run `npm run build`, resolve every error, then smoke test affected pages locally with `npm run dev` or `npm run preview`. Run `./deploy/validate.sh` when deployment behavior, nginx config, admin behavior, or public routes change.

## Required Post-Change Workflow

For every code or config change, rebuild and verify before publishing: run the checks above, smoke test changed pages, redeploy with `./deploy/deploy.sh`, commit only touched files, and push with `git push origin main`. If any step fails, fix the root cause and repeat the workflow.

## Commit & Pull Request Guidelines

Recent commits use short, human-style messages with prefixes like `fix:`, `feat:`, and `docs:` when useful. Commit only after rebuild, checks, smoke tests, and redeploy succeed. PRs should summarize user-visible changes, list verification commands, link related issues when available, and include screenshots for layout or visual updates. Do not include AI attribution.

## Security & Configuration Tips

Never commit production secrets, uploaded media, or generated `dist/`. The admin panel relies on nginx proxy auth, rate limiting, upload validation, and `ADMIN_SHARED_SECRET`; treat `admin/` and `deploy/nginx/` edits as security-sensitive.
