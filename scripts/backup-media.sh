#!/usr/bin/env sh
set -eu

: "${MEDIA_STORAGE_PATH:?MEDIA_STORAGE_PATH is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

if [ ! -d "$MEDIA_STORAGE_PATH" ]; then
    echo "Media directory not found: $MEDIA_STORAGE_PATH" >&2
    exit 2
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIR/routes_oubliees-media-$timestamp.tar.gz"

tar -czf "$output" -C "$MEDIA_STORAGE_PATH" .

printf '%s\n' "$output"
