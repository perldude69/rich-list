// Stats API Routes
// Ledger statistics and account trends

import db from "../config/database.js";

export async function setupRoutes(app) {
  // Stats endpoint - Ledger and network statistics from stats table
  app.get("/api/stats", async (req, res) => {
    try {
      // Get latest stats from stats table
      const statsResult = await db.query(
        "SELECT * FROM stats ORDER BY ledgerindex DESC LIMIT 1",
      );

      if (statsResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No statistics data available",
        });
      }

      const stat = statsResult.rows[0];

      // Parse values that might be strings
      const totalXRP = parseFloat(stat.totalxrp);
      const walletXRP = parseFloat(stat.walletxrp);
      const escrowXRP = parseFloat(stat.escrowxrp);
      const numAccounts = parseInt(stat.numaccounts);

      res.json({
        success: true,
        data: {
          ledger_index: stat.ledgerindex,
          ledger_date: stat.ledgerdate,
          accounts: numAccounts,
          total_xrp: totalXRP,
          total_drops: totalXRP * 1000000,
          wallet_xrp: walletXRP,
          wallet_drops: walletXRP * 1000000,
          escrow_xrp: escrowXRP,
          escrow_drops: escrowXRP * 1000000,
          average_balance_xrp: numAccounts > 0 ? walletXRP / numAccounts : 0,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Balance range distribution endpoint
  app.get("/api/stats/balance-ranges", async (req, res) => {
    try {
      const ranges = [
        {
          min: 1000000000000000,
          max: Infinity,
          label: "1,000,000,000 - Infinity",
        },
        {
          min: 500000000000000,
          max: 999999999999999,
          label: "500,000,000 - 1,000,000,000",
        },
        {
          min: 100000000000000,
          max: 499999999999999,
          label: "100,000,000 - 500,000,000",
        },
        {
          min: 20000000000000,
          max: 99999999999999,
          label: "20,000,000 - 100,000,000",
        },
        {
          min: 10000000000000,
          max: 19999999999999,
          label: "10,000,000 - 20,000,000",
        },
        {
          min: 5000000000000,
          max: 9999999999999,
          label: "5,000,000 - 10,000,000",
        },
        {
          min: 1000000000000,
          max: 4999999999999,
          label: "1,000,000 - 5,000,000",
        },
        { min: 500000000000, max: 999999999999, label: "500,000 - 1,000,000" },
        { min: 100000000000, max: 499999999999, label: "100,000 - 500,000" },
        { min: 75000000000, max: 99999999999, label: "75,000 - 100,000" },
        { min: 50000000000, max: 74999999999, label: "50,000 - 75,000" },
        { min: 25000000000, max: 49999999999, label: "25,000 - 50,000" },
        { min: 10000000000, max: 24999999999, label: "10,000 - 25,000" },
        { min: 5000000000, max: 9999999999, label: "5,000 - 10,000" },
        { min: 1000000000, max: 4999999999, label: "1,000 - 5,000" },
        { min: 500000000, max: 999999999, label: "500 - 1,000" },
        { min: 20000000, max: 499999999, label: "20 - 500" },
        { min: 0, max: 19999999, label: "0 - 20" },
      ];

      const distribution = [];

      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        const nextRange = i < ranges.length - 1 ? ranges[i + 1] : null;
        let query, params;

        if (range.max === Infinity) {
          // Highest range: balance >= range.min
          query =
            "SELECT COUNT(*) as count, SUM(balance) as total FROM accounts WHERE balance >= $1";
          params = [range.min];
        } else {
          // Other ranges: balance >= range.min AND balance <= range.max
          // This ensures each account appears in exactly one bucket
          query =
            "SELECT COUNT(*) as count, SUM(balance) as total FROM accounts WHERE balance >= $1 AND balance <= $2";
          params = [range.min, range.max];
        }

        const result = await db.query(query, params);
        const count = parseInt(result.rows[0].count);
        const total = result.rows[0].total
          ? parseInt(result.rows[0].total) / 1000000
          : 0;

        distribution.push({
          account_count: count,
          balance_range: range.label,
          total_xrp: total,
        });
      }

      res.json({
        success: true,
        data: distribution,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Percentile distribution endpoint
  app.get("/api/stats/percentiles", async (req, res) => {
    try {
      const percentiles = [0.01, 0.1, 0.2, 0.5, 1, 2, 3, 4, 5, 10];

      // Get total account count
      const totalResult = await db.query(
        "SELECT COUNT(*) as total FROM accounts",
      );
      const totalAccounts = parseInt(totalResult.rows[0].total);

      const distribution = [];

      for (const percentile of percentiles) {
        // Calculate how many accounts represent this percentile
        const accountCount = Math.ceil(totalAccounts * (percentile / 100));

        // Find the balance threshold where this many accounts have at least that balance
        const result = await db.query(
          `SELECT balance FROM accounts
            ORDER BY balance DESC
            LIMIT 1 OFFSET $1`,
          [accountCount - 1],
        );

        let balance_xrp = 0;
        if (result.rows.length > 0) {
          balance_xrp = parseInt(result.rows[0].balance) / 1000000;
        }

        distribution.push({
          percentile: percentile + " %",
          account_count: accountCount,
          balance_threshold_xrp: balance_xrp,
        });
      }

      res.json({
        success: true,
        data: distribution,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Accounts trend endpoint - Historical account count over time
  app.get("/api/accounts/trend", async (req, res) => {
    try {
      const timeframe = req.query.timeframe || "30d";
      const days =
        timeframe === "30d"
          ? 30
          : timeframe === "90d"
            ? 90
            : timeframe === "1y"
              ? 365
              : timeframe === "all"
                ? null
                : 30;

      let query, params;
      if (days) {
        const startDate = new Date(
          Date.now() - days * 24 * 60 * 60 * 1000,
        ).toISOString();
        query =
          "SELECT ledgerindex, ledgerdate, numaccounts FROM stats WHERE ledgerdate >= $1 ORDER BY ledgerdate ASC";
        params = [startDate];
      } else {
        query =
          "SELECT ledgerindex, ledgerdate, numaccounts FROM stats ORDER BY ledgerdate ASC";
        params = [];
      }

      const result = await db.query(query, params);

      res.json({
        success: true,
        timeframe,
        data: result.rows.map((row) => ({
          ledger_index: parseInt(row.ledgerindex),
          date: row.ledgerdate,
          accounts: parseInt(row.numaccounts),
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
