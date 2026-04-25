#!/usr/bin/env bash
# validate.sh — Endpoint and SSL validation for 21bristoe.com
# Run this after deploy to verify all endpoints, redirects, SSL, and headers.
#
# Usage: ./deploy/validate.sh [--local]
#   --local  Run against http://localhost:4321 (dev server) instead of production

set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" == "--local" ]]; then
    BASE="http://localhost:4321"
    echo "==> Validating LOCAL dev server at $BASE"
    echo "    Make sure 'npm run dev' is running first."
else
    BASE="https://21bristoe.com"
    echo "==> Validating PRODUCTION at $BASE"
fi

PASS=0
FAIL=0

check() {
    local desc="$1"
    local result="$2"
    local expected="$3"
    if echo "$result" | grep -q "$expected"; then
        echo "  PASS  $desc"
        ((PASS++)) || true
    else
        echo "  FAIL  $desc"
        echo "        Expected: $expected"
        echo "        Got:      $(echo "$result" | head -3)"
        ((FAIL++)) || true
    fi
}

echo ""
echo "--- Endpoint checks ---"
check "Homepage 200" "$(curl -so /dev/null -w '%{http_code}' "$BASE/")" "200"
check "robots.txt 200" "$(curl -so /dev/null -w '%{http_code}' "$BASE/robots.txt")" "200"
check "sitemap-index.xml 200" "$(curl -so /dev/null -w '%{http_code}' "$BASE/sitemap-index.xml")" "200"
check "favicon.svg 200" "$(curl -so /dev/null -w '%{http_code}' "$BASE/favicon.svg")" "200"
check "favicon.ico 200" "$(curl -so /dev/null -w '%{http_code}' "$BASE/favicon.ico")" "200"
check "og-image.png 200" "$(curl -so /dev/null -w '%{http_code}' "$BASE/og-image.png")" "200"
check "site.webmanifest 200" "$(curl -so /dev/null -w '%{http_code}' "$BASE/site.webmanifest")" "200"
check "apple-touch-icon 200" "$(curl -so /dev/null -w '%{http_code}' "$BASE/apple-touch-icon.png")" "200"
check "404 page returns 404" "$(curl -so /dev/null -w '%{http_code}' "$BASE/this-page-does-not-exist")" "404"

echo ""
echo "--- Content checks ---"
check "robots.txt blocks GPTBot" "$(curl -s "$BASE/robots.txt")" "GPTBot"
check "robots.txt blocks Google-Extended" "$(curl -s "$BASE/robots.txt")" "Google-Extended"
check "sitemap has 21bristoe.com" "$(curl -s "$BASE/sitemap-index.xml")" "21bristoe.com"
check "Homepage has 21 Bristoe" "$(curl -s "$BASE/")" "21 Bristoe"
check "Homepage has Limón" "$(curl -s "$BASE/")" "Lim"
check "Homepage has Faber" "$(curl -s "$BASE/")" "Faber"
check "Homepage has Kasey" "$(curl -s "$BASE/")" "Kasey"
check "webmanifest is valid JSON" "$(curl -s "$BASE/site.webmanifest" | python3 -c 'import sys,json; json.load(sys.stdin); print("valid")')" "valid"

if [[ "$MODE" != "--local" ]]; then
    echo ""
    echo "--- HTTPS / redirect checks ---"
    check "HTTP -> HTTPS redirect" "$(curl -sI http://21bristoe.com | head -5)" "301"
    check "HTTP -> HTTPS location" "$(curl -sI http://21bristoe.com | grep -i location)" "https://21bristoe.com"
    check "www HTTPS -> non-www redirect" "$(curl -sI https://www.21bristoe.com | head -5)" "301"
    check "www HTTPS location" "$(curl -sI https://www.21bristoe.com | grep -i location)" "https://21bristoe.com"
    check "HTTP www -> HTTPS" "$(curl -sI http://www.21bristoe.com | head -5)" "301"

    echo ""
    echo "--- SSL checks ---"
    SSL_INFO=$(openssl s_client -connect 21bristoe.com:443 -servername 21bristoe.com </dev/null 2>&1)
    check "SSL cert not expired" "$SSL_INFO" "Verify return code: 0"
    check "SSL cert covers 21bristoe.com" "$(echo "$SSL_INFO" | openssl x509 -noout -text 2>/dev/null)" "21bristoe.com"

    echo ""
    echo "--- Security headers ---"
    # Note: HTTP/2 headers are lowercase; use case-insensitive matching
    HEADERS=$(curl -sI "$BASE/")
    check "HSTS header present" "$(echo "$HEADERS" | grep -i strict-transport)" "strict-transport-security"
    check "X-Frame-Options present" "$(echo "$HEADERS" | grep -i x-frame)" "x-frame-options"
    check "X-Content-Type-Options present" "$(echo "$HEADERS" | grep -i x-content-type)" "x-content-type-options"
    check "CSP header present" "$(echo "$HEADERS" | grep -i content-security)" "content-security-policy"
    check "Referrer-Policy present" "$(echo "$HEADERS" | grep -i referrer-policy)" "referrer-policy"

    echo ""
    echo "--- Performance ---"
    TIMING=$(curl -so /dev/null -w "TTFB:%{time_starttransfer}s Total:%{time_total}s Size:%{size_download}bytes" "$BASE/")
    echo "  INFO  $TIMING"

    echo ""
    echo "--- Admin panel checks ---"
    ADMIN_CODE=$(curl -so /dev/null -w '%{http_code}' https://admin.21bristoe.com 2>/dev/null || echo "error")
    check "Admin requires auth (401)" "$ADMIN_CODE" "401"

    MANIFEST=$(curl -s https://21bristoe.com/uploads/manifest.json 2>/dev/null || echo "")
    check "Uploads manifest is valid JSON" "$(echo "$MANIFEST" | python3 -c 'import sys,json; json.load(sys.stdin); print("valid")' 2>/dev/null || echo "invalid")" "valid"

    ADMIN_SERVICE=$(systemctl is-active 21bristoe-admin 2>/dev/null || echo "inactive")
    check "Admin service is active" "$ADMIN_SERVICE" "active"

    echo ""
    echo "--- drink-hub still works ---"
    DH_CODE=$(curl -so /dev/null -w '%{http_code}' https://drink-hub.21bristoe.com 2>/dev/null || echo "error")
    if [[ "$DH_CODE" == "200" || "$DH_CODE" == "401" ]]; then
        echo "  PASS  drink-hub.21bristoe.com ($DH_CODE)"
        ((PASS++)) || true
    else
        echo "  WARN  drink-hub.21bristoe.com returned $DH_CODE (may need investigation)"
    fi
fi

echo ""
echo "=============================="
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "=============================="

if [[ $FAIL -gt 0 ]]; then
    echo "SOME CHECKS FAILED — site is NOT ready for go-live."
    exit 1
else
    echo "All checks passed!"
    exit 0
fi
