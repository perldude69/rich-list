// Accounts API Routes
// Wallet and rich list management

import db from "../config/database.js";

export async function setupRoutes(app) {
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
}
