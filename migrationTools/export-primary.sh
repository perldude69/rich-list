#!/bin/bash
export PGPASSWORD=richlist_postgres_2025
pg_dump -h localhost -p 5656 -U postgres -d xrp_list_db --no-owner --no-privileges --format=custom > migration_backup.dump
if [ $? -ne 0 ]; then echo "pg_dump failed"; exit 1; fi
echo "Exported primary DB to migration_backup.dump"