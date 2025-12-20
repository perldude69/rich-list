import db from "./config/database.js";

// Migration script for anonymous user tracking
async function createUserTrackingTables() {
  console.log("Starting user tracking table creation...");
  try {
    console.log("Creating user tracking database tables...");

    // Active user sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS active_user_sessions (
        id SERIAL PRIMARY KEY,
        session_hash VARCHAR(64) NOT NULL UNIQUE,
        last_activity TIMESTAMP NOT NULL,
        ip_hash VARCHAR(64),
        user_agent_hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created active_user_sessions table");

    // Hourly active user counts
    await db.query(`
      CREATE TABLE IF NOT EXISTS hourly_active_users (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
        active_users INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, hour)
      )
    `);
    console.log("✓ Created hourly_active_users table");

    // Daily active user summaries
    await db.query(`
      CREATE TABLE IF NOT EXISTS daily_active_users (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        active_users INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created daily_active_users table");

    // Weekly active user summaries
    await db.query(`
      CREATE TABLE IF NOT EXISTS weekly_active_users (
        id SERIAL PRIMARY KEY,
        week_start DATE NOT NULL UNIQUE,
        active_users INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created weekly_active_users table");

    // Monthly active user summaries
    await db.query(`
      CREATE TABLE IF NOT EXISTS monthly_active_users (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
        active_users INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month)
      )
    `);
    console.log("✓ Created monthly_active_users table");

    // Yearly active user summaries
    await db.query(`
      CREATE TABLE IF NOT EXISTS yearly_active_users (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL UNIQUE,
        active_users INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created yearly_active_users table");

    // Admin settings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(50) NOT NULL UNIQUE,
        setting_value BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created admin_settings table");

    // Insert default admin dashboard setting
    await db.query(`
      INSERT INTO admin_settings (setting_key, setting_value)
      VALUES ('admin_dashboard_enabled', FALSE)
      ON CONFLICT (setting_key) DO NOTHING
    `);
    console.log("✓ Set default admin dashboard state to disabled");

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity
      ON active_user_sessions (last_activity)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_hourly_active_users_date_hour
      ON hourly_active_users (date, hour)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_active_users_date
      ON daily_active_users (date)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_monthly_active_users_year_month
      ON monthly_active_users (year, month)
    `);
    console.log("✓ Created performance indexes");

    console.log("✅ User tracking database schema created successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error creating user tracking tables:", error);
    throw error;
  }
}

// Cleanup function for testing (optional)
async function dropUserTrackingTables() {
  try {
    console.log("Dropping user tracking tables...");

    const tables = [
      "active_user_sessions",
      "hourly_active_users",
      "daily_active_users",
      "weekly_active_users",
      "monthly_active_users",
      "yearly_active_users",
      "admin_settings",
    ];

    for (const table of tables) {
      await db.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`✓ Dropped ${table} table`);
    }

    console.log("✅ User tracking tables dropped successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error dropping user tracking tables:", error);
    throw error;
  }
}

export { createUserTrackingTables, dropUserTrackingTables };

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createUserTrackingTables().catch(console.error);
}
