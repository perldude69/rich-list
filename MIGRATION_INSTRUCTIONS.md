# Dev Environment Migration Instructions

This document outlines the steps to set up a dev environment in /opt/devenv, isolated from the prod version in /opt/rich-list.

## Overview

- Prod: /opt/rich-list (DB port 5656, app port 9876, DB name xrp_list_db, container rich-list-postgres)
- Dev: /opt/devenv (DB port 5657, app port 8585, DB name xrp_list_db_dev, container rich-list-postgres-dev)

## Steps

1. Directory Migration: `sudo cp -a /opt/rich-list/. /opt/devenv/`
2. Modify /opt/devenv/docker-compose.yml:
   - Port: "5657:5432"
   - Volume: - /opt/devenv/postgres-data:/var/lib/postgresql/data
   - DB: POSTGRES_DB: xrp_list_db_dev
   - Container: container_name: rich-list-postgres-dev
   - Init: - /opt/devenv/scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
3. Create /opt/devenv/.env.dev:
   DB_HOST=localhost
   DB_PORT=5657
   DB_USER=postgres
   DB_PASSWORD=richlist_postgres_2025
   DB_NAME=xrp_list_db_dev
   PORT=8585
   NODE_ENV=development
4. Update /opt/devenv/server.js: dotenv.config({ path: '.env.dev' })
5. Update /opt/devenv/package.json scripts: "dev:start": "node --env-file=.env.dev server.js", change docker-compose to docker compose
6. Create ./migrationTools folder with scripts: export-primary.sh, import-dev.sh, reset-dev.sh, migrate.sh
7. Startup: cd /opt/devenv && docker compose up -d postgres
8. Migrate: ./migrationTools/migrate.sh
9. Start app: npm run dev:start

## Migration Tools

- export-primary.sh: pg_dump from prod DB
- import-dev.sh: pg_restore to dev DB
- reset-dev.sh: Wipe and re-import dev DB
- migrate.sh: Full export/import wrapper
