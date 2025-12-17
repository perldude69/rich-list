# Nginx Deployment Plan for Rich-List Application

**Created:** December 17, 2025  
**Status:** Ready for Implementation  
**Configuration Approach:** Two-File Symlink Switching

---

## Overview

This plan outlines the complete deployment of the Rich-List Node.js application behind Nginx with SSL/TLS, including easy switching between the new app and the original PHP site configuration.

### Current Environment
- **Application:** Express.js SPA running on port 9876
- **Nginx:** Version 1.24.0 (Ubuntu), currently active
- **SSL:** Let's Encrypt certificates valid for rich-list.info
- **PostgreSQL:** Running on port 5656
- **Node.js:** Currently running manually (PID 2014296)

---

## File Structure After Implementation

```
/etc/nginx/sites-available/
├── default
├── rich-list-classic      ← Original PHP site (renamed from current)
└── rich-list-new          ← New Node.js reverse proxy configuration

/etc/nginx/sites-enabled/
├── default
└── rich-list              ← Active symlink (points to whichever config is active)

/etc/systemd/system/
└── rich-list.service      ← Node.js application service manager

/opt/rich-list/
├── .env                   ← Updated with NODE_ENV=production and ORIGIN
├── server.js              ← Main application entry point
├── public/                ← Static assets
├── routes/                ← API routes
└── NGINX_DEPLOYMENT_PLAN.md ← This document
```

---

## Phase 1: Pre-Deployment Preparation

### 1.1 Rename Classic Configuration
```bash
sudo mv /etc/nginx/sites-available/rich-list /etc/nginx/sites-available/rich-list-classic
```
**Purpose:** Preserve original PHP site configuration as backup

### 1.2 Backup Current .env
```bash
cp /opt/rich-list/.env /opt/rich-list/.env.backup
```
**Purpose:** Safety measure before modifying environment variables

---

## Phase 2: Application Configuration

### 2.1 Update Environment Variables
**File:** `/opt/rich-list/.env`

Add/modify these variables:
```
NODE_ENV=production
PORT=9876
ORIGIN=https://rich-list.info
```

**Rationale:**
- `NODE_ENV=production` - Disables CORS wildcard, enables optimizations
- `PORT=9876` - Maintains current port; proxied through Nginx
- `ORIGIN=https://rich-list.info` - Allows requests from the domain (CORS)

### 2.2 Verify PostgreSQL Connection
```bash
# Verify PostgreSQL is running and accessible
pg_isready -h localhost -p 5656
```

---

## Phase 3: Systemd Service Configuration

### 3.1 Create Systemd Service Unit
**File:** `/etc/systemd/system/rich-list.service`

```ini
[Unit]
Description=Rich-List Node.js Application
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=jim
WorkingDirectory=/opt/rich-list
EnvironmentFile=/opt/rich-list/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=rich-list

[Install]
WantedBy=multi-user.target
```

**Configuration Details:**
- **User:** `jim` (current application owner)
- **WorkingDirectory:** `/opt/rich-list` (application root)
- **EnvironmentFile:** Loads variables from `.env`
- **Restart Policy:** Auto-restart on failure with 10-second delay
- **Logging:** Routes to systemd journal for centralized logging

### 3.2 Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable rich-list
sudo systemctl start rich-list
sudo systemctl status rich-list
```

---

## Phase 4: Nginx Configuration

### 4.1 Create New Nginx Configuration
**File:** `/etc/nginx/sites-available/rich-list-new`

```nginx
upstream rich_list_app {
    server localhost:9876;
    keepalive 64;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name rich-list.info;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rich-list.info;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rich-list.info/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rich-list.info/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Logging
    access_log /var/log/nginx/rich-list.access.log;
    error_log /var/log/nginx/rich-list.error.log warn;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Static assets (from /public directory)
    location ~* ^/(?!api/|socket\.io/)(.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot))$ {
        proxy_pass http://rich_list_app;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # API endpoints
    location /api/ {
        proxy_pass http://rich_list_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # WebSocket (Socket.io)
    location /socket.io/ {
        proxy_pass http://rich_list_app;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # SPA catch-all (serve index.html for client-side routing)
    location / {
        proxy_pass http://rich_list_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Favicon and robots.txt
    location = /favicon.ico {
        access_log off;
        log_not_found off;
    }

    location = /robots.txt {
        access_log off;
        log_not_found off;
    }
}
```

**Configuration Highlights:**

**Upstream Block:**
- Connection pooling to Node.js application
- 64 keepalive connections for efficiency

**SSL/TLS:**
- TLSv1.2 and TLSv1.3 only
- Strong cipher suite configuration
- HTTP/2 enabled for better performance

**Routing Locations:**
1. **Static Assets** - 7-day cache, immutable headers
2. **API Endpoints** - Full proxy with WebSocket upgrade headers
3. **WebSocket (Socket.io)** - Extended timeout (86400s), buffering disabled
4. **SPA Catch-all** - Serves index.html for client-side routing
5. **Hidden Files** - Deny access and suppress logging
6. **Special Files** - Optimize favicon and robots.txt

**Security Headers:**
- X-Frame-Options: Prevents clickjacking
- X-Content-Type-Options: Prevents MIME sniffing
- X-XSS-Protection: Legacy XSS protection
- Referrer-Policy: Controls referrer information

### 4.2 Enable New Configuration
```bash
sudo rm /etc/nginx/sites-enabled/rich-list
sudo ln -s /etc/nginx/sites-available/rich-list-new /etc/nginx/sites-enabled/rich-list
```

### 4.3 Test Nginx Configuration
```bash
sudo nginx -t
```
**Expected Output:** 
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 4.4 Reload Nginx
```bash
sudo systemctl reload nginx
```

---

## Phase 5: Deployment Verification

### 5.1 Service Health Checks
```bash
# Check Node.js service status
sudo systemctl status rich-list

# View recent logs
sudo journalctl -u rich-list -n 20

# Follow logs in real-time
sudo journalctl -u rich-list -f
```

### 5.2 API Endpoint Testing
```bash
# Test health endpoint
curl https://rich-list.info/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-12-17T...","database":"connected","uptime":...}
```

### 5.3 HTTPS/SSL Testing
```bash
# Verify certificate validity
curl -vI https://rich-list.info

# Check certificate expiration
openssl s_client -connect rich-list.info:443 -showcerts | grep "Expire"
```

### 5.4 WebSocket Testing
Open browser developer console at https://rich-list.info and verify:
- No connection errors in console
- Socket.io connection established
- Real-time updates (stats and price updates) flowing

### 5.5 Static Assets Testing
```bash
# Verify cache headers are set
curl -I https://rich-list.info/js/main.js | grep -i cache-control
curl -I https://rich-list.info/css/main.css | grep -i cache-control

# Expected: "Cache-Control: public, immutable, max-age=604800"
```

### 5.6 Nginx Log Review
```bash
# Check for errors
sudo tail -50 /var/log/nginx/rich-list.error.log

# Monitor access logs
sudo tail -f /var/log/nginx/rich-list.access.log
```

---

## Phase 6: Switching Between Configurations

### 6.1 Switch TO the New Node.js App
```bash
# Remove old symlink
sudo rm /etc/nginx/sites-enabled/rich-list

# Create new symlink to rich-list-new
sudo ln -s /etc/nginx/sites-available/rich-list-new /etc/nginx/sites-enabled/rich-list

# Validate and reload
sudo nginx -t
sudo systemctl reload nginx

# Ensure Node.js service is running
sudo systemctl start rich-list
sudo systemctl status rich-list
```

### 6.2 Switch BACK TO the Classic PHP Site
```bash
# Remove current symlink
sudo rm /etc/nginx/sites-enabled/rich-list

# Create symlink to rich-list-classic
sudo ln -s /etc/nginx/sites-available/rich-list-classic /etc/nginx/sites-enabled/rich-list

# Validate and reload
sudo nginx -t
sudo systemctl reload nginx

# Optionally stop Node.js service
sudo systemctl stop rich-list
```

### 6.3 Verify Active Configuration
```bash
# Check which config is active
ls -la /etc/nginx/sites-enabled/rich-list

# Check running services
ps aux | grep -E "node|php-fpm" | grep -v grep

# Test current site
curl -I https://rich-list.info
```

---

## Rollback Procedures

### In Case of Issues with New Configuration

**Quick Rollback:**
```bash
# Switch back to classic
sudo rm /etc/nginx/sites-enabled/rich-list
sudo ln -s /etc/nginx/sites-available/rich-list-classic /etc/nginx/sites-enabled/rich-list
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl stop rich-list
```

**Restore Original .env (if modified):**
```bash
cp /opt/rich-list/.env.backup /opt/rich-list/.env
sudo systemctl restart rich-list
```

**Check Nginx Status:**
```bash
sudo systemctl status nginx
sudo journalctl -u nginx -n 50
```

---

## Maintenance Tasks

### Certificate Renewal
Certbot auto-renewal should already be configured. Verify:
```bash
sudo systemctl status certbot.timer
sudo certbot certificates
```

### Log Rotation
Nginx logs should auto-rotate. Verify:
```bash
cat /etc/logrotate.d/nginx
```

### Service Monitoring
Monitor Node.js service uptime:
```bash
# Check service uptime
sudo systemctl status rich-list

# View service restart history
sudo journalctl -u rich-list --no-tail -o short-iso | head -20
```

---

## Summary Checklist

### Pre-Deployment
- [ ] Backup `.env` file
- [ ] Backup current nginx configuration
- [ ] Verify PostgreSQL is running
- [ ] Document current production state

### Deployment
- [ ] Rename `rich-list` to `rich-list-classic`
- [ ] Create `rich-list-new` configuration
- [ ] Update `.env` with production settings
- [ ] Create systemd service unit
- [ ] Enable and start systemd service
- [ ] Update nginx symlink to `rich-list-new`
- [ ] Validate nginx syntax
- [ ] Reload nginx
- [ ] Verify all endpoints are working

### Post-Deployment
- [ ] Test HTTPS connectivity
- [ ] Verify API endpoints respond
- [ ] Confirm WebSocket connections work
- [ ] Check static assets load and cache
- [ ] Review nginx error logs
- [ ] Confirm systemd service restarts on failure
- [ ] Document any issues or customizations

---

## Notes

- **Reversibility:** Both configurations remain in `/etc/nginx/sites-available/`. Easy to switch between them.
- **Service Management:** Node.js service is managed by systemd, independent of Nginx configuration switches.
- **SSL Certificate:** Existing Let's Encrypt certificates are used; no new certificate generation needed.
- **User Permissions:** Node.js service runs as `jim` user; ensure proper file permissions.
- **Database:** PostgreSQL connection verified; no database schema changes needed.

---

## Related Files in Repository

- `/opt/rich-list/server.js` - Main application entry point
- `/opt/rich-list/package.json` - Node.js dependencies
- `/opt/rich-list/.env` - Environment configuration (to be updated)
- `/opt/rich-list/public/` - Static assets served by Node.js (proxied through Nginx)
- `/opt/rich-list/routes/api.js` - API route definitions

---

**Plan Status:** Ready for implementation review and approval
**Last Updated:** December 17, 2025
