# Rich-List SPA: Operations and Architecture Analysis

## Executive Summary
The Rich-List SPA is a Node.js/Express web application for monitoring XRP Ledger statistics. It contains two main batch operations ("update-ledger" and "update-escrow") that are designed to be run manually via npm scripts, plus real-time services that run continuously via the main server process.

---

## 1. OPERATIONS DEFINITION

### 1.1 "update-ledger" Operation

**File:** `/opt/rich-list/update-ledger.js`

**Purpose:** 
Fetches complete account balance data from the XRP Ledger and updates the database with:
- All account addresses and their current XRP balances
- Ledger statistics (ledger index, hash, close time, total coins)
- Computed statistics (account counts, balance ranges, percentiles)
- Escrow XRP calculation

**How it Works:**
1. Connects to rippled/Clio server via WebSocket
2. Fetches the latest validated ledger index
3. Retrieves ALL account states from that ledger using `ledger_data` command
   - Paginated requests with 22,000 account limit per call
   - Uses marker-based pagination to get complete dataset
4. Converts drops to XRP and calculates statistics
5. Truncates and reloads the `accounts` table with fresh data
6. Updates the `stats` table with computed statistics
7. All operations wrapped in PostgreSQL transaction for consistency

**Key Statistics Computed:**
- Number of accounts
- Total wallet XRP vs. escrow XRP
- Balance distribution across range buckets
- Percentile statistics (top 0.01%, 0.1%, etc.)
- Top 100 wallet balances

**Database Tables Updated:**
- `accounts` - All account addresses and balances (truncated and reloaded)
- `ledger_stats` - Ledger metadata
- `stats` - Computed statistics with latest flag

---

### 1.2 "update-escrow" Operation

**File:** `/opt/rich-list/update-escrow.js`

**Purpose:**
Fetches all escrow objects from the XRP Ledger and updates the database with:
- Escrow creator accounts
- Escrow amounts (in drops)
- Escrow finish dates/expiration times
- Escrow creation metadata

**How it Works:**
1. Connects to rippled/Clio server via WebSocket
2. Uses `ledger_data` command with `type: "escrow"` filter
3. Iterates through all escrow objects with marker-based pagination
4. For each escrow with a `FinishAfter` date:
   - Converts XRPL timestamp to ISO date (using RIPPLE_EPOCH_OFFSET: 946684800)
   - Extracts account, amount, and finish date
5. Creates temporary table with same schema as original
6. Inserts all escrows into temporary table
7. Atomically swaps tables (DROP old → RENAME temp)
8. Transaction ensures consistency

**Alternative Implementation:**
- `update-escrows.cjs` - CommonJS version of the same operation

**Database Tables:**
- `escrows` - Escrow objects with finish_after date, amount, and account

---

## 2. CURRENT SCHEDULING MECHANISM

### 2.1 Current Status: **MANUAL EXECUTION**

Both "update-ledger" and "update-escrow" are **NOT automatically scheduled**. They must be triggered manually.

### 2.2 Execution Methods

**Via npm scripts (defined in package.json):**
```json
{
  "scripts": {
    "update-ledger": "node update-ledger.js",
    "update-escrow": "node update-escrow.js"
  }
}
```

**Invocation:**
```bash
npm run update-ledger   # Triggers /opt/rich-list/update-ledger.js
npm run update-escrow   # Triggers /opt/rich-list/update-escrow.js
```

### 2.3 No Cron or Timer Implementation

**Important Finding:** There is **NO cron job, setInterval, setTimeout, or scheduler library** configured for these operations.

- No `node-cron` dependency
- No `bull` or `bull-board` job queue
- No `agenda` or similar scheduling library
- Both scripts are standalone executables meant to be run manually

### 2.4 Real-Time Services (Running in Main Process)

The server.js initializes three background services that **ARE** running continuously:

#### A. Oracle Subscriber Service
**File:** `/opt/rich-list/services/oracleSubscriber.mjs`

**Purpose:** Polls for XRP price updates from the XRPL Oracle account

**Scheduling:** 
- Polls every **60,000 milliseconds (1 minute)** via `setInterval`
- Account: `rXUMMaPpZqPutoRszR29jtC8amWq3APkx` (XRPL Oracle)
- Checks last 5 transactions for TrustSet operations
- Detects new price updates and inserts to database
- Maintains transaction hash to avoid duplicates

#### B. Price Backfiller Service  
**File:** `/opt/rich-list/services/priceBackfiller.mjs`

**Purpose:** Backfills missing historical XRP price data

**Scheduling:** 
- Runs **once on server startup** (one-time operation)
- Identifies gaps in price history
- Samples every 10th ledger to minimize API calls
- Processes in batches of 50 ledgers
- 50ms delay between requests to avoid overwhelming server

#### C. WebSocket Broadcast Service
**File:** `/opt/rich-list/server.js` (lines 81-161, 160-162)

**Purpose:** Broadcasts real-time updates to connected clients

**Scheduling:**
- Broadcasts every **10,000 milliseconds (10 seconds)** via `setInterval`
- Emits events: `stats:update`, `price:update`, `ledger:update`
- Socket.IO connections with configurable ping intervals

---

## 3. SERVER ARCHITECTURE

### 3.1 Technology Stack

**Framework:**
- **Express.js** (v4.18.2) - HTTP server framework
- **Node.js** (requires >= 18.0.0) - Runtime

**Database:**
- **PostgreSQL** (v15, in Docker) - Primary database
- **pg** (v8.10.0) - Node.js PostgreSQL driver
- Connection pooling with max 50 connections, 30s idle timeout

**Real-Time Communication:**
- **Socket.IO** (v4.7.2) - WebSocket server for live updates
- **ws** (v8.18.3) - WebSocket client library

**Blockchain/XRPL Integration:**
- **xrpl** (v4.4.3) - Official XRPL JavaScript library
- Connects to local Clio/rippled server via WebSocket

**Utilities:**
- **dotenv** (v16.3.1) - Environment variable management
- **cors** (v2.8.5) - CORS middleware
- **body-parser** (v1.20.2) - Request body parsing
- **axios** (v1.6.0) - HTTP client

### 3.2 Server Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Express.js Server                            │
│                    (server.js - port 9876)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐   │
│  │  HTTP Routes    │  │  Socket.IO       │  │  Static Files │   │
│  │  (API Endpoints)│  │  (Real-time)     │  │  (Frontend)   │   │
│  └────────┬────────┘  └────────┬─────────┘  └───────────────┘   │
│           │                    │                                  │
│  ┌────────┴─────────────────────┴──────────────┐                │
│  │                                              │                │
│  │    Routes Layer (routes/api.js)             │                │
│  │  - /api/stats                               │                │
│  │  - /api/richlist                            │                │
│  │  - /api/search                              │                │
│  │  - /api/escrows                             │                │
│  │  - /api/price/...                           │                │
│  │  - /api/escrows/date-range                  │                │
│  │  - /api/escrows/stats                       │                │
│  │  - Plus 8 more endpoints...                 │                │
│  └──────────────┬──────────────────────────────┘                │
│                 │                                                 │
│  ┌──────────────┴──────────────┐                                │
│  │                             │                                 │
│  └─────────────┬───────────────┴──────┐                         │
│                │                      │                         │
│  ┌─────────────▼─────────┐  ┌─────────▼──────────┐              │
│  │  XRPL Services        │  │  PostgreSQL DB     │              │
│  │  (xrplService.mjs)    │  │  (localhost:5656)  │              │
│  └──────────────────────┘  └────────────────────┘              │
│  - XRP Connection Mgmt                                          │
│  - Price Extraction                                             │
│  - Ledger Queries                                               │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Background Services                                     │    │
│  │                                                           │    │
│  │  1. OracleSubscriber (1-min polling)                    │    │
│  │  2. PriceBackfiller (startup one-time)                 │    │
│  │  3. WebSocket Broadcaster (10-sec intervals)           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Manual Operations (npm scripts)                         │    │
│  │  - npm run update-ledger  (STANDALONE SCRIPT)          │    │
│  │  - npm run update-escrow  (STANDALONE SCRIPT)          │    │
│  │  (NOT integrated with main server)                      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         └──> Clio/rippled Server (ws://127.0.0.1:51233)
```

### 3.3 Key Endpoints

**Statistics & Ledger:**
- `GET /api/stats` - Latest ledger statistics
- `GET /api/accounts/trend` - Historical account count trends

**Rich List & Search:**
- `GET /api/richlist` - Top wallets with pagination
- `GET /api/search?account=rXXX` - Wallet lookup with rank

**Escrows:**
- `GET /api/escrows` - Paginated escrow list
- `GET /api/escrows/stats` - Escrow statistics
- `GET /api/escrows/date-range` - Escrows by date range
- `GET /api/escrows/total` - Total escrowed XRP

**Price & Charts:**
- `GET /api/price/latest` - Current XRP price
- `GET /api/price/history` - Historical price data
- `GET /api/graph` - Price chart data with timeframes

**Analysis:**
- `GET /api/ranking-search` - Rank lookup for wallets/amounts
- `GET /api/stats/balance-ranges` - Distribution by balance range
- `GET /api/stats/percentiles` - Percentile distribution

### 3.4 Database Schema (Key Tables)

**accounts**
```sql
- account_id (TEXT, PRIMARY KEY)
- balance (BIGINT in drops)
- sequence (INTEGER)
- flags (INTEGER)
- owner_count (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**escrows**
```sql
- id (SERIAL, PRIMARY KEY)
- account_id (TEXT)
- finish_after (DATE)
- amount (BIGINT in drops)
- created_at (TIMESTAMP)
```

**ledger_stats**
```sql
- ledger_index (INTEGER, PRIMARY KEY)
- ledger_hash (TEXT)
- transaction_count (INTEGER)
- reserve_base (BIGINT)
- reserve_inc (BIGINT)
- closed_at (BIGINT timestamp)
```

**stats**
```sql
- ind (INTEGER, PRIMARY KEY) [ledger_index]
- ledgerindex (INTEGER)
- ledgerdate (TIMESTAMP)
- totalxrp (NUMERIC)
- walletxrp (NUMERIC)
- escrowxrp (NUMERIC)
- numaccounts (INTEGER)
- latest (INTEGER, 0 or 1)
```

**xrp_price**
```sql
- id (SERIAL, PRIMARY KEY)
- price (NUMERIC)
- time (TIMESTAMP)
- ledger (INTEGER)
- sequence (INTEGER)
```

### 3.5 Frontend Architecture

**SPA (Single Page Application):**
- Client-side routing with hash-based navigation
- Modular component system
- Multiple theme support (6 themes)
- Socket.IO client integration for real-time updates
- No build step - vanilla JavaScript

**Frontend Modules:**
- `pages/` - 7 page components (Search, Dashboard, Charts, etc.)
- `services/` - API, Socket.IO, XRPL, Wallet services
- `components/` - Reusable UI components
- `modules/` - Feature modules (wallet badges, etc.)

---

## 4. KEY FINDINGS & RECOMMENDATIONS

### 4.1 Current State
✓ Well-structured Express.js + Socket.IO architecture
✓ Real-time services actively running (Oracle polling, WebSocket broadcast)
✓ Clean separation between manual ops and background services
✓ Comprehensive API with 13+ endpoints
✓ PostgreSQL for persistent storage with proper transactions

### 4.2 Observations
⚠️ "update-ledger" and "update-escrow" are **manual operations only**
⚠️ No automatic scheduling mechanism in place
⚠️ Must be triggered externally (cron, CI/CD, manual invocation)
⚠️ Full ledger fetch is resource-intensive (all ~40M accounts)
⚠️ Escrow updates require full table replacement (no incremental)

### 4.3 Integration Points
- Both scripts connect directly to XRPL and PostgreSQL
- Use same connection pooling configuration
- Transaction support for data consistency
- Error handling with rollback capability
- Independent of main server process (can run in parallel)

### 4.4 To Add Automated Scheduling
If automatic scheduling is desired, options include:

1. **node-cron** (light, embedded)
   ```bash
   npm install node-cron
   ```
   
2. **bull** + **bull-board** (robust, job queue with UI)
   ```bash
   npm install bull redis bull-board
   ```

3. **Agenda** (MongoDB-backed scheduling)
   ```bash
   npm install agenda
   ```

4. **External cron** (system-level)
   ```bash
   0 2 * * * cd /opt/rich-list && npm run update-ledger
   0 3 * * * cd /opt/rich-list && npm run update-escrow
   ```

---

## 5. EXECUTION FLOW SUMMARY

### Server Startup (npm start)
```
1. Load environment variables
2. Initialize Express + Socket.IO
3. Connect to PostgreSQL
4. Start XRPL Service (connect to Clio)
5. Start Oracle Subscriber (1-min polling)
6. Start Price Backfiller (one-time backfill)
7. Start WebSocket Broadcaster (10-sec updates)
8. Listen on port 9876
9. Health check endpoint available
```

### Update Ledger (npm run update-ledger)
```
1. Check XRPL and PostgreSQL connections
2. Get latest validated ledger index
3. Fetch ALL account states via paginated ledger_data
4. Compute statistics (percentiles, ranges, etc.)
5. BEGIN transaction
6. TRUNCATE accounts table
7. INSERT all accounts in 10k batches
8. INSERT ledger_stats record
9. INSERT/UPDATE stats record
10. COMMIT
11. Exit
```

### Update Escrow (npm run update-escrow)
```
1. Connect to XRPL WebSocket
2. Request escrow objects with marker pagination
3. Process each escrow (FinishAfter validation)
4. BEGIN transaction
5. CREATE temporary escrows_temp table
6. INSERT all escrows
7. DROP original escrows table
8. RENAME escrows_temp to escrows
9. COMMIT
10. Close WebSocket
11. Exit
```

---

## 6. File Manifest

**Key Files:**
- `/opt/rich-list/server.js` - Main Express server
- `/opt/rich-list/update-ledger.js` - Ledger update operation (1,375 lines)
- `/opt/rich-list/update-escrow.js` - Escrow update operation (135 lines)
- `/opt/rich-list/update-escrows.cjs` - Alternative CommonJS version
- `/opt/rich-list/routes/api.js` - API endpoint definitions (772 lines)
- `/opt/rich-list/config/database.js` - Database configuration
- `/opt/rich-list/services/xrplService.mjs` - XRPL connectivity
- `/opt/rich-list/services/oracleSubscriber.mjs` - Price polling (1-min intervals)
- `/opt/rich-list/services/priceBackfiller.mjs` - Historical backfill
- `/opt/rich-list/models/priceModel.mjs` - Database price operations
- `/opt/rich-list/package.json` - npm scripts and dependencies
- `/opt/rich-list/public/` - Frontend SPA files

