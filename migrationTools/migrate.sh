#!/bin/bash
export PGPASSWORD=richlist_postgres_2025
echo "Starting migration from primary to dev DB..."

# Check if primary DB is accessible
if ! pg_isready -h localhost -p 5656 -U postgres -d xrp_list_db > /dev/null 2>&1; then
  echo "Error: Primary DB not accessible"
  exit 1
fi

# Export from primary
./migrationTools/export-primary.sh

# Check if dump file was created successfully
if [ ! -s migration_backup.dump ]; then
  echo "Error: Export failed - dump file is empty"
  exit 1
fi

# Check if dev DB server is running
if ! pg_isready -h localhost -p 5657 -U postgres > /dev/null 2>&1; then
  echo "Starting dev DB..."
  cd /opt/devenv && docker compose up -d postgres
  sleep 10
fi

# Ensure the target database exists
psql -h localhost -p 5657 -U postgres -d postgres -c "CREATE DATABASE xrp_list_db_dev;" 2>/dev/null || true

# Import to dev
./migrationTools/import-dev.sh

# Integrity check: Verify data was imported
echo "Verifying data integrity..."
ROW_COUNT=$(psql -h localhost -p 5657 -U postgres -d xrp_list_db_dev -t -c "SELECT COUNT(*) FROM accounts;")
if [ "$ROW_COUNT" -gt 0 ] 2>/dev/null; then
  echo "Integrity check passed: $ROW_COUNT rows in accounts table"
else
  echo "Integrity check failed: No data found in accounts table"
  exit 1
fi

echo "Migration completed successfully"