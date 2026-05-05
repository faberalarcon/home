# Claude Code instructions for this repo

## Change workflow (always)

Every code change in this repo follows this cycle — no exceptions:

1. **Smoke test locally**: `npm run dev` (or `npm run build && npm start`), exercise affected pages under `/drinks/`, grep for markers of the change. Run `npm run validate:local` when a local server is running.
2. **Rebuild**: `npm run build` — must succeed before any commit.
3. **Redeploy**: from the unified repo root, run `./deploy/deploy.sh` — rebuilds the container image, restarts the service, installs nginx config, and runs validation.
4. **Commit**: stage only files you touched; use a conventional, human-style message (see existing `git log --oneline`).
5. **Push**: `git push origin main`.

If any step fails, fix the root cause and restart the cycle. Do not skip steps or batch changes across cycles.

## Deployment context

Drink Hub now lives at `apps/drink-hub/` inside the `home` repo and is canonically served at `https://21bristoe.com/drinks/`. Use `src/lib/app-paths.ts` for links, form actions, uploads, redirects, and client fetches that must include the SvelteKit base path. The old `drink-hub.21bristoe.com` host should redirect to `/drinks/`.

## Commit attribution

**Do not add any Claude / AI attribution to commits in this repository.**

Specifically:
- Do **not** add `Co-Authored-By: Claude ...` trailers to commit messages.
- Do **not** add `🤖 Generated with [Claude Code]...` footers to commits or pull request bodies.
- Do **not** mention Claude, Anthropic, or any AI tool in commit messages or PR descriptions.

Commits should look like a human wrote them. The user (faberalarcon) is the sole author of record.

This applies to every commit and PR, no exceptions.
