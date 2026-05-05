#!/usr/bin/env bash
# install.sh — install backup.sh + cron job on the Pi. Idempotent.
# Run from the stats repo root: ./deploy/backup/install.sh

set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="/home/faber/bin"
MANIFEST_DIR="/var/lib/bristoe-backup"
LOG_DIR="/var/log/bristoe-backup"
CRON_FILE="/etc/cron.d/bristoe-backup"

echo "==> Installing Bristoe backup tooling"

mkdir -p "$BIN_DIR"
install -m 755 "$SRC_DIR/backup.sh" "$BIN_DIR/backup.sh"
echo "    $BIN_DIR/backup.sh installed"

sudo install -d -o faber -g faber -m 755 "$MANIFEST_DIR"
sudo install -d -o faber -g faber -m 755 "$LOG_DIR"
echo "    manifest dir: $MANIFEST_DIR"
echo "    log dir:      $LOG_DIR"

sudo install -m 644 "$SRC_DIR/bristoe-backup.cron" "$CRON_FILE"
sudo chown root:root "$CRON_FILE"
echo "    cron installed: $CRON_FILE"

echo ""
echo "Install complete. Verify:"
echo "  systemctl status cron"
echo "  /home/faber/bin/backup.sh daily  # dry run the daily tier"
echo ""
echo "Stats site reads $MANIFEST_DIR/manifest.json — bind-mount that path into the container."
