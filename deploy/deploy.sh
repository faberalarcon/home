#!/usr/bin/env bash
# deploy.sh — Build and deploy 21bristoe.com to production
#
# Usage: ./deploy/deploy.sh [--no-backup | --rollback]
#
# Requirements:
#   - Run from the project root: /home/faber/projects/home
#   - nginx config already installed at /etc/nginx/sites-available/21bristoe.com
#   - Web root exists: /var/www/21bristoe.com
#   - sudo access for rsync, chown, nginx reload

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="/var/www/21bristoe.com"
DRINK_HUB_DATA_DIR="${DRINK_HUB_DATA_DIR:-/var/lib/21bristoe/drink-hub}"
LEGACY_DRINK_HUB_DATA_DIR="${LEGACY_DRINK_HUB_DATA_DIR:-/home/faber/projects/drink-hub/data}"
ROOT_ENV_FILE="$REPO_DIR/.env"
LEGACY_DRINK_HUB_ENV="${LEGACY_DRINK_HUB_ENV:-/home/faber/projects/drink-hub/.env}"
LEGACY_STATS_ENV="${LEGACY_STATS_ENV:-/home/faber/projects/stats/.env}"
NGINX_CONF_REPO="$REPO_DIR/deploy/nginx/21bristoe.com.ssl.conf"
NGINX_CONF_LIVE="/etc/nginx/sites-available/21bristoe.com"
LEGACY_NGINX_SITES=("drink-hub.21bristoe.com" "stats.21bristoe.com")
LEGACY_CONTAINERS=("drink-hub" "21bristoe-stats")
FLAG="${1:-}"

read_env_line() {
    local file="$1"
    local key="$2"

    if [[ ! -f "$file" ]]; then
        return 0
    fi

    grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 | sed 's/^[[:space:]]*//' || true
}

write_env_key_from() {
    local file="$1"
    local key="$2"
    local line

    line="$(read_env_line "$file" "$key")"
    if [[ -n "$line" ]]; then
        printf '%s\n' "$line"
    fi
}

ensure_root_env() {
    if [[ -f "$ROOT_ENV_FILE" ]]; then
        return 0
    fi

    echo "      Creating root .env from legacy app env files..."
    {
        printf '# Created by deploy/deploy.sh during unified home repo migration.\n'
        printf '# Keep this file untracked; it supplies docker compose production secrets.\n'
        printf 'ORIGIN=https://21bristoe.com\n'
        printf 'CSRF_TRUSTED_ORIGINS=https://21bristoe.com\n'
        printf 'DRINK_HUB_DATA_DIR=%s\n' "$DRINK_HUB_DATA_DIR"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "SITE_PASSWORD"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "SITE_PASSWORD_HASH"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "ADMIN_PASSWORD"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "SESSION_SECRET"
        write_env_key_from "$LEGACY_DRINK_HUB_ENV" "HA_STRICT_PUBLIC"
        write_env_key_from "$LEGACY_STATS_ENV" "HA_BASE_URL"
        write_env_key_from "$LEGACY_STATS_ENV" "HA_TOKEN"
        write_env_key_from "$LEGACY_STATS_ENV" "EV_COST_PER_KWH"
        write_env_key_from "$LEGACY_STATS_ENV" "TZ"
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

    if ! docker container inspect "$name" >/dev/null 2>&1; then
        return 0
    fi

    project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$name" 2>/dev/null || true)"
    if [[ "$project" == "home" ]]; then
        return 0
    fi

    echo "      Removing legacy container: $name (compose project: ${project:-none})"
    docker rm -f "$name" >/dev/null
}

# --- Rollback mode ---
if [[ "$FLAG" == "--rollback" ]]; then
    LATEST_BAK=$(ls -dt "${WEB_ROOT}".bak-* 2>/dev/null | head -1 || true)
    if [[ -z "$LATEST_BAK" ]]; then
        echo "ERROR: No backup found to roll back to."
        exit 1
    fi
    BROKEN_DIR="${WEB_ROOT}.broken-$(date +%Y%m%d-%H%M%S)"
    echo ""
    echo "==> Rolling back to: $LATEST_BAK"
    sudo mv "$WEB_ROOT" "$BROKEN_DIR"
    sudo mv "$LATEST_BAK" "$WEB_ROOT"
    sudo systemctl reload nginx
    echo ""
    echo "Rollback complete."
    echo "Broken deployment saved at: $BROKEN_DIR"
    echo "Remove it when satisfied: sudo rm -rf $BROKEN_DIR"
    exit 0
fi

echo ""
echo "==> 21bristoe.com deploy"
echo "    Repo: $REPO_DIR"
echo "    Web root: $WEB_ROOT"
echo ""

# 1. Build
echo "[1/5] Building..."
cd "$REPO_DIR"
npm run build
echo "      Build complete. Pages: $(find dist -name '*.html' | wc -l)"

# 2. Backup (unless --no-backup)
BACKUP_DIR=""
if [[ "$FLAG" != "--no-backup" ]]; then
    BACKUP_DIR="${WEB_ROOT}.bak-$(date +%Y%m%d-%H%M%S)"
    if [[ -d "$WEB_ROOT" ]]; then
        echo "[2/5] Backing up current deployment to $BACKUP_DIR..."
        sudo cp -r "$WEB_ROOT" "$BACKUP_DIR"
        echo "      Backup created."

        # Rotate: keep only the 3 most recent backups to save disk space
        BAK_COUNT=$(ls -dt "${WEB_ROOT}".bak-* 2>/dev/null | wc -l || echo 0)
        if [[ "$BAK_COUNT" -gt 3 ]]; then
            ls -dt "${WEB_ROOT}".bak-* | tail -n "+4" | xargs sudo rm -rf
            echo "      Rotated old backups (keeping 3 most recent)."
        fi
    else
        echo "[2/5] No existing deployment to back up — skipping."
        sudo mkdir -p "$WEB_ROOT"
    fi
else
    echo "[2/5] Skipping backup (--no-backup flag)."
    sudo mkdir -p "$WEB_ROOT"
fi

# 3. Deploy
echo "[3/5] Syncing dist/ to $WEB_ROOT..."
sudo rsync -av --delete "$REPO_DIR/dist/" "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"
echo "      Sync complete."

# 4. Ensure runtime data dirs exist and migrate legacy Drink Hub data once.
echo "[4/8] Preparing runtime data..."
ensure_root_env
sudo mkdir -p "$DRINK_HUB_DATA_DIR"
if [[ ! -f "$DRINK_HUB_DATA_DIR/drink-hub.db" && -f "$LEGACY_DRINK_HUB_DATA_DIR/drink-hub.db" ]]; then
    echo "      Migrating Drink Hub data from $LEGACY_DRINK_HUB_DATA_DIR..."
    sudo rsync -a "$LEGACY_DRINK_HUB_DATA_DIR/" "$DRINK_HUB_DATA_DIR/"
fi
sudo chown -R faber:faber "$(dirname "$DRINK_HUB_DATA_DIR")"
echo "      Runtime data ready."

# 5. Restart SvelteKit apps
echo "[5/8] Rebuilding app containers..."
for container in "${LEGACY_CONTAINERS[@]}"; do
    retire_legacy_container "$container"
done
docker compose up -d --build
echo "      App containers running."

# 6. Restart admin service if server.js changed since last deploy
echo "[6/8] Checking admin service..."
ADMIN_JS="$REPO_DIR/admin/server.js"
ADMIN_STAMP="/tmp/21bristoe-admin-server.md5"
CURRENT_MD5=$(md5sum "$ADMIN_JS" | cut -d' ' -f1)
STORED_MD5=$(cat "$ADMIN_STAMP" 2>/dev/null || echo "")
if [[ "$CURRENT_MD5" != "$STORED_MD5" ]]; then
    echo "      server.js changed — restarting admin service..."
    sudo systemctl restart 21bristoe-admin
    echo "$CURRENT_MD5" > "$ADMIN_STAMP"
    echo "      Admin service restarted."
else
    echo "      server.js unchanged — skipping restart."
fi

# 7. Install and test nginx config
echo "[7/8] Installing and testing nginx config..."
sudo cp "$NGINX_CONF_REPO" "$NGINX_CONF_LIVE"
for site in "${LEGACY_NGINX_SITES[@]}"; do
    retire_legacy_nginx_site "$site"
done
sudo nginx -t

# 8. Reload nginx
echo "[8/8] Reloading nginx..."
sudo systemctl reload nginx
echo "      nginx reloaded."

echo ""
echo "==> Deploy complete!"
echo ""

# Post-deploy validation gate
echo "==> Running validation checks..."
if "$REPO_DIR/deploy/validate.sh"; then
    echo ""
    echo "All checks passed — deploy successful!"
else
    echo ""
    echo "WARNING: Some validation checks FAILED after deploy."
    echo "         Run './deploy/validate.sh' for details."
    if [[ -n "$BACKUP_DIR" ]]; then
        echo "         To roll back: ./deploy/deploy.sh --rollback"
    fi
    exit 1
fi
