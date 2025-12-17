import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5656,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'richlist_postgres_2025',
  database: process.env.DB_NAME || 'xrp_list_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function createEscrowsTable() {
  try {
    console.log('Creating escrows_simple table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS escrows_simple (
        id SERIAL PRIMARY KEY,
        wallet TEXT NOT NULL,
        expiration_date DATE NOT NULL,
        xrp DECIMAL(20, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Table created successfully');

    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_escrows_simple_date 
      ON escrows_simple(expiration_date);
    `);
    console.log('✓ Index created successfully');
  } catch (err) {
    console.error('Error creating table:', err.message);
    throw err;
  }
}

async function clearEscrows() {
  try {
    console.log('Clearing existing escrow data...');
    const result = await pool.query('DELETE FROM escrows_simple');
    console.log(`✓ Deleted ${result.rowCount} existing escrow records`);
  } catch (err) {
    console.error('Error clearing escrows:', err.message);
    throw err;
  }
}

async function importEscrows(csvFilePath) {
  const fileStream = fs.createReadStream(csvFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let insertedCount = 0;
  let errorCount = 0;

  console.log(`\nImporting escrows from: ${csvFilePath}`);

  for await (const line of rl) {
    lineCount++;
    
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    try {
      // Parse CSV line: wallet,date,xrp
      const parts = line.split(',');
      if (parts.length !== 3) {
        console.warn(`⚠ Line ${lineCount}: Invalid format (expected 3 fields, got ${parts.length})`);
        errorCount++;
        continue;
      }

      const wallet = parts[0].trim();
      const dateStr = parts[1].trim(); // Format: "YYYY-MM-DD HH:MM:SS"
      const xrp = parseFloat(parts[2].trim());

      // Validate wallet address
      if (!wallet || wallet.length === 0) {
        console.warn(`⚠ Line ${lineCount}: Empty wallet address`);
        errorCount++;
        continue;
      }

      // Validate and convert date
      // Extract just the date part (YYYY-MM-DD) from the timestamp
      const datePart = dateStr.split(' ')[0];
      const dateObj = new Date(datePart);
      if (isNaN(dateObj.getTime())) {
        console.warn(`⚠ Line ${lineCount}: Invalid date format: ${dateStr}`);
        errorCount++;
        continue;
      }

      // Validate XRP amount
      if (isNaN(xrp) || xrp < 0) {
        console.warn(`⚠ Line ${lineCount}: Invalid XRP amount: ${parts[2]}`);
        errorCount++;
        continue;
      }

      // Insert into database
      const result = await pool.query(
        'INSERT INTO escrows_simple (wallet, expiration_date, xrp) VALUES ($1, $2::DATE, $3)',
        [wallet, datePart, xrp]
      );

      insertedCount++;

      // Log progress every 100 rows
      if (insertedCount % 100 === 0) {
        console.log(`  ${insertedCount} records inserted...`);
      }
    } catch (err) {
      console.error(`✗ Line ${lineCount}: Error inserting record - ${err.message}`);
      errorCount++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Import completed!`);
  console.log(`  Total lines read: ${lineCount}`);
  console.log(`  Records inserted: ${insertedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`${'='.repeat(60)}\n`);

  return { lineCount, insertedCount, errorCount };
}

async function verifyImport() {
  try {
    const countResult = await pool.query('SELECT COUNT(*) as count FROM escrows_simple');
    const count = parseInt(countResult.rows[0].count);

    const totalResult = await pool.query('SELECT SUM(xrp) as total FROM escrows_simple');
    const total = parseFloat(totalResult.rows[0].total) || 0;

    const sampleResult = await pool.query('SELECT wallet, expiration_date, xrp FROM escrows_simple LIMIT 5');

    console.log(`Database verification:`);
    console.log(`  Total escrow records: ${count.toLocaleString()}`);
    console.log(`  Total XRP escrowed: ${total.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`\n  Sample records:`);
    sampleResult.rows.forEach(row => {
      const dateStr = row.expiration_date instanceof Date 
        ? row.expiration_date.toISOString().split('T')[0]
        : row.expiration_date;
      console.log(`    ${row.wallet.substring(0, 15)}... | ${dateStr} | ${row.xrp} XRP`);
    });
  } catch (err) {
    console.error('Error verifying import:', err.message);
  }
}

async function main() {
  const csvFilePath = '/opt/rich-list/new_escrows.csv';

  // Check if file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found at ${csvFilePath}`);
    process.exit(1);
  }

  try {
    // Create table if needed
    await createEscrowsTable();

    // Clear existing escrows
    await clearEscrows();

    // Import new escrows
    const result = await importEscrows(csvFilePath);

    // Verify import
    await verifyImport();

    console.log('✓ Import process completed successfully!\n');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during import:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
