#!/bin/bash
cd /opt/devenv
docker compose down
rm -rf postgres-data
docker compose up -d postgres
sleep 10  # Wait for DB initialization
./migrationTools/import-dev.sh
echo "Dev DB reset and data imported"