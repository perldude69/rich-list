import { Pool } from "pg";

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

async function populatePriceHistory() {
  const client = await pool.connect();
  try {
    console.log("Starting price history population...");

    // Truncate existing price_history
    await client.query("TRUNCATE TABLE price_history");

    // Insert OHLC data grouped by day
    const query = `
      INSERT INTO price_history (timestamp, open, high, low, close, volume, currency, created_at)
      SELECT
        EXTRACT(epoch from DATE(time)) * 1000 as timestamp,
        (ARRAY_AGG(price ORDER BY time ASC))[1] as open,
        MAX(price) as high,
        MIN(price) as low,
        (ARRAY_AGG(price ORDER BY time DESC))[1] as close,
        0 as volume,
        'USD' as currency,
        CURRENT_TIMESTAMP as created_at
      FROM xrp_price
      GROUP BY DATE(time)
      ORDER BY DATE(time) ASC
    `;

    const result = await client.query(query);
    console.log(
      `Inserted ${result.rowCount} daily OHLC records into price_history`,
    );
  } catch (error) {
    console.error("Error populating price history:", error);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

populatePriceHistory().catch(console.error);
