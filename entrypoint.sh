#!/bin/sh
set -e

# Ensure upload subdirectories exist. Runs as the node user (UID 1000) which
# must own /app/data/uploads on the host volume. The mkdir is a no-op if the
# dirs already exist, and creates them on fresh deployments.
mkdir -p /app/data/uploads/items /app/data/uploads/profiles

exec node build/index.js
