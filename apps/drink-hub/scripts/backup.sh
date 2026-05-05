#!/usr/bin/env bash
# drink-hub nightly backup
# Usage: ./scripts/backup.sh [path/to/drink-hub.db]
# Defaults to ./data/drink-hub.db relative to the repo root.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

DB="${1:-$REPO_ROOT/data/drink-hub.db}"
BACKUP_DIR="$REPO_ROOT/data/backups"
DEST="$BACKUP_DIR/$(date +%F).db"

if [ ! -f "$DB" ]; then
  echo "ERROR: database not found at $DB" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Python's sqlite3 module performs an online backup — safe with WAL mode
python3 - <<PYEOF
import sqlite3
src = sqlite3.connect("$DB")
dst = sqlite3.connect("$DEST")
src.backup(dst, pages=1000)
dst.close()
src.close()
print("Backup written to $DEST")
PYEOF

# Prune backups older than 14 days
find "$BACKUP_DIR" -maxdepth 1 -name "*.db" -mtime +14 -delete

echo "Done. Backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"/*.db 2>/dev/null | tail -5
