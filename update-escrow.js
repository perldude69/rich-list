import WebSocket from "ws";
import { Pool } from "pg";

let endpoint = "ws://127.0.0.1:51233";

const ws = new WebSocket(endpoint);

let escrows = [];

let id = 1;

const RIPPLE_EPOCH_OFFSET = 946684800;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5656,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "richlist_postgres_2025",
  database: process.env.DB_NAME || "xrp_list_db",
  max: 10,
  idleTimeoutMillis: 7200000,
  connectionTimeoutMillis: 10000,
});

function sendRequest(params) {
  const request = { id: id++, command: "ledger_data", ...params };
  ws.send(JSON.stringify(request));
}

ws.on("open", function open() {
  console.log("Connected to XRPL WebSocket");
  sendRequest({ type: "escrow", limit: 256 });
});

ws.on("message", async function incoming(data) {
  const response = JSON.parse(data.toString());
  if (response.result && response.result.state) {
    escrows.push(...response.result.state);
    console.log(
      `Fetched ${response.result.state.length} escrows, total: ${escrows.length}`,
    );
    if (response.result.marker) {
      sendRequest({
        type: "escrow",
        limit: 256,
        marker: response.result.marker,
      });
    } else {
      // Done fetching, now insert into database
      await insertEscrowsToDatabase();
      ws.close();
    }
  } else {
    console.error("Unexpected response:", response);
    ws.close();
  }
});

async function insertEscrowsToDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create temporary table
    console.log("Creating temporary escrow table...");
    await client.query("DROP TABLE IF EXISTS escrows_temp");
    await client.query(
      "CREATE TABLE escrows_temp (LIKE escrows INCLUDING ALL)",
    );
    // Drop and recreate finish_after as DATE type for date string compatibility
    await client.query("ALTER TABLE escrows_temp DROP COLUMN finish_after");
    await client.query("ALTER TABLE escrows_temp ADD COLUMN finish_after DATE");
    // Recreate the sequence since CASCADE dropped it
    await client.query("CREATE SEQUENCE IF NOT EXISTS escrows_simple_id_seq");
    // Ensure the sequence is set for the temp table
    await client.query(
      "ALTER TABLE escrows_temp ALTER COLUMN id SET DEFAULT nextval('escrows_simple_id_seq')",
    );
    // Ensure the sequence is set for the temp table
    await client.query(
      "ALTER TABLE escrows_temp ALTER COLUMN id SET DEFAULT nextval('escrows_simple_id_seq')",
    );

    console.log("Inserting escrow data into temp table...");
    let insertCount = 0;

    for (const escrow of escrows) {
      if (!escrow.FinishAfter) continue; // Only insert escrows with expiration dates

      const amountDrops = parseInt(escrow.Amount);
      const finishDate = new Date(
        (escrow.FinishAfter + RIPPLE_EPOCH_OFFSET) * 1000,
      )
        .toISOString()
        .split("T")[0];

      await client.query(
        `INSERT INTO escrows_temp
                  (id, account_id, destination, finish_after, amount, created_at)
                  VALUES (DEFAULT, $1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [escrow.Account, escrow.Destination, finishDate, amountDrops],
      );
      insertCount++;
    }

    // If successful, swap tables
    console.log("Swapping tables...");
    await client.query("DROP TABLE escrows CASCADE");
    await client.query("ALTER TABLE escrows_temp RENAME TO escrows");

    await client.query("COMMIT");
    console.log(
      `Database updated successfully - inserted ${insertCount} escrows`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    // Clean up temp table on error
    try {
      await client.query("DROP TABLE IF EXISTS escrows_temp");
    } catch (cleanupError) {
      console.error("Error cleaning up temp table:", cleanupError);
    }
    throw error;
  } finally {
    client.release();
  }
}

ws.on("error", function error(err) {
  console.error("WebSocket error:", err);
});

ws.on("close", function close() {
  pool.end();
  process.exit(0);
});
