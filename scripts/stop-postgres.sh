#!/bin/bash

# Rich-List PostgreSQL Stop Script
# Stops Docker container with PostgreSQL
# Usage: bash scripts/stop-postgres.sh

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping PostgreSQL container..."

cd /opt/rich-list

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
  echo "ERROR: docker-compose.yml not found!"
  exit 1
fi

# Stop container (keep volumes)
docker-compose down

if [ $? -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] PostgreSQL container stopped."
  echo ""
  echo "Data persisted in: /opt/rich-list/postgres-data/"
  echo "To restart: bash scripts/start-postgres.sh"
else
  echo "ERROR: Failed to stop PostgreSQL container!"
  exit 1
fi
