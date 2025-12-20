// Clean null gaps

import db from "./config/database.js";

async function cleanNullGaps() {
  try {
    await db.query(
      "DELETE FROM price_gaps WHERE start_ledger IS NULL OR end_ledger IS NULL",
    );
    console.log("Cleaned null gaps");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

cleanNullGaps();
