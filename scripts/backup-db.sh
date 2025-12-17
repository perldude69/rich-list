#!/bin/bash

# Rich-List Database Backup Script
# Daily backup to /opt/rich-list/backups/
# Usage: bash scripts/backup-db.sh

set -e

# Configuration
BACKUP_DIR="/opt/rich-list/backups"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5656}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-xrp_list_db}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/rich-list_${TIMESTAMP}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database backup..."

# Create backup using pg_dump
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --database="$DB_NAME" \
  --verbose \
  --no-password \
  --format=plain \
  | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully: $BACKUP_FILE ($FILE_SIZE)"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup failed!"
  exit 1
fi

# Clean up old backups (keep last 30 days)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "rich-list_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# List current backups
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current backups:"
ls -lh "$BACKUP_DIR" | tail -5

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup process complete."
