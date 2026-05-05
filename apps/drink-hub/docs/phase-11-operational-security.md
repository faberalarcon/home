# Phase 11 — Operational Security, Monitoring & Container Hardening

**Status:** Complete

## Goal

Make the deployed service safer to operate over time. This phase covers container runtime hardening, monitoring, auditability, and recovery practices.

## Deliverables

### 1. Stop publishing the app container directly to the internet

- Put `drink-hub` on an internal Docker network behind nginx.
- Remove direct public exposure of the Node port where possible.
- Bind the app only to local/internal networking.

Files:
- `docker-compose.yml`
- nginx deployment config

Verify:
- app is reachable through nginx
- app is not reachable directly from the public internet on its container port

### 2. Harden the container runtime

- Run as a non-root user.
- Use a read-only root filesystem if practical.
- Mount only the writable data directory as writable.
- Review Linux capabilities and drop unnecessary ones.

Files:
- `Dockerfile`
- `docker-compose.yml`

Verify:
- container still starts and writes only where expected
- uploads and database operations still work

### 3. Add security-focused HTTP headers

- Set:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - HSTS once HTTPS is stable

Files:
- nginx site config
- optionally `src/hooks.server.ts` for app-set headers

Verify:
- headers appear on page and API responses
- CSP does not break the current app

### 4. Add access and auth failure logging

- Log failed site login attempts.
- Log failed admin login attempts.
- Log rate-limit events and blocked requests.
- Keep logs actionable but avoid storing plaintext secrets.

Files:
- `src/routes/login/+page.server.ts`
- `src/routes/admin/login/+page.server.ts`
- `src/lib/server/ratelimit.ts`
- deployment logging config

Verify:
- auth failures appear in logs with timestamp and client source info
- passwords are never logged

### 5. Add operational runbooks for recovery and review

- Document:
  - rotating the shared password
  - rotating the admin credential
  - reviewing auth/rate-limit logs
  - recovering from suspected abuse
  - restoring from backup after compromise

Files:
- `docs/troubleshooting.md`
- `docs/backup-restore.md`
- new security operations doc if needed

Verify:
- another person can follow the docs without tribal knowledge

### 6. Review dependency and image hygiene

- Pin or review base image update cadence.
- Run `npm audit` and triage the current high severity issue.
- Document which findings are accepted vs. fixed.

Files:
- `Dockerfile`
- `package.json`
- security docs

Verify:
- known dependency risk is documented or fixed
- image rebuild path remains reproducible

## End-to-end verification

1. Confirm the app is only reachable through nginx.
2. Confirm expected security headers are present.
3. Trigger failed logins and rate limits, then review logs.
4. Rotate the shared password using the documented procedure and verify the old one stops working.

## Risks / decisions

- Read-only container filesystems can require small app changes for temp files or native libs.
- CSP should be introduced carefully to avoid breaking SvelteKit assets or future integrations.
- If logs are retained long-term, decide where they live and who can read them.
