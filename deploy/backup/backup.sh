#!/usr/bin/env bash
# backup.sh - tiered rsync backups of /home/faber to /mnt/usbbackup.
# Usage: backup.sh <daily|weekly|monthly|quarterly>
#
# Writes a JSON manifest to /var/lib/bristoe-backup/manifest.json so the
# stats site can render status even when the drive is offline.

set -euo pipefail

TIER="${1:?tier required: daily|weekly|monthly|quarterly}"

SOURCE="/home/faber/"
MOUNT="/mnt/usbbackup"
DEST_BASE="$MOUNT/backups"
MANIFEST_DIR="/var/lib/bristoe-backup"
MANIFEST="$MANIFEST_DIR/manifest.json"
LOG_DIR="/var/log/bristoe-backup"
LOG="$LOG_DIR/backup.log"

case "$TIER" in
    daily)     KEEP=7  ;;
    weekly)    KEEP=4  ;;
    monthly)   KEEP=12 ;;
    quarterly) KEEP=4  ;;
    *) echo "Unknown tier: $TIER" >&2; exit 2 ;;
esac

mkdir -p "$LOG_DIR" "$MANIFEST_DIR"
exec >>"$LOG" 2>&1

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
TIER_DIR="$DEST_BASE/$TIER"
NEW="$TIER_DIR/$TIMESTAMP"
LATEST_LINK="$TIER_DIR/latest"

log() { echo "[$(date -u +%FT%TZ)] [$TIER] $*"; }

record_result() {
    local status="$1" size="$2" files="$3" duration="$4" error="${5:-}"
    local drive_uuid="" drive_total=0 drive_free=0 drive_mounted=0
    if mountpoint -q "$MOUNT"; then
        drive_mounted=1
        drive_uuid=$(findmnt -n -o UUID "$MOUNT" 2>/dev/null || true)
        read -r drive_total drive_free < <(python3 -c "import os,sys; s=os.statvfs('$MOUNT'); print(s.f_frsize*s.f_blocks, s.f_frsize*s.f_bavail)" 2>/dev/null || echo "0 0")
    fi
    python3 - "$MANIFEST" "$TIER" "$TIMESTAMP" "$status" "$size" "$files" "$duration" "$error" "$KEEP" \
        "$MOUNT" "$drive_mounted" "$drive_uuid" "$drive_total" "$drive_free" <<'PY'
import json, os, sys, tempfile
(path, tier, ts, status, size, files, duration, error, keep,
 mount, d_mounted, d_uuid, d_total, d_free) = sys.argv[1:15]
try:
    with open(path) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    data = {}
tiers = data.setdefault("tiers", {})
tier_data = tiers.setdefault(tier, {"history": [], "retain": int(keep)})
tier_data["retain"] = int(keep)
entry = {
    "timestamp": ts,
    "status": status,
    "sizeBytes": int(size) if size else 0,
    "fileCount": int(files) if files else 0,
    "durationSec": float(duration) if duration else 0.0,
}
if error:
    entry["error"] = error
tier_data["last"] = entry
tier_data["history"].append(entry)
tier_data["history"] = tier_data["history"][-30:]
data["updatedAt"] = ts
data["drive"] = {
    "mountpoint": mount,
    "mounted": d_mounted == "1",
    "uuid": d_uuid or None,
    "totalBytes": int(d_total) if d_total else 0,
    "freeBytes": int(d_free) if d_free else 0,
    "updatedAt": ts,
}

os.makedirs(os.path.dirname(path), exist_ok=True)
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".manifest.", suffix=".tmp")
try:
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)
except Exception:
    try: os.unlink(tmp)
    except FileNotFoundError: pass
    raise
PY
}

snapshot_dirs_to_prune() {
    find "$TIER_DIR" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended \
        -regex '.*/[0-9]{8}T[0-9]{6}Z$' -printf '%p\n' 2>/dev/null |
        sort |
        head -n "-$KEEP"
}

prune_snapshot() {
    local d="$1"
    [[ -n "$d" && "$d" != "$NEW" && -d "$d" ]] || return 0

    log "Pruning $d"
    find "$d" -type d -exec chmod u+rwx {} + 2>/dev/null || true
    rm -rf --one-file-system "$d"
}

START=$(date +%s)

if ! mountpoint -q "$MOUNT"; then
    log "ERROR: $MOUNT not mounted - skipping"
    record_result "failed" 0 0 0 "backup target not mounted"
    exit 3
fi

if ! touch "$MOUNT/.write-probe" 2>/dev/null; then
    log "ERROR: $MOUNT not writable (I/O error?)"
    record_result "failed" 0 0 0 "backup target not writable"
    exit 4
fi
rm -f "$MOUNT/.write-probe" || true

log "Starting $TIER backup -> $NEW"
mkdir -p "$TIER_DIR"

RSYNC_ARGS=(
    -aH --delete --numeric-ids
    --exclude='node_modules/'
    --exclude='.cache/'
    --exclude='.npm/'
    --exclude='.local/share/Trash/'
    --exclude='*.sock'
    --exclude='.Trash*'
    --exclude='tmp/'
    --exclude='.tmp/'
)

# Hardlink dedupe: link unchanged files to the previous snapshot in this tier.
if [[ -L "$LATEST_LINK" ]] && [[ -d "$LATEST_LINK" ]]; then
    RSYNC_ARGS+=(--link-dest="$LATEST_LINK")
fi

if rsync "${RSYNC_ARGS[@]}" "$SOURCE" "$NEW/"; then
    ln -sfn "$NEW" "$LATEST_LINK"
    END=$(date +%s)
    DUR=$((END - START))
    SIZE=$(du -sb "$NEW" 2>/dev/null | cut -f1 || echo 0)
    FILES=$(find "$NEW" -type f 2>/dev/null | wc -l || echo 0)
    log "Success: ${SIZE}B, ${FILES} files, ${DUR}s"

    # Rotate: keep the most recent $KEEP snapshots in this tier.
    mapfile -t OLD < <(snapshot_dirs_to_prune)
    for d in "${OLD[@]:-}"; do
        prune_snapshot "$d"
    done

    record_result "success" "$SIZE" "$FILES" "$DUR"
else
    END=$(date +%s)
    DUR=$((END - START))
    log "FAILED after ${DUR}s"
    record_result "failed" 0 0 "$DUR" "rsync exit nonzero"
    exit 1
fi
