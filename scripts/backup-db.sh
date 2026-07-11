#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DATABASE_USERNAME:?DATABASE_USERNAME is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIR/routes_oubliees-$timestamp.dump"

pg_dump -Fc "$DATABASE_URL" --username "$DATABASE_USERNAME" --file "$output"

printf '%s\n' "$output"
