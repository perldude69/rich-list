import db from "../config/database.js";

// Convert Ripple timestamp to ISO string
function convertToISOString(timeValue) {
  if (typeof timeValue === "string") {
    if (
      timeValue.includes("T") &&
      (timeValue.includes("Z") ||
        timeValue.includes("+") ||
        timeValue.includes("-"))
    ) {
      return timeValue;
    }
    timeValue = parseInt(timeValue);
  }

  const numValue = parseInt(timeValue);
  if (isNaN(numValue)) {
    throw new Error("Invalid timestamp value");
  }

  // Check format based on magnitude
  if (numValue > 1e12) {
    // Unix timestamp in milliseconds
    return new Date(numValue).toISOString();
  } else if (numValue > 1e9) {
    // Unix timestamp in seconds
    return new Date(numValue * 1000).toISOString();
  } else if (numValue > 1e8) {
    // Ripple timestamp (seconds since 2000-01-01)
    return new Date((numValue + 946684800) * 1000).toISOString();
  } else {
    throw new Error("Timestamp too old or invalid");
  }
}

// Get latest price
async function getLatestPrice() {
  try {
    const result = await db.query(
      "SELECT price, time, ledger FROM xrp_price ORDER BY ledger DESC LIMIT 1",
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error("Error getting latest price:", err.message);
    throw err;
  }
}

// Insert new price
async function insertPrice(price, time, ledger, sequence) {
  try {
    const isoTime = convertToISOString(time);

    // Check if this ledger price already exists
    const existing = await db.query(
      "SELECT id FROM xrp_price WHERE ledger = $1 LIMIT 1",
      [ledger],
    );

    // Skip if already exists
    if (existing.rows.length > 0) {
      return false;
    }

    // Get the next ID
    const maxIdResult = await db.query(
      "SELECT MAX(id) as max_id FROM xrp_price",
    );
    const nextId = (maxIdResult.rows[0]?.max_id || 0) + 1;

    // Insert the new price with explicit ID
    const result = await db.query(
      "INSERT INTO xrp_price (id, price, time, ledger, sequence) VALUES ($1, $2, $3, $4, $5)",
      [nextId, price, isoTime, ledger, sequence],
    );
    return result.rowCount > 0;
  } catch (err) {
    console.error("Error inserting price:", err.message);
    throw err;
  }
}

// Get price history for a date range
async function getPriceHistory(startTime, endTime, limit = 1000) {
  try {
    const result = await db.query(
      `SELECT price, time, ledger 
       FROM xrp_price 
       WHERE time >= $1 AND time <= $2
       ORDER BY time DESC
       LIMIT $3`,
      [startTime, endTime, limit],
    );
    return result.rows;
  } catch (err) {
    console.error("Error getting price history:", err.message);
    throw err;
  }
}

export { getLatestPrice, insertPrice, getPriceHistory };
