// Rich-List API Routes
// Complete API implementation for Phase 3

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

  // Rich list endpoint - Top wallets by balance
  app.get("/api/richlist", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
      const offset = parseInt(req.query.offset) || 0;

      const countResult = await db.query(
        "SELECT COUNT(*) as total FROM accounts",
      );
      const total = parseInt(countResult.rows[0].total);

      const result = await db.query(
        `SELECT 
          ROW_NUMBER() OVER (ORDER BY balance DESC) as rank,
          account_id, 
          balance,
          balance / 1000000.0 as balance_xrp,
          sequence,
          owner_count
        FROM accounts 
        ORDER BY balance DESC 
        LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        success: true,
        pagination: {
          limit,
          offset,
          total,
          pages: Math.ceil(total / limit),
          current_page: Math.floor(offset / limit) + 1,
        },
        data: result.rows,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Search endpoint - Find account by address
  app.get("/api/search", async (req, res) => {
    try {
      const account = req.query.account || req.query.q;
      if (!account) {
        return res
          .status(400)
          .json({ success: false, error: "Account address required" });
      }

      const result = await db.query(
        "SELECT account_id, balance, balance / 1000000.0 as balance_xrp, sequence, owner_count, created_at, updated_at FROM accounts WHERE account_id = $1",
        [account],
      );

      if (result.rows.length === 0) {
        return res.json({ success: true, data: null });
      }

      const accountData = result.rows[0];

      // Get rank
      const rankResult = await db.query(
        "SELECT COUNT(*) + 1 as rank FROM accounts WHERE balance > $1",
        [accountData.balance],
      );

      // Get escrows for this account
      const escrowResult = await db.query(
        "SELECT * FROM escrows WHERE account_id = $1",
        [account],
      );

      res.json({
        success: true,
        data: {
          ...accountData,
          rank: parseInt(rankResult.rows[0].rank),
          escrows: escrowResult.rows,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Escrows endpoint - Upcoming escrow releases
  app.get("/api/escrows", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
      const offset = parseInt(req.query.offset) || 0;

      const countResult = await db.query(
        "SELECT COUNT(*) as total FROM escrows",
      );
      const total = parseInt(countResult.rows[0].total);

      const result = await db.query(
        `SELECT 
          id,
          account_id,
          finish_after,
          amount,
          amount as amount_xrp
        FROM escrows
        ORDER BY finish_after DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        success: true,
        pagination: {
          limit,
          offset,
          total,
          pages: Math.ceil(total / limit),
        },
        data: result.rows,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Price endpoint - Current and historical price
  app.get("/api/price/latest", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT id, price, time as timestamp, ledger, sequence FROM xrp_price ORDER BY time DESC LIMIT 1",
      );

      res.json({
        success: true,
        data: result.rows[0] || {
          price: 0,
          timestamp: new Date().toISOString(),
          ledger: 0,
          sequence: 0,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Price history endpoint - Historical data
  app.get("/api/price/history", async (req, res) => {
    try {
      // Parse ISO date strings or use millisecond timestamps
      const startTime = req.query.start
        ? new Date(req.query.start).toISOString()
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = req.query.end
        ? new Date(req.query.end).toISOString()
        : new Date().toISOString();

      const result = await db.query(
        `SELECT id, price, time as timestamp, ledger, sequence FROM xrp_price 
          WHERE time >= $1 AND time <= $2
          ORDER BY time DESC`,
        [startTime, endTime],
      );

      res.json({
        success: true,
        data: result.rows,
        range: {
          start: startTime,
          end: endTime,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Graph endpoint - Data for price charts
  app.get("/api/graph", async (req, res) => {
    try {
      const timeframe = req.query.timeframe || "30d";
      let days = null;
      console.log(`API: Received timeframe: ${timeframe}`);

      if (timeframe === "1d") days = 1;
      else if (timeframe === "7d") days = 7;
      else if (timeframe === "30d") days = 30;
      else if (timeframe === "90d") days = 90;
      else if (timeframe === "1y") {
        days = 365;
        console.log("API: Setting days to 365 for 1y timeframe");
      } else if (timeframe === "3y") {
        days = 365 * 3;
        console.log("API: Setting days to 1095 for 3y timeframe");
      } else if (timeframe === "all") {
        days = 365 * 10; // Limit to 10 years for "all"
        console.log("API: Setting days to 3650 for all timeframe");
      }
      // for cases without explicit limit, use null

      let query, params;
      if (days) {
        const startTime = new Date(
          Date.now() - days * 24 * 60 * 60 * 1000,
        ).toISOString();
        query =
          "SELECT price, time as timestamp FROM xrp_price WHERE time >= $1 ORDER BY time ASC";
        params = [startTime];
      } else {
        query =
          "SELECT price, time as timestamp FROM xrp_price ORDER BY time ASC";
        params = [];
      }

      const result = await db.query(query, params);

      res.json({
        success: true,
        timeframe,
        data: result.rows,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Escrow total endpoint - Get total escrowed XRP
  app.get("/api/escrows/total", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT SUM(amount) / 1000000.0 as total FROM escrows",
      );

      res.json({
        success: true,
        data: {
          total: parseFloat(result.rows[0].total || 0),
          currency: "XRP",
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Escrow date range endpoint - Get escrows for calendar view
  app.get("/api/escrows/date-range", async (req, res) => {
    try {
      const startDate =
        req.query.startDate || new Date().toISOString().split("T")[0];
      const endDate =
        req.query.endDate || new Date().toISOString().split("T")[0];

      // Validate date format
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      const result = await db.query(
        `SELECT
           id,
           account_id,
           amount / 1000000.0 as amount_xrp,
           finish_after,
           created_at
         FROM escrows
         WHERE finish_after >= $1 AND finish_after <= $2
         ORDER BY finish_after ASC`,
        [startDate, endDate],
      );

      // Group escrows by date
      const escrowsByDate = {};
      let monthTotal = 0;

      result.rows.forEach((escrow) => {
        const dateKey = escrow.finish_after.toISOString().split("T")[0];

        if (!escrowsByDate[dateKey]) {
          escrowsByDate[dateKey] = {
            date: escrow.finish_after.toISOString().split("T")[0],
            escrows: [],
            total_xrp: 0,
          };
        }

        escrowsByDate[dateKey].escrows.push({
          id: escrow.id,
          wallet: escrow.account_id,
          xrp: parseFloat(escrow.amount_xrp),
          full_date: `${dateKey}T00:00:00Z`, // Simplified ISO format
        });

        escrowsByDate[dateKey].total_xrp += parseFloat(escrow.amount_xrp);
        monthTotal += parseFloat(escrow.amount_xrp);
      });

      // Convert to array format
      const data = Object.values(escrowsByDate);

      res.json({
        success: true,
        data,
        month_total: monthTotal,
        range: {
          start: startDate,
          end: endDate,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Escrow stats endpoint - Get escrow statistics
  app.get("/api/escrows/stats", async (req, res) => {
    try {
      const totalEscrowsResult = await db.query(
        "SELECT COUNT(*) as count FROM escrows",
      );
      const totalAmountResult = await db.query(
        "SELECT SUM(amount) as total FROM escrows",
      );
      const avgAmountResult = await db.query(
        "SELECT AVG(amount) as avg FROM escrows",
      );

      // Get upcoming escrows (next 30 and 90 days)
      // XRPL epoch offset: 946684800 seconds (2000-01-01 to 1970-01-01)
      const XRPL_EPOCH_OFFSET = 946684800;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const nowXrpl = nowSeconds - XRPL_EPOCH_OFFSET;
      const in30DaysXrpl = nowXrpl + 30 * 24 * 60 * 60;
      const in90DaysXrpl = nowXrpl + 90 * 24 * 60 * 60;

      // Convert XRPL timestamps to date strings for DATE column comparison
      const nowDate = new Date((nowXrpl + XRPL_EPOCH_OFFSET) * 1000)
        .toISOString()
        .split("T")[0];
      const in30DaysDate = new Date((in30DaysXrpl + XRPL_EPOCH_OFFSET) * 1000)
        .toISOString()
        .split("T")[0];
      const in90DaysDate = new Date((in90DaysXrpl + XRPL_EPOCH_OFFSET) * 1000)
        .toISOString()
        .split("T")[0];

      const upcoming30Result = await db.query(
        "SELECT COUNT(*) as count FROM escrows WHERE finish_after > $1 AND finish_after <= $2",
        [nowDate, in30DaysDate],
      );

      const upcoming90Result = await db.query(
        "SELECT COUNT(*) as count FROM escrows WHERE finish_after > $1 AND finish_after <= $2",
        [nowDate, in90DaysDate],
      );

      // Get expired vs future escrow amounts
      const expiredResult = await db.query(
        "SELECT SUM(amount) as total FROM escrows WHERE finish_after <= $1",
        [nowDate],
      );

      const futureResult = await db.query(
        "SELECT SUM(amount) as total FROM escrows WHERE finish_after > $1",
        [nowDate],
      );

      const totalXrp =
        parseFloat(totalAmountResult.rows[0].total || 0) / 1000000;
      const expiredXrp = parseFloat(expiredResult.rows[0].total || 0) / 1000000;
      const futureXrp = parseFloat(futureResult.rows[0].total || 0) / 1000000;

      res.json({
        success: true,
        data: {
          total_escrows: parseInt(totalEscrowsResult.rows[0].count),
          total_xrp: totalXrp,
          average_xrp: parseFloat(avgAmountResult.rows[0].avg || 0) / 1000000,
          upcoming_30_days: parseInt(upcoming30Result.rows[0].count),
          upcoming_90_days: parseInt(upcoming90Result.rows[0].count),
          expired_xrp: expiredXrp,
          future_xrp: futureXrp,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Ranking search endpoint - Find where a wallet or amount ranks
  app.get("/api/ranking-search", async (req, res) => {
    try {
      const valuesParam = req.query.values || "";

      if (!valuesParam) {
        return res.status(400).json({
          success: false,
          error: "Please provide wallet addresses or XRP amounts",
        });
      }

      const values = valuesParam
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      if (values.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid entries provided",
        });
      }

      // Get total wallet count
      const totalResult = await db.query(
        "SELECT COUNT(*) as total FROM accounts",
      );
      const total = parseInt(totalResult.rows[0].total);

      let totalBalance = 0;
      const breakdown = [];
      const notFoundAddresses = [];

      for (const value of values) {
        const isAddress = value.startsWith("r");

        if (isAddress) {
          // Search by wallet address
          const walletResult = await db.query(
            "SELECT account_id, balance FROM accounts WHERE account_id = $1",
            [value],
          );

          if (walletResult.rows.length === 0) {
            notFoundAddresses.push(value);
            continue;
          }

          const balance = parseInt(walletResult.rows[0].balance);
          totalBalance += balance;
          breakdown.push({
            type: "address",
            value: walletResult.rows[0].account_id,
            balance_xrp: balance / 1000000,
          });
        } else {
          // Search by XRP amount
          const amount = parseFloat(value);

          if (isNaN(amount) || amount <= 0) {
            continue; // Skip invalid amounts
          }

          // Convert XRP to drops for comparison
          const balance = amount * 1000000;
          totalBalance += balance;
          breakdown.push({
            type: "amount",
            value: amount,
            balance_xrp: amount,
          });
        }
      }

      if (totalBalance === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid wallet addresses or positive XRP amounts found",
        });
      }

      const balance = totalBalance;

      // Calculate rank (count of wallets with MORE balance than this)
      const rankResult = await db.query(
        "SELECT COUNT(*) as rank FROM accounts WHERE balance > $1",
        [balance],
      );
      const rank = parseInt(rankResult.rows[0].rank) + 1;

      const wallets_above = rank - 1;
      const wallets_below = total - rank;
      const percentile = ((wallets_above / total) * 100).toFixed(3);

      // Fetch 3 wallets just above the searched balance
      const walletsAboveResult = await db.query(
        `SELECT account_id, balance, balance / 1000000.0 as balance_xrp
          FROM accounts
          WHERE balance > $1
          ORDER BY balance ASC
          LIMIT 3`,
        [balance],
      );

      // Fetch 3 wallets just below the searched balance
      const walletsBelowResult = await db.query(
        `SELECT account_id, balance, balance / 1000000.0 as balance_xrp
          FROM accounts
          WHERE balance < $1
          ORDER BY balance DESC
          LIMIT 3`,
        [balance],
      );

      const responseData = {
        balance_drops: balance,
        balance_xrp: balance / 1000000,
        rank: rank,
        total_wallets: total,
        wallets_above: wallets_above,
        wallets_below: wallets_below,
        percentile: parseFloat(percentile),
        nearby_wallets_above: walletsAboveResult.rows,
        nearby_wallets_below: walletsBelowResult.rows,
        breakdown: breakdown,
      };

      if (notFoundAddresses.length > 0) {
        responseData.not_found_addresses = notFoundAddresses;
      }

      res.json({
        success: true,
        data: responseData,
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

  // Gap scan endpoint
  app.get("/api/gaps/scan", async (req, res) => {
    try {
      if (!global.gapTracker) {
        return res
          .status(500)
          .json({ success: false, error: "Gap tracker not initialized" });
      }
      console.log("🔍 Gap scan initiated by user via /api/gaps/scan");
      await global.gapTracker.scanForGaps();
      res.json({
        status: "scan_started",
        message: "Gap identification scan initiated",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Backfill start endpoint
  app.get("/api/backfill/start", async (req, res) => {
    try {
      if (!global.priceBackfiller) {
        return res
          .status(500)
          .json({ success: false, error: "Price backfiller not initialized" });
      }
      global.priceBackfiller.backfillMissingPrices().catch((err) => {
        console.error("Backfill error:", err);
      });
      res.json({ status: "started", message: "Gap backfilling initiated" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Backfill stop endpoint
  app.get("/api/backfill/stop", async (req, res) => {
    try {
      if (!global.priceBackfiller) {
        return res
          .status(500)
          .json({ success: false, error: "Price backfiller not initialized" });
      }
      global.priceBackfiller.stop();
      res.json({
        status: "stop_requested",
        message: "Backfill stop requested",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Backfill status endpoint
  app.get("/api/backfill/status", async (req, res) => {
    try {
      if (!global.priceBackfiller) {
        return res
          .status(500)
          .json({ success: false, error: "Price backfiller not initialized" });
      }
      const status = global.priceBackfiller.getStatus();
      res.json({
        backfillInProgress: status.backfillInProgress,
        pricesBackfilled: status.pricesBackfilled,
        backfillDuration: status.backfillDuration,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Backfill gaps count endpoint
  app.get("/api/backfill/gaps", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT COUNT(*) as remaining_gaps FROM price_gaps",
      );
      const count = parseInt(result.rows[0].remaining_gaps);
      console.log(count);
      res.json({ remainingGaps: count });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
