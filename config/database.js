// Rich-List Database Configuration Module
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5656,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "richlist_postgres_2025",
  database: process.env.DB_NAME || "xrp_list_db",
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  options: "--datestyle=ISO,YMD",
});

// Pool event handlers
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

pool.on("connect", () => {
  console.log("Database connection established");
});

// Test connection function
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    console.log("Database connection test successful:", result.rows[0]);
    client.release();
    return true;
  } catch (err) {
    console.error("Database connection test failed:", err.message);
    return false;
  }
};

// Query execution with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("Executed query", { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
};

export default {
  pool,
  query,
  testConnection,
};
