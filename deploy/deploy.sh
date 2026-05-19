#!/usr/bin/env bash
# deploy.sh — Build and deploy the unified 21bristoe.com SvelteKit app
#
# Usage: ./deploy/deploy.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRINK_HUB_DATA_DIR="${DRINK_HUB_DATA_DIR:-/var/lib/21bristoe/drink-hub}"
MEDIA_DIR="${MEDIA_DIR:-/var/www/21bristoe-media}"
LEGACY_DRINK_HUB_DATA_DIR="${LEGACY_DRINK_HUB_DATA_DIR:-/home/faber/projects/drink-hub/data}"
ROOT_ENV_FILE="$REPO_DIR/.env"
LEGACY_DRINK_HUB_ENV="${LEGACY_DRINK_HUB_ENV:-/home/faber/projects/drink-hub/.env}"
LEGACY_STATS_ENV="${LEGACY_STATS_ENV:-/home/faber/projects/stats/.env}"
ADMIN_ENV="${ADMIN_ENV:-/etc/21bristoe-admin.env}"
NGINX_CONF_REPO="$REPO_DIR/deploy/nginx/21bristoe.com.ssl.conf"
NGINX_CONF_LIVE="/etc/nginx/sites-available/21bristoe.com"
ADMIN_NGINX_CONF_REPO="$REPO_DIR/deploy/nginx/admin.21bristoe.com.conf"
ADMIN_NGINX_CONF_LIVE="/etc/nginx/sites-available/admin.21bristoe.com"
LEGACY_NGINX_SITES=("drink-hub.21bristoe.com" "stats.21bristoe.com")
LEGACY_CONTAINERS=("drink-hub" "21bristoe-stats")

read_env_line() {
    local file="$1"
    local key="$2"
    if [[ ! -f "$file" ]]; then return 0; fi
    grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 | sed 's/^[[:space:]]*//' || true
}

write_env_key_from() {
    local file="$1"
    local key="$2"
    local line
    line="$(read_env_line "$file" "$key")"
    if [[ -n "$line" ]]; then printf '%s\n' "$line"; fi
}

ensure_env_key_from() {
    local key="$1"
    local file="$2"
    local line
    if grep -qE "^[[:space:]]*${key}=" "$ROOT_ENV_FILE"; then return 0; fi
    line="$(read_env_line "$file" "$key")"
    if [[ -n "$line" ]]; then
        printf '%s\n' "$line" >> "$ROOT_ENV_FILE"
        echo "      Added $key to root .env."
    fi
}

ensure_env_key_literal() {
    local key="$1"
    local value="$2"
    if grep -qE "^[[:space:]]*${key}=" "$ROOT_ENV_FILE"; then return 0; fi
    printf '%s=%s\n' "$key" "$value" >> "$ROOT_ENV_FILE"
    echo "      Added $key to root .env."
}

ensure_root_env() {
    if [[ -f "$ROOT_ENV_FILE" ]]; then
        ensure_env_key_literal "DRINK_HUB_DATA_DIR" "$DRINK_HUB_DATA_DIR"
        ensure_env_key_literal "MEDIA_DIR" "$MEDIA_DIR"
        ensure_env_key_literal "GOOBY_DATABASE_PATH" "/app/data/gooby-gpt.db"
        ensure_env_key_literal "LLAMA_BASE_URL" "http://192.168.1.215:8080"
        ensure_env_key_literal "WHISPER_BASE_URL" "http://192.168.1.215:8081"
        ensure_env_key_literal "WHISPER_MODEL" "base.en"
        ensure_env_key_from "ADMIN_SHARED_SECRET" "$ADMIN_ENV"
        chmod 600 "$ROOT_ENV_FILE"
        return 0
    fi

    echo "      Creating root .env from legacy app/admin env files..."
    {
        printf '# Created by deploy/deploy.sh during unified home repo migration.\n'
        printf '# Keep this file untracked; it supplies docker compose production secrets.\n'
        printf 'CSRF_TRUSTED_ORIGINS=https://21bristoe.com,https://admin.21bristoe.com\n'
        printf 'DRINK_HUB_DATA_DIR=%s\n' "$DRINK_HUB_DATA_DIR"
        printf 'MEDIA_DIR=%s\n' "$MEDIA_DIR"
        printf 'GOOBY_DATABASE_PATH=/app/data/gooby-gpt.db\n'
        printf 'LLAMA_BASE_URL=http://192.168.1.215:8080\n'
        printf 'WHISPER_BASE_URL=http://192.168.1.215:8081\n'
        printf 'WHISPER_MODEL=base.en\n'
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "SITE_PASSWORD"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "SITE_PASSWORD_HASH"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "GOOBY_PASSWORD"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "GOOBY_PASSWORD_HASH"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "ADMIN_PASSWORD"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "SESSION_SECRET"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "HA_STRICT_PUBLIC"
        write_env_key_from "$LEGACY_STATS_ENV" "HA_BASE_URL"
        write_env_key_from "$LEGACY_STATS_ENV" "HA_TOKEN"
        write_env_key_from "$LEGACY_STATS_ENV" "EV_COST_PER_KWH"
        write_env_key_from "$LEGACY_STATS_ENV" "TZ"
        write_env_key_from "$ADMIN_ENV" "ADMIN_SHARED_SECRET"
    } > "$ROOT_ENV_FILE"
    chmod 600 "$ROOT_ENV_FILE"
    echo "      Root .env created."
}

retire_legacy_nginx_site() {
    local site="$1"
    local enabled="/etc/nginx/sites-enabled/$site"
    local backup="/etc/nginx/sites-available/${site}.retired-unified-$(date +%Y%m%d-%H%M%S)"

    if [[ -L "$enabled" || -f "$enabled" ]]; then
        echo "      Retiring legacy enabled vhost: $enabled"
        sudo mv "$enabled" "$backup"
        echo "      Saved at: $backup"
    fi
}

retire_legacy_container() {
    local name="$1"
    local project

    if ! docker container inspect "$name" >/dev/null 2>&1; then return 0; fi
    project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$name" 2>/dev/null || true)"
    if [[ "$project" == "home" && "$name" == "21bristoe-site" ]]; then return 0; fi

    echo "      Removing legacy container: $name (compose project: ${project:-none})"
    docker rm -f "$name" >/dev/null
}

wait_for_site() {
    local url="${1:-http://127.0.0.1:6173/}"
    local code

    echo "      Waiting for site to answer at $url..."
    for _ in {1..30}; do
        code="$(curl -so /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
        if [[ "$code" == "200" || "$code" == "303" ]]; then
            echo "      Site is ready ($code)."
            return 0
        fi
        sleep 1
    done

    echo "      Site did not become ready in time; last status: ${code:-none}"
    return 1
}

echo ""
echo "==> 21bristoe.com unified deploy"
echo "    Repo: $REPO_DIR"
echo ""

cd "$REPO_DIR"

echo "[1/7] Building unified SvelteKit app..."
npm run build
echo "      Build complete."

echo "[2/7] Preparing runtime data..."
ensure_root_env
sudo mkdir -p "$DRINK_HUB_DATA_DIR" "$MEDIA_DIR"
if [[ ! -f "$DRINK_HUB_DATA_DIR/drink-hub.db" && -f "$LEGACY_DRINK_HUB_DATA_DIR/drink-hub.db" ]]; then
    echo "      Migrating Drink Hub data from $LEGACY_DRINK_HUB_DATA_DIR..."
    sudo rsync -a "$LEGACY_DRINK_HUB_DATA_DIR/" "$DRINK_HUB_DATA_DIR/"
fi
sudo chown -R faber:faber "$(dirname "$DRINK_HUB_DATA_DIR")"
sudo chown -R faber:faber "$MEDIA_DIR"
echo "      Runtime data ready."

echo "[3/7] Retiring legacy app containers..."
for container in "${LEGACY_CONTAINERS[@]}"; do
    retire_legacy_container "$container"
done

echo "[4/7] Rebuilding unified site container..."
docker compose up -d --build site
wait_for_site
echo "      Unified site container running."

echo "[5/7] Installing and testing nginx config..."
sudo cp "$NGINX_CONF_REPO" "$NGINX_CONF_LIVE"
sudo cp "$ADMIN_NGINX_CONF_REPO" "$ADMIN_NGINX_CONF_LIVE"
for site in "${LEGACY_NGINX_SITES[@]}"; do
    retire_legacy_nginx_site "$site"
done
sudo nginx -t

echo "[6/7] Reloading nginx..."
sudo systemctl reload nginx
echo "      nginx reloaded."

echo "[7/7] Retiring legacy admin service if present..."
if systemctl list-unit-files 21bristoe-admin.service >/dev/null 2>&1; then
    sudo systemctl disable --now 21bristoe-admin || true
    echo "      Legacy admin service stopped."
else
    echo "      Legacy admin service not installed."
fi

echo ""
echo "==> Running validation checks..."
if "$REPO_DIR/deploy/validate.sh"; then
    echo ""
    echo "All checks passed — deploy successful!"
else
    echo ""
    echo "WARNING: Some validation checks FAILED after deploy."
    exit 1
fi
