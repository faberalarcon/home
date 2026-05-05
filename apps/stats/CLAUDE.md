# Claude Code instructions for this repo

## Change workflow (always)

Every code change in this repo follows this cycle — no exceptions:

1. **Smoke test locally**: `npm run dev` (port 5174) or `npm run build && PORT=5180 node build`. Curl affected routes (`/`, `/house`, `/drinks`, `/visitors`, `/backups`, `/pi`, `/house?range=1d|7d|30d|90d`) and grep for markers of the change. Run `npm run validate:local` when a local server is running.
2. **Rebuild**: `npm run build` — must succeed before any commit. Run `npx svelte-check --tsconfig ./tsconfig.json` and confirm no new errors.
3. **Redeploy**: `docker compose build && docker compose up -d` — rebuilds the production image and recreates the `21bristoe-stats` container. Run `npm run validate` and verify with `curl -sIk https://stats.21bristoe.com/`.
4. **Commit**: stage only files you touched; use a conventional, human-style message (see existing `git log --oneline`). **No Claude / AI attribution** (see Commit attribution section below).
5. **Push**: `git push origin main`.

If any step fails, fix the root cause and restart the cycle. Do not skip steps or batch changes across cycles.

## Commit attribution

**Do not add any Claude / AI attribution to commits in this repository.**

Specifically:
- Do **not** add `Co-Authored-By: Claude ...` trailers to commit messages.
- Do **not** add `🤖 Generated with [Claude Code]...` footers to commits or pull request bodies.
- Do **not** mention Claude, Anthropic, or any AI tool in commit messages or PR descriptions.

Commits should look like a human wrote them. The user (faberalarcon) is the sole author of record.

This applies to every commit and PR, no exceptions.
