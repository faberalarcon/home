# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security problems.

Report privately to **faberalarcon1@gmail.com** with:

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- any affected URL/route or component.

You can expect an acknowledgement within a few days. Once a fix is released the
report may be disclosed.

## Scope

This repo runs `21bristoe.com` (Home, Drinks, Stats) and the Tailscale-gated
Admin panel. The Admin surface is additionally protected by nginx proxy auth,
rate limiting, upload validation, and `ADMIN_SHARED_SECRET`. Reports touching
`src/lib/admin/`, `src/routes/admin/`, or `deploy/nginx/` are treated as
high priority.

## Automated checks

This repo runs CodeQL, Semgrep, Trivy, Gitleaks, npm-audit, zizmor, and OpenSSF
Scorecard via GitHub Actions, plus Dependabot updates. Findings surface in the
repository **Security** tab.
