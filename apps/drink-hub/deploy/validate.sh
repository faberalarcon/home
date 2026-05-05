#!/usr/bin/env bash
# validate.sh - Endpoint, auth, SSL, and header validation for Drink Hub
#
# Usage: ./deploy/validate.sh [--local]
#   --local  Run against http://localhost:5173 instead of production

set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" == "--local" ]]; then
    BASE="${VALIDATE_BASE:-http://localhost:5173}"
    echo "==> Validating LOCAL Drink Hub app at $BASE"
    echo "    Make sure 'npm run dev' or 'npm run start' is running first."
elif [[ -z "$MODE" ]]; then
    BASE="https://drink-hub.21bristoe.com"
    echo "==> Validating PRODUCTION Drink Hub app at $BASE"
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

check_json_body() {
    local desc="$1"
    local body="$2"
    if printf '%s' "$body" | python3 -c 'import sys,json; json.load(sys.stdin); print("valid")' >/dev/null 2>&1; then
        pass "$desc"
        return 0
    fi
    fail "$desc" "Response was empty or malformed."
    return 1
}

check_protected_page() {
    local path="$1"
    local desc="$2"
    local code
    code="$(fetch_code "$BASE$path")"

    if [[ "$code" == "303" || "$code" == "401" || "$code" == "403" ]]; then
        pass "$desc is protected ($code)"
    elif [[ "$code" == "200" && "$MODE" == "--local" ]]; then
        warn "$desc rendered in local mode" "Local SITE_PASSWORD may be disabled."
    elif [[ "$code" == "200" ]]; then
        fail "$desc is protected" "Rendered publicly with HTTP 200."
    else
        fail "$desc is protected" "Expected 303/401/403, got $code"
    fi
}

echo ""
echo "--- Public endpoint checks ---"
LOGIN_CODE="$(fetch_code "$BASE/login")"
if [[ "$MODE" == "--local" && "$LOGIN_CODE" == "303" ]]; then
    warn "House login redirects in local mode" "Local SITE_PASSWORD may be disabled."
else
    if [[ "$LOGIN_CODE" == "200" ]]; then
        pass "House login 200"
        check_contains "House login has title" "$BASE/login" "House Access"
    else
        fail "House login reachable" "Expected HTTP 200, got $LOGIN_CODE"
    fi
fi

ADMIN_LOGIN_CODE="$(fetch_code "$BASE/admin/login")"
if [[ "$ADMIN_LOGIN_CODE" == "200" ]]; then
    pass "Admin login reachable"
    check_contains "Admin login has title" "$BASE/admin/login" "Admin"
elif [[ "$MODE" != "--local" && "$ADMIN_LOGIN_CODE" == "403" ]]; then
    pass "Admin login blocked outside allowed network (403)"
else
    fail "Admin login reachable or blocked by nginx" "Expected HTTP 200 or production 403, got $ADMIN_LOGIN_CODE"
fi

check_code "Manifest 200" "$BASE/manifest.webmanifest" "200"
check_code "Apple touch icon 200" "$BASE/icons/apple-touch-icon.png" "200"
check_code "192px icon 200" "$BASE/icons/icon-192.png" "200"
check_code "512px icon 200" "$BASE/icons/icon-512.png" "200"

MANIFEST_BODY="$(fetch_body "$BASE/manifest.webmanifest")"
check_json_body "Manifest is valid JSON" "$MANIFEST_BODY" || true

echo ""
echo "--- API checks ---"
HEALTH_BODY="$(fetch_body "$BASE/api/health")"
if check_json_body "/api/health returns valid JSON" "$HEALTH_BODY"; then
    DB_STATUS="$(
        printf '%s' "$HEALTH_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("db", ""))' 2>/dev/null || true
    )"
    HA_STATUS="$(
        printf '%s' "$HEALTH_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("ha", ""))' 2>/dev/null || true
    )"
    APP_STATUS="$(
        printf '%s' "$HEALTH_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status", ""))' 2>/dev/null || true
    )"

    if [[ "$DB_STATUS" == "ok" ]]; then
        pass "/api/health database ok"
    else
        fail "/api/health database ok" "db status was ${DB_STATUS:-missing}"
    fi

    case "$APP_STATUS" in
        ok)
            pass "/api/health status ok"
            ;;
        degraded)
            warn "/api/health status degraded" "Home Assistant may be unavailable."
            ;;
        unhealthy)
            fail "/api/health status" "App reported unhealthy."
            ;;
        *)
            fail "/api/health status" "Unexpected status: ${APP_STATUS:-missing}"
            ;;
    esac

    if [[ "$HA_STATUS" == "degraded" || "$HA_STATUS" == "unconfigured" ]]; then
        warn "/api/health Home Assistant $HA_STATUS" "Drink Hub can still serve orders."
    fi
fi

STATS_BODY="$(fetch_body "$BASE/api/stats")"
check_json_body "/api/stats returns valid JSON" "$STATS_BODY" || true

echo ""
echo "--- Auth gate checks ---"
check_protected_page "/" "Profile picker"
check_protected_page "/menu" "Menu"
check_protected_page "/recent" "Recent orders"
check_protected_page "/stats" "Leaderboard"
check_protected_page "/admin" "Admin dashboard"

ORDER_CODE="$(
    curl -sS --max-time 10 -o /dev/null -w '%{http_code}' \
        -X POST -H 'Content-Type: application/json' --data '{}' \
        "$BASE/api/orders" 2>/dev/null || true
)"
ORDER_CODE="${ORDER_CODE:-000}"
if [[ "$ORDER_CODE" == "401" || "$ORDER_CODE" == "403" ]]; then
    pass "Order mutation requires auth ($ORDER_CODE)"
elif [[ "$MODE" == "--local" ]]; then
    warn "Order mutation did not hit auth gate in local mode" "Got HTTP $ORDER_CODE; local SITE_PASSWORD may be disabled."
else
    fail "Order mutation requires auth" "Expected 401/403, got $ORDER_CODE"
fi

if [[ "$MODE" != "--local" ]]; then
    echo ""
    echo "--- HTTPS / redirect checks ---"
    HTTP_HEADERS="$(fetch_headers "http://drink-hub.21bristoe.com/")"
    if printf '%s' "$HTTP_HEADERS" | head -5 | grep -q "301"; then
        pass "HTTP redirects to HTTPS"
    else
        fail "HTTP redirects to HTTPS" "Expected 301 redirect."
    fi
    if printf '%s' "$HTTP_HEADERS" | grep -iq "location: https://drink-hub.21bristoe.com"; then
        pass "HTTP redirect location is canonical"
    else
        fail "HTTP redirect location is canonical" "Expected Location: https://drink-hub.21bristoe.com"
    fi

    echo ""
    echo "--- SSL checks ---"
    SSL_INFO="$(openssl s_client -connect drink-hub.21bristoe.com:443 -servername drink-hub.21bristoe.com </dev/null 2>&1 || true)"
    if printf '%s' "$SSL_INFO" | grep -q "Verify return code: 0"; then
        pass "SSL certificate verifies"
    else
        fail "SSL certificate verifies" "OpenSSL verification failed."
    fi
    if printf '%s' "$SSL_INFO" | openssl x509 -noout -text 2>/dev/null | grep -q "drink-hub.21bristoe.com"; then
        pass "SSL certificate covers drink-hub.21bristoe.com"
    else
        fail "SSL certificate covers drink-hub.21bristoe.com" "SAN/CN did not include drink-hub.21bristoe.com."
    fi
fi

echo ""
echo "--- Security headers ---"
HEADERS="$(fetch_headers "$BASE/api/health")"
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
TIMING="$(curl -sS --max-time 10 -o /dev/null -w "TTFB:%{time_starttransfer}s Total:%{time_total}s Size:%{size_download}bytes" "$BASE/api/health" 2>/dev/null || true)"
TIMING="${TIMING:-unavailable}"
echo "  INFO  $TIMING"

echo ""
echo "=============================="
echo "Results: ${PASS} passed, ${FAIL} failed, ${WARN} warnings"
echo "=============================="

if [[ $FAIL -gt 0 ]]; then
    echo "SOME CHECKS FAILED - Drink Hub is not ready."
    exit 1
fi

echo "All required checks passed."
exit 0
