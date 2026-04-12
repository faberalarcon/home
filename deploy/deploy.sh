#!/usr/bin/env bash
# deploy.sh — Build and deploy 21bristoe.com to production
#
# Usage: ./deploy/deploy.sh [--no-backup]
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
SKIP_BACKUP="${1:-}"

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
if [[ "$SKIP_BACKUP" != "--no-backup" ]]; then
    BACKUP_DIR="${WEB_ROOT}.bak-$(date +%Y%m%d-%H%M%S)"
    if [[ -d "$WEB_ROOT" ]]; then
        echo "[2/5] Backing up current deployment to $BACKUP_DIR..."
        sudo cp -r "$WEB_ROOT" "$BACKUP_DIR"
        echo "      Backup created."
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

# 4. Test nginx config
echo "[4/5] Testing nginx config..."
sudo nginx -t

# 5. Reload nginx
echo "[5/5] Reloading nginx..."
sudo systemctl reload nginx
echo "      nginx reloaded."

echo ""
echo "==> Deploy complete!"
echo ""
echo "Verify with:"
echo "  curl -sI https://21bristoe.com/ | head -5"
echo "  curl -sI http://21bristoe.com   | grep -E '^(HTTP|Location)'"
echo ""

# Quick rollback reminder
if [[ -n "${BACKUP_DIR:-}" ]]; then
    echo "Rollback if needed:"
    echo "  sudo rm -rf $WEB_ROOT"
    echo "  sudo mv $BACKUP_DIR $WEB_ROOT"
    echo "  sudo systemctl reload nginx"
fi
