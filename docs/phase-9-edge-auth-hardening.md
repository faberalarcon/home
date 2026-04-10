# Phase 9 — Edge Access & Authentication Hardening

**Status:** ✅ Done

## Goal

Harden the internet-facing entry points so the app is no longer relying on "people probably won't find it" as a defense. This phase focuses on nginx, HTTPS, login boundaries, and secret handling.

## Deliverables

### 1. Enforce HTTPS and correct proxy forwarding

- Redirect all HTTP traffic to HTTPS at nginx.
- Forward `X-Forwarded-Proto`, `X-Forwarded-Host`, and real client IP headers correctly.
- Confirm the app sees secure requests so auth cookies stay `Secure`.

Files:
- nginx site config
- `docker-compose.yml`
- `src/routes/admin/login/+page.server.ts`
- `src/routes/login/+page.server.ts`

Verify:
- `http://...` redirects to `https://...`
- login cookies are set with `Secure`
- app behavior is correct behind nginx TLS termination

Implemented in repo:
- env-backed adapter-node proxy header configuration in `docker-compose.yml`
- hardened nginx example in `deploy/nginx/drink-hub.conf.example`

### 2. Re-enable CSRF protection

- Remove the current relaxed LAN-only CSRF configuration.
- Replace deprecated `csrf.checkOrigin` usage with current trusted-origin config.
- Add the deployed domain(s) to the allowlist explicitly.

Files:
- `svelte.config.js`
- deployment docs

Verify:
- same-origin form posts still work
- cross-origin form submissions are rejected
- no false positives when accessed through nginx

Implemented in repo:
- `svelte.config.js` now uses `csrf.trustedOrigins`
- `Dockerfile` and `docker-compose.yml` pass `CSRF_TRUSTED_ORIGINS` at build time

### 3. Gate the whole site at the edge

- Add nginx HTTP Basic Auth in front of the site as a first-line shield.
- Keep the app-level shared-password login as the second layer.
- Exempt only health checks if needed.

Files:
- nginx site config
- deployment docs

Verify:
- anonymous browser gets the nginx auth prompt first
- valid edge auth + valid app session reaches the app
- `/api/health` remains reachable only if intentionally allowed

Implemented in repo:
- example nginx Basic Auth config checked in under `deploy/nginx/`
- app-level shared-password gate kept in place behind it

### 4. Remove weak admin defaults

- Stop bootstrapping `admin_pin_hash` to `1234`.
- Require an explicit admin credential to be set through env or one-time setup.
- Refuse to start with an insecure default in internet-exposed deployments.

Files:
- `src/hooks.server.ts`
- `src/lib/server/db/settings.ts`
- `README.md`
- `.env.example`

Verify:
- fresh deployment does not silently create a weak admin secret
- admin login only works after a real secret is configured

Implemented in repo:
- `src/hooks.server.ts` no longer bootstraps `1234`
- admin access now depends on `ADMIN_PIN` or `ADMIN_PIN_HASH`

### 5. Move all runtime secrets to env-backed configuration

- Keep shared-password and admin credentials out of tracked files.
- Document env-based setup only.
- Prefer hashed secrets over plaintext where practical.

Files:
- `.env.example`
- `README.md`
- `docker-compose.yml`

Verify:
- no real secrets appear in git-tracked files
- a fresh deployment can be configured from env alone

Implemented in repo:
- site password and admin PIN are env-backed only
- admin settings no longer writes secrets to the database
- `.env.example` and `scripts/hash-secret.mjs` document the setup path

## End-to-end verification

1. Reach the site over HTTP and confirm redirect to HTTPS.
2. Pass nginx auth, then hit `/menu` and confirm redirect to `/login`.
3. Log in successfully and place an order.
4. Clear cookies and confirm `/admin` still requires separate admin auth.
5. Review tracked files and confirm no live secrets are present.

## Smoke Test Snapshot

Validated on the deployed container after implementation:

- `GET /menu` returns `303` to `/login?next=%2Fmenu`
- same-origin shared-password login succeeds when forwarded host/proto headers are present
- same-origin admin PIN login succeeds when forwarded host/proto headers are present
- cross-origin login POST is rejected with `403`
- container starts cleanly with env-backed site/admin credentials

## Risks / decisions

- Decide whether nginx Basic Auth should stay permanently or only while the app remains low-traffic.
- Decide whether the admin secret should remain a PIN or move to a full password.
- Confirm the public hostname and certificate strategy before re-enabling strict CSRF/origin checks.
