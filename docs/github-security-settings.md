# GitHub security settings checklist

These are repository **settings**, not files — they cannot be committed. Run
them once after the CI/bots PR merges. All are free on this public repo.

## One-shot CLI (requires `gh auth login` with admin scope)

```bash
# Secret scanning + push protection (blocks pushes that contain known secrets)
gh api -X PATCH repos/faberalarcon/home \
  -f 'security_and_analysis[secret_scanning][status]=enabled' \
  -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'

# Dependabot security updates (auto-PRs that fix vulnerable deps)
gh api -X PUT repos/faberalarcon/home/automated-security-fixes

# Dependabot vulnerability alerts (prerequisite for the above)
gh api -X PUT repos/faberalarcon/home/vulnerability-alerts
```

## Verify in the UI

Settings → **Code security**:

- [ ] Dependabot alerts — **on** (already implied by `.github/dependabot.yml`)
- [ ] Dependabot security updates — **on**
- [ ] Secret scanning — **on**
- [ ] Push protection — **on**
- [ ] Code scanning shows CodeQL + Semgrep + Trivy + Scorecard + zizmor results

## Optional: branch protection on `main`

Not enforced by default — current workflow is solo direct-push to `main`, where
`ci.yml` still catches regressions (just after the push, not before). If you
move to a PR flow, require the `ci / check + build` status check:

```bash
gh api -X PUT repos/faberalarcon/home/branches/main/protection \
  -F 'required_status_checks[strict]=true' \
  -F 'required_status_checks[contexts][]=check + build' \
  -F 'enforce_admins=false' \
  -F 'required_pull_request_reviews=' \
  -F 'restrictions='
```
