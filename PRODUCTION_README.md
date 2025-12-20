# Production Deployment Instructions

## Overview

This folder contains the cleaned Rich-List application ready for production deployment.

## Files Included

- All application code (server.js, routes/, services/, etc.)
- Production environment configuration (.env)
- Deployment configurations (in deployment/ folder)
- Cleaned codebase with unused files removed

## Deployment Steps

1. **Copy to Production Server:**

   ```bash
   scp -r /opt/devenv user@prod-server:/opt/rich-list
   ```

2. **Install Dependencies:**

   ```bash
   cd /opt/rich-list
   npm ci --production
   ```

3. **Setup Systemd Service:**

   ```bash
   sudo cp deployment/rich-list.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable rich-list
   ```

4. **Configure Nginx:**
   - Backup current config: `sudo mv /etc/nginx/sites-available/rich-list /etc/nginx/sites-available/rich-list-classic`
   - Copy new config: `sudo cp deployment/nginx-rich-list-new.conf /etc/nginx/sites-available/rich-list-new`
   - Create symlink: `sudo ln -s /etc/nginx/sites-available/rich-list-new /etc/nginx/sites-enabled/rich-list`
   - Test: `sudo nginx -t`
   - Reload: `sudo systemctl reload nginx`

5. **Start Application:**
   ```bash
   sudo systemctl start rich-list
   sudo systemctl status rich-list
   ```

## Verification

- Test HTTPS: `curl -I https://rich-list.info`
- Test API: `curl https://rich-list.info/api/stats`
- Check logs: `sudo journalctl -u rich-list -f`

## Rollback

If issues occur, switch back to classic PHP site:

```bash
sudo rm /etc/nginx/sites-enabled/rich-list
sudo ln -s /etc/nginx/sites-available/rich-list-classic /etc/nginx/sites-enabled/rich-list
sudo systemctl reload nginx
sudo systemctl stop rich-list
```

## Notes

- PostgreSQL should be running on port 5656
- SSL certificates assumed to be in place via Let's Encrypt
- Application runs on port 9876, proxied through Nginx
