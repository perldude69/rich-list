#!/usr/bin/env node

/**
 * XRP Price Table Backup Script
 * 
 * Backs up the xrp_price table with schema, data, and metadata
 * Usage: node backup-xrp-price.js
 * Or:    npm run price:backup
 * 
 * Returns: { success: true, file: "...", rowCount: 1234 }
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { spawn } from 'child_process';
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
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      logger.info(`Created backup directory: ${BACKUP_DIR}`);
    }
    
    // Test write permissions
    const testFile = path.join(BACKUP_DIR, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    throw new Error(`Cannot write to backup directory: ${error.message}`);
  }
}

/**
 * Get row count from xrp_price table
 */
async function getRowCount(pool) {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM xrp_price');
    return parseInt(result.rows[0].count);
  } catch (error) {
    if (error.message.includes('does not exist')) {
      logger.warn('xrp_price table not found');
      return null;
    }
    throw new Error(`Failed to query row count: ${error.message}`);
  }
}

/**
 * Execute pg_dump command
 */
function executePgDump(args) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PGPASSWORD: process.env.DB_PASSWORD,
    };

    const pgDump = spawn('pg_dump', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let stdout = '';
    let stderr = '';

    pgDump.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pgDump.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pgDump.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump failed: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    pgDump.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('pg_dump not found. Install PostgreSQL client tools.'));
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `xrp_price_${year}${month}${day}_${hours}${minutes}${seconds}.sql`;
}

/**
 * Filter out id column from COPY statement
 * Removes the id column from the COPY line and all data values
 */
function filterIdColumnFromCopy(sqlContent) {
  const lines = sqlContent.split('\n');
  const result = [];
  let inCopyData = false;
  let idColumnIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is the COPY line
    if (line.includes('COPY public.xrp_price') && line.includes('FROM stdin')) {
      // Parse column list to find id index
      const match = line.match(/COPY public\.xrp_price \((.*?)\) FROM stdin/);
      if (match) {
        const columns = match[1].split(',').map(col => col.trim());
        idColumnIndex = columns.indexOf('id');
        
        if (idColumnIndex !== -1) {
          // Remove id from column list
          columns.splice(idColumnIndex, 1);
          const newLine = `COPY public.xrp_price (${columns.join(', ')}) FROM stdin;`;
          result.push(newLine);
          inCopyData = true;
          continue;
        }
      }
    }

    // Process data lines - remove the id column value
    if (inCopyData && idColumnIndex !== -1 && line.trim() !== '' && line !== '\\.') {
      const values = line.split('\t');
      if (values.length > idColumnIndex) {
        values.splice(idColumnIndex, 1);
        result.push(values.join('\t'));
      } else {
        result.push(line);
      }
      continue;
    }

    // End of copy data
    if (line.trim() === '\\.') {
      inCopyData = false;
      idColumnIndex = -1;
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Create metadata header
 */
function createMetadataHeader(rowCount) {
  const lines = [
    '-- XRP_PRICE_BACKUP',
    `-- Backup Date: ${new Date().toISOString()}`,
    '-- Table: xrp_price',
    `-- Row Count: ${rowCount}`,
    '-- Format Version: 1.0',
    '-- ============================================',
    '',
  ];
  return lines.join('\n');
}

/**
 * Backup the xrp_price table
 */
async function backupXrpPrice() {
  logger.start('BACKUP');
  
  const pool = createPool();
  
  try {
    // Test database connection
    await pool.query('SELECT 1');
    logger.info('Connected to database');
    
    // Ensure backup directory exists
    ensureBackupDir();
    logger.info(`Backup directory: ${BACKUP_DIR}`);
    
    // Get row count
    const rowCount = await getRowCount(pool);
    
    if (rowCount === null) {
      logger.warn('xrp_price table not found. No backup created.');
      return {
        success: false,
        error: 'xrp_price table not found',
      };
    }
    
    logger.info(`Row count: ${rowCount}`);
    
    // Export schema
    logger.debug('Exporting schema...');
    const schemaSQL = await executePgDump([
      `--host=${process.env.DB_HOST || 'localhost'}`,
      `--port=${process.env.DB_PORT || 5656}`,
      `--username=${process.env.DB_USER || 'postgres'}`,
      `--dbname=${process.env.DB_NAME || 'xrp_list_db'}`,
      '--table=xrp_price',
      '--schema-only',
      '--no-password',
    ]);
    logger.debug(`Schema exported (${schemaSQL.length} bytes)`);
    
     // Export data (excluding id column to allow auto-generation on restore)
     logger.debug('Exporting data...');
     const rawDataSQL = await executePgDump([
       `--host=${process.env.DB_HOST || 'localhost'}`,
       `--port=${process.env.DB_PORT || 5656}`,
       `--username=${process.env.DB_USER || 'postgres'}`,
       `--dbname=${process.env.DB_NAME || 'xrp_list_db'}`,
       '--table=xrp_price',
       '--data-only',
       '--no-password',
     ]);
     
     // Filter out id column from COPY statement
     const dataSQL = filterIdColumnFromCopy(rawDataSQL);
     logger.debug(`Data exported (${dataSQL.length} bytes)`);
    
    // Create metadata header
    const metadata = createMetadataHeader(rowCount);
    
    // Combine schema, metadata, and data
    const combinedSQL = metadata + schemaSQL + dataSQL;
    
    // Generate backup filename
    const backupName = generateBackupFilename();
    const tempFile = path.join(BACKUP_DIR, backupName);
    const backupFile = path.join(BACKUP_DIR, `${backupName}.gz`);
    
    // Write uncompressed SQL to temp file
    logger.debug(`Writing to temp file: ${tempFile}`);
    fs.writeFileSync(tempFile, combinedSQL);
    
    // Compress with gzip
    logger.debug('Compressing with gzip...');
    await new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(tempFile);
      const writeStream = fs.createWriteStream(backupFile);
      const gzipStream = zlib.createGzip();
      
      readStream
        .pipe(gzipStream)
        .pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
      
      readStream.on('error', reject);
      gzipStream.on('error', reject);
    });
    
    // Verify backup file
    const stats = fs.statSync(backupFile);
    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }
    
    logger.debug(`Compressed to ${stats.size} bytes`);
    
    // Delete temp uncompressed file
    fs.unlinkSync(tempFile);
    logger.debug('Removed temp file');
    
    // Verify backup file is readable
    fs.accessSync(backupFile, fs.constants.R_OK);
    
    logger.success('BACKUP', `${stats.size} bytes`);
    
    return {
      success: true,
      file: backupFile,
      rowCount: rowCount,
      size: stats.size,
    };
    
  } catch (error) {
    logger.failure('BACKUP', error);
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
    const result = await backupXrpPrice();
    
    if (result.success) {
      console.log('\n✓ Backup successful');
      console.log(`  File: ${path.relative(process.cwd(), result.file)}`);
      console.log(`  Rows: ${result.rowCount.toLocaleString()}`);
      console.log(`  Size: ${(result.size / 1024).toFixed(1)} KB`);
      console.log(`  Location: ${result.file}\n`);
      process.exit(0);
    } else {
      console.error(`\n✗ Backup failed: ${result.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Export for use as module
export { backupXrpPrice };

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
