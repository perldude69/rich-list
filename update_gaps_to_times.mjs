// Update price_gaps table to only store gap times

import db from "./config/database.js";

async function updatePriceGapsToTimesOnly() {
  try {
    console.log("Updating price_gaps table to store only gap times...");

    // Drop ledger columns
    await db.query("ALTER TABLE price_gaps DROP COLUMN IF EXISTS start_ledger");
    await db.query("ALTER TABLE price_gaps DROP COLUMN IF EXISTS end_ledger");

    // Ensure time columns exist
    await db.query(
      "ALTER TABLE price_gaps ADD COLUMN IF NOT EXISTS start_time TIMESTAMP",
    );
    await db.query(
      "ALTER TABLE price_gaps ADD COLUMN IF NOT EXISTS end_time TIMESTAMP",
    );

    console.log("✅ price_gaps table updated to times only");
  } catch (error) {
    console.error("❌ Error updating price_gaps table:", error.message);
    throw error;
  }
}

updatePriceGapsToTimesOnly();
