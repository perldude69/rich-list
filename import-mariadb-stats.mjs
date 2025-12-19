import mysql from "mysql2/promise";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// MariaDB connection
const mariadbConfig = {
  socketPath: "/var/run/mysqld/mysqld.sock",
  user: "root",
  database: "richstats",
};

// PostgreSQL connection
const pgPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5656,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "richlist_postgres_2025",
  database: process.env.DB_NAME || "xrp_list_db",
  max: 10,
  idleTimeoutMillis: 7200000,
  connectionTimeoutMillis: 10000,
});

async function createTablesIfNotExist() {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // Create stats table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stats (
        ind INTEGER PRIMARY KEY,
        ledgerindex INTEGER,
        ledgerdate VARCHAR(30),
        totalxrp NUMERIC(20, 8),
        walletxrp NUMERIC(20, 8),
        escrowxrp NUMERIC(20, 8),
        numaccounts INTEGER,
        latest INTEGER
      );
    `);

    // Create top10percentages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS top10percentages (
        ind INTEGER PRIMARY KEY,
        topacts1 INTEGER,
        topacts2 INTEGER,
        topacts3 INTEGER,
        topacts4 INTEGER,
        topacts5 INTEGER,
        topacts6 INTEGER,
        topacts7 INTEGER,
        topacts8 INTEGER,
        topacts9 INTEGER,
        topacts10 INTEGER,
        topbal1 NUMERIC(20, 8),
        topbal2 NUMERIC(20, 8),
        topbal3 NUMERIC(20, 8),
        topbal4 NUMERIC(20, 8),
        topbal5 NUMERIC(20, 8),
        topbal6 NUMERIC(20, 8),
        topbal7 NUMERIC(20, 8),
        topbal8 NUMERIC(20, 8),
        topbal9 NUMERIC(20, 8),
        topbal10 NUMERIC(20, 8),
        ledgerindex INTEGER,
        ledgerdate VARCHAR(30)
      );
    `);

    // Create top18accountstats table
    await client.query(`
      CREATE TABLE IF NOT EXISTS top18accountstats (
        top1 NUMERIC(20, 8),
        top2 NUMERIC(20, 8),
        top3 NUMERIC(20, 8),
        top4 NUMERIC(20, 8),
        top5 NUMERIC(20, 8),
        top6 NUMERIC(20, 8),
        top7 NUMERIC(20, 8),
        top8 NUMERIC(20, 8),
        top9 NUMERIC(20, 8),
        top10 NUMERIC(20, 8),
        top11 NUMERIC(20, 8),
        top12 NUMERIC(20, 8),
        top13 NUMERIC(20, 8),
        top14 NUMERIC(20, 8),
        top15 NUMERIC(20, 8),
        top16 NUMERIC(20, 8),
        top17 NUMERIC(20, 8),
        top18 NUMERIC(20, 8),
        top1ct INTEGER,
        top2ct INTEGER,
        top3ct INTEGER,
        top4ct INTEGER,
        top5ct INTEGER,
        top6ct INTEGER,
        top7ct INTEGER,
        top8ct INTEGER,
        top9ct INTEGER,
        top10ct INTEGER,
        top11ct INTEGER,
        top12ct INTEGER,
        top13ct INTEGER,
        top14ct INTEGER,
        top15ct INTEGER,
        top16ct INTEGER,
        top17ct INTEGER,
        top18ct INTEGER,
        ledgerindex INTEGER,
        ledgerdate VARCHAR(30),
        ind INTEGER PRIMARY KEY
      );
    `);

    await client.query("COMMIT");
    console.log("PostgreSQL tables created or already exist.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating tables:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function importTable(
  mariadbConn,
  tableName,
  pgInsertQuery,
  transformRow,
  onConflict = "",
) {
  console.log(`Starting import for table: ${tableName}`);

  const [rows] = await mariadbConn.execute(
    `SELECT * FROM ${tableName} ORDER BY ind`,
  );
  console.log(`Fetched ${rows.length} rows from ${tableName}`);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      let paramIndex = 1;

      for (const row of batch) {
        const transformed = transformRow ? transformRow(row) : row;
        const params = Object.values(transformed);
        placeholders.push(
          `(${params.map(() => `$${paramIndex++}`).join(", ")})`,
        );
        values.push(...params);
      }

      const query = `${pgInsertQuery} VALUES ${placeholders.join(", ")} ${onConflict}`;
      await client.query(query, values);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${rows.length} rows for ${tableName}`);
    }

    await client.query("COMMIT");
    console.log(`Import completed for ${tableName}: ${inserted} rows`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`Error importing ${tableName}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  let mariadbConn;
  try {
    // Connect to MariaDB
    mariadbConn = await mysql.createConnection(mariadbConfig);
    console.log("Connected to MariaDB");

    // Create PostgreSQL tables
    await createTablesIfNotExist();

    // Import stats table
    await importTable(
      mariadbConn,
      "stats",
      `INSERT INTO stats (ind, ledgerindex, ledgerdate, totalxrp, walletxrp, escrowxrp, numaccounts, latest)`,
      (row) => ({
        ind: row.ind,
        ledgerindex: row.ledgerindex,
        ledgerdate: row.ledgerdate ? row.ledgerdate.toISOString() : null,
        totalxrp: row.totalxrp,
        walletxrp: row.walletxrp,
        escrowxrp: row.escrowxrp,
        numaccounts: row.numaccounts,
        latest: row.latest ? 1 : 0, // tinyint(1) to boolean
      }),
      "ON CONFLICT (ind) DO NOTHING",
    );

    // Import top10percentages table
    await importTable(
      mariadbConn,
      "top10percentages",
      `INSERT INTO top10percentages (ind, topacts1, topacts2, topacts3, topacts4, topacts5, topacts6, topacts7, topacts8, topacts9, topacts10,
                                    topbal1, topbal2, topbal3, topbal4, topbal5, topbal6, topbal7, topbal8, topbal9, topbal10,
                                    ledgerindex, ledgerdate)`,
      (row) => ({
        ind: row.ind,
        topacts1: row.topacts1,
        topacts2: row.topacts2,
        topacts3: row.topacts3,
        topacts4: row.topacts4,
        topacts5: row.topacts5,
        topacts6: row.topacts6,
        topacts7: row.topacts7,
        topacts8: row.topacts8,
        topacts9: row.topacts9,
        topacts10: row.topacts10,
        topbal1: row.topbal1,
        topbal2: row.topbal2,
        topbal3: row.topbal3,
        topbal4: row.topbal4,
        topbal5: row.topbal5,
        topbal6: row.topbal6,
        topbal7: row.topbal7,
        topbal8: row.topbal8,
        topbal9: row.topbal9,
        topbal10: row.topbal10,
        ledgerindex: row.ledgerindex,
        ledgerdate: row.ledgerdate ? row.ledgerdate.toISOString() : null,
      }),
    );

    // Import top18accountstats table
    await importTable(
      mariadbConn,
      "top18accountstats",
      `INSERT INTO top18accountstats (top1, top2, top3, top4, top5, top6, top7, top8, top9, top10, top11, top12, top13, top14, top15, top16, top17, top18,
                                     top1ct, top2ct, top3ct, top4ct, top5ct, top6ct, top7ct, top8ct, top9ct, top10ct, top11ct, top12ct, top13ct, top14ct, top15ct, top16ct, top17ct, top18ct,
                                     ledgerindex, ledgerdate, ind)`,
      (row) => ({
        top1: row.top1,
        top2: row.top2,
        top3: row.top3,
        top4: row.top4,
        top5: row.top5,
        top6: row.top6,
        top7: row.top7,
        top8: row.top8,
        top9: row.top9,
        top10: row.top10,
        top11: row.top11,
        top12: row.top12,
        top13: row.top13,
        top14: row.top14,
        top15: row.top15,
        top16: row.top16,
        top17: row.top17,
        top18: row.top18,
        top1ct: row.top1ct,
        top2ct: row.top2ct,
        top3ct: row.top3ct,
        top4ct: row.top4ct,
        top5ct: row.top5ct,
        top6ct: row.top6ct,
        top7ct: row.top7ct,
        top8ct: row.top8ct,
        top9ct: row.top9ct,
        top10ct: row.top10ct,
        top11ct: row.top11ct,
        top12ct: row.top12ct,
        top13ct: row.top13ct,
        top14ct: row.top14ct,
        top15ct: row.top15ct,
        top16ct: row.top16ct,
        top17ct: row.top17ct,
        top18ct: row.top18ct,
        ledgerindex: row.ledgerindex,
        ledgerdate: row.ledgerdate ? row.ledgerdate.toISOString() : null,
        ind: row.ind,
      }),
    );

    console.log("All imports completed successfully.");
  } catch (error) {
    console.error("Import failed:", error);
  } finally {
    if (mariadbConn) await mariadbConn.end();
    await pgPool.end();
  }
}

main();
