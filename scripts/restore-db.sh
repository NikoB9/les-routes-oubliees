#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DATABASE_USERNAME:?DATABASE_USERNAME is required}"

if [ "$#" -ne 1 ]; then
    echo "Usage: restore-db.sh /path/to/backup.dump" >&2
    exit 2
fi

backup_file="$1"

if [ ! -f "$backup_file" ]; then
    echo "Backup file not found: $backup_file" >&2
    exit 2
fi

pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" --username "$DATABASE_USERNAME" "$backup_file"
