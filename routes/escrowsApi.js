// Escrows API Routes
// Escrow data and calendar functionality

import db from "../config/database.js";

export async function setupRoutes(app) {
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
           destination,
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
          destination: escrow.destination,
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

  // Escrow export endpoint - Download all escrows as CSV
  app.get("/api/escrows/export", async (req, res) => {
    try {
      const result = await db.query(
        `SELECT
           id,
           account_id as source_wallet,
           COALESCE(destination, '') as destination_wallet,
           amount / 1000000.0 as amount_xrp,
           finish_after as expiration_date,
           created_at
         FROM escrows
         ORDER BY finish_after ASC`,
      );

      // Build CSV content
      const headers = [
        "ID",
        "Source Wallet",
        "Destination Wallet",
        "Amount (XRP)",
        "Expiration Date",
        "Created At",
      ];

      let csvContent = headers.join(",") + "\n";

      result.rows.forEach((row) => {
        const values = [
          row.id,
          `"${row.source_wallet}"`, // Quote wallet addresses
          `"${row.destination_wallet}"`, // Quote wallet addresses
          row.amount_xrp,
          row.expiration_date
            ? row.expiration_date.toISOString().split("T")[0]
            : "", // YYYY-MM-DD format
          row.created_at ? row.created_at.toISOString() : "",
        ];
        csvContent += values.join(",") + "\n";
      });

      // Set headers for CSV download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="xrpl_escrows.csv"',
      );

      res.send(csvContent);
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
}
