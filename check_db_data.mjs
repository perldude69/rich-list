import db from "./config/database.js";

(async () => {
  try {
    await db.testConnection();
    console.log("Connection successful");

    // Query stats table
    const stats = await db.query("SELECT COUNT(*) as count FROM stats");
    console.log("Stats count:", stats.rows[0].count);

    // Query accounts table
    const accounts = await db.query("SELECT COUNT(*) as count FROM accounts");
    console.log("Accounts count:", accounts.rows[0].count);

    // Query escrows table
    const escrows = await db.query("SELECT COUNT(*) as count FROM escrows");
    console.log("Escrows count:", escrows.rows[0].count);

    // Query xrp_price table
    const prices = await db.query("SELECT COUNT(*) as count FROM xrp_price");
    console.log("Prices count:", prices.rows[0].count);

    // Get latest stats if any
    if (stats.rows[0].count > 0) {
      const latest = await db.query(
        "SELECT * FROM stats ORDER BY ledgerindex DESC LIMIT 1",
      );
      console.log("Latest stats:", latest.rows[0]);
    } else {
      console.log("No stats data found");
    }

    // Get latest accounts if any
    if (accounts.rows[0].count > 0) {
      const latestAcc = await db.query(
        "SELECT account_id, balance FROM accounts ORDER BY balance DESC LIMIT 5",
      );
      console.log("Top 5 accounts by balance:", latestAcc.rows);
    } else {
      console.log("No accounts data found");
    }

    // Get escrows if any
    if (escrows.rows[0].count > 0) {
      const latestEsc = await db.query(
        "SELECT COUNT(*) as count, SUM(amount) as total FROM escrows",
      );
      console.log("Escrows summary:", latestEsc.rows[0]);
    } else {
      console.log("No escrows data found");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
})();
