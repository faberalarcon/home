#!/usr/bin/env bash
# validate.sh — Endpoint and SSL validation for 21bristoe.com
# Run this after deploy to verify all endpoints, redirects, SSL, and headers.
#
# Usage: ./deploy/validate.sh [--local]
#   --local  Run against http://localhost:4321 (dev server) instead of production

set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" == "--local" ]]; then
    BASE="${VALIDATE_BASE:-http://localhost:5173}"
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
    check "drink-hub subdomain redirects to /drinks" "$(curl -sI http://drink-hub.21bristoe.com/ | grep -i location)" "https://21bristoe.com/drinks/"
    check "stats subdomain redirects to /stats" "$(curl -sI http://stats.21bristoe.com/ | grep -i location)" "https://21bristoe.com/stats/"

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
    ADMIN_CODE=$(curl -so /dev/null -w '%{http_code}' https://admin.21bristoe.com/admin/ 2>/dev/null || echo "error")
    check "Admin requires auth (401)" "$ADMIN_CODE" "401"

    MANIFEST=$(curl -s https://21bristoe.com/uploads/manifest.json 2>/dev/null || echo "")
    check "Uploads manifest is valid JSON" "$(echo "$MANIFEST" | python3 -c 'import sys,json; json.load(sys.stdin); print("valid")' 2>/dev/null || echo "invalid")" "valid"

    SITE_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -x '21bristoe-site' || true)
    check "Unified site container is running" "$SITE_CONTAINER" "21bristoe-site"

    echo ""
    echo "--- Path app checks ---"
    DH_CODE=$(curl -so /dev/null -w '%{http_code}' "$BASE/drinks/login" 2>/dev/null || echo "error")
    if [[ "$DH_CODE" == "200" || "$DH_CODE" == "303" ]]; then
        echo "  PASS  /drinks/login reachable ($DH_CODE)"
        ((PASS++)) || true
    else
        echo "  FAIL  /drinks/login reachable"
        echo "        Expected: 200 or 303"
        echo "        Got:      $DH_CODE"
        ((FAIL++)) || true
    fi

    DH_HEALTH=$(curl -s "$BASE/drinks/api/health" 2>/dev/null || echo "")
    check "Drink Hub health JSON" "$(echo "$DH_HEALTH" | python3 -c 'import sys,json; json.load(sys.stdin); print("valid")' 2>/dev/null || echo "invalid")" "valid"

    STATS_CODE=$(curl -so /dev/null -w '%{http_code}' "$BASE/stats/" 2>/dev/null || echo "error")
    if [[ "$STATS_CODE" == "200" ]]; then
        echo "  PASS  /stats/ reachable ($STATS_CODE)"
        ((PASS++)) || true
    else
        echo "  FAIL  /stats/ reachable"
        echo "        Expected: 200"
        echo "        Got:      $STATS_CODE"
        ((FAIL++)) || true
    fi

    STATS_HEALTH=$(curl -s "$BASE/stats/api/health" 2>/dev/null || echo "")
    check "Stats health JSON" "$(echo "$STATS_HEALTH" | python3 -c 'import sys,json; json.load(sys.stdin); print("valid")' 2>/dev/null || echo "invalid")" "valid"

    BRIEF_CODE=$(curl -so /dev/null -w '%{http_code}' "$BASE/stats/brief" 2>/dev/null || echo "error")
    if [[ "$BRIEF_CODE" == "200" ]]; then
        echo "  PASS  /stats/brief reachable ($BRIEF_CODE)"
        ((PASS++)) || true
    else
        echo "  FAIL  /stats/brief reachable"
        echo "        Expected: 200"
        echo "        Got:      $BRIEF_CODE"
        ((FAIL++)) || true
    fi

    BRIEF_LIST=$(curl -s "$BASE/stats/api/brief" 2>/dev/null || echo "")
    check "Stats brief list JSON" "$(echo "$BRIEF_LIST" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("valid") if isinstance(d.get("briefs"), list) else print("invalid")' 2>/dev/null || echo "invalid")" "valid"

    # SSE doesn't respond to HEAD cleanly; do a short GET and extract the content type.
    STATS_STREAM_CT=$(curl -s --max-time 3 -o /dev/null -w '%{content_type}' "$BASE/stats/api/stream" 2>/dev/null || echo "")
    check "Stats SSE returns text/event-stream" "$STATS_STREAM_CT" "text/event-stream"

    PI_30D=$(curl -so /dev/null -w '%{http_code}' "$BASE/stats/pi?range=30d" 2>/dev/null || echo "error")
    if [[ "$PI_30D" == "200" ]]; then
        echo "  PASS  /stats/pi?range=30d reachable ($PI_30D)"
        ((PASS++)) || true
    else
        echo "  FAIL  /stats/pi?range=30d reachable"
        echo "        Expected: 200"
        echo "        Got:      $PI_30D"
        ((FAIL++)) || true
    fi

    GOOBY_CODE=$(curl -so /dev/null -w '%{http_code}' "$BASE/gooby/login" 2>/dev/null || echo "error")
    if [[ "$GOOBY_CODE" == "200" || "$GOOBY_CODE" == "303" ]]; then
        echo "  PASS  /gooby/login reachable ($GOOBY_CODE)"
        ((PASS++)) || true
    else
        echo "  FAIL  /gooby/login reachable"
        echo "        Expected: 200 or 303"
        echo "        Got:      $GOOBY_CODE"
        ((FAIL++)) || true
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
