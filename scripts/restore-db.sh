#!/bin/bash

# Rich-List Database Restore Script
# Restore from a specific backup file
# Usage: bash scripts/restore-db.sh [backup_file]

set -e

# Configuration
BACKUP_DIR="/opt/rich-list/backups"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5656}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-xrp_list_db}"

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: bash scripts/restore-db.sh [backup_file]"
  echo ""
  echo "Available backups:"
  ls -lh "$BACKUP_DIR" | tail -10
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database restore from: $BACKUP_FILE"
echo "WARNING: This will overwrite all data in $DB_NAME!"
read -p "Are you sure? Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Terminate existing connections
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Terminating existing connections..."
PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname=postgres \
  --command="SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();"

# Drop and recreate database
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dropping and recreating database..."
PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname=postgres \
  --command="DROP DATABASE IF EXISTS $DB_NAME;"

PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname=postgres \
  --command="CREATE DATABASE $DB_NAME;"

# Restore from backup
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME"

if [ $? -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore completed successfully!"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Restore failed!"
  exit 1
fi
