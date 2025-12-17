# PATH TO PRODUCTION: Rich-List SPA
**Document Version:** 1.0  
**Last Updated:** December 17, 2025  
**Status:** Ready for Implementation  
**Audience:** Development Team, DevOps, Product Managers

---

## EXECUTIVE SUMMARY

This document provides a structured, prioritized path to deploy the Rich-List Single Page Application to production. It separates tasks into **four priority levels**, each with specific subtasks, success criteria, and implementation steps.

The application is currently **development-ready** and requires hardening, monitoring, and operational procedures before production deployment.

**Estimated Timeline:**
- **CRITICAL tasks:** 2-3 days
- **HIGH priority:** 3-5 days  
- **MEDIUM priority:** 1-2 weeks (can run in parallel)
- **LOW priority:** Post-launch improvements

**Key Dates:**
- Target Production Launch: January 2026 (3-4 weeks)
- Current Phase: Development & Testing Complete
- Deployment Target: Existing server running Nginx/PHP (replacement scenario)

---

## TABLE OF CONTENTS

1. [Priority Framework](#priority-framework)
2. [CRITICAL PRIORITY TASKS](#critical-priority-tasks)
3. [HIGH PRIORITY TASKS](#high-priority-tasks)
4. [MEDIUM PRIORITY TASKS](#medium-priority-tasks)
5. [LOW PRIORITY TASKS](#low-priority-tasks)
6. [Implementation Schedule](#implementation-schedule)
7. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
8. [Rollback Procedures](#rollback-procedures)
9. [Success Criteria](#success-criteria)
10. [Post-Launch Operations](#post-launch-operations)

---

## PRIORITY FRAMEWORK

### Priority Definitions

| Priority | Impact | Timeline | Owner |
|----------|--------|----------|-------|
| **CRITICAL** | Blocks launch; causes data loss, security issues, or service outage | Must complete before prod | Tech Lead |
| **HIGH** | Should complete before launch; affects stability, security, or user experience | Complete in parallel | Tech Lead / DevOps |
| **MEDIUM** | Nice to have at launch; improves observability and operational efficiency | Weeks 2-3 | DevOps / SRE |
| **LOW** | Post-launch improvements; technical debt reduction | After launch | Team |

### Decision Criteria

Tasks are prioritized based on:
1. **Severity** - Impact if not fixed (data loss > security > performance)
2. **Probability** - Likelihood of occurrence in production
3. **Effort** - Time required vs. complexity
4. **Dependencies** - Blocking other work

---

## CRITICAL PRIORITY TASKS

**These must be completed before any production deployment attempt.**

---

### CRITICAL-1: Fix Missing Database Tables

**Problem:** Database schema is incomplete. Missing `stats` and `xrp_price` tables that are referenced in `server.js`.

**Scope:** Database initialization only  
**Owner:** Database Administrator  
**Timeline:** 2-4 hours  
**Risk Level:** CRITICAL (server will crash without these tables)

#### Subtask 1.1: Validate Missing Tables
- **Action:** Connect to PostgreSQL and verify which tables exist
  ```bash
  docker-compose exec postgres psql -U postgres -d xrp_list_db -c "\dt"
  ```
- **Expected Output:** Should show 9 tables (currently shows 7)
- **Success Criteria:** List clearly shows missing `stats` and `xrp_price`

#### Subtask 1.2: Create SQL Migration
- **Action:** Create `/opt/rich-list/scripts/migration-001-add-missing-tables.sql`
- **Contents:** Schema definitions for:
  - `stats` table (referenced in server.js broadcast loop)
  - `xrp_price` table (referenced in price subscription)
- **Success Criteria:** File exists and is valid SQL syntax

#### Subtask 1.3: Apply Migration
- **Action:** Execute migration against development database
  ```bash
  PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5656 -U postgres -d xrp_list_db -f scripts/migration-001-add-missing-tables.sql
  ```
- **Success Criteria:** Migration executes without errors; tables appear in `\dt`

#### Subtask 1.4: Verify With Server Test
- **Action:** Start server and confirm Socket.IO broadcasts work
  ```bash
  npm start
  # In another terminal:
  curl http://localhost:9876/api/health
  ```
- **Success Criteria:** Health check returns `"status": "ok"` with no database errors

**Documentation Reference:**
- See `/opt/rich-list/scripts/init-db.sql` for existing schema
- See `server.js` lines 84-170 for broadcast functions using these tables

---

### CRITICAL-2: Validate Data Integrity

**Problem:** 7.4M records imported, but no verification that data is clean and consistent.

**Scope:** Data validation and quality assurance  
**Owner:** Database Administrator  
**Timeline:** 3-5 hours  
**Risk Level:** CRITICAL (corrupted data will serve incorrect information)

#### Subtask 2.1: Verify Record Counts
- **Action:** Run count queries on all tables
  ```bash
  docker-compose exec postgres psql -U postgres -d xrp_list_db << 'SQL'
  SELECT 'accounts' as table_name, COUNT(*) as rows FROM accounts
  UNION ALL
  SELECT 'escrows', COUNT(*) FROM escrows
  UNION ALL
  SELECT 'price_history', COUNT(*) FROM price_history
  -- ... etc for all tables
  SQL
  ```
- **Expected Output:**
  - `accounts`: ~7.4M rows
  - `escrows`: ~14k rows
  - Other tables: Has valid data
- **Success Criteria:** Counts match expected values within ±1%

#### Subtask 2.2: Check Data Integrity Constraints
- **Action:** Run integrity check queries
  ```bash
  # Check for orphaned foreign keys
  SELECT COUNT(*) FROM escrows WHERE account_id NOT IN (SELECT account_id FROM accounts);
  
  # Check for NULL values in required fields
  SELECT COUNT(*) FROM accounts WHERE account_id IS NULL;
  ```
- **Success Criteria:** Zero orphaned records, zero NULL in required fields

#### Subtask 2.3: Validate Index Performance
- **Action:** Query plan analysis for key searches
  ```bash
  EXPLAIN ANALYZE SELECT * FROM accounts WHERE account_id = 'rN7n7otQDd6FczFgLdlqtyMVrn3Rqq5c9P';
  ```
- **Expected Output:** Uses index; sequential scan only if no match
- **Success Criteria:** Query uses `account_id` index, not sequential scan

#### Subtask 2.4: Test Top Records Retrievals
- **Action:** Manually verify top wallet balances match XRPL
  ```bash
  curl http://localhost:9876/api/richlist?limit=10
  ```
- **Expected Output:** Top wallets match known addresses (e.g., exchange wallets)
- **Success Criteria:** Top 3-5 wallets verified against public XRPL data

**Documentation Reference:**
- See `PROJECT_COMPLETION_SUMMARY.md` for expected data volumes
- See `ARCHITECTURE_AND_OPERATIONS.md` for data validation procedures

---

### CRITICAL-3: Implement Backup Verification

**Problem:** Backups run daily, but we cannot verify they work until we try to restore one.

**Scope:** Backup/recovery testing and validation  
**Owner:** DevOps / Database Administrator  
**Timeline:** 2-3 hours (first run); 1 hour ongoing  
**Risk Level:** CRITICAL (untested backups may be worthless)

#### Subtask 3.1: Create Backup Verification Script
- **Action:** Create `/opt/rich-list/scripts/verify-backup.sh`
- **Purpose:** Test backup integrity without restoration
  ```bash
  gzip -t "$BACKUP_FILE"  # Tests compression integrity
  # Plus: file size validation, timestamp checks
  ```
- **Success Criteria:** Script exists and runs without errors

#### Subtask 3.2: Perform Test Restore
- **Action:** Restore latest backup to test database
  ```bash
  # Create test database
  PGPASSWORD="$DB_PASSWORD" psql -U postgres -c "CREATE DATABASE xrp_list_db_test;"
  
  # Restore into test database
  gunzip -c backups/rich-list_LATEST.sql.gz | PGPASSWORD="$DB_PASSWORD" psql -d xrp_list_db_test
  ```
- **Success Criteria:** Restore completes; record counts match original

#### Subtask 3.3: Validate Restored Data
- **Action:** Run spot checks on restored database
  ```bash
  # Test queries on restored database
  PGPASSWORD="$DB_PASSWORD" psql -d xrp_list_db_test -c "SELECT COUNT(*) FROM accounts;"
  ```
- **Success Criteria:** Counts match source database exactly

#### Subtask 3.4: Document Restore Procedure
- **Action:** Create detailed restore runbook
- **Contents:**
  - Step-by-step restore process
  - Estimated time to restore (7.4M records)
  - Validation queries post-restore
  - Rollback steps if issues found
- **Success Criteria:** Document exists; procedure is tested

#### Subtask 3.5: Test Cron-Based Automated Backups
- **Action:** Run `bash scripts/setup-cron.sh` (if not already running)
- **Verify:** Backup runs at scheduled time (2 AM)
  ```bash
  # Check cron job
  crontab -l | grep backup-db.sh
  
  # Check backup logs
  tail -20 /opt/rich-list/backups/cron.log
  ```
- **Success Criteria:** Cron job exists; recent backup in log

**Documentation Reference:**
- See `/opt/rich-list/scripts/backup-db.sh` for implementation
- See `/opt/rich-list/scripts/restore-db.sh` for restore logic
- See `ARCHITECTURE_AND_OPERATIONS.md` for backup strategy

---

### CRITICAL-4: Security Audit - Environment Variables & Secrets

**Problem:** Database password and other secrets are in `.env` file; need to ensure they're not exposed in production.

**Scope:** Secrets management and configuration  
**Owner:** Tech Lead / Security  
**Timeline:** 2-3 hours  
**Risk Level:** CRITICAL (exposed credentials = full data access)

#### Subtask 4.1: Audit .env File
- **Action:** Review `/opt/rich-list/.env` for sensitive data
  ```bash
  cat /opt/rich-list/.env | grep -E "PASSWORD|SECRET|KEY|TOKEN"
  ```
- **Check Points:**
  - [ ] `DB_PASSWORD` set to strong random value
  - [ ] No hardcoded production credentials
  - [ ] No API keys or tokens
  - [ ] NODE_ENV appropriate for target (should be "production")
- **Success Criteria:** No plain-text secrets in version control

#### Subtask 4.2: Verify .env Not in Git
- **Action:** Confirm `.env` is gitignored
  ```bash
  cat /opt/rich-list/.gitignore | grep "\.env"
  ```
- **Success Criteria:** `.env*` is in .gitignore; file not in git history

#### Subtask 4.3: Prepare Production Secrets
- **Action:** Create production `.env` with:
  - Unique database password (NOT same as dev)
  - `NODE_ENV=production`
  - `ORIGIN=https://rich-list.info` (actual domain)
  - `PORT=9876`
  - CORS configuration
- **Success Criteria:** Production `.env` prepared (not committed)

#### Subtask 4.4: Document Secrets Management Process
- **Action:** Create `/opt/rich-list/SECRETS_MANAGEMENT.md`
- **Contents:**
  - How to securely generate database password
  - How to store production `.env` (not in git)
  - How to rotate secrets
  - Emergency access procedures
- **Success Criteria:** Document exists and is clear

**Documentation Reference:**
- See `server.js` lines 27-32 for CORS configuration
- See `config/database.js` for DB connection setup
- See `NGINX_DEPLOYMENT_PLAN.md` section 2.1 for environment variables

---

### CRITICAL-5: Fix CORS Configuration for Production

**Problem:** Current code uses `CORS: origin: "*"` in development; production must be restricted.

**Scope:** Security hardening  
**Owner:** Tech Lead  
**Timeline:** 1-2 hours  
**Risk Level:** HIGH (unrestricted CORS is security vulnerability)

#### Subtask 5.1: Verify CORS Configuration
- **Action:** Review `server.js` lines 27-30
  ```javascript
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : "*",
    credentials: true,
  }
  ```
- **Current Behavior:**
  - Development: Allows all origins (`*`)
  - Production: `false` (blocks all cross-origin requests)
- **Issue:** `false` is too restrictive; should allow actual domain

#### Subtask 5.2: Update CORS with Domain Whitelist
- **Action:** Modify CORS to accept production domain
  ```javascript
  // In server.js, update CORS configuration:
  cors: {
    origin: process.env.NODE_ENV === "production" 
      ? process.env.ORIGIN || "https://rich-list.info"
      : "*",
    credentials: true,
  }
  ```
- **Success Criteria:** Configuration allows `https://rich-list.info`

#### Subtask 5.3: Test CORS in Production Mode
- **Action:** Start server with NODE_ENV=production locally
  ```bash
  NODE_ENV=production npm start
  # Test CORS header is set correctly
  curl -i http://localhost:9876/api/health
  ```
- **Expected Output:** Response includes correct `Access-Control-Allow-Origin` header
- **Success Criteria:** Header matches ORIGIN env var

**Documentation Reference:**
- See `NGINX_DEPLOYMENT_PLAN.md` section 2.1 for CORS setup
- See `server.js` lines 26-33 for current implementation

---

## HIGH PRIORITY TASKS

**These should be completed before launch. They address stability, security, and operability.**

---

### HIGH-1: Implement Production Logging

**Problem:** No structured logging; errors and events only go to console. Production needs persistent, queryable logs.

**Scope:** Observability infrastructure  
**Owner:** DevOps / Tech Lead  
**Timeline:** 4-6 hours  
**Risk Level:** HIGH (can't diagnose production issues)

#### Subtask 1.1: Add Winston Logger Library
- **Action:** Add logging dependency to `package.json`
  ```bash
  npm install winston
  ```
- **Configuration:** Create `/opt/rich-list/config/logger.js`
  - Console output for errors and warnings
  - File output for all events (rotating daily)
  - JSON format for structured logs
- **Success Criteria:** `logger.js` module exists; can be imported

#### Subtask 1.2: Integrate Logging Into Server
- **Action:** Update `server.js` to use logger
  - Replace `console.log()` with `logger.info()`
  - Replace `console.error()` with `logger.error()`
- **Log Key Events:**
  - Server startup/shutdown
  - Database connections
  - API requests/responses
  - Socket.IO connections
  - Error stack traces
- **Success Criteria:** Server logs to file; format is JSON

#### Subtask 1.3: Create Log Rotation Policy
- **Action:** Configure log rotation in `logger.js`
  - Daily rotation (new file each day)
  - Keep 30 days of logs
  - Compress older logs (gzip)
- **Location:** `/opt/rich-list/logs/` directory
- **Success Criteria:** Logs directory created; rotation configured

#### Subtask 1.4: Document Log Access
- **Action:** Create `/opt/rich-list/LOG_MANAGEMENT.md`
- **Contents:**
  - Where to find logs (file paths)
  - How to search logs (grep, jq)
  - Important error patterns to watch for
  - How to debug issues using logs
- **Success Criteria:** Documentation exists and is clear

**Implementation Notes:**
- Use `winston` with `winston-daily-rotate-file` for rotation
- JSON format enables automated parsing and monitoring
- Keep both console and file output (console helps with `npm start`)

---

### HIGH-2: Implement Health Checks & Monitoring Endpoints

**Problem:** Production needs to verify that all systems are working. Requires dedicated health check endpoints.

**Scope:** Operational readiness  
**Owner:** DevOps / Tech Lead  
**Timeline:** 3-4 hours  
**Risk Level:** HIGH (can't detect service degradation)

#### Subtask 2.1: Create Comprehensive Health Check Endpoint
- **Action:** Enhance `/api/health` endpoint in `server.js`
- **Current State:** Returns basic health info
- **Additions Needed:**
  ```javascript
  {
    status: "ok",  // ok, degraded, error
    timestamp: ISO timestamp,
    checks: {
      database: { status: "up", latency_ms: 45 },
      server: { status: "up", uptime_sec: 3600 },
      socket_io: { status: "up", connections: 12 },
      api: { status: "up", requests_total: 1234 }
    },
    version: "1.0.0"
  }
  ```
- **Success Criteria:** Endpoint returns detailed health info

#### Subtask 2.2: Add Liveness & Readiness Probes
- **Action:** Create two additional endpoints for Kubernetes/Docker
  - `GET /health/live` - Is process alive?
  - `GET /health/ready` - Is service ready to accept traffic?
- **Live Check:** Process is running (always true)
- **Ready Check:** Database connected AND can query
- **Success Criteria:** Both endpoints exist and respond correctly

#### Subtask 2.3: Integrate Health Checks Into Monitoring
- **Action:** Document how to use health endpoints with monitoring systems
- **Use Cases:**
  - Load balancer checks (every 10 seconds)
  - Nagios/Prometheus scraping
  - Uptime monitoring services
- **Success Criteria:** Documentation shows how to configure monitoring

#### Subtask 2.4: Test Health Endpoints
- **Action:** Verify health checks under various conditions
  ```bash
  # Normal operation
  curl http://localhost:9876/health/ready
  
  # Database down (simulate with docker-compose stop)
  npm run docker:stop
  curl http://localhost:9876/health/ready  # Should return unhealthy
  npm run docker:start
  ```
- **Success Criteria:** Endpoints correctly reflect system state

---

### HIGH-3: Implement Rate Limiting & DDoS Protection

**Problem:** No rate limiting; public API is vulnerable to abuse and DDoS attacks.

**Scope:** Security hardening  
**Owner:** Tech Lead / Security  
**Timeline:** 2-3 hours  
**Risk Level:** HIGH (API could be disabled by malicious traffic)

#### Subtask 3.1: Add express-rate-limit Dependency
- **Action:** Add rate limiting library
  ```bash
  npm install express-rate-limit
  ```
- **Purpose:** Limit requests per IP address
- **Success Criteria:** Library installed in `package.json`

#### Subtask 3.2: Configure Rate Limits
- **Action:** Create `/opt/rich-list/config/rate-limits.js`
- **Configuration:**
  - Global limit: 100 requests per minute per IP
  - Strict endpoints: 10 requests per minute for `/api/search`
  - WebSocket: 50 messages per minute per client
- **Bypass:** Allow internal IPs if behind Nginx
- **Success Criteria:** Rate limit config file exists

#### Subtask 3.3: Integrate Into Express Server
- **Action:** Add middleware to `server.js`
  ```javascript
  const rateLimit = require('express-rate-limit');
  app.use('/api/', limiter);
  ```
- **Apply Different Limits:**
  - Search endpoint (expensive): 10/min
  - Rich list (cached): 100/min
  - Health check: unlimited (for monitoring)
- **Success Criteria:** Rate limiting middleware active

#### Subtask 3.4: Test Rate Limiting
- **Action:** Verify rate limits work correctly
  ```bash
  # Send 20 rapid requests
  for i in {1..20}; do curl http://localhost:9876/api/health; done
  # Should get 429 (Too Many Requests) after limit
  ```
- **Success Criteria:** 429 responses received when limit exceeded

---

### HIGH-4: Implement Input Validation & Sanitization

**Problem:** API endpoints don't validate input; vulnerable to SQL injection and malformed data.

**Scope:** Security hardening  
**Owner:** Tech Lead  
**Timeline:** 4-6 hours  
**Risk Level:** HIGH (SQL injection could expose all data)

#### Subtask 4.1: Add Input Validation Library
- **Action:** Add validation framework
  ```bash
  npm install joi  # or: zod, yup
  ```
- **Purpose:** Validate request parameters before processing
- **Success Criteria:** Library installed in `package.json`

#### Subtask 4.2: Create Validation Schemas
- **Action:** Create `/opt/rich-list/config/validators.js`
- **Schemas Needed:**
  ```javascript
  schemas = {
    account: joi.string().pattern(/^r[a-zA-Z0-9]{24,34}$/).required(),
    limit: joi.number().integer().min(1).max(1000).default(100),
    offset: joi.number().integer().min(0).default(0),
    timeframe: joi.string().valid('1d', '1w', '1m', '1y'),
  }
  ```
- **Success Criteria:** All common parameters have validation schemas

#### Subtask 4.3: Apply Validation to API Routes
- **Action:** Update `/opt/rich-list/routes/api.js`
- **For Each Endpoint:**
  - Validate request parameters against schema
  - Return 400 Bad Request if invalid
  - Log validation failures for security monitoring
- **Example:**
  ```javascript
  const { error, value } = validators.account.validate(req.query.account);
  if (error) return res.status(400).json({ error: error.details });
  ```
- **Success Criteria:** All endpoints validate input

#### Subtask 4.4: Test Validation
- **Action:** Test with malicious inputs
  ```bash
  # Invalid account format
  curl "http://localhost:9876/api/search?account='); DROP TABLE accounts; --"
  # Should return 400, not execute query
  
  # Negative offset
  curl "http://localhost:9876/api/richlist?offset=-1"
  # Should return 400
  ```
- **Success Criteria:** Invalid inputs rejected safely

**Documentation Reference:**
- See `/opt/rich-list/routes/api.js` for current endpoint implementations
- Current parameters: account, limit, offset, timeframe

---

### HIGH-5: Implement Error Handling & Recovery

**Problem:** No consistent error handling; crashes or partial failures not managed gracefully.

**Scope:** Reliability and stability  
**Owner:** Tech Lead  
**Timeline:** 3-5 hours  
**Risk Level:** HIGH (errors cause service interruption)

#### Subtask 5.1: Create Error Classes
- **Action:** Create `/opt/rich-list/errors/AppError.js`
- **Types:**
  ```javascript
  class AppError extends Error { }
  class ValidationError extends AppError { }
  class DatabaseError extends AppError { }
  class NotFoundError extends AppError { }
  ```
- **Success Criteria:** Error class module created

#### Subtask 5.2: Add Global Error Handler
- **Action:** Create middleware in `server.js`
  ```javascript
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    res.status(err.status || 500).json({
      error: err.message,
      status: err.status || 500
    });
  });
  ```
- **Behavior:**
  - Validation errors: 400
  - Not found errors: 404
  - Database errors: 503 (service unavailable)
  - Other errors: 500
- **Success Criteria:** Global error handler in place

#### Subtask 5.3: Add Graceful Degradation
- **Action:** Handle missing/failing services
- **Database Down:**
  - Health check returns 503
  - API endpoints return error message
  - Socket.IO attempts reconnection
- **Socket.IO Down:**
  - API still works
  - Real-time updates unavailable but cached data serves
- **Success Criteria:** Service degrades gracefully

#### Subtask 5.4: Test Error Scenarios
- **Action:** Verify error handling under failure conditions
  ```bash
  # Stop database
  npm run docker:stop
  curl http://localhost:9876/api/stats
  # Should return 503, not 500 or crash
  
  # Invalid JSON POST
  curl -X POST -d "not json" http://localhost:9876/api/test
  # Should return 400 Bad Request
  ```
- **Success Criteria:** All error scenarios handled gracefully

---

### HIGH-6: Prepare Nginx Reverse Proxy Configuration

**Problem:** Application currently accessible only on localhost:9876. Production needs Nginx proxy with SSL.

**Scope:** Deployment infrastructure  
**Owner:** DevOps  
**Timeline:** 2-3 hours (if using NGINX_DEPLOYMENT_PLAN.md)  
**Risk Level:** HIGH (users won't be able to access service without this)

#### Subtask 6.1: Review Existing Plan
- **Action:** Review `/opt/rich-list/NGINX_DEPLOYMENT_PLAN.md`
- **Current Status:** Detailed plan exists from Phase 8
- **Success Criteria:** Plan is understood and ready to implement

#### Subtask 6.2: Prepare Nginx Configuration File
- **Action:** Create `/etc/nginx/sites-available/rich-list-new`
- **Key Sections:**
  - Upstream backend (port 9876)
  - SSL configuration (Let's Encrypt certs)
  - Reverse proxy headers (X-Forwarded-For, etc.)
  - Static file caching for `/public`
  - Gzip compression
- **Success Criteria:** Configuration file created (not yet activated)

#### Subtask 6.3: Test Nginx Configuration Syntax
- **Action:** Validate configuration before deployment
  ```bash
  sudo nginx -t
  ```
- **Expected Output:** `syntax is ok` message
- **Success Criteria:** No syntax errors

#### Subtask 6.4: Plan Switchover Strategy
- **Action:** Document exact steps to switch from PHP to Node.js
- **Steps:**
  1. Backup current config: `cp rich-list rich-list-classic`
  2. Test new config: `nginx -t`
  3. Update symlink: `ln -sf rich-list-new rich-list`
  4. Reload Nginx: `systemctl reload nginx`
  5. Verify: `curl https://rich-list.info`
  6. Rollback if needed: Restore symlink, reload
- **Success Criteria:** Switchover plan is documented

---

### HIGH-7: Create Production Deployment Script

**Problem:** Manual deployment steps are error-prone. Need automated, repeatable deployment.

**Scope:** Operational process  
**Owner:** DevOps  
**Timeline:** 2-3 hours  
**Risk Level:** MEDIUM (manual errors could cause downtime)

#### Subtask 7.1: Create Deployment Script
- **Action:** Create `/opt/rich-list/scripts/deploy-production.sh`
- **Contents:**
  ```bash
  #!/bin/bash
  set -e
  
  # 1. Backup current database
  npm run db:backup
  
  # 2. Pull latest code
  git pull origin main
  
  # 3. Install dependencies
  npm install --production
  
  # 4. Run migrations
  node scripts/run-migrations.js
  
  # 5. Restart service
  systemctl restart rich-list
  
  # 6. Verify health
  curl https://rich-list.info/api/health
  ```
- **Success Criteria:** Script exists and is executable

#### Subtask 7.2: Add Pre-Deployment Checks
- **Action:** Add validation steps before deployment
  ```bash
  # Check disk space
  # Verify database connectivity
  # Ensure backups are recent
  # Confirm code compiles
  ```
- **Success Criteria:** Script validates prerequisites

#### Subtask 7.3: Add Rollback Capability
- **Action:** Script can rollback if deployment fails
  ```bash
  if [ $? -ne 0 ]; then
    echo "Deployment failed. Rolling back..."
    git checkout $PREVIOUS_VERSION
    npm install --production
    systemctl restart rich-list
  fi
  ```
- **Success Criteria:** Rollback is automatic on failure

#### Subtask 7.4: Document Deployment Process
- **Action:** Create `/opt/rich-list/DEPLOYMENT.md`
- **Contents:**
  - Step-by-step deployment instructions
  - How to use deployment script
  - Verification steps post-deployment
  - Rollback procedures
  - Emergency contacts
- **Success Criteria:** Deployment documentation is complete

---

## MEDIUM PRIORITY TASKS

**These improve operational efficiency and observability. Can run in parallel with HIGH priority tasks.**

---

### MEDIUM-1: Setup Production Monitoring & Alerting

**Problem:** No visibility into production system performance. Need metrics, dashboards, and alerts.

**Scope:** Observability and alerting  
**Owner:** DevOps / SRE  
**Timeline:** 1-2 weeks  
**Risk Level:** MEDIUM (production issues won't be noticed immediately)

#### Subtask 1.1: Choose Monitoring Stack
- **Option A (Lightweight):** Prometheus + Grafana
  - Prometheus: Metrics collection
  - Grafana: Visualization and dashboards
  - AlertManager: Alerting
  - Estimated setup: 4-6 hours
  - Cost: Free (open source)

- **Option B (SaaS):** Datadog, New Relic, or similar
  - Simpler setup
  - Professional support included
  - Estimated setup: 2-3 hours
  - Cost: $100-500/month

- **Recommendation:** Start with Prometheus/Grafana; upgrade to SaaS if needed later
- **Success Criteria:** Monitoring platform chosen

#### Subtask 1.2: Export Metrics from Application
- **Action:** Add `/api/metrics` endpoint using prom-client
  ```bash
  npm install prom-client
  ```
- **Metrics to Export:**
  - Request count (by endpoint)
  - Request latency (percentiles)
  - Database query duration
  - Socket.IO connections
  - Error rate
- **Success Criteria:** Metrics endpoint returns valid Prometheus format

#### Subtask 1.3: Setup Prometheus Scraping
- **Action:** Configure Prometheus to collect metrics every 15 seconds
  ```yaml
  scrape_configs:
    - job_name: 'rich-list'
      static_configs:
        - targets: ['localhost:9876']
      metrics_path: '/api/metrics'
  ```
- **Success Criteria:** Prometheus scrapes metrics successfully

#### Subtask 1.4: Create Grafana Dashboards
- **Action:** Build dashboards showing:
  - Request rate (requests/sec)
  - Latency percentiles (p50, p95, p99)
  - Error rate
  - Database connections
  - Disk usage
  - Uptime
- **Success Criteria:** Dashboards are viewable and updated in real-time

#### Subtask 1.5: Configure Alerting Rules
- **Action:** Create alert thresholds for:
  - Error rate > 1% → Alert
  - Latency p95 > 1000ms → Alert
  - Service down → Alert immediately
  - Disk usage > 80% → Alert
- **Notification:** Send to Slack/email
- **Success Criteria:** At least 1 alert has fired successfully during testing

---

### MEDIUM-2: Implement Database Optimization & Tuning

**Problem:** Database has 30+ indexes but may not be optimally configured for workload.

**Scope:** Performance optimization  
**Owner:** Database Administrator  
**Timeline:** 3-5 days  
**Risk Level:** MEDIUM (slow queries degrade UX)

#### Subtask 2.1: Analyze Query Performance
- **Action:** Identify slow queries
  ```bash
  # Enable slow query log
  sudo -u postgres psql -c "ALTER SYSTEM SET log_min_duration_statement = 100;"
  # Queries slower than 100ms will be logged
  
  # Check recent slow queries
  sudo -u postgres psql -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
  ```
- **Success Criteria:** Slow query log is enabled; baseline measurements taken

#### Subtask 2.2: Optimize High-Value Queries
- **Action:** For each slow query, create optimal index or rewrite query
  ```sql
  -- Example: If search is slow, ensure proper index:
  CREATE INDEX CONCURRENTLY idx_accounts_account_id_balance 
  ON accounts(account_id, balance) WHERE balance > 0;
  ```
- **Validation:** Run EXPLAIN ANALYZE after optimization
- **Success Criteria:** Top 5 slow queries are optimized

#### Subtask 2.3: Review Index Usage
- **Action:** Identify unused indexes
  ```bash
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  ORDER BY idx_scan ASC;
  ```
- **Action:** Drop unused indexes to free space and speed up writes
- **Success Criteria:** No unused indexes remain

#### Subtask 2.4: Tune PostgreSQL Parameters
- **Action:** Update `postgresql.conf` for production workload
  ```ini
  # Increase shared buffers for larger datasets
  shared_buffers = 256MB  # (25% of RAM)
  
  # Improve query planning
  work_mem = 16MB
  maintenance_work_mem = 64MB
  
  # Connection settings
  max_connections = 100
  ```
- **Success Criteria:** Parameters are tuned; no OOM errors

#### Subtask 2.5: Test Performance Under Load
- **Action:** Load test with production-like traffic
  ```bash
  # Use Apache Bench or wrk
  ab -n 10000 -c 100 http://localhost:9876/api/richlist
  ```
- **Metrics:**
  - Latency p99 < 500ms
  - Error rate = 0%
  - Database doesn't crash
- **Success Criteria:** Load test passes; no issues identified

---

### MEDIUM-3: Implement Automated Backup Testing

**Problem:** Backups run daily but we only test them once (CRITICAL-3). Need recurring validation.

**Scope:** Disaster recovery  
**Owner:** DevOps  
**Timeline:** 2-3 days  
**Risk Level:** MEDIUM (untested backups may fail when needed)

#### Subtask 3.1: Create Automated Restore Test Script
- **Action:** Create `/opt/rich-list/scripts/test-restore.sh`
- **Weekly Test Procedure:**
  1. Get latest backup file
  2. Create temporary test database
  3. Restore from backup
  4. Run data integrity checks
  5. Delete test database
  6. Report results
- **Success Criteria:** Script exists and is executable

#### Subtask 3.2: Schedule Monthly Full Restore Test
- **Action:** Add to cron (monthly, e.g., first Sunday of month)
  ```bash
  0 3 * * 0 cd /opt/rich-list && bash scripts/test-restore.sh >> logs/restore-test.log 2>&1
  ```
- **Purpose:** Ensures backups can be restored if primary database fails
- **Success Criteria:** Cron job is configured

#### Subtask 3.3: Create Restore Test Report
- **Action:** Generate report after each test
  ```
  Restore Test Results
  Date: 2025-12-20
  Backup File: rich-list_20251220_020000.sql.gz
  Restore Time: 45 minutes
  Record Count Check: PASS (7,419,865 records)
  Data Integrity Check: PASS
  Status: SUCCESS
  ```
- **Success Criteria:** Report template created

#### Subtask 3.4: Document RTO/RPO
- **Action:** Calculate and document recovery metrics
  - **RTO (Recovery Time Objective):** How long to restore?
    - Time: ~45 minutes for 7.4M records
    - Acceptable for non-critical app
  - **RPO (Recovery Point Objective):** How much data loss is acceptable?
    - Daily backups = 24 hours max loss
    - Acceptable for analytics use case
- **Success Criteria:** RTO/RPO documented and communicated

---

### MEDIUM-4: Setup CI/CD Pipeline

**Problem:** Deployments are manual. Need automated testing and deployment.

**Scope:** Development process  
**Owner:** DevOps / Tech Lead  
**Timeline:** 3-5 days  
**Risk Level:** MEDIUM (manual deployments are slow and error-prone)

#### Subtask 4.1: Choose CI/CD Platform
- **Options:**
  - GitHub Actions (free with GitHub)
  - GitLab CI (free with GitLab)
  - Jenkins (self-hosted, free)
  - CircleCI (cloud, free tier available)
- **Recommendation:** GitHub Actions (if using GitHub) or GitLab CI (if using GitLab)
- **Success Criteria:** Platform chosen and access granted

#### Subtask 4.2: Create Automated Test Pipeline
- **Action:** Create `.github/workflows/test.yml` (if using GitHub Actions)
  ```yaml
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v2
        - uses: actions/setup-node@v2
        - run: npm install
        - run: npm run lint
        - run: npm run test
  ```
- **Tests to Run:**
  - Linting (ESLint)
  - Unit tests (if any)
  - E2E tests (Playwright)
- **Success Criteria:** Tests run automatically on every push

#### Subtask 4.3: Create Deployment Pipeline
- **Action:** Create production deployment workflow
  ```yaml
  on:
    push:
      branches: [main]  # Deploy only on main branch
  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v2
        - run: bash scripts/deploy-production.sh
  ```
- **Safety:**
  - Only deploy from main branch (protected)
  - Require code review before merge
  - Automatic rollback on failure
- **Success Criteria:** Deployment is automated; reviewed code only

#### Subtask 4.4: Test CI/CD Pipeline
- **Action:** Verify pipeline works with test commits
  - Push test code change
  - Observe pipeline execute automatically
  - Verify all steps complete successfully
- **Success Criteria:** Pipeline runs end-to-end successfully

---

### MEDIUM-5: Implement Security Hardening

**Problem:** Production system needs additional security controls beyond CRITICAL tasks.

**Scope:** Security  
**Owner:** Tech Lead / Security  
**Timeline:** 3-5 days  
**Risk Level:** MEDIUM (security gaps could lead to data breach)

#### Subtask 5.1: Add Helmet.js for Security Headers
- **Action:** Install and configure security headers
  ```bash
  npm install helmet
  ```
- **Headers Added:**
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Strict-Transport-Security
- **Success Criteria:** Security headers are sent with all responses

#### Subtask 5.2: Implement HTTPS/TLS
- **Action:** Ensure all traffic uses HTTPS
  - Use Let's Encrypt certificates (already in place per docs)
  - Configure Nginx to force HTTPS redirect
  ```nginx
  server {
    listen 80;
    server_name rich-list.info;
    return 301 https://$server_name$request_uri;
  }
  ```
- **Success Criteria:** HTTP requests redirect to HTTPS

#### Subtask 5.3: Setup Web Application Firewall (WAF)
- **Option A:** Nginx ModSecurity
  - Free, self-hosted
  - Setup: 2-3 hours
  
- **Option B:** Cloudflare
  - Managed service
  - Setup: 1 hour
  - Cost: $20/month +
  
- **Recommendation:** Start with Nginx rate limiting (done in HIGH-3); upgrade to WAF if needed
- **Success Criteria:** WAF rules are configured (or plan documented)

#### Subtask 5.4: Regular Dependency Security Scanning
- **Action:** Setup automated dependency checks
  ```bash
  npm audit  # Check before each release
  ```
- **Process:**
  - Run `npm audit` before deployment
  - Fix critical vulnerabilities immediately
  - Plan fixes for high/medium vulnerabilities
- **Success Criteria:** `npm audit` runs cleanly; no critical issues

#### Subtask 5.5: Document Security Checklist
- **Action:** Create `/opt/rich-list/SECURITY_CHECKLIST.md`
- **Contents:**
  - Pre-deployment security checks
  - Known vulnerabilities and mitigations
  - Security contact information
  - Incident response procedures
- **Success Criteria:** Checklist is complete and reviewed

---

### MEDIUM-6: Create Runbooks & Documentation

**Problem:** Production requires clear procedures for common operations and emergencies.

**Scope:** Operational procedures  
**Owner:** DevOps / Tech Lead  
**Timeline:** 2-3 days  
**Risk Level:** MEDIUM (unclear procedures lead to mistakes)

#### Subtask 6.1: Create Startup Runbook
- **Action:** Document `/opt/rich-list/RUNBOOKS/startup.md`
- **Contents:**
  - Prerequisites check
  - Start PostgreSQL
  - Start Node.js application
  - Verify health endpoints
  - Expected behavior
- **Success Criteria:** Runbook is clear and tested

#### Subtask 6.2: Create Shutdown Runbook
- **Action:** Document `/opt/rich-list/RUNBOOKS/shutdown.md`
- **Contents:**
  - Graceful shutdown procedure
  - Wait for in-flight requests
  - Close database connections
  - Backup verification
- **Success Criteria:** Runbook is clear and tested

#### Subtask 6.3: Create Emergency Procedures
- **Action:** Document `/opt/rich-list/RUNBOOKS/emergency.md`
- **Scenarios:**
  - Database corruption
  - Service won't start
  - High error rate
  - Out of disk space
- **Response:** For each, document:
  - Symptoms to watch for
  - Immediate response
  - Root cause analysis steps
  - Resolution steps
  - Verification
- **Success Criteria:** All major scenarios documented

#### Subtask 6.4: Create Troubleshooting Guide
- **Action:** Document `/opt/rich-list/RUNBOOKS/troubleshooting.md`
- **Contents:**
  - Common error messages
  - How to debug each error
  - Which logs to check
  - How to collect diagnostic info
  - When to escalate
- **Success Criteria:** Guide covers 10+ common issues

#### Subtask 6.5: Create On-Call Documentation
- **Action:** Document `/opt/rich-list/ON_CALL.md`
- **Contents:**
  - Contact list (tech lead, DBA, security)
  - Escalation procedures
  - SLA definitions (response time, resolution time)
  - Alert routing
  - Test procedures (fire test alert monthly)
- **Success Criteria:** On-call procedures are clear

---

## LOW PRIORITY TASKS

**These are nice-to-have improvements. Can be done post-launch.**

---

### LOW-1: Implement Caching Layer (Redis)

**Problem:** No application-level caching; high-traffic scenarios could overload database.

**Scope:** Performance optimization  
**Owner:** Tech Lead / DevOps  
**Timeline:** 3-5 days  
**Risk Level:** LOW (current caching strategy is acceptable)

#### Subtask 1.1: Evaluate Caching Need
- **Current Caching:**
  - Browser caching (5 min via HTTP headers)
  - Client-side API cache (5 min in memory)
  - Database query optimization
- **Question:** Is performance adequate for current load?
- **Decision Point:** If latency p95 > 1 second, implement Redis

#### Subtask 1.2: Setup Redis
- **Action:** Deploy Redis container via Docker Compose
- **Configuration:**
  - Port: 6379
  - Persistence: Enabled (RDB snapshots)
  - Max memory: 256MB
- **Success Criteria:** Redis is running and accessible

#### Subtask 1.3: Add Redis Cache Layer
- **Action:** Update API services to use Redis
- **Cache Keys:**
  - `richlist:top-100` (cache top wallets)
  - `account:{address}` (cache account details)
  - `price:latest` (cache current price)
  - `stats:current` (cache network stats)
- **TTL:** 1-5 minutes depending on data freshness needs
- **Success Criteria:** Cache layer is functional

#### Subtask 1.4: Monitor Cache Hit Rate
- **Action:** Add metrics for cache effectiveness
- **Metric:** `(hits) / (hits + misses)`
- **Target:** > 80% hit rate
- **Success Criteria:** Hit rate is tracked and visible in monitoring

---

### LOW-2: Implement API Versioning & Documentation

**Problem:** API has no version control; breaking changes could break clients.

**Scope:** Developer experience  
**Owner:** Tech Lead  
**Timeline:** 2-3 days  
**Risk Level:** LOW (no external clients currently)

#### Subtask 2.1: Add API Versioning
- **Action:** Implement `/api/v1/` prefix for endpoints
- **Purpose:** Allow future breaking changes without breaking existing clients
- **Example:**
  - Current: `/api/richlist`
  - Versioned: `/api/v1/richlist`
- **Success Criteria:** All endpoints under `/api/v1/` prefix

#### Subtask 2.2: Create OpenAPI/Swagger Documentation
- **Action:** Document API using OpenAPI 3.0 format
  ```bash
  npm install swagger-ui-express
  ```
- **Contents:**
  - All endpoints (method, path, parameters)
  - Request/response examples
  - Error codes and meanings
  - Authentication (if added later)
- **Success Criteria:** API docs available at `/api/docs`

#### Subtask 2.3: Generate Client Libraries
- **Action:** Auto-generate SDK from OpenAPI spec
- **Options:**
  - TypeScript client library
  - Python client library
  - JavaScript NPM package
- **Success Criteria:** At least one SDK is generated and tested

---

### LOW-3: Implement User Analytics

**Problem:** No visibility into how users interact with the application.

**Scope:** Product development  
**Owner:** Product / Tech Lead  
**Timeline:** 2-3 days  
**Risk Level:** LOW (analytics are informational)

#### Subtask 3.1: Choose Analytics Platform
- **Options:**
  - Google Analytics (free, cloud)
  - Plausible Analytics (privacy-focused, $9/month)
  - Matomo (self-hosted, free)
- **Recommendation:** Google Analytics (free, simple)
- **Success Criteria:** Platform chosen

#### Subtask 3.2: Add Analytics Instrumentation
- **Action:** Add tracking to frontend
  ```javascript
  // Track page views
  gtag('event', 'page_view', {
    page_path: currentPath
  });
  
  // Track searches
  gtag('event', 'search', {
    search_term: userQuery
  });
  ```
- **Success Criteria:** Frontend is instrumented

#### Subtask 3.3: Setup Custom Reports
- **Action:** Create dashboards showing:
  - Daily active users
  - Top pages by traffic
  - Most searched addresses
  - Average session duration
  - Top referrers
- **Success Criteria:** Reports are viewable and updated daily

---

### LOW-4: Implement Feature Flags

**Problem:** No way to toggle features without redeployment.

**Scope:** Deployment flexibility  
**Owner:** Tech Lead  
**Timeline:** 2-3 days  
**Risk Level:** LOW (can deploy without feature flags)

#### Subtask 4.1: Choose Feature Flag Service
- **Options:**
  - LaunchDarkly (free tier available)
  - Unleash (self-hosted, free)
  - Simple environment variables (basic)
- **Recommendation:** Start with environment variables; upgrade if needed
- **Success Criteria:** Decision documented

#### Subtask 4.2: Implement Feature Flag Evaluation
- **Action:** Create helper function in backend
  ```javascript
  function isFeatureEnabled(featureName) {
    return process.env[`FEATURE_${featureName}`] === 'true';
  }
  ```
- **Usage:**
  ```javascript
  if (isFeatureEnabled('redis_cache')) {
    // Use Redis
  } else {
    // Use database directly
  }
  ```
- **Success Criteria:** Feature flag system is functional

#### Subtask 4.3: Document Feature Flags
- **Action:** Create `/opt/rich-list/FEATURES.md`
- **Contents:**
  - List of all feature flags
  - What each flag controls
  - How to enable/disable (for ops team)
- **Success Criteria:** Documentation is complete

---

### LOW-5: Add Grafana Dashboards & Visualization

**Problem:** Monitoring data is available but not visually presented.

**Scope:** Observability  
**Owner:** DevOps  
**Timeline:** 2-3 days  
**Risk Level:** LOW (alternative: CLI tools)

#### Subtask 5.1: Install Grafana
- **Action:** Deploy Grafana container
  ```bash
  docker run -d -p 3000:3000 grafana/grafana
  ```
- **Default:** http://localhost:3000 (admin/admin)
- **Success Criteria:** Grafana is accessible

#### Subtask 5.2: Connect Prometheus Datasource
- **Action:** Add Prometheus as data source in Grafana
  - URL: `http://prometheus:9090`
- **Success Criteria:** Datasource connection successful

#### Subtask 5.3: Create Dashboards
- **Dashboards to Build:**
  1. **Service Health:** Uptime, errors, latency
  2. **Business Metrics:** Active users, searches, top wallets
  3. **Infrastructure:** CPU, memory, disk, network
  4. **Database:** Connection count, slow queries, cache hit rate
- **Success Criteria:** 4+ dashboards created and populated

---

## IMPLEMENTATION SCHEDULE

### Timeline Overview

```
Week 1: CRITICAL Tasks (High Risk, Must Complete)
├─ Day 1-2: CRITICAL-1 (Missing tables)
├─ Day 2-3: CRITICAL-2 (Data integrity)
├─ Day 3-4: CRITICAL-3 (Backup verification)
└─ Day 4-5: CRITICAL-4 & CRITICAL-5 (Security)

Week 2: HIGH Priority Tasks (Stability & Security)
├─ Day 1: HIGH-1 (Logging)
├─ Day 2: HIGH-2 (Health checks)
├─ Day 3: HIGH-3 & HIGH-4 (Security)
├─ Day 4: HIGH-5 (Error handling)
└─ Day 5: HIGH-6 & HIGH-7 (Deployment)

Weeks 3-4: MEDIUM Priority Tasks (Operational Excellence)
├─ Week 1: MEDIUM-1 & MEDIUM-2 (Monitoring & Performance)
├─ Week 1: MEDIUM-3 & MEDIUM-4 (CI/CD & Testing)
└─ Week 2: MEDIUM-5 & MEDIUM-6 (Security & Documentation)

Post-Launch: LOW Priority Tasks (Polish & Enhancement)
```

### Parallel Work Streams

**Stream A (Security-Critical):**
- CRITICAL-1 → CRITICAL-4 → HIGH-3 → HIGH-4 (Sequential)

**Stream B (Operational):**
- CRITICAL-3 → HIGH-1 → HIGH-2 → MEDIUM-3 (Sequential)

**Stream C (Deployment):**
- CRITICAL-5 → HIGH-6 → HIGH-7 → MEDIUM-4 (Sequential)

**Stream D (Documentation):**
- Can run in parallel with other streams
- Compile during each stream completion

### Critical Path

```
CRITICAL-1 (missing tables)
    ↓
CRITICAL-2 (data integrity)
    ↓
CRITICAL-3 (backup verification)
    ↓
CRITICAL-4 (secrets management)
    ↓
CRITICAL-5 (CORS config)
    ↓
HIGH-6 (Nginx config)
    ↓
HIGH-7 (deployment script)
    ↓
PRODUCTION LAUNCH
```

**Estimated Timeline for Critical Path:** 5-7 days

---

## RISK ASSESSMENT & MITIGATION

### High-Risk Areas

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Missing DB tables cause crash | HIGH | CRITICAL | CRITICAL-1: Add missing tables before launch |
| Corrupted data serves wrong info | MEDIUM | HIGH | CRITICAL-2: Validate all data |
| Backups don't work when needed | MEDIUM | CRITICAL | CRITICAL-3: Test restore before launch |
| Exposed database password | MEDIUM | CRITICAL | CRITICAL-4: Audit secrets, secure storage |
| Service unreachable due to CORS | LOW | HIGH | CRITICAL-5: Test CORS before launch |
| Database performance degrades | MEDIUM | MEDIUM | MEDIUM-2: Optimize before high traffic |
| Errors crash service silently | MEDIUM | HIGH | HIGH-5: Add error handling |
| Manual deployment errors | LOW | MEDIUM | HIGH-7: Automate deployment |
| Production issues undiagnosed | MEDIUM | MEDIUM | HIGH-1 & MEDIUM-1: Add logging & monitoring |
| Rapid traffic overwhelms API | LOW | MEDIUM | HIGH-3: Implement rate limiting |

### Mitigation Strategies

1. **Test Everything:** Use staging environment; never test in production
2. **Backup First:** Always have recent backup before making changes
3. **Gradual Rollout:** Launch with internal users first; ramp up traffic
4. **Monitoring:** Have visibility into system before issues occur
5. **Runbooks:** Document procedures for common operations
6. **Communication:** Keep stakeholders informed of progress

---

## ROLLBACK PROCEDURES

### Full Rollback to Previous Version

```bash
# 1. Identify previous stable version (from git tags)
git log --oneline | head -10

# 2. Stop current service
systemctl stop rich-list

# 3. Restore from backup
npm run db:restore /opt/rich-list/backups/rich-list_LATEST.sql.gz

# 4. Checkout previous code
git checkout v1.0.0  # or specific commit

# 5. Reinstall dependencies
npm install --production

# 6. Start service
systemctl start rich-list

# 7. Verify
curl https://rich-list.info/api/health
```

**Timeline:** ~30 minutes

### Partial Rollback (Nginx Only)

If issue is specific to frontend routing:

```bash
# 1. Revert Nginx to classic PHP configuration
sudo ln -sf rich-list-classic /etc/nginx/sites-enabled/rich-list

# 2. Reload Nginx
sudo systemctl reload nginx

# 3. Verify
curl https://rich-list.info

# 4. Node.js service can stay running (for later fix)
```

**Timeline:** < 5 minutes

### Database-Only Rollback

If issue is in data (e.g., bad migration):

```bash
# 1. Keep Node.js service running (returns cached data or error)
# 2. Restore previous database backup
npm run db:restore /opt/rich-list/backups/rich-list_YYYYMMDD_HHMMSS.sql.gz

# 3. Verify data is correct
curl https://rich-list.info/api/stats

# 4. Identify root cause of data issue
# 5. Reapply migration if it was corrected
```

**Timeline:** ~45 minutes (depends on backup size)

### Abort Pre-Launch (Before Production)

If issues found during HIGH priority tasks:

1. **Fix immediately** in development environment
2. **Re-test** the specific component
3. **Document** the issue and solution
4. **Re-validate** CRITICAL tasks
5. **Delay launch** until confident

**Timeline:** Dependent on severity

---

## SUCCESS CRITERIA

### Pre-Launch Verification Checklist

**CRITICAL Requirements (MUST PASS):**
- [ ] Database has all 9 required tables
- [ ] 7.4M account records verified; no corruption
- [ ] Backup/restore tested successfully
- [ ] All secrets stored securely (not in code)
- [ ] CORS configured for production domain
- [ ] Error handling is comprehensive
- [ ] Health check endpoints respond correctly
- [ ] Rate limiting is active
- [ ] Input validation is enforced
- [ ] Logging is configured and working
- [ ] Nginx reverse proxy is configured
- [ ] SSL/TLS certificates are valid
- [ ] Database password changed from default

**HIGH Priority Requirements (SHOULD PASS):**
- [ ] Monitoring system is collecting metrics
- [ ] Alert rules are configured and tested
- [ ] Deployment script is tested
- [ ] Runbooks are documented
- [ ] On-call procedures are clear
- [ ] CI/CD pipeline is functional
- [ ] Security audit is documented
- [ ] Performance testing is completed
- [ ] Load testing shows acceptable results
- [ ] Rollback procedures are tested

**MEDIUM Priority (NICE TO HAVE):**
- [ ] Redis caching is operational
- [ ] API documentation is published
- [ ] Feature flags are configured
- [ ] Analytics are collecting data
- [ ] Grafana dashboards are available

### Production Launch Gate

**Go/No-Go Criteria:**

| Criterion | Go | No-Go |
|-----------|----|----|
| CRITICAL tasks complete | 100% | < 100% → Delay |
| Data integrity verified | Yes | No → Investigate |
| Backup/restore tested | Yes | No → Test again |
| Performance acceptable | p95 < 1000ms | p95 > 1000ms → Optimize |
| Security audit passed | Yes | No → Fix issues |
| Monitoring active | Yes | No → Setup required |
| Runbooks documented | Yes | No → Document |
| Team ready | Yes | No → Train/prepare |

**Decision:** Launch only if ALL go criteria are met

---

## POST-LAUNCH OPERATIONS

### Day 1 (Launch Day)

**3 Hours Before Launch:**
- [ ] Final health checks (all systems green)
- [ ] Team assembled (tech lead, DevOps, on-call)
- [ ] Communication channels open (Slack, email)
- [ ] Monitoring dashboards visible
- [ ] Rollback plan reviewed

**At Launch:**
- [ ] Switch Nginx symlink to rich-list-new
- [ ] Reload Nginx: `systemctl reload nginx`
- [ ] Verify: `curl https://rich-list.info`
- [ ] Monitor error rate (should be 0%)
- [ ] Monitor latency (should be baseline)

**1 Hour Post-Launch:**
- [ ] Check error logs
- [ ] Verify all API endpoints working
- [ ] Test core user workflows
- [ ] Monitor CPU/memory usage
- [ ] Check database connections

**4 Hours Post-Launch:**
- [ ] Real user traffic verification
- [ ] Performance metrics baseline collection
- [ ] Team standup on observations

### Week 1

**Daily Activities:**
- [ ] Review error logs
- [ ] Check monitoring dashboard
- [ ] Verify backup completed successfully
- [ ] Monitor system health
- [ ] Respond to any user-reported issues

**End of Week 1:**
- [ ] Collect performance baseline metrics
- [ ] Identify any issues for future optimization
- [ ] Review and update runbooks based on real operations
- [ ] Plan next phase improvements

### Ongoing (Monthly)

- [ ] Test restore procedure (monthly)
- [ ] Review monitoring alerts (ensure no alert fatigue)
- [ ] Update dependencies (security patches)
- [ ] Review slow query log
- [ ] Capacity planning (growth projections)
- [ ] Security audit (quarterly)

---

## APPENDIX A: Glossary

- **RTO:** Recovery Time Objective - How long to restore service
- **RPO:** Recovery Point Objective - How much data loss is acceptable
- **CORS:** Cross-Origin Resource Sharing - Allows requests from different domains
- **WAF:** Web Application Firewall - Protects against malicious requests
- **SLA:** Service Level Agreement - Uptime commitments
- **Prometheus:** Metrics collection system
- **Grafana:** Visualization/dashboard tool
- **CI/CD:** Continuous Integration/Continuous Deployment
- **ESLint:** Code quality linter
- **Docker:** Container platform
- **Nginx:** Reverse proxy / web server
- **SSL/TLS:** Encryption for HTTPS

---

## APPENDIX B: Key Contacts & Resources

**Team:**
- Tech Lead: [To be filled]
- DevOps Engineer: [To be filled]
- Database Admin: [To be filled]
- Product Manager: [To be filled]
- On-Call: [To be filled]

**Documentation:**
- README.md - Feature overview
- ARCHITECTURE_AND_OPERATIONS.md - System design
- NGINX_DEPLOYMENT_PLAN.md - Deployment details
- PROJECT_COMPLETION_SUMMARY.md - Current status

**External Resources:**
- XRPL Documentation: https://xrpl.org/docs
- PostgreSQL Docs: https://www.postgresql.org/docs
- Node.js Docs: https://nodejs.org/docs
- Nginx Docs: https://nginx.org/en/docs

---

## APPENDIX C: Command Reference

### Essential Commands

```bash
# Start services
npm start                        # Start Node.js server
npm run docker:start             # Start PostgreSQL

# Database operations
npm run db:backup                # Create backup
npm run db:restore [file]        # Restore from backup
npm run docker:logs              # View database logs

# Testing
npm test                         # Run E2E tests
npm run test:grep [pattern]      # Run specific tests

# Monitoring
curl http://localhost:9876/api/health        # Basic health
curl https://rich-list.info/api/health       # Production health

# Logging
tail -f /opt/rich-list/logs/app.log          # View logs
journalctl -u rich-list -f                   # Systemd logs
```

---

**Document Status:** DRAFT - Ready for Review  
**Last Updated:** December 17, 2025  
**Next Review:** Before each project milestone

