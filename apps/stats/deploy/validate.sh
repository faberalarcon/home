#!/usr/bin/env bash
# validate.sh - Endpoint, SSL, redirect, and header validation for 21bristoe Stats
#
# Usage: ./deploy/validate.sh [--local]
#   --local  Run against http://localhost:5174/stats instead of production

set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" == "--local" ]]; then
    BASE="${VALIDATE_BASE:-http://localhost:5174/stats}"
    echo "==> Validating LOCAL stats app at $BASE"
    echo "    Make sure 'npm run dev' or 'npm run start' is running first."
elif [[ -z "$MODE" ]]; then
    BASE="https://21bristoe.com/stats"
    echo "==> Validating PRODUCTION stats app at $BASE"
else
    echo "Usage: $0 [--local]"
    exit 2
fi

PASS=0
FAIL=0
WARN=0

pass() {
    echo "  PASS  $1"
    ((PASS++)) || true
}

fail() {
    echo "  FAIL  $1"
    if [[ $# -gt 1 ]]; then
        echo "        $2"
    fi
    ((FAIL++)) || true
}

warn() {
    echo "  WARN  $1"
    if [[ $# -gt 1 ]]; then
        echo "        $2"
    fi
    ((WARN++)) || true
}

fetch_code() {
    local code
    code="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true)"
    printf '%s\n' "${code:-000}"
}

fetch_body() {
    curl -sS --max-time 10 "$1" 2>/dev/null || true
}

fetch_headers() {
    curl -sS --max-time 10 -I "$1" 2>/dev/null || true
}

check_code() {
    local desc="$1"
    local url="$2"
    local expected="$3"
    local code
    code="$(fetch_code "$url")"
    if [[ "$code" == "$expected" ]]; then
        pass "$desc ($code)"
    else
        fail "$desc" "Expected HTTP $expected, got $code"
    fi
}

check_contains() {
    local desc="$1"
    local url="$2"
    local expected="$3"
    local body
    body="$(fetch_body "$url")"
    if printf '%s' "$body" | grep -Fq "$expected"; then
        pass "$desc"
    else
        fail "$desc" "Missing marker: $expected"
    fi
}

check_header() {
    local desc="$1"
    local headers="$2"
    local expected="$3"
    if printf '%s' "$headers" | grep -iq "$expected"; then
        pass "$desc"
    else
        fail "$desc" "Missing header: $expected"
    fi
}

echo ""
echo "--- Endpoint checks ---"
check_code "Overview 200" "$BASE/" "200"
check_code "House 200" "$BASE/house" "200"
check_code "Drinks 200" "$BASE/drinks" "200"
check_code "Visitors 200" "$BASE/visitors" "200"
check_code "Backups 200" "$BASE/backups" "200"
check_code "Pi 200" "$BASE/pi" "200"

echo ""
echo "--- Content checks ---"
check_contains "Overview has operations title" "$BASE/" "Operations board"
check_contains "House has route title" "$BASE/house" "Sensors and history"
check_contains "Drinks has route title" "$BASE/drinks" "Orders and trends"
check_contains "Visitors has route title" "$BASE/visitors" "Location trends"
check_contains "Backups has route title" "$BASE/backups" "Backup status"
check_contains "Pi has route title" "$BASE/pi" "Pi health"
check_contains "Footer has 21 Bristoe Stats" "$BASE/" "21 Bristoe"

echo ""
echo "--- Health check ---"
HEALTH_BODY="$(fetch_body "$BASE/api/health")"
if printf '%s' "$HEALTH_BODY" | python3 -c 'import sys,json; json.load(sys.stdin); print("valid")' >/dev/null 2>&1; then
    pass "/api/health returns valid JSON"
    HEALTH_STATUS="$(
        printf '%s' "$HEALTH_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status", ""))' 2>/dev/null || true
    )"
    case "$HEALTH_STATUS" in
        ok)
            pass "/api/health status ok"
            ;;
        degraded|unhealthy)
            warn "/api/health status $HEALTH_STATUS" "One or more upstream data sources are unavailable."
            ;;
        *)
            fail "/api/health status" "Unexpected status: ${HEALTH_STATUS:-missing}"
            ;;
    esac
else
    fail "/api/health returns valid JSON" "Response was empty or malformed."
fi

if [[ "$MODE" != "--local" ]]; then
    echo ""
    echo "--- HTTPS / redirect checks ---"
    HTTP_HEADERS="$(fetch_headers "http://stats.21bristoe.com/")"
    if printf '%s' "$HTTP_HEADERS" | head -5 | grep -q "301"; then
        pass "HTTP redirects to HTTPS"
    else
        fail "HTTP redirects to HTTPS" "Expected 301 redirect."
    fi
    if printf '%s' "$HTTP_HEADERS" | grep -iq "location: https://21bristoe.com/stats/"; then
        pass "HTTP redirect location is canonical path"
    else
        fail "HTTP redirect location is canonical path" "Expected Location: https://21bristoe.com/stats/"
    fi

    echo ""
    echo "--- SSL checks ---"
    SSL_INFO="$(openssl s_client -connect stats.21bristoe.com:443 -servername stats.21bristoe.com </dev/null 2>&1 || true)"
    if printf '%s' "$SSL_INFO" | grep -q "Verify return code: 0"; then
        pass "SSL certificate verifies"
    else
        fail "SSL certificate verifies" "OpenSSL verification failed."
    fi
    if printf '%s' "$SSL_INFO" | openssl x509 -noout -text 2>/dev/null | grep -q "stats.21bristoe.com"; then
        pass "SSL certificate covers stats.21bristoe.com"
    else
        fail "SSL certificate covers stats.21bristoe.com" "SAN/CN did not include stats.21bristoe.com."
    fi
fi

echo ""
echo "--- Security headers ---"
HEADERS="$(fetch_headers "$BASE/")"
if [[ "$MODE" != "--local" ]]; then
    check_header "HSTS header present" "$HEADERS" "strict-transport-security"
fi
check_header "X-Frame-Options present" "$HEADERS" "x-frame-options"
check_header "X-Content-Type-Options present" "$HEADERS" "x-content-type-options"
check_header "CSP header present" "$HEADERS" "content-security-policy"
check_header "Referrer-Policy present" "$HEADERS" "referrer-policy"
check_header "Permissions-Policy present" "$HEADERS" "permissions-policy"

echo ""
echo "--- Performance ---"
TIMING="$(curl -sS --max-time 10 -o /dev/null -w "TTFB:%{time_starttransfer}s Total:%{time_total}s Size:%{size_download}bytes" "$BASE/" 2>/dev/null || true)"
TIMING="${TIMING:-unavailable}"
echo "  INFO  $TIMING"

echo ""
echo "=============================="
echo "Results: ${PASS} passed, ${FAIL} failed, ${WARN} warnings"
echo "=============================="

if [[ $FAIL -gt 0 ]]; then
    echo "SOME CHECKS FAILED - stats is not ready."
    exit 1
fi

echo "All required checks passed."
exit 0
