# Security posture — 21bristoe.com

Audit 2026-06-03. Single-tenant private site (Raspberry Pi `192.168.1.177`),
admin behind Tailscale + nginx basic-auth + `X-Admin-Auth`.

## Defensive baseline (verified good)

Parameterized Drizzle/better-sqlite3 (no raw SQL) · DOMPurify on all `{@html}`
markdown · path-traversal guards (`resolve` + prefix check) · SSRF allowlist
with pinned-DNS dispatcher + private-range block · open-redirect normalization ·
`timingSafeEqual` everywhere · scrypt hashing · CSRF on · HttpOnly/Secure/
SameSite cookies · rate-limiting + DB-backed admin login backoff · HSTS/CSP/
XFO/nosniff headers. No SQLi / XSS / command-injection / IDOR found.

## Fixed in this pass

- **Dependencies**: bumped `svelte` (SSR XSS chain) + `devalue` (DoS) — prod
  `npm audit --omit=dev` is now clean. Remaining 7 `npm audit` items are
  dev-only toolchain (esbuild via drizzle-kit), not production-reachable.
- **DB file perms**: `data/*.db*` set to `0600`; DB init (`src/lib/drinks/
  server/db/index.ts`, `src/lib/gooby/db.ts`) now `chmod 600` at runtime so
  prod files + WAL/SHM sidecars stay owner-only.
- **CSP**: migrated to nonce-based; `'unsafe-inline'` removed from `script-src`.
- **CI**: Semgrep + Gitleaks + Trivy + `npm audit` workflow + Dependabot.

## Accepted risks (owner decision — intentionally NOT changed)

- **`?pw=` in URL** (`src/hooks.server.ts`): site password rides the login
  redirect to power QR-code deep links into the gooby/drinks gates. Kept by
  design. Residual: password appears in nginx access logs / browser history.
  Optional hardening: drop `$query_string` from the nginx log_format on gated
  paths, or swap the raw password for a rotating link-token.
- **Public `/stats/visitors` geo dashboard**: city-level lat/long + counts are
  public. Visitor IPs are already hashed (`sha256(ip+ua)`). Kept by design.

## Owner action items (infra / off-box — cannot be done in-repo)

- [ ] **Rotate `HA_TOKEN`** to a shorter-lived token (current JWT exp = 2036).
- [ ] **Encrypt `/mnt/usbbackup`** (LUKS) — `deploy/backup/backup.sh` rsyncs all
      of `/home/faber` incl. `.env` + DBs to the USB drive. `rsync -a` preserves
      the `0600` perms, but the drive itself is plaintext → physical-theft risk.
