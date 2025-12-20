// Update price_gaps table schema
// Drops gap_minute column and adds start_time, end_time columns

import db from "./config/database.js";

async function updatePriceGapsTable() {
  try {
    console.log("Updating price_gaps table schema...");

    // Drop the gap_minute column if it exists
    await db.query("ALTER TABLE price_gaps DROP COLUMN IF EXISTS gap_minute");

    // Add start_time and end_time columns
    await db.query(
      "ALTER TABLE price_gaps ADD COLUMN IF NOT EXISTS start_time TIMESTAMP",
    );
    await db.query(
      "ALTER TABLE price_gaps ADD COLUMN IF NOT EXISTS end_time TIMESTAMP",
    );

    console.log("✅ price_gaps table updated successfully");
  } catch (error) {
    console.error("❌ Error updating price_gaps table:", error.message);
    throw error;
  }
}

updatePriceGapsTable();
