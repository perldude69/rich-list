#!/bin/bash

# Rich-List PostgreSQL Start Script
# Starts Docker container with PostgreSQL
# Usage: bash scripts/start-postgres.sh

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting PostgreSQL container..."

cd /opt/rich-list

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
  echo "ERROR: docker-compose.yml not found!"
  exit 1
fi

# Start container
docker-compose up -d postgres

if [ $? -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] PostgreSQL container started."
  echo ""
  echo "Waiting for database to be ready..."
  sleep 5
  
  # Check health
  docker-compose ps
  
  echo ""
  echo "Database connection details:"
  echo "  Host: localhost"
  echo "  Port: 5656"
  echo "  User: postgres"
  echo "  Database: xrp_list_db"
  echo ""
  echo "To view logs: docker-compose logs -f postgres"
else
  echo "ERROR: Failed to start PostgreSQL container!"
  exit 1
fi
