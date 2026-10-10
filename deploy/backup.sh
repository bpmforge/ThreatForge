#!/bin/bash
#
# ThreatForge - Database Backup Script
#
# Usage:
#   ./deploy/backup.sh              # Create backup
#   ./deploy/backup.sh --restore backup-file.sql.gz  # Restore from backup
#

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
COMPOSE_FILE="docker-compose.prod.yml"

# Load environment
if [[ -f .env.prod ]]; then
    set -a
    source .env.prod
    set +a
fi

mkdir -p "$BACKUP_DIR"

if [[ "${1:-}" == "--restore" ]]; then
    BACKUP_FILE="${2:-}"
    if [[ -z "$BACKUP_FILE" ]] || [[ ! -f "$BACKUP_FILE" ]]; then
        echo "Usage: $0 --restore <backup-file.sql.gz>"
        exit 1
    fi

    echo "Restoring from: $BACKUP_FILE"
    echo "WARNING: This will overwrite the current database!"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi

    gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T db \
        psql -U "${POSTGRES_USER:-flowthreat}" -d "${POSTGRES_DB:-flowthreat_prod}"

    echo "Restore complete!"
else
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

    echo "Creating backup: $BACKUP_FILE"

    docker compose -f "$COMPOSE_FILE" exec -T db \
        pg_dump -U "${POSTGRES_USER:-flowthreat}" "${POSTGRES_DB:-flowthreat_prod}" | \
        gzip > "$BACKUP_FILE"

    # Keep only last 7 daily backups
    ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm

    echo "Backup complete: $BACKUP_FILE"
    echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
fi
