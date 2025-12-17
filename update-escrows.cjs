require("dotenv").config();
const { Client: XrplClient } = require("xrpl");
const { Pool } = require("pg");

// Configuration from .env - using rich-list database settings
const RIPPLE_ENDPOINT = process.env.RIPPLE_ENDPOINT || "wss://xrpl.ws";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || 5656;
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD || "richlist_postgres_2025";
const DB_NAME = process.env.DB_NAME || "xrp_list_db";

const RIPPLE_EPOCH_OFFSET = 946684800;

// Database connection pool
const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 10,
  idleTimeoutMillis: 7200000,
  connectionTimeoutMillis: 10000,
});

async function testConnections() {
  console.log("🔍 Testing connections...");

  // Test XRPL connection
  try {
    const xrplClient = new XrplClient(RIPPLE_ENDPOINT);
    await xrplClient.connect();
    console.log("✅ XRPL connection successful");
    await xrplClient.disconnect();
  } catch (error) {
    console.error("❌ XRPL connection failed:", error.message);
    throw error;
  }

  // Test PostgreSQL connection
  try {
    const client = await pool.connect();
    console.log("✅ PostgreSQL connection successful");
    client.release();
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error.message);
    throw error;
  }

  console.log("⏳ Waiting 10 seconds before proceeding...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  console.log("🚀 Proceeding with escrow update...");
}

async function fetchAllEscrows() {
  console.log("📡 Connecting to XRPL for escrow data...");
  const client = new XrplClient(RIPPLE_ENDPOINT);
  await client.connect();

  try {
    const escrows = [];
    let marker = null;
    const limit = 256;
    let calls = 0;

    do {
      calls++;
      const request = {
        command: "ledger_data",
        type: "escrow",
        limit: limit,
      };

      if (marker) {
        request.marker = marker;
      }

      const response = await client.request(request);

      if (response.result && response.result.state) {
        escrows.push(...response.result.state);
        marker = response.result.marker;
        process.stdout.write(
          `📊 Fetched ${escrows.length} escrows in ${calls} calls...\r`,
        );
      } else {
        break;
      }
    } while (marker);

    console.log(`\n✅ Completed: ${escrows.length} escrows fetched`);
    return escrows;
  } finally {
    await client.disconnect();
  }
}

function formatDate(unixTime) {
  const date = new Date(unixTime * 1000);
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

async function updateDatabase(escrows) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Truncate existing escrows table
    console.log("🗑️  Clearing existing escrow data...");
    await client.query("TRUNCATE TABLE escrows RESTART IDENTITY CASCADE");

    console.log("💾 Inserting escrow data...");
    let insertCount = 0;

    // Process and insert escrows
    for (const escrow of escrows) {
      if (!escrow.FinishAfter) continue; // Only insert escrows with expiration dates

      const amountDrops = parseInt(escrow.Amount) || 0;
      const finishDate = escrow.FinishAfter
        ? new Date((escrow.FinishAfter + RIPPLE_EPOCH_OFFSET) * 1000)
            .toISOString()
            .split("T")[0]
        : null;

      try {
        await client.query(
          `INSERT INTO escrows 
            (account_id, destination, destination_tag, amount, finish_after, ledger_entry_type, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            escrow.Account,
            escrow.Destination,
            escrow.DestinationTag || null,
            amountDrops,
            finishDate,
            "Escrow",
          ],
        );
        insertCount++;
      } catch (err) {
        // Log error but continue with next escrow
        console.error(
          `⚠️  Failed to insert escrow for ${escrow.Account}:`,
          err.message,
        );
      }
    }

    await client.query("COMMIT");
    console.log(
      `✅ Database updated successfully - inserted ${insertCount} escrows`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log("🚀 Starting escrow update process...");

    // Test connections
    await testConnections();

    // Fetch escrow data
    const escrows = await fetchAllEscrows();

    // Update database
    await updateDatabase(escrows);

    console.log("🎉 Escrow update completed successfully!");
  } catch (error) {
    console.error("❌ Error updating escrows:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
