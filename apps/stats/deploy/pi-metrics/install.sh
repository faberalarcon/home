#!/usr/bin/env bash
set -euo pipefail

# Installs the Pi metrics collector as a systemd timer.
# Run as root: sudo bash deploy/pi-metrics/install.sh

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo)." >&2
  exit 1
fi

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_LIB="/usr/local/lib/21bristoe-pi-metrics"
SYSTEMD_DIR="/etc/systemd/system"
DATA_DIR="/var/lib/bristoe-stats"

echo "==> Install collector script to ${INSTALL_LIB}"
mkdir -p "${INSTALL_LIB}"
install -m 0755 "${SRC_DIR}/collect-pi-metrics.mjs" "${INSTALL_LIB}/collect-pi-metrics.mjs"

echo "==> Install systemd units to ${SYSTEMD_DIR}"
install -m 0644 "${SRC_DIR}/21bristoe-pi-metrics.service" "${SYSTEMD_DIR}/21bristoe-pi-metrics.service"
install -m 0644 "${SRC_DIR}/21bristoe-pi-metrics.timer"   "${SYSTEMD_DIR}/21bristoe-pi-metrics.timer"

echo "==> Ensure data dir ${DATA_DIR}"
mkdir -p "${DATA_DIR}"
chmod 0755 "${DATA_DIR}"

echo "==> Reload systemd + enable timer"
systemctl daemon-reload
systemctl enable --now 21bristoe-pi-metrics.timer

echo "==> Run one sample now"
systemctl start 21bristoe-pi-metrics.service || true

echo "==> Status"
systemctl --no-pager --full status 21bristoe-pi-metrics.timer | sed -n '1,8p' || true

echo ""
echo "Done. Timer will tick every 5 minutes (OnCalendar=*:0/5)."
echo "Data file: ${DATA_DIR}/pi-metrics.jsonl"
