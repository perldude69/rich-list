// Check price_gaps table

import db from "./config/database.js";

async function checkPriceGapsTable() {
  try {
    const result = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'price_gaps'",
    );
    console.log("price_gaps table exists:", result.rows.length > 0);
    if (result.rows.length > 0) {
      const cols = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'price_gaps' ORDER BY ordinal_position",
      );
      console.log(
        "Columns:",
        cols.rows.map((r) => r.column_name),
      );
    } else {
      console.log("Creating price_gaps table...");
      await db.query(
        "CREATE TABLE price_gaps (id SERIAL PRIMARY KEY, start_time TIMESTAMP, end_time TIMESTAMP)",
      );
      console.log("price_gaps table created");
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await db.pool.end();
  }
}

checkPriceGapsTable();
