import dotenv from "dotenv";
import { Client as XrplClient } from "xrpl";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

// Clio/rippled endpoint - can be overridden with env var
const RIPPLE_ENDPOINT = process.env.RIPPLE_ENDPOINT || "ws://127.0.0.1:51233";

async function fetchLedgerData(ledgerIndex) {
  console.log("Connecting to rippled at:", RIPPLE_ENDPOINT);
  const client = new XrplClient(RIPPLE_ENDPOINT);
  await client.connect();

  try {
    // Get ledger info
    const ledgerResponse = await client.request({
      command: "ledger",
      ledger_index: ledgerIndex,
      transactions: false,
      expand: false,
    });

    const ledger = ledgerResponse.result.ledger;
    console.log("Fetching data for ledger:", ledger.ledger_index);
    console.log("Close time:", ledger.close_time_human);

    const balances = [];
    let marker = undefined;
    let calls = 0;

    // Fetch all account states
    do {
      calls++;
      const response = await client.request({
        command: "ledger_data",
        ledger: ledger.ledger_hash,
        type: "account",
        limit: 22000, // Smaller limit to reduce load
        marker: marker,
      });

      if (response.result.state) {
        for (const state of response.result.state) {
          const balance = parseInt(state.Balance) / 1000000; // Convert drops to XRP
          balances.push({
            account: state.Account,
            balance: balance,
          });
        }
      }

      marker = response.result.marker;
      process.stdout.write(
        `Fetched ${balances.length} accounts in ${calls} calls...\r`,
      );

      // No delay - local server
      if (marker) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } while (marker);

    console.log(`\nCompleted: ${balances.length} accounts fetched`);

    return {
      ledger: {
        index: parseInt(ledger.ledger_index),
        hash: ledger.ledger_hash,
        closeTime: ledger.close_time_human,
        totalCoins: parseInt(ledger.total_coins) / 1000000,
      },
      balances: balances,
    };
  } finally {
    await client.disconnect();
  }
}

function computeStats(balances, totalCoins) {
  // Sort balances descending
  balances.sort((a, b) => b.balance - a.balance);

  const numberOfAccounts = balances.length;
  const balanceSum = balances.reduce((sum, acc) => sum + acc.balance, 0);

  // Top 100
  const top100Sum = balances
    .slice(0, 100)
    .reduce((sum, acc) => sum + acc.balance, 0);

  // Percentage stats
  const percentages = [0.01, 0.1, 0.2, 0.5, 1, 2, 3, 4, 5, 10];
  const pctStats = percentages.map((p) => {
    const n = Math.round((numberOfAccounts * p) / 100);
    const balance = balances[n - 1]?.balance || 0;
    return {
      percentage: p,
      numberAccounts: n,
      balanceEqGt: balance,
    };
  });

  // Balance range stats
  const balanceRanges = [
    { from: 1000000000, to: Infinity },
    { from: 500000000, to: 1000000000 },
    { from: 100000000, to: 500000000 },
    { from: 20000000, to: 100000000 },
    { from: 10000000, to: 20000000 },
    { from: 5000000, to: 10000000 },
    { from: 1000000, to: 5000000 },
    { from: 500000, to: 1000000 },
    { from: 100000, to: 500000 },
    { from: 75000, to: 100000 },
    { from: 50000, to: 75000 },
    { from: 25000, to: 50000 },
    { from: 10000, to: 25000 },
    { from: 5000, to: 10000 },
    { from: 1000, to: 5000 },
    { from: 500, to: 1000 },
    { from: 20, to: 500 },
    { from: 0, to: 20 },
  ];

  const rangeStats = [];
  let sliceFrom = 0;

  for (const range of balanceRanges) {
    let count = 0;
    let sum = 0;

    for (let i = sliceFrom; i < numberOfAccounts; i++) {
      if (balances[i].balance < range.from) {
        sliceFrom = i;
        break;
      } else {
        sum += balances[i].balance;
        count++;
      }
    }

    rangeStats.push({
      numberAccounts: count,
      balanceFrom: range.from,
      balanceTo: range.to === Infinity ? null : range.to,
      balanceSum: sum,
    });
  }

  return {
    numberOfAccounts,
    balanceSum,
    top100Sum,
    pctStats,
    rangeStats,
    escrowXrp: totalCoins - balanceSum,
  };
}

async function updateDatabase(ledgerData, stats) {
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5656,
    database: process.env.POSTGRES_DB || "xrp_list_db",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "richlist_postgres_2025",
    max: 10, // Increase pool size
    idleTimeoutMillis: 7200000, // 2 hours
    connectionTimeoutMillis: 10000, // 10 seconds
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create stats table if it doesn't exist
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

    const ledgerIndex = ledgerData.ledger.index;
    const ledgerDate = new Date(ledgerData.ledger.closeTime).toISOString();

    // Truncate accounts table and reload with fresh data
    console.log("Clearing existing accounts...");
    await client.query("TRUNCATE TABLE accounts RESTART IDENTITY CASCADE");

    // Insert accounts in batches to avoid memory issues
    console.log("Inserting account data...");
    const batchSize = 10000;
    let insertedCount = 0;

    for (let i = 0; i < ledgerData.balances.length; i += batchSize) {
      const batch = ledgerData.balances.slice(i, i + batchSize);

      // Build parameterized query for batch insert
      const values = [];
      let paramIdx = 1;
      const placeholders = batch
        .map(() => {
          const params = [
            `$${paramIdx++}`, // account_id
            `$${paramIdx++}`, // balance (in drops)
            `$${paramIdx++}`, // sequence (default 0)
          ];
          return `(${params.join(", ")}, 0, 0)`;
        })
        .join(", ");

      // Flatten all values
      for (const account of batch) {
        values.push(account.account);
        values.push(Math.floor(account.balance * 1000000)); // Store as drops (XRP × 1M) for rich-list consistency
        values.push(0); // sequence default
      }

      const query = `
        INSERT INTO accounts (account_id, balance, sequence, flags, owner_count)
        VALUES ${placeholders}
      `;

      await client.query(query, values);
      insertedCount += batch.length;
      console.log(
        `  Progress: ${insertedCount}/${ledgerData.balances.length} accounts (${Math.round((insertedCount / ledgerData.balances.length) * 100)}%)`,
      );
    }

    // Insert ledger stats
    console.log("Inserting ledger statistics...");
    await client.query(
      `
      INSERT INTO ledger_stats (ledger_index, ledger_hash, transaction_count, reserve_base, reserve_inc, closed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (ledger_index) DO NOTHING
    `,
      [
        ledgerIndex,
        ledgerData.ledger.hash,
        0, // transaction_count - placeholder
        20000000, // reserve_base in drops (20 XRP)
        5000000, // reserve_inc in drops (5 XRP)
        Math.floor(new Date(ledgerDate).getTime() / 1000), // closed_at as unix timestamp
      ],
    );

    // Insert/update stats table with computed statistics
    console.log("Inserting/updating stats table with latest account count...");
    await client.query(
      `
      INSERT INTO stats (ind, ledgerindex, ledgerdate, totalxrp, walletxrp, escrowxrp, numaccounts, latest)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (ind) DO UPDATE SET
        ledgerindex = EXCLUDED.ledgerindex,
        ledgerdate = EXCLUDED.ledgerdate,
        totalxrp = EXCLUDED.totalxrp,
        walletxrp = EXCLUDED.walletxrp,
        escrowxrp = EXCLUDED.escrowxrp,
        numaccounts = EXCLUDED.numaccounts,
        latest = EXCLUDED.latest
    `,
      [
        ledgerIndex, // ind - using ledger index as unique identifier
        ledgerIndex, // ledgerindex
        ledgerDate, // ledgerdate - ISO string
        ledgerData.ledger.totalCoins, // totalxrp - in XRP
        stats.balanceSum, // walletxrp - in XRP
        stats.escrowXrp, // escrowxrp - in XRP
        stats.numberOfAccounts, // numaccounts
        1, // latest - mark as latest record
      ],
    );

    // Optionally, set latest=0 for all other records (if needed for historical tracking)
    await client.query("UPDATE stats SET latest = 0 WHERE ind != $1", [
      ledgerIndex,
    ]);

    await client.query("COMMIT");
    console.log("Database updated successfully for ledger", ledgerIndex);
    console.log(`Total accounts loaded: ${insertedCount}`);
    console.log(`Total XRP (wallet): ${stats.balanceSum.toFixed(6)}`);
    console.log(`Total escrow XRP: ${stats.escrowXrp.toFixed(6)}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function checkConnections() {
  console.log("Checking connections...");

  // Check XRPL connection
  try {
    const xrplClient = new XrplClient(RIPPLE_ENDPOINT);
    await xrplClient.connect();
    console.log("XRPL connection successful");
    await xrplClient.disconnect();
  } catch (error) {
    console.error("XRPL connection failed:", error);
    throw error;
  }

  // Check PostgreSQL connection
  try {
    const pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5656,
      database: process.env.POSTGRES_DB || "xrp_list_db",
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "richlist_postgres_2025",
      max: 1,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
    });
    const client = await pool.connect();
    console.log("PostgreSQL connection successful");
    client.release();
    await pool.end();
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    throw error;
  }

  console.log("All connections verified. Waiting 10 seconds...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  console.log("Proceeding with ledger update...");
}

async function main() {
  try {
    console.log("Starting ledger update process...");

    // Check connections before proceeding
    await checkConnections();

    // Get latest ledger
    const client = new XrplClient(RIPPLE_ENDPOINT);
    await client.connect();
    const ledgerResponse = await client.request({
      command: "ledger",
      ledger_index: "validated",
    });
    const ledgerIndex = ledgerResponse.result.ledger.ledger_index;
    await client.disconnect();

    console.log("Latest validated ledger:", ledgerIndex);

    // Fetch data
    const ledgerData = await fetchLedgerData(ledgerIndex);

    // Compute stats
    console.log("Computing statistics...");
    const computedStats = computeStats(
      ledgerData.balances,
      ledgerData.ledger.totalCoins,
    );

    console.log(`Accounts: ${computedStats.numberOfAccounts}`);
    console.log(`Total wallet XRP: ${computedStats.balanceSum.toFixed(6)}`);
    console.log(`Escrow XRP: ${computedStats.escrowXrp.toFixed(6)}`);

    // Update database
    await updateDatabase(ledgerData, computedStats);

    console.log("Ledger update completed successfully!");
  } catch (error) {
    console.error("Error updating ledger:", error);
    process.exit(1);
  }
}

main();
