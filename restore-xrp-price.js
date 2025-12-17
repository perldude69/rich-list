#!/usr/bin/env node

/**
 * XRP Price Table Restore Script
 * 
 * Safely restores xrp_price table from backup with atomic table swap
 * Usage: node restore-xrp-price.js [backup_file]
 * Or:    npm run price:restore
 * Or:    npm run price:restore -- /path/to/backup.sql.gz
 * 
 * Returns: { success: true, rowsRestored: 1234 }
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger('xrp_price_backup.log');
const BACKUP_DIR = path.join(__dirname, 'backups', 'xrp_price');

/**
 * Initialize PostgreSQL connection pool
 */
function createPool() {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5656,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'xrp_list_db',
    max: 1,
  });
}

/**
 * Interactive file selection if no argument provided
 */
async function selectBackupFile() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('\nNo backup directory found.');
    return null;
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql.gz'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('\nNo backups found in:', BACKUP_DIR);
    return null;
  }

  if (files.length === 1) {
    const file = files[0];
    const fullPath = path.join(BACKUP_DIR, file);
    console.log(`\nFound backup: ${file}`);
    return fullPath;
  }

  console.log('\nAvailable backups:');
  files.forEach((f, i) => {
    const fullPath = path.join(BACKUP_DIR, f);
    const stats = fs.statSync(fullPath);
    console.log(`  ${i + 1}. ${f} (${stats.size} bytes)`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\nSelect backup (1-${files.length}): `, (answer) => {
      rl.close();
      const idx = parseInt(answer) - 1;
      if (idx >= 0 && idx < files.length) {
        resolve(path.join(BACKUP_DIR, files[idx]));
      } else {
        console.log('Invalid selection');
        resolve(null);
      }
    });
  });
}

/**
 * Validate backup file and extract metadata
 */
function validateAndExtractMetadata(filePath) {
  try {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }

    // Decompress and read metadata
    const compressed = fs.readFileSync(filePath);
    const decompressed = zlib.gunzipSync(compressed).toString();

    // Parse metadata header
    const lines = decompressed.split('\n');
    const metadata = {};

    for (const line of lines) {
      if (line.includes('Backup Date:')) {
        const match = line.match(/Backup Date: ([\d\-T:.Z]+)/);
        if (match) metadata.backupDate = match[1];
      }
      if (line.includes('Row Count:')) {
        const match = line.match(/Row Count: (\d+)/);
        if (match) metadata.rowCount = parseInt(match[1]);
      }
      if (line.includes('Format Version:')) {
        const match = line.match(/Format Version: ([\d.]+)/);
        if (match) metadata.formatVersion = match[1];
      }
      if (line.startsWith('--') === false && line.trim() !== '') {
        break; // End of metadata
      }
    }

    if (!metadata.backupDate || metadata.rowCount === undefined) {
      throw new Error('Invalid backup format. Metadata header not found.');
    }

    return { metadata, decompressed };
  } catch (error) {
    if (error.message.includes('gunzip')) {
      throw new Error('Corrupted backup file. Gzip decompression failed.');
    }
    throw error;
  }
}

/**
 * Extract SQL schema from backup and set up auto-increment for id
 */
function extractSchema(sqlContent) {
  const lines = sqlContent.split('\n');
  const schemaLines = [];
  let inSchema = false;

  for (const line of lines) {
    // Look for CREATE TABLE with or without schema prefix
    if (line.includes('CREATE TABLE') && line.includes('xrp_price')) {
      inSchema = true;
    }
    if (inSchema) {
      schemaLines.push(line);
      if (line.trim().endsWith(';') && line.includes('CREATE TABLE')) {
        break;
      }
    }
  }

  let schema = schemaLines.join('\n');

  if (!schema.includes('CREATE TABLE') || !schema.includes('xrp_price')) {
    throw new Error('Failed to extract schema from backup.');
  }

  // Replace public.xrp_price with just xrp_price for compatibility
  schema = schema.replace(/CREATE TABLE public\.xrp_price/g, 'CREATE TABLE xrp_price');
  
  // Modify id column to allow NULL initially (will be filled by sequence later)
  schema = schema.replace(/id integer NOT NULL/g, 'id integer');

  return schema;
}

/**
 * Extract SQL data (COPY or INSERT statements) from backup
 */
function extractData(sqlContent) {
  const lines = sqlContent.split('\n');
  const dataLines = [];
  let inData = false;
  let inCopyData = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle COPY format
    if (line.includes('COPY') && line.includes('xrp_price')) {
      inData = true;
      inCopyData = true;
      // Replace public.xrp_price with xrp_price for compatibility
      const modifiedLine = line.replace(/COPY public\.xrp_price/g, 'COPY xrp_price');
      dataLines.push(modifiedLine);
      continue;
    }

    // Handle INSERT format (legacy)
    if (line.includes('INSERT INTO xrp_price') || line.includes('INSERT INTO public.xrp_price')) {
      inData = true;
      inCopyData = false;
      const modifiedLine = line.replace(/INSERT INTO public\.xrp_price/g, 'INSERT INTO xrp_price');
      dataLines.push(modifiedLine);
      continue;
    }

    // Collect data lines
    if (inData && line.trim() !== '') {
      // Stop at the end marker for COPY data
      if (inCopyData && line.trim() === '\\.') {
        dataLines.push(line);
        break;
      }
      dataLines.push(line);
    }
  }

  return dataLines.join('\n');
}

/**
 * Convert COPY format to batched INSERT statements (multiple rows per statement)
 */
function batchInsertStatements(sqlContent, tableName, batchSize = 1000) {
  const lines = sqlContent.split('\n');
  const statements = [];
  let columns = [];
  let inCopyData = false;
  let currentBatch = [];
  let rowCount = 0;

  for (const line of lines) {
    // Parse COPY statement to extract columns
    if (line.includes('COPY') && line.includes('FROM stdin')) {
      const match = line.match(/COPY [\w.]+ \((.*?)\) FROM stdin/);
      if (match) {
        columns = match[1]
          .split(',')
          .map(col => col.trim().replace(/"/g, ''));
        inCopyData = true;
      }
      continue;
    }

    // Stop at end marker - flush remaining batch
    if (line.trim() === '\\.') {
      if (currentBatch.length > 0) {
        statements.push(createBatchInsert(tableName, columns, currentBatch));
        currentBatch = [];
      }
      inCopyData = false;
      continue;
    }

    // Convert data lines to batch INSERT
    if (inCopyData && columns.length > 0 && line.trim() !== '') {
      const values = line.split('\t');
      
      if (values.length === columns.length) {
        currentBatch.push(values);
        rowCount++;

        // Flush batch when it reaches batchSize
        if (currentBatch.length >= batchSize) {
          statements.push(createBatchInsert(tableName, columns, currentBatch));
          currentBatch = [];
        }
      }
    }
  }

  // If no INSERT statements were generated, return the original (might be INSERT format already)
  if (statements.length === 0) {
    return [sqlContent];
  }

  return statements;
}

/**
 * Create a single INSERT statement with multiple rows
 */
function createBatchInsert(tableName, columns, valuesList) {
  const formattedRows = valuesList.map(values => {
    const formattedValues = values.map(val => {
      // Handle NULL values
      if (val === '\\N') return 'NULL';
      // Handle numeric values
      if (!isNaN(val) && val !== '') return val;
      // Quote string values and escape quotes
      return `'${val.replace(/'/g, "''")}'`;
    });
    return `(${formattedValues.join(', ')})`;
  });

  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${formattedRows.join(', ')};`;
}

/**
 * Check if table exists
 */
async function tableExists(pool, tableName) {
  try {
    const result = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    logger.error(`Failed to check table existence: ${error.message}`);
    throw error;
  }
}

/**
 * Create table from schema
 */
async function createTableFromSchema(pool, schema) {
  try {
    await pool.query(schema);
    logger.debug('Table created from schema');
  } catch (error) {
    throw new Error(`Failed to create table: ${error.message}`);
  }
}

/**
 * Get row count from table
 */
async function getRowCount(pool, tableName) {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM ${tableName}`
  );
  return parseInt(result.rows[0].count);
}

/**
 * Restore xrp_price from backup file
 */
async function restoreXrpPrice(backupFile) {
  logger.start('RESTORE');
  logger.info(`File: ${backupFile}`);

  const pool = createPool();

  try {
    // Validate backup file and extract metadata
    logger.debug('Validating backup file...');
    const { metadata, decompressed } = validateAndExtractMetadata(backupFile);
    logger.info(`Backup validated ✓`);
    logger.info(`Metadata: Date=${metadata.backupDate}, Rows=${metadata.rowCount}`);

    // Test database connection
    await pool.query('SELECT 1');
    logger.info('Database connected ✓');

    // Extract schema
    logger.debug('Extracting schema...');
    const schema = extractSchema(decompressed);
    logger.debug(`Schema extracted (${schema.length} bytes)`);

    // Check if table exists
    const xrpPriceExists = await tableExists(pool, 'xrp_price');

    if (!xrpPriceExists) {
      logger.info('xrp_price table not found. Creating from backup schema.');
      await createTableFromSchema(pool, schema);
      logger.info('Table created ✓');
    }

    // Create staging table
    logger.debug('Creating staging table xrp_price_temp...');
    
    // Drop if exists
    try {
      await pool.query('DROP TABLE xrp_price_temp CASCADE');
      logger.debug('Dropped existing xrp_price_temp');
    } catch (e) {
      // Expected if doesn't exist
    }

     // Create staging table as copy of existing or from schema
     if (xrpPriceExists) {
       await pool.query(
         'CREATE TABLE xrp_price_temp AS SELECT * FROM xrp_price WHERE 1=0'
       );
     } else {
       await pool.query(schema.replace('CREATE TABLE xrp_price', 'CREATE TABLE xrp_price_temp'));
     }
     logger.info('Staging table created ✓');
     
     // Set up sequence and auto-increment for id column
     logger.debug('Setting up id sequence...');
     try {
       await pool.query('DROP SEQUENCE IF EXISTS xrp_price_temp_id_seq CASCADE');
     } catch (e) {
       // OK if sequence doesn't exist
     }
     await pool.query('CREATE SEQUENCE xrp_price_temp_id_seq START WITH 1');
     await pool.query('ALTER TABLE xrp_price_temp ALTER COLUMN id SET DEFAULT nextval(\'xrp_price_temp_id_seq\')');
     logger.debug('Sequence configured ✓');

     // Extract and load data
     logger.debug('Extracting data from backup...');
     const data = extractData(decompressed);

     if (data.trim()) {
       logger.debug('Loading data into staging table...');
       // Use batch INSERT statements for better performance
       const batchedSQL = batchInsertStatements(data, 'xrp_price_temp', 1000);
       
       // Execute batched statements
       for (const batchStatement of batchedSQL) {
         if (batchStatement.trim()) {
           await pool.query(batchStatement);
         }
       }
     }
     logger.info('Data loaded ✓');

    // Validate row count
    logger.debug('Validating row count...');
    const tempCount = await getRowCount(pool, 'xrp_price_temp');
    logger.info(`Rows in temp table: ${tempCount}`);

    if (tempCount !== metadata.rowCount) {
      // Drop temp table and fail
      await pool.query('DROP TABLE xrp_price_temp CASCADE');
      throw new Error(
        `Row count mismatch. Expected ${metadata.rowCount}, got ${tempCount}`
      );
    }
    logger.info('Row count verified ✓');

     // Atomic table swap
     logger.info('Table swap: BEGIN');
     const client = await pool.connect();
     try {
       await client.query('BEGIN');

       // Rename sequence first
       try {
         await client.query('ALTER SEQUENCE xrp_price_temp_id_seq RENAME TO xrp_price_id_seq');
         logger.debug('Renamed sequence xrp_price_temp_id_seq → xrp_price_id_seq');
       } catch (e) {
         logger.debug('Sequence rename skipped (may not exist)');
       }

       // Only do swap if xrp_price exists
       if (xrpPriceExists) {
         await client.query('ALTER TABLE xrp_price RENAME TO xrp_price_old');
         logger.debug('Renamed xrp_price → xrp_price_old');
       }

       await client.query('ALTER TABLE xrp_price_temp RENAME TO xrp_price');
       logger.debug('Renamed xrp_price_temp → xrp_price');

       if (xrpPriceExists) {
         await client.query('DROP TABLE xrp_price_old CASCADE');
         logger.debug('Dropped xrp_price_old');
       }

       await client.query('COMMIT');
       logger.info('Table swap: COMMIT ✓');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Table swap failed. Rollback executed.`);
      throw new Error(
        `Table swap failed: ${error.message}. xrp_price_old preserved for rollback.`
      );
    } finally {
      client.release();
    }

    // Post-swap verification
    logger.debug('Verifying post-swap state...');
    const finalCount = await getRowCount(pool, 'xrp_price');
    const oldTableExists = await tableExists(pool, 'xrp_price_old');
    const tempTableExists = await tableExists(pool, 'xrp_price_temp');

    if (oldTableExists || tempTableExists) {
      logger.warn('Post-swap verification: Orphaned tables detected');
      return {
        success: true,
        status: 'PARTIAL_SUCCESS',
        rowsRestored: finalCount,
        message: 'Restore successful but manual cleanup may be needed',
      };
    }

    logger.success('RESTORE', `${finalCount} rows`);

    return {
      success: true,
      rowsRestored: finalCount,
      backupDate: metadata.backupDate,
    };
  } catch (error) {
    logger.failure('RESTORE', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Determine backup file
    let backupFile = process.argv[2];

    if (!backupFile) {
      backupFile = await selectBackupFile();
      if (!backupFile) {
        console.log('\nNo backup file selected.');
        process.exit(1);
      }
    }

    const result = await restoreXrpPrice(backupFile);

    if (result.success) {
      console.log('\n✓ Restore successful');
      console.log(`  Backup Date: ${result.backupDate}`);
      console.log(`  Rows Restored: ${result.rowsRestored.toLocaleString()}`);
      if (result.status === 'PARTIAL_SUCCESS') {
        console.log(`  Status: ⚠ PARTIAL_SUCCESS - ${result.message}`);
      } else {
        console.log('  Status: xrp_price table is live');
      }
      console.log();
      process.exit(0);
    } else {
      console.error(`\n✗ Restore failed\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Export for use as module
export { restoreXrpPrice };

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
