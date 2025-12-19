import fs from "fs";
import csv from "csv-parser";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

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

async function createTableIfNotExists() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS xrp_price (
        id SERIAL PRIMARY KEY,
        price NUMERIC(20,8) NOT NULL,
        time TIMESTAMP NOT NULL,
        ledger BIGINT,
        sequence BIGINT,
        UNIQUE(time)
      );
    `);
    console.log("xrp_price table created or already exists.");
  } catch (error) {
    console.error("Error creating table:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function importCSV() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const batchSize = 1000;
    let batch = [];
    let totalInserted = 0;

    const stream = fs.createReadStream("xrp_prices_export.csv").pipe(
      csv({
        headers: ["price", "time", "ledger", "sequence"],
        skipEmptyLines: true,
      }),
    );

    for await (const row of stream) {
      // Skip header if it's the first row and matches header
      if (row.price === "price" && row.time === "time") continue;

      // Parse and validate
      const price = parseFloat(row.price);
      const time = new Date(row.time);
      const ledger = parseInt(row.ledger);
      const sequence = parseInt(row.sequence);

      if (
        isNaN(price) ||
        isNaN(time.getTime()) ||
        isNaN(ledger) ||
        isNaN(sequence)
      ) {
        console.warn("Skipping invalid row:", row);
        continue;
      }

      batch.push({ price, time: time.toISOString(), ledger, sequence });

      if (batch.length >= batchSize) {
        await insertBatch(client, batch);
        totalInserted += batch.length;
        console.log(`Inserted ${totalInserted} rows so far...`);
        batch = [];
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      await insertBatch(client, batch);
      totalInserted += batch.length;
    }

    await client.query("COMMIT");
    console.log(`Import completed. Total rows inserted: ${totalInserted}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing CSV:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function insertBatch(client, batch) {
  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (const row of batch) {
    placeholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
    );
    values.push(row.price, row.time, row.ledger, row.sequence);
  }

  const query = `
    INSERT INTO xrp_price (price, time, ledger, sequence)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (time) DO NOTHING
  `;

  await client.query(query, values);
}

async function main() {
  try {
    await createTableIfNotExists();
    await importCSV();
    console.log("CSV import successful.");
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
