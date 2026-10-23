#!/usr/bin/env bash
# Production database backup (Linux host). Run from the project directory, e.g. daily via cron:
#   15 2 * * * cd /opt/ai-commerce-studio && ./infra/backup-db.sh >> /var/log/acs-backup.log 2>&1
# Creates a pg_dump custom-format file, verifies it with pg_restore --list, keeps the newest
# $KEEP files and optionally copies the dump off-site (set OFFSITE_CMD, e.g. an rclone/restic command
# that receives the file path as $1). Dumps contain personal data: the directory must be private
# (chmod 700) and off-site copies must be encrypted.
set -euo pipefail

COMPOSE=${COMPOSE:-"docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml"}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/ai-commerce-studio}
KEEP=${KEEP:-14}
OFFSITE_CMD=${OFFSITE_CMD:-}

umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/acs-$(date -u +%Y%m%d-%H%M%S).dump"

$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$file"
tables=$($COMPOSE exec -T db pg_restore --list < "$file" | grep -c 'TABLE DATA' || true)
if [ "${tables:-0}" -lt 1 ]; then
  echo "$(date -u +%FT%TZ) backup verification FAILED for $file" >&2
  exit 1
fi
echo "$(date -u +%FT%TZ) backup ok: $file ($(du -h "$file" | cut -f1), $tables tables with data)"

if [ -n "$OFFSITE_CMD" ]; then
  $OFFSITE_CMD "$file"
fi

ls -1t "$BACKUP_DIR"/acs-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm -f
