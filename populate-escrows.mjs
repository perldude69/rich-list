import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5656,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "richlist_postgres_2025",
  database: process.env.DB_NAME || "xrp_list_db",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function clearEscrowsTable() {
  try {
    console.log("Clearing escrows table...");
    const result = await pool.query("DELETE FROM escrows");
    console.log(`✓ Deleted ${result.rowCount} existing escrow records`);
  } catch (err) {
    console.error("Error clearing escrows:", err.message);
    throw err;
  }
}

async function populateEscrows(csvFilePath) {
  const fileStream = fs.createReadStream(csvFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let insertedCount = 0;
  let errorCount = 0;

  console.log(`\nPopulating escrows from: ${csvFilePath}`);

  for await (const line of rl) {
    lineCount++;

    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    try {
      // Parse CSV line: wallet,date,xrp
      const parts = line.split(",");
      if (parts.length !== 3) {
        console.warn(
          `⚠ Line ${lineCount}: Invalid format (expected 3 fields, got ${parts.length})`,
        );
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

      // Validate XRP amount first
      if (isNaN(xrp) || xrp < 0) {
        console.warn(`⚠ Line ${lineCount}: Invalid XRP amount: ${parts[2]}`);
        errorCount++;
        continue;
      }

      // Convert XRP to drops (1 XRP = 1,000,000 drops)
      const drops = Math.round(xrp * 1000000);

      // Handle date - "No expiration" entries will have NULL finish_after
      let unixTimestamp = null;
      if (dateStr.toLowerCase() !== "no expiration") {
        // Validate and convert date - extract just the date part
        const datePart = dateStr.split(" ")[0];
        const dateObj = new Date(datePart);
        if (isNaN(dateObj.getTime())) {
          console.warn(`⚠ Line ${lineCount}: Invalid date format: ${dateStr}`);
          errorCount++;
          continue;
        }
        // Convert date to Unix timestamp (seconds since epoch)
        unixTimestamp = Math.floor(dateObj.getTime() / 1000);
      }

      // Insert into escrows table
      // The escrows table expects: account_id, destination, amount, finish_after
      // We'll use wallet as account_id, same wallet as destination, XRP amount in drops, and Unix timestamp (or NULL)
      const result = await pool.query(
        `INSERT INTO escrows (account_id, destination, amount, finish_after) 
         VALUES ($1, $2, $3, $4)`,
        [wallet, wallet, drops, unixTimestamp],
      );

      insertedCount++;

      // Log progress every 100 rows
      if (insertedCount % 100 === 0) {
        console.log(`  ${insertedCount} records inserted...`);
      }
    } catch (err) {
      console.error(
        `✗ Line ${lineCount}: Error inserting record - ${err.message}`,
      );
      errorCount++;
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Population completed!`);
  console.log(`  Total lines read: ${lineCount}`);
  console.log(`  Records inserted: ${insertedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`${"=".repeat(60)}\n`);

  return { lineCount, insertedCount, errorCount };
}

async function verifyPopulation() {
  try {
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM escrows",
    );
    const count = parseInt(countResult.rows[0].count);

    const totalResult = await pool.query(
      "SELECT SUM(amount) as total FROM escrows",
    );
    const totalDrops = parseInt(totalResult.rows[0].total) || 0;
    const totalXrp = totalDrops / 1000000;

    const sampleResult = await pool.query(
      "SELECT account_id, destination, amount, finish_after FROM escrows LIMIT 5",
    );

    console.log(`Database verification:`);
    console.log(`  Total escrow records: ${count.toLocaleString()}`);
    console.log(
      `  Total XRP escrowed: ${totalXrp.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    );
    console.log(`\n  Sample records:`);
    sampleResult.rows.forEach((row) => {
      // Convert Unix timestamp back to date string
      const dateObj = new Date(row.finish_after * 1000);
      const dateStr = dateObj.toISOString().split("T")[0];
      const xrp = row.amount / 1000000;
      console.log(
        `    ${row.account_id.substring(0, 15)}... | ${dateStr} | ${xrp.toLocaleString("en-US", { maximumFractionDigits: 2 })} XRP`,
      );
    });
  } catch (err) {
    console.error("Error verifying population:", err.message);
  }
}

async function main() {
  const csvFilePath = "/opt/rich-list/new_escrows.csv";

  // Check if file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found at ${csvFilePath}`);
    process.exit(1);
  }

  try {
    // Clear existing escrows
    await clearEscrowsTable();

    // Populate from CSV
    const result = await populateEscrows(csvFilePath);

    // Verify population
    await verifyPopulation();

    console.log("✓ Escrow population completed successfully!\n");
    process.exit(0);
  } catch (err) {
    console.error("Fatal error during population:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
