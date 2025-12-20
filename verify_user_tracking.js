import db from "./config/database.js";

async function verifyTables() {
  try {
    console.log("Checking for user tracking tables...");

    // Check each table individually
    const tables = [
      "active_user_sessions",
      "hourly_active_users",
      "daily_active_users",
      "weekly_active_users",
      "monthly_active_users",
      "yearly_active_users",
      "admin_settings",
    ];

    for (const tableName of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) FROM ${tableName}`);
        console.log(`✓ ${tableName} exists`);
      } catch (error) {
        console.log(`✗ ${tableName} does not exist`);
      }
    }

    // Check admin settings if table exists
    try {
      const settingsResult = await db.query(`
        SELECT setting_key, setting_value FROM admin_settings
      `);
      console.log("\nAdmin settings:");
      settingsResult.rows.forEach((row) => {
        console.log(`✓ ${row.setting_key}: ${row.setting_value}`);
      });
    } catch (error) {
      console.log("Admin settings table not accessible");
    }
  } catch (error) {
    console.error("Error verifying tables:", error.message);
  }
}

verifyTables();
