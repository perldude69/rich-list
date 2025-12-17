# XRP_PRICE TABLE BACKUP & RESTORE IMPLEMENTATION PLAN

**Document Version:** 1.0  
**Created:** December 17, 2025  
**Status:** Ready for Implementation  
**Owner:** Development Team

---

## EXECUTIVE SUMMARY

Create two Node.js scripts (`backup-xrp-price.js` and `restore-xrp-price.js`) that:
- Use PostgreSQL `pg_dump` for reliable schema + data export
- Are callable from `server.js` OR executable as standalone CLI tools
- Include metadata (row count) for validation
- Implement safe restore with atomic table swapping
- Log all operations to file and console
- Maintain old table on failure for manual inspection

**Timeline:** 4-6 hours  
**Complexity:** Medium  
**Risk Level:** Low (table-specific, no system impact)

---

## FILE STRUCTURE

### Files to Create

```
/opt/rich-list/
├── backup-xrp-price.js              [NEW - 250-350 lines]
├── restore-xrp-price.js             [NEW - 400-500 lines]
├── backups/
│   └── xrp_price/                   [NEW DIRECTORY]
│       └── .gitkeep
├── logs/
│   └── xrp_price_backup.log         [Created by scripts]
└── package.json                     [UPDATE - add 2 scripts]
```

### Files to Update

```
/opt/rich-list/
└── package.json (add 2 npm scripts)
```

---

## DETAILED IMPLEMENTATION PLAN

### PART 1: BACKUP SCRIPT (`backup-xrp-price.js`)

#### 1.1 File Header & Imports
```javascript
Requirements:
├─ #!/usr/bin/env node (shebang for direct execution)
├─ dotenv - Load .env variables
├─ pg (node-postgres) - Database connection
├─ child_process.spawn - Execute pg_dump
├─ fs - File I/O
├─ zlib - Gzip compression
├─ path - Path utilities
└─ Custom logger - Write to file + console
```

#### 1.2 Database Connection
```javascript
Approach:
├─ Load .env via dotenv.config()
├─ Create PostgreSQL connection pool using pg library
│  └─ Use same config structure as config/database.js
├─ Test connection before proceeding
└─ Handle connection errors gracefully
```

#### 1.3 Backup Directory Setup
```javascript
Steps:
├─ Check if /opt/rich-list/backups/xrp_price/ exists
├─ If not: Create directory (mkdir -p)
├─ If error: Log and exit with error
└─ Verify write permissions
```

#### 1.4 Row Count Query
```javascript
SQL Query:
├─ SELECT COUNT(*) as count FROM xrp_price
├─ Store row count for metadata
├─ If table doesn't exist:
│  └─ Warn user: "xrp_price table not found. No backup created."
│  └─ Exit gracefully
└─ On query error:
   └─ Log error details and exit
```

#### 1.5 pg_dump Execution (Schema)
```javascript
Command:
pg_dump \
  --host=$DB_HOST \
  --port=$DB_PORT \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --table=xrp_price \
  --schema-only \
  --no-password

Error Handling:
├─ Check if pg_dump exists in PATH
├─ If not: Error "pg_dump not found. Install PostgreSQL client tools."
├─ Capture stderr and log any warnings
└─ Verify schema output is valid SQL
```

#### 1.6 pg_dump Execution (Data)
```javascript
Command:
pg_dump \
  --host=$DB_HOST \
  --port=$DB_PORT \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --table=xrp_price \
  --data-only \
  --no-password

Error Handling:
├─ Capture both stdout and stderr
├─ Verify data output received
└─ Handle process errors
```

#### 1.7 Metadata Header Creation
```javascript
Format:
-- XRP_PRICE_BACKUP
-- Backup Date: 2025-12-17T21:30:00.123Z
-- Table: xrp_price
-- Row Count: 1,234
-- Format Version: 1.0
-- ============================================

Details:
├─ Timestamp: ISO 8601 format with milliseconds
├─ Row Count: Integer from SQL query
├─ Format Version: For future compatibility
└─ Use consistent format for parsing in restore script
```

#### 1.8 File Creation
```javascript
Steps:
├─ Combine: metadata_header + schema_sql + data_sql
├─ Generate filename: xrp_price_YYYYMMDD_HHMMSS.sql
│  └─ Use: new Date().toISOString() then format
├─ Write to temp file first (safety)
├─ Gzip compress to: xrp_price_YYYYMMDD_HHMMSS.sql.gz
├─ Verify gzip file size > 0
├─ Delete temp uncompressed file
└─ Verify backup file exists and is readable
```

#### 1.9 Success Output
```
Output Format:
✓ Backup successful
  File: backups/xrp_price/xrp_price_20251217_213000.sql.gz
  Rows: 1,234
  Size: 125 KB
  Location: /opt/rich-list/backups/xrp_price/xrp_price_20251217_213000.sql.gz
```

#### 1.10 Logging
```javascript
File: /opt/rich-list/logs/xrp_price_backup.log

Log Format:
[2025-12-17T21:30:00.123Z] BACKUP_START
[2025-12-17T21:30:00.234Z] Connected to database
[2025-12-17T21:30:00.345Z] Row count: 1,234
[2025-12-17T21:30:01.456Z] Schema exported (2.3 KB)
[2025-12-17T21:30:02.567Z] Data exported (122 KB)
[2025-12-17T21:30:03.678Z] File compressed
[2025-12-17T21:30:03.789Z] BACKUP_SUCCESS - 125 KB

On Error:
[2025-12-17T21:30:00.123Z] BACKUP_ERROR
[2025-12-17T21:30:00.234Z] Error: pg_dump not found
[2025-12-17T21:30:00.234Z] Action: Install PostgreSQL client tools
```

#### 1.11 Error Handling Summary
```
Error Scenarios:
├─ pg_dump not found
│  └─ Message: "pg_dump not found. Install PostgreSQL client tools."
├─ Database connection failed
│  └─ Message: "Cannot connect to database. Check .env configuration."
├─ xrp_price table not found
│  └─ Message: "xrp_price table not found. No backup created."
├─ File write permission denied
│  └─ Message: "Permission denied writing to backups/xrp_price directory."
├─ Gzip compression failed
│  └─ Message: "Failed to compress backup file."
└─ All: Log to file + console, exit with code 1
```

---

### PART 2: RESTORE SCRIPT (`restore-xrp-price.js`)

#### 2.1 File Header & Imports
```javascript
Requirements:
├─ #!/usr/bin/env node (shebang)
├─ dotenv - Load .env variables
├─ pg (node-postgres) - Database connection
├─ fs - File I/O
├─ zlib - Gzip decompression
├─ path - Path utilities
├─ readline - Interactive prompts (for file selection)
└─ Custom logger - File + console logging
```

#### 2.2 Argument Parsing
```javascript
Logic:
├─ Check process.argv[2]
├─ If provided:
│  ├─ Validate file exists: fs.existsSync()
│  ├─ Validate is file: fs.statSync().isFile()
│  └─ Use as backup file path
├─ If not provided:
│  ├─ List available backups in backups/xrp_price/
│  ├─ If no backups: Message "No backups found."
│  ├─ If one backup: Prompt to use it
│  └─ If multiple: Show menu for selection
└─ Exit if invalid input

Usage Examples:
node restore-xrp-price.js                    # Interactive
node restore-xrp-price.js backups/xrp_price/xrp_price_20251217_213000.sql.gz
npm run price:restore -- backups/xrp_price/xrp_price_20251217_213000.sql.gz
```

#### 2.3 Backup File Validation
```javascript
Steps:
├─ Check file is readable: fs.accessSync()
├─ Check file size > 0
├─ Try decompress: Check if valid gzip
│  └─ On error: "Corrupted or invalid backup file"
├─ Read decompressed content
├─ Parse metadata header:
│  ├─ Extract: backup_date, row_count, format_version
│  └─ Validate all present and valid
└─ On any error: Fail with descriptive message
```

#### 2.4 Metadata Extraction
```javascript
Parsing Logic:
├─ Read first 500 bytes of decompressed file
├─ Look for metadata header:
│  ├─ Pattern: -- XRP_PRICE_BACKUP
│  ├─ Extract: Backup Date: YYYY-MM-DDTHH:MM:SS.mmmZ
│  ├─ Extract: Row Count: <number>
│  └─ Extract: Format Version: <version>
├─ Validate format: If no date/count found, fail
└─ Store in object:
   {
     backupDate: "2025-12-17T21:30:00.123Z",
     rowCount: 1234,
     formatVersion: "1.0"
   }
```

#### 2.5 Database Connection
```javascript
Steps:
├─ Load .env via dotenv.config()
├─ Create PostgreSQL connection pool
├─ Test connection with SELECT 1
├─ On error: "Cannot connect to database. Check .env."
└─ Keep connection open for entire restore process
```

#### 2.6 Table Existence Check
```javascript
SQL Query:
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'xrp_price'
)

If NO (table doesn't exist):
├─ Log: "xrp_price table not found. Will create from backup schema."
├─ Extract schema from backup file
├─ Execute schema CREATE TABLE statement
├─ Verify table created successfully
└─ Continue to staging

If YES (table exists):
└─ Continue to staging
```

#### 2.7 Schema Extraction
```javascript
Logic:
├─ Decompress backup file (keep in memory)
├─ Find line starting with "CREATE TABLE xrp_price"
├─ Extract SQL until line starting with "INSERT"
├─ Validate schema:
│  ├─ Contains "CREATE TABLE"
│  ├─ Contains "xrp_price"
│  ├─ Contains "price", "time" columns
│  └─ On error: "Invalid schema in backup file"
└─ Store schema SQL in variable

Example Output:
CREATE TABLE xrp_price (
    id SERIAL PRIMARY KEY,
    price NUMERIC(20, 8) NOT NULL,
    time BIGINT NOT NULL,
    ledger INTEGER,
    sequence INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(time)
);
```

#### 2.8 Create Staging Table
```javascript
SQL:
CREATE TABLE xrp_price_temp AS 
  SELECT * FROM xrp_price WHERE 1=0

Purpose:
├─ Creates empty table with same structure
├─ Ensures schema matches
└─ Ready for data import

Alternative if table doesn't exist:
CREATE TABLE xrp_price_temp (
  [schema from backup]
)

Error Handling:
├─ If xrp_price_temp already exists: Drop first
├─ On create error: Log and rollback
└─ Verify table created successfully
```

#### 2.9 Load Data into Staging Table
```javascript
Method:
├─ Extract data portion from backup file
├─ Split into INSERT statements
├─ Execute in batch: INSERT INTO xrp_price_temp VALUES (...)
├─ Or use: COPY xrp_price_temp FROM STDIN
└─ Monitor for errors:
   ├─ On conflict: Log unique constraint errors
   ├─ On data type: Log conversion errors
   └─ On error: Rollback (drop xrp_price_temp)

Error Handling:
├─ If any INSERT fails:
│  ├─ Log error details
│  ├─ Drop xrp_price_temp
│  ├─ Keep xrp_price intact
│  └─ Exit with error
└─ If partial data loaded:
   └─ Drop temp table and fail
```

#### 2.10 Row Count Validation
```javascript
SQL Queries:
├─ SELECT COUNT(*) FROM xrp_price_temp
├─ Compare to metadata.rowCount

Logic:
├─ If count matches metadata:
│  └─ Log: "✓ Row count verified: 1,234 rows"
│  └─ Continue to table swap
├─ If count MISMATCH:
│  ├─ Log: "ERROR: Row count mismatch"
│  ├─ Log: "Expected: 1,234, Got: 1,200"
│  ├─ Drop xrp_price_temp
│  ├─ Keep xrp_price intact
│  ├─ Suggest: "Check backup file integrity"
│  └─ Exit with error
└─ On query error:
   ├─ Drop temp table
   └─ Exit with error
```

#### 2.11 Atomic Table Swap
```javascript
SQL Transaction:
BEGIN;
  ALTER TABLE xrp_price RENAME TO xrp_price_old;
  ALTER TABLE xrp_price_temp RENAME TO xrp_price;
  DROP TABLE xrp_price_old CASCADE;
COMMIT;

Steps:
├─ 1. BEGIN transaction
├─ 2. Rename xrp_price → xrp_price_old
├─ 3. Rename xrp_price_temp → xrp_price
├─ 4. Drop xrp_price_old (with CASCADE)
├─ 5. COMMIT transaction
└─ All or nothing (atomic)

Error Handling:
├─ If ANY step fails:
│  ├─ ROLLBACK entire transaction
│  ├─ xrp_price_old remains (NOT dropped)
│  ├─ xrp_price_temp remains
│  ├─ Original xrp_price restored
│  ├─ Log: "Table swap failed. Manual intervention needed."
│  ├─ Log: "Keep xrp_price_old for inspection."
│  ├─ Log: "Recommend: Contact DBA"
│  └─ Exit with error
└─ On success:
   ├─ All tables in correct state
   ├─ xrp_price_old deleted
   └─ Continue to verification
```

#### 2.12 Post-Swap Verification
```javascript
Checks:
├─ Verify xrp_price exists
├─ Verify xrp_price_old does NOT exist
├─ Verify xrp_price_temp does NOT exist
├─ Select COUNT(*) from xrp_price (should = metadata.rowCount)
└─ Select sample rows to spot-check data

On Failure:
├─ Log: "Post-swap verification failed"
├─ Log: "xrp_price_old still exists. Manual intervention needed."
├─ Suggest: "Contact DBA to investigate"
└─ Exit with partial success status
```

#### 2.13 Success Output
```
Output Format:
✓ Restore successful
  Backup Date: 2025-12-17T21:30:00.123Z
  Rows Restored: 1,234
  Previous Table: xrp_price_old (DROPPED)
  Status: xrp_price table is live

Log Entry:
[2025-12-17T21:35:00.123Z] RESTORE_START
[2025-12-17T21:35:00.234Z] Backup validated
[2025-12-17T21:35:00.345Z] Schema extracted
[2025-12-17T21:35:00.456Z] xrp_price_temp created
[2025-12-17T21:35:01.567Z] Data loaded (1,234 rows)
[2025-12-17T21:35:01.678Z] Row count verified ✓
[2025-12-17T21:35:02.789Z] Table swap completed
[2025-12-17T21:35:02.890Z] RESTORE_SUCCESS
```

#### 2.14 Partial Success (Keep Old Table)
```
Scenario: Table swap failed at DROP step

Output:
⚠ WARNING: Restore had issues
  Status: PARTIAL SUCCESS - Manual action required
  Issue: Failed to drop xrp_price_old
  
Next Steps:
  1. Verify xrp_price has correct data: SELECT COUNT(*) FROM xrp_price
  2. If correct: Manually run: DROP TABLE xrp_price_old CASCADE
  3. If incorrect: Use xrp_price_old to rollback
  
Contact DBA if unsure.

Log Entry:
[2025-12-17T21:35:02.890Z] RESTORE_PARTIAL_SUCCESS
[2025-12-17T21:35:02.900Z] WARNING: xrp_price_old still exists
[2025-12-17T21:35:02.900Z] ACTION: Contact DBA for cleanup
```

#### 2.15 Error Handling Summary
```
Error Scenarios:
├─ Backup file not found
│  └─ "Backup file not found: /path/to/file"
├─ Invalid/corrupted backup file
│  └─ "Corrupted backup file. Gzip decompression failed."
├─ Missing metadata header
│  └─ "Invalid backup format. Metadata header not found."
├─ Row count mismatch
│  └─ "Row count mismatch. Expected 1234, got 1200."
├─ Database connection failed
│  └─ "Cannot connect to database. Check .env configuration."
├─ Schema extraction failed
│  └─ "Failed to extract schema from backup."
├─ Data load failed
│  └─ "Failed to load data into staging table. [SQL error]"
├─ Table swap failed
│  └─ "Table swap failed. xrp_price_old preserved for rollback."
└─ All: Log to file + console, exit with code 1
```

#### 2.16 Logging
```
File: /opt/rich-list/logs/xrp_price_backup.log

Format:
[2025-12-17T21:35:00.123Z] RESTORE_START
[2025-12-17T21:35:00.234Z] File: backups/xrp_price/xrp_price_20251217_213000.sql.gz
[2025-12-17T21:35:00.345Z] Backup validated ✓
[2025-12-17T21:35:00.456Z] Metadata: Date=2025-12-17T21:30:00.123Z, Rows=1234
[2025-12-17T21:35:00.567Z] Database connected ✓
[2025-12-17T21:35:00.678Z] Schema extracted (342 bytes)
[2025-12-17T21:35:00.789Z] xrp_price_temp created ✓
[2025-12-17T21:35:01.890Z] Data loading started...
[2025-12-17T21:35:02.901Z] Data load complete: 1234 rows
[2025-12-17T21:35:03.012Z] Row count verified: 1234 ✓
[2025-12-17T21:35:03.123Z] Table swap: BEGIN
[2025-12-17T21:35:03.234Z] Renamed xrp_price → xrp_price_old
[2025-12-17T21:35:03.345Z] Renamed xrp_price_temp → xrp_price
[2025-12-17T21:35:03.456Z] Dropped xrp_price_old
[2025-12-17T21:35:03.567Z] Table swap: COMMIT ✓
[2025-12-17T21:35:03.678Z] RESTORE_SUCCESS
[2025-12-17T21:35:03.789Z] Elapsed time: 3.67 seconds
```

---

### PART 3: CALLABLE FUNCTIONS (Server Integration)

#### 3.1 Export Functions Structure
```javascript
// Both scripts should export functions:

backup-xrp-price.js:
├─ export async function backupXrpPrice() { }
├─ Can be called from server.js or CLI
└─ Returns: { success: true, file: "...", rowCount: 1234 }

restore-xrp-price.js:
├─ export async function restoreXrpPrice(backupFilePath) { }
├─ Can be called from server.js or CLI
└─ Returns: { success: true, rowsRestored: 1234 }
```

#### 3.2 Server Integration Example
```javascript
// In server.js or routes:

import { backupXrpPrice } from './backup-xrp-price.js';
import { restoreXrpPrice } from './restore-xrp-price.js';

// Create API endpoints if desired:
app.post('/api/admin/backup/xrp_price', async (req, res) => {
  try {
    const result = await backupXrpPrice();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/restore/xrp_price', async (req, res) => {
  const { backupFile } = req.body;
  try {
    const result = await restoreXrpPrice(backupFile);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 3.3 Standalone CLI Usage
```bash
# Backup
node backup-xrp-price.js
npm run price:backup

# Restore (with file)
node restore-xrp-price.js backups/xrp_price/xrp_price_20251217_213000.sql.gz
npm run price:restore -- backups/xrp_price/xrp_price_20251217_213000.sql.gz

# Restore (interactive)
node restore-xrp-price.js
npm run price:restore
```

---

### PART 4: PACKAGE.JSON UPDATES

#### 4.1 Scripts to Add
```json
{
  "scripts": {
    "...existing scripts...": "",
    "price:backup": "node backup-xrp-price.js",
    "price:restore": "node restore-xrp-price.js"
  }
}
```

#### 4.2 Usage from npm
```bash
npm run price:backup
# Output: ✓ Backup saved to: backups/xrp_price/xrp_price_20251217_213000.sql.gz

npm run price:restore
# Shows: Available backups: [list]
# Prompts: Select backup to restore

npm run price:restore -- backups/xrp_price/xrp_price_20251217_213000.sql.gz
# Directly restores without prompt
```

---

### PART 5: IMPLEMENTATION CHECKLIST

```
Pre-Implementation:
├─ [ ] Review this plan with team
├─ [ ] Confirm pg_dump is installed
├─ [ ] Verify database credentials in .env
└─ [ ] Backup current xrp_price table manually

Implementation Phase 1 (backup-xrp-price.js):
├─ [ ] Create file with imports
├─ [ ] Implement database connection
├─ [ ] Create backup directory
├─ [ ] Implement row count query
├─ [ ] Implement pg_dump schema execution
├─ [ ] Implement pg_dump data execution
├─ [ ] Implement metadata header creation
├─ [ ] Implement gzip compression
├─ [ ] Implement success output
├─ [ ] Implement comprehensive logging
├─ [ ] Implement error handling
├─ [ ] Add export for callable function
├─ [ ] Test: Normal backup operation
├─ [ ] Test: Error handling (missing table, no write permission)
└─ [ ] Test: Backup file integrity

Implementation Phase 2 (restore-xrp-price.js):
├─ [ ] Create file with imports
├─ [ ] Implement argument parsing
├─ [ ] Implement backup file listing
├─ [ ] Implement interactive menu
├─ [ ] Implement backup file validation
├─ [ ] Implement metadata extraction
├─ [ ] Implement schema extraction
├─ [ ] Implement database connection
├─ [ ] Implement table existence check
├─ [ ] Implement staging table creation
├─ [ ] Implement data loading
├─ [ ] Implement row count validation
├─ [ ] Implement atomic table swap
├─ [ ] Implement post-swap verification
├─ [ ] Implement success/warning output
├─ [ ] Implement comprehensive logging
├─ [ ] Implement error handling with partial success
├─ [ ] Add export for callable function
├─ [ ] Test: Normal restore operation
├─ [ ] Test: Row count mismatch detection
├─ [ ] Test: Restore to empty database
├─ [ ] Test: Table existence check
├─ [ ] Test: Transaction rollback on failure
└─ [ ] Test: Old table retention on partial failure

Integration Phase:
├─ [ ] Update package.json with scripts
├─ [ ] Test npm run price:backup
├─ [ ] Test npm run price:restore
├─ [ ] Create symbolic link for easy execution (optional)
├─ [ ] Update documentation with examples
└─ [ ] Train team on usage

Post-Implementation:
├─ [ ] Test backup/restore cycle in production
├─ [ ] Monitor logs for any issues
├─ [ ] Schedule regular backup testing
└─ [ ] Document in runbooks
```

---

### PART 6: TESTING STRATEGY

#### 6.1 Unit Tests (Pseudo-code)

```javascript
Test Suite 1: Backup Script
├─ Test: Backup normal table with data
│  └─ Verify: File created, row count in metadata, gzip valid
├─ Test: Backup table with 0 rows
│  └─ Verify: File created, row count = 0
├─ Test: Backup non-existent table
│  └─ Verify: Error message "xrp_price table not found"
├─ Test: Backup with permission denied
│  └─ Verify: Error message, log entry
├─ Test: pg_dump not found
│  └─ Verify: Helpful error message
└─ Test: Database connection failure
   └─ Verify: Clear error, suggestions in log

Test Suite 2: Restore Script
├─ Test: Restore to empty database
│  └─ Verify: Table created, data loaded, 1,234 rows
├─ Test: Restore to existing table
│  └─ Verify: Old table renamed, data swapped, old table deleted
├─ Test: Restore with row count mismatch
│  └─ Verify: Error, temp table dropped, original intact
├─ Test: Restore corrupted backup
│  └─ Verify: Error, temp table dropped, original intact
├─ Test: Restore missing file
│  └─ Verify: Error with helpful message
├─ Test: Restore interactive (no arguments)
│  └─ Verify: Menu shown, can select backup
├─ Test: Restore with file argument
│  └─ Verify: Directly restores without prompting
├─ Test: Transaction rollback on swap failure
│  └─ Verify: Old table preserved, new temp preserved, original unchanged
└─ Test: Partial success (DROP fails)
   └─ Verify: Warning logged, xrp_price_old exists for manual cleanup
```

#### 6.2 Integration Tests

```
Test Scenario 1: Full Backup → Restore Cycle
├─ Backup xrp_price table
├─ Verify backup file created
├─ Delete xrp_price table completely
├─ Restore from backup
├─ Verify table recreated with same data
└─ Verify row count matches

Test Scenario 2: Restore Over Existing Data
├─ Create table with 500 rows
├─ Backup it (creates backup_A)
├─ Add 500 more rows (now 1000)
├─ Restore backup_A over current table
├─ Verify table has 500 rows (old data restored)
├─ Verify xrp_price_old has 1000 rows
└─ Verify xrp_price_old deleted after success

Test Scenario 3: Error Recovery
├─ Create corrupted backup file
├─ Attempt restore
├─ Verify error message shown
├─ Verify original table intact
└─ Verify temp tables cleaned up

Test Scenario 4: Row Count Validation
├─ Backup file claims 1000 rows
├─ Actually load 999 rows
├─ Restore attempts
├─ Verify mismatch detected
├─ Verify temp table dropped
└─ Verify original intact
```

---

### PART 7: USAGE DOCUMENTATION

#### 7.1 User Guide

```markdown
# XRP Price Table Backup & Restore

## Backup

### Automatic Backup
npm run price:backup

Output:
✓ Backup successful
  File: backups/xrp_price/xrp_price_20251217_213000.sql.gz
  Rows: 1,234
  Size: 125 KB

### What Gets Backed Up
- Table schema (CREATE TABLE statement)
- All data (INSERT statements)
- Metadata (backup date, row count)
- Indexes and constraints

### Backup Location
/opt/rich-list/backups/xrp_price/xrp_price_YYYYMMDD_HHMMSS.sql.gz

## Restore

### Interactive Restore (List Available Backups)
npm run price:restore

Output:
Available backups:
  1. xrp_price_20251217_213000.sql.gz (1,234 rows)
  2. xrp_price_20251217_200000.sql.gz (1,200 rows)
  3. xrp_price_20251216_150000.sql.gz (1,000 rows)

Select backup to restore (1-3): 1

### Restore Specific File
npm run price:restore -- backups/xrp_price/xrp_price_20251217_213000.sql.gz

Output:
✓ Restore successful
  Backup Date: 2025-12-17T21:30:00.123Z
  Rows Restored: 1,234
  Previous Table: xrp_price_old (DROPPED)
  Status: xrp_price table is live

## Logs
tail -f /opt/rich-list/logs/xrp_price_backup.log

## Troubleshooting
- Row count mismatch: Backup may be corrupted. Try another backup.
- xrp_price_old still exists: Restore had issues. Contact DBA.
- Database connection failed: Check .env file is readable.
```

#### 7.2 DBA Guide

```markdown
# XRP Price Backup & Restore - DBA Operations

## How It Works

### Backup Process
1. Queries row count from xrp_price
2. Executes pg_dump --schema-only
3. Executes pg_dump --data-only
4. Creates metadata header (date, row count)
5. Combines schema + data + metadata
6. Gzips the file
7. Saves to backups/xrp_price/

### Restore Process
1. Validates backup file integrity
2. Extracts and parses metadata
3. Checks if xrp_price table exists
   - If not: Creates table from backup schema
   - If yes: Continues to staging
4. Creates xrp_price_temp (staging table)
5. Loads data into xrp_price_temp
6. Validates row count matches metadata
7. Executes atomic table swap:
   - Renames xrp_price → xrp_price_old
   - Renames xrp_price_temp → xrp_price
   - Drops xrp_price_old
8. Verifies restore success

## Safety Features

✓ Staging Table: Data loaded to temp first
✓ Validation: Row count checked before swap
✓ Atomic Swap: All-or-nothing table swap
✓ Old Table Preserved: If swap fails, xrp_price_old kept
✓ Logging: Complete audit trail in logs

## Monitoring

Watch for:
- Row count mismatches (data corruption)
- Slow restore times (large backups)
- Permission errors (directory access)
- Database connection issues

## Manual Intervention

If restore partially succeeds:
1. Verify xrp_price has correct data:
   SELECT COUNT(*) FROM xrp_price;
2. If correct: Manually drop old table:
   DROP TABLE xrp_price_old CASCADE;
3. If incorrect: Use xrp_price_old to investigate

## Backup Retention
- Current: Kept indefinitely
- Future: Configure auto-cleanup (30+ days)
```

---

## IMPLEMENTATION DECISION POINTS

### Question 1: Logger Implementation
Should logging use:
- **Option A:** Simple console.log + fs.appendFileSync()
- **Option B:** Create shared logger.js module
- **Option C:** Use existing logger if one exists

**Recommendation:** Option B (create shared logger.js) for reusability

### Question 2: Database Pool Management
Should we:
- **Option A:** Import and reuse config/database.js pool
- **Option B:** Create new pool in each script
- **Option C:** Both (use config/database.js when called from server, create new when standalone)

**Recommendation:** Option C (flexibility for both modes)

### Question 3: Error Codes
Should errors return:
- **Option A:** exit(1) for all errors
- **Option B:** Different codes (exit(1) for errors, exit(0) for partial success)
- **Option C:** exit codes + return objects from functions

**Recommendation:** Option C (better for programmatic usage)

### Question 4: Backup Auto-Cleanup
Should old backups be:
- **Option A:** Kept indefinitely (current plan)
- **Option B:** Auto-delete after 30 days
- **Option C:** Keep 10 most recent, delete older

**Recommendation:** Option A now, document Option B for future (MEDIUM priority task)

### Question 5: Restore Confirmation
Should restore prompt for confirmation:
- **Option A:** No confirmation (proceed directly)
- **Option B:** "This will overwrite xrp_price. Continue? (yes/no)"
- **Option C:** Only if table exists

**Recommendation:** Option C (warn only when overwriting existing data)

---

## ESTIMATED EFFORT BREAKDOWN

| Component | Effort | Notes |
|-----------|--------|-------|
| backup-xrp-price.js | 2 hours | pg_dump, compression, logging |
| restore-xrp-price.js | 3 hours | More complex (swap logic, validation) |
| Logger module | 0.5 hours | Reusable for other scripts |
| Testing | 1.5 hours | Multiple test scenarios |
| Documentation | 1 hour | Usage guides, examples |
| **Total** | **~8 hours** | With testing & documentation |

---

## DEPENDENCIES & REQUIREMENTS

### Existing
- ✅ Node.js 18+
- ✅ PostgreSQL client tools (pg_dump, psql)
- ✅ .env file with DB credentials
- ✅ config/database.js (for reference)

### Node Packages
- ✅ dotenv (already in package.json)
- ✅ pg (already in package.json)
- ✅ Built-in: fs, zlib, path, child_process

### New Directories
- ✓ /opt/rich-list/backups/xrp_price/ (auto-created)
- ✓ /opt/rich-list/logs/ (auto-created)

---

## SUCCESS CRITERIA

### Backup Script
✅ Accepts no arguments
✅ Creates backup file with timestamp
✅ Backup includes schema + data + metadata
✅ Backup is gzip-compressed
✅ Metadata contains: date, row count, version
✅ Row count accurate (matches SELECT COUNT(*))
✅ Logs all operations to file
✅ Errors descriptive and actionable
✅ Callable from server.js AND CLI

### Restore Script
✅ Accepts backup file path as argument
✅ Validates backup file integrity
✅ Extracts and parses metadata correctly
✅ Row count validation works
✅ Detects table existence correctly
✅ Atomic table swap (all-or-nothing)
✅ Preserves old table if swap fails (partial success)
✅ Logs all operations to file
✅ Errors descriptive and actionable
✅ Callable from server.js AND CLI

### npm Scripts
✅ npm run price:backup works
✅ npm run price:restore [file] works
✅ npm run price:restore (interactive) works

### Testing
✅ All test scenarios pass
✅ Backup/restore cycle works
✅ Error scenarios handled correctly
✅ Logs are accurate and helpful

---

## TIMELINE & NEXT STEPS

**Current Status:** Plan complete, ready for implementation

**Next Action:** Confirm plan with team, then:
1. Create backup-xrp-price.js (2 hours)
2. Create restore-xrp-price.js (3 hours)
3. Create logger.js module (30 min)
4. Test thoroughly (1.5 hours)
5. Update documentation (1 hour)
6. Deploy to production (30 min)

**Estimated Total:** ~8 hours

---

**Plan Status:** ✅ READY FOR IMPLEMENTATION

Are there any clarifications or changes needed before implementation begins?

