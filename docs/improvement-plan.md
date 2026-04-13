# 21bristoe.com — Improvement & Hardening Plan

**Created:** 2026-04-12
**Status:** Planned — not yet started

## Context
The site is live and stable (28/28 validation checks passing). The admin panel is the only writable surface — it accepts image uploads and modifies `manifest.json`. While current security is good (HTTPS, basic auth, filename sanitization, Sharp re-encoding), there are defense-in-depth gaps and code quality improvements worth making. This plan covers all four categories: security, infrastructure, code quality, and SEO/enhancements.

**Non-breaking guarantee:** Each phase builds, deploys, validates, updates docs, and commits/pushes independently. No phase depends on another (though some pair naturally).

---

## Audit Summary

### What's working well
- **Security posture:** HTTPS everywhere, HSTS, CSP, X-Frame-Options DENY, basic auth on admin
- **File upload safety:** MIME type filtering, filename sanitization (`[a-zA-Z0-9_-]` only), Sharp re-encoding strips malicious payloads
- **Path traversal prevention:** `path.basename()` used on all user-supplied filenames
- **Accessibility:** 37+ ARIA attributes, skip-to-content, focus-visible, prefers-reduced-motion
- **Performance:** Zero client JS (except slideshow), static output, hashed assets with 1-year cache
- **Deploy safety:** `set -euo pipefail`, backups, nginx config test before reload

### Issues found
| Issue | Severity | Location |
|-------|----------|----------|
| No rate limiting on admin API | Medium | `admin/server.js` |
| No Express-level auth (relies only on nginx) | Medium | `admin/server.js` |
| No error handling middleware (could leak stack traces) | Medium | `admin/server.js` |
| MIME type is client-provided, no magic byte check | Low | `admin/server.js:22` |
| No audit logging of admin actions | Low | `admin/server.js` |
| Manifest race condition (no file locking) | Medium | `admin/server.js:32-43` |
| Non-atomic manifest writes | Low | `admin/server.js:42` |
| Silent error swallowing on file delete | Low | `admin/server.js:110` |
| Inline `onclick` handlers (fragile XSS pattern) | Low | `admin/public/index.html:305-306` |
| CSP uses `'unsafe-inline'` for script-src and style-src | Medium | `deploy/nginx/21bristoe.com.ssl.conf:48` |
| No health check endpoint for monitoring | Low | `admin/server.js` |
| Validation suite doesn't check admin panel | Low | `deploy/validate.sh` |
| No automated rollback in deploy script | Low | `deploy/deploy.sh` |
| No backup rotation (SD card fill risk) | Low | `deploy/deploy.sh` |
| Missing `interest-cohort=()` in Permissions-Policy | Low | `deploy/nginx/21bristoe.com.ssl.conf` |

---

## Phase 7: Admin Panel Security Hardening
**Category:** Security | **Complexity:** Medium | **Impact:** High

Harden the only writable attack surface on the Pi.

### Changes
1. **Rate limiting** — Add `express-rate-limit` (in-memory, fine for single-user). 30 req/min on upload, 60 req/min on other API routes.
2. **Express-level auth guard** — Check for an `X-Admin-Token` header (value from env var) as defense-in-depth. If nginx basic auth is ever bypassed, Express still rejects requests.
3. **Global error handler** — Catch-all `(err, req, res, next)` middleware that returns generic JSON and never leaks stack traces.
4. **File magic byte validation** — Before Sharp processing, verify first bytes match JPEG/PNG/GIF/WebP signatures. Reject mismatches.
5. **Audit logging** — Log upload/delete/reorder actions to stdout (captured by journalctl). Format: `[AUDIT] action=upload file=photo.jpg ip=1.2.3.4`

### Files to modify
- `admin/server.js` — rate limiter, auth middleware, error handler, magic byte check, audit lines
- `admin/package.json` — add `express-rate-limit`
- `deploy/nginx/admin.21bristoe.com.conf` — pass `X-Admin-Token` header to proxy
- `deploy/21bristoe-admin.service` — add `ADMIN_TOKEN` env var
- `CLAUDE.md` — document new env var and security features

### Verification
- `cd admin && npm install && node -c server.js` (syntax check)
- Admin panel still works: upload, delete, reorder
- Upload a `.txt` file renamed to `.jpg` → rejected with error
- Rapid-fire curl → 429 after limit hit
- `sudo journalctl -u 21bristoe-admin --since "5 min ago"` shows audit entries
- `npm run build && ./deploy/validate.sh` — all checks pass

---

## Phase 8: Manifest Safety & Error Handling
**Category:** Code quality | **Complexity:** Small | **Impact:** Medium

Prevent data loss from concurrent manifest writes and fix silent error swallowing.

### Changes
1. **Atomic manifest writes** — Write to `manifest.json.tmp` then `fs.renameSync()` to `manifest.json` (atomic on Linux).
2. **Simple file lock** — Use `mkdir`-based lock (no dependencies) around read-modify-write operations via `withManifestLock(fn)` helper.
3. **Fix silent delete errors** — Log `fs.unlinkSync` failures to `console.warn` and include `fileRemoved: true/false` in API response.

### Files to modify
- `admin/server.js` — atomic write helper, lock helper, delete error handling

### Verification
- Upload multiple files simultaneously → manifest.json is valid, all entries present
- Delete an already-removed image → response includes `fileRemoved: false`, warning logged
- `cat /var/www/21bristoe-media/manifest.json` is valid JSON after all operations
- `npm run build && ./deploy/validate.sh` — all checks pass

---

## Phase 9: Health Check + Expanded Validation Suite
**Category:** Infrastructure | **Complexity:** Small | **Impact:** Medium

Add monitoring capability and catch admin regressions in validation.

### Changes
1. **Health endpoint** — `GET /api/health` returns `{ status: "ok", uptime, imageCount, manifestValid }`. Exempt from auth token check (but still behind nginx basic auth).
2. **Admin validation checks** — Add ~5 checks to `validate.sh`:
   - `admin.21bristoe.com` returns 401 without credentials (auth active)
   - `/uploads/manifest.json` returns valid JSON
   - Systemd service `21bristoe-admin` is active
   - Upload directory exists and is writable
   - Manifest image count > 0 (warning, not failure, if empty)

### Files to modify
- `admin/server.js` — add `/api/health` route (~10 lines)
- `deploy/validate.sh` — add admin checks section (~25 lines)
- `CLAUDE.md` — update check count in docs

### Verification
- `curl https://admin.21bristoe.com/api/health` (with creds) → JSON with status "ok"
- `curl -so /dev/null -w '%{http_code}' https://admin.21bristoe.com/api/health` (no creds) → 401
- `./deploy/validate.sh` reports ~33 checks, all pass

---

## Phase 10: Deploy Script Improvements
**Category:** Infrastructure | **Complexity:** Small | **Impact:** Medium

Automate rollback and add safety gates.

### Changes
1. **`--rollback` flag** — Find most recent `.bak-*` directory, swap it into place, reload nginx.
2. **Post-deploy validation gate** — After rsync + reload, auto-run `validate.sh`. Print prominent warning on failure.
3. **Backup rotation** — Keep only the 3 most recent backups, remove older ones to save SD card space.

### Files to modify
- `deploy/deploy.sh` — rollback flag, validation gate, backup rotation (~40 lines added)
- `CLAUDE.md` — document `--rollback` flag

### Verification
- `./deploy/deploy.sh` now runs validation after deploy
- `./deploy/deploy.sh --rollback` restores previous version
- After 4+ deploys, only 3 `.bak-*` directories remain

---

## Phase 11: CSP Tightening + Admin JS Extraction
**Category:** Security + Code quality | **Complexity:** Medium | **Impact:** Medium

Remove `unsafe-inline` from CSP where possible. Extract admin inline JS for cleaner code.

### Changes
1. **Main site script-src** — The slideshow emits an inline `<script type="module">` in the built HTML. Since its content is static, compute its SHA-256 hash and use `'sha256-XXXX'` in `script-src`, replacing `'unsafe-inline'`. (If Astro can be configured to emit it externally, `'self'` alone works.)
2. **Main site style-src** — Verify Tailwind 4 uses `<link>` tags in built output. If no inline `<style>` blocks exist, `style-src 'self'` suffices. If Astro injects inline styles, compute hashes.
3. **Extract admin inline JS** — Move the ~200 lines of JS from `admin/public/index.html` into `admin/public/admin.js`. Replace inline `onclick` handlers with event delegation (single click listener on grid, reads `data-filename` attribute).
4. **Update admin CSP** — Remove `'unsafe-inline'` from admin nginx config.
5. **Permissions-Policy** — Add `interest-cohort=()` for FLoC opt-out.

### Files to modify
- `deploy/nginx/21bristoe.com.ssl.conf` — CSP with hash, Permissions-Policy
- `deploy/nginx/admin.21bristoe.com.conf` — CSP without unsafe-inline
- `admin/public/index.html` — remove inline script, add `<script src="admin.js">`
- `admin/public/admin.js` — new file, extracted + refactored JS with event delegation
- `CLAUDE.md` — document CSP approach

### Verification
- `npm run build` succeeds
- Browser DevTools Console on https://21bristoe.com — zero CSP violation errors
- Admin panel works: upload, delete, reorder, drag-and-drop
- `curl -sI https://21bristoe.com/ | grep content-security-policy` — no `unsafe-inline`
- `./deploy/validate.sh` — all checks pass

---

## Phase 12: SEO & Structured Data
**Category:** Enhancement | **Complexity:** Small | **Impact:** Low

Polish search appearance for local queries.

### Changes
1. **Enhanced JSON-LD** — Add `Place` schema with address (21 Bristoe St, Taneytown, MD 21787), and `Person` entities for household members.
2. **WebPage schema** — Add `mainEntity` pointing to the Place.
3. **Review meta description** — Ensure it's optimized for "21 Bristoe St Taneytown" local searches.

### Files to modify
- `src/layouts/BaseLayout.astro` — enhanced JSON-LD block
- `CLAUDE.md` — note structured data additions

### Verification
- `npm run build` succeeds
- Check `dist/index.html` contains valid JSON-LD with Place schema
- `./deploy/validate.sh` — all checks pass
- Paste URL into Google Rich Results Test (manual) — no errors

---

## Summary

| Phase | Name | Category | Impact | Complexity | Status |
|-------|------|----------|--------|------------|--------|
| 7 | Admin security hardening | Security | High | Medium | Done ✓ |
| 8 | Manifest safety | Code quality | Medium | Small | Done ✓ |
| 9 | Health check + validation | Infrastructure | Medium | Small | Planned |
| 10 | Deploy improvements | Infrastructure | Medium | Small | Planned |
| 11 | CSP + admin JS extraction | Security + Code | Medium | Medium | Planned |
| 12 | SEO structured data | Enhancement | Low | Small | Planned |

**Workflow per phase:** implement → build → deploy → validate → update docs → commit → push
