// Add ledger columns to price_gaps table

import db from "./config/database.js";

async function addLedgerColumns() {
  try {
    console.log("Adding ledger columns to price_gaps table...");

    // Add start_ledger and end_ledger columns
    await db.query(
      "ALTER TABLE price_gaps ADD COLUMN IF NOT EXISTS start_ledger INTEGER",
    );
    await db.query(
      "ALTER TABLE price_gaps ADD COLUMN IF NOT EXISTS end_ledger INTEGER",
    );

    console.log("✅ Ledger columns added successfully");
  } catch (error) {
    console.error("❌ Error adding ledger columns:", error.message);
    throw error;
  }
}

addLedgerColumns();
