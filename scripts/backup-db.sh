#!/bin/bash
#
# Database Backup Script
# Creates timestamped PostgreSQL backups with optional S3/GCS upload
#
# Usage:
#   ./scripts/backup-db.sh                    # Local backup only
#   ./scripts/backup-db.sh --upload s3        # Upload to S3
#   ./scripts/backup-db.sh --upload gcs       # Upload to GCS
#
# Environment variables:
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB - Database credentials
#   BACKUP_RETENTION_DAYS - Days to keep local backups (default: 7)
#   S3_BUCKET - S3 bucket name for uploads
#   GCS_BUCKET - GCS bucket name for uploads
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Load environment
if [ -f "${ROOT_DIR}/.env.prod" ]; then
    source "${ROOT_DIR}/.env.prod"
elif [ -f "${ROOT_DIR}/.env" ]; then
    source "${ROOT_DIR}/.env"
fi

# Validate required variables
if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DB" ]; then
    echo "Error: Database credentials not configured"
    echo "Set POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB"
    exit 1
fi

BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "================================================"
echo "  ThreatForge - Database Backup"
echo "================================================"
echo ""
echo "Database: ${POSTGRES_DB}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Check if running in Docker or direct PostgreSQL
if docker compose ps db 2>/dev/null | grep -q "running"; then
    echo "Creating backup from Docker container..."
    docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"
elif command -v pg_dump &> /dev/null; then
    echo "Creating backup using local pg_dump..."
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h localhost -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"
else
    echo "Error: Neither Docker db container nor pg_dump available"
    exit 1
fi

# Verify backup was created
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file was not created"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Upload to cloud storage if requested
UPLOAD_TARGET="${1:-}"
if [ "$UPLOAD_TARGET" = "--upload" ]; then
    CLOUD="${2:-}"

    case "$CLOUD" in
        s3)
            if [ -z "$S3_BUCKET" ]; then
                echo "Error: S3_BUCKET not set"
                exit 1
            fi
            echo "Uploading to S3: s3://${S3_BUCKET}/backups/"
            aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/"
            echo "Upload complete!"
            ;;
        gcs)
            if [ -z "$GCS_BUCKET" ]; then
                echo "Error: GCS_BUCKET not set"
                exit 1
            fi
            echo "Uploading to GCS: gs://${GCS_BUCKET}/backups/"
            gsutil cp "$BACKUP_FILE" "gs://${GCS_BUCKET}/backups/"
            echo "Upload complete!"
            ;;
        *)
            echo "Unknown cloud provider: $CLOUD"
            echo "Supported: s3, gcs"
            ;;
    esac
fi

# Clean up old backups
echo ""
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
REMAINING=$(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
echo "Remaining local backups: $REMAINING"

echo ""
echo "================================================"
echo "  Backup Complete!"
echo "================================================"
echo ""
echo "Backup file: $BACKUP_FILE"
echo ""
echo "To restore:"
echo "  gunzip -c $BACKUP_FILE | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB"
echo ""
