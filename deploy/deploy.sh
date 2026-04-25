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
NGINX_CONF_REPO="$REPO_DIR/deploy/nginx/21bristoe.com.ssl.conf"
NGINX_CONF_LIVE="/etc/nginx/sites-available/21bristoe.com"
FLAG="${1:-}"

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

# 4. Restart admin service if server.js changed since last deploy
echo "[4/6] Checking admin service..."
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

# 5. Test nginx config
echo "[5/6] Testing nginx config..."
sudo nginx -t

# 6. Reload nginx
echo "[6/6] Reloading nginx..."
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
