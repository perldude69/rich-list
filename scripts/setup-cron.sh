#!/bin/bash

# Rich-List Cron Job Setup Script
# Sets up daily backup at 2 AM
# Usage: bash scripts/setup-cron.sh

CRON_JOB="0 2 * * * cd /opt/rich-list && bash scripts/backup-db.sh >> /opt/rich-list/backups/cron.log 2>&1"

echo "Setting up cron job for daily database backups at 2:00 AM..."

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "scripts/backup-db.sh"; then
  echo "Cron job already exists!"
  crontab -l | grep backup-db.sh
  exit 0
fi

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

if [ $? -eq 0 ]; then
  echo "Cron job added successfully!"
  echo ""
  echo "Current cron jobs:"
  crontab -l | grep -v "^#"
else
  echo "ERROR: Failed to add cron job!"
  exit 1
fi
