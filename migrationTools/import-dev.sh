#!/bin/bash
export PGPASSWORD=richlist_postgres_2025
pg_restore -h localhost -p 5657 -U postgres -d xrp_list_db_dev --clean --if-exists migration_backup.dump
if [ $? -ne 0 ]; then echo "pg_restore failed"; exit 1; fi
echo "Imported data to dev DB"