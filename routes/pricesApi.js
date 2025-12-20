// Prices API Routes
// Price data and chart functionality

import db from "../config/database.js";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

export async function setupRoutes(app) {
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

  // Graph endpoint - Data for price charts with server-side aggregation
  app.get("/api/graph", async (req, res) => {
    try {
      const timeframe = req.query.timeframe || "30d";
      const intvl = req.query.interval || "4h";
      let days = null;

      console.log(
        `API: Received timeframe: ${timeframe}, intvl: ${intvl}, req.query:`,
        JSON.stringify(req.query),
      );

      // Calculate timeframe in days
      if (timeframe === "1d") days = 1;
      else if (timeframe === "7d") days = 7;
      else if (timeframe === "30d") days = 30;
      else if (timeframe === "90d") days = 90;
      else if (timeframe === "1y") days = 365;
      else if (timeframe === "3y") days = 365 * 3;
      else if (timeframe === "all") days = 365 * 10; // Limit to 10 years for "all"

      const startTime = days
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Server-side aggregation based on interval
      let query, params;

      // For very short timeframes with fine intervals, return raw data (limited)
      if (
        (timeframe === "1d" && ["1m", "1h"].includes(intvl)) ||
        (timeframe === "7d" && intvl === "1h")
      ) {
        if (startTime) {
          query = `
            SELECT price, time as timestamp
            FROM xrp_price
            WHERE time >= $1
            ORDER BY time ASC
            LIMIT 2000
          `;
          params = [startTime];
        } else {
          query = `
            SELECT price, time as timestamp
            FROM xrp_price
            ORDER BY time ASC
            LIMIT 2000
          `;
          params = [];
        }
      }
      // For 1-minute intervals (group every minute)
      else if (intvl === "1m") {
        if (startTime) {
          query = `
            SELECT
              DATE_TRUNC('minute', time::timestamp) as timestamp,
              AVG(price) as price
            FROM xrp_price
            WHERE time >= $1
            GROUP BY DATE_TRUNC('minute', time::timestamp)
            ORDER BY timestamp ASC
          `;
          params = [startTime];
        } else {
          query = `
            SELECT
              DATE_TRUNC('minute', time::timestamp) as timestamp,
              AVG(price) as price
            FROM xrp_price
            GROUP BY DATE_TRUNC('minute', time::timestamp)
            ORDER BY timestamp ASC
          `;
          params = [];
        }
      }
      // For 1-hour intervals
      else if (intvl === "1h") {
        if (startTime) {
          query = `
            SELECT
              DATE_TRUNC('hour', time::timestamp) as timestamp,
              AVG(price) as price
            FROM xrp_price
            WHERE time >= $1
            GROUP BY DATE_TRUNC('hour', time::timestamp)
            ORDER BY timestamp ASC
          `;
          params = [startTime];
        } else {
          query = `
            SELECT
              DATE_TRUNC('hour', time::timestamp) as timestamp,
              AVG(price) as price
            FROM xrp_price
            GROUP BY DATE_TRUNC('hour', time::timestamp)
            ORDER BY timestamp ASC
          `;
          params = [];
        }
      }
      // For 4-hour intervals
      else if (intvl === "4h") {
        if (startTime) {
          query = `
            SELECT
              DATE_TRUNC('hour', time::timestamp) + INTERVAL '4 hour' * FLOOR(EXTRACT(hour FROM time::timestamp) / 4) as timestamp,
              AVG(price) as price
            FROM xrp_price
            WHERE time >= $1
            GROUP BY DATE_TRUNC('hour', time::timestamp) + INTERVAL '4 hour' * FLOOR(EXTRACT(hour FROM time::timestamp) / 4)
            ORDER BY timestamp ASC
          `;
          params = [startTime];
        } else {
          query = `
            SELECT
              DATE_TRUNC('hour', time::timestamp) + INTERVAL '4 hour' * FLOOR(EXTRACT(hour FROM time::timestamp) / 4) as timestamp,
              AVG(price) as price
            FROM xrp_price
            GROUP BY DATE_TRUNC('hour', time::timestamp) + INTERVAL '4 hour' * FLOOR(EXTRACT(hour FROM time::timestamp) / 4)
            ORDER BY timestamp ASC
          `;
          params = [];
        }
      }
      // For 12-hour intervals
      else if (intvl === "12h") {
        if (startTime) {
          query = `
            SELECT
              DATE_TRUNC('hour', time::timestamp) + INTERVAL '12 hour' * FLOOR(EXTRACT(hour FROM time::timestamp) / 12) as timestamp,
              AVG(price) as price
            FROM xrp_price
            WHERE time >= $1
            GROUP BY DATE_TRUNC('hour', time::timestamp) + INTERVAL '12 hour' * FLOOR(EXTRACT(hour FROM time::timestamp) / 12)
            ORDER BY timestamp ASC
          `;
          params = [startTime];
        } else {
          query = `
            SELECT
              DATE_TRUNC('hour', time::timestamp) + INTERVAL '12 hour' * FLOOR(EXTRACT(hour FROM time::timestamp) / 12) as timestamp,
              AVG(price) as price
            FROM xrp_price
            GROUP BY DATE_TRUNC('hour', time::timestamp) + INTERVAL '12 hour' * FLOOR(EXTRACT(hour FROM time::timestamp) / 12)
            ORDER BY timestamp ASC
          `;
          params = [];
        }
      }
      // For daily intervals
      else if (intvl === "1d") {
        if (startTime) {
          query = `
            SELECT
              DATE_TRUNC('day', time::timestamp) as timestamp,
              AVG(price) as price
            FROM xrp_price
            WHERE time >= $1
            GROUP BY DATE_TRUNC('day', time::timestamp)
            ORDER BY timestamp ASC
          `;
          params = [startTime];
        } else {
          query = `
            SELECT
              DATE_TRUNC('day', time::timestamp) as timestamp,
              AVG(price) as price
            FROM xrp_price
            GROUP BY DATE_TRUNC('day', time::timestamp)
            ORDER BY timestamp ASC
          `;
          params = [];
        }
      }
      // For weekly intervals
      else if (intvl === "1w") {
        if (startTime) {
          query = `
            SELECT
              DATE_TRUNC('week', time::timestamp) as timestamp,
              AVG(price) as price
            FROM xrp_price
            WHERE time >= $1
            GROUP BY DATE_TRUNC('week', time::timestamp)
            ORDER BY timestamp ASC
          `;
          params = [startTime];
        } else {
          query = `
            SELECT
              DATE_TRUNC('week', time::timestamp) as timestamp,
              AVG(price) as price
            FROM xrp_price
            GROUP BY DATE_TRUNC('week', time::timestamp)
            ORDER BY timestamp ASC
          `;
          params = [];
        }
      }
      // For monthly intervals
      else if (intvl === "1M") {
        if (startTime) {
          query = `
            SELECT
              TO_CHAR(time::timestamp, 'YYYY-MM-01') || 'T00:00:00.000Z' as timestamp,
              AVG(price) as price
            FROM xrp_price
            WHERE time >= $1
            GROUP BY TO_CHAR(time::timestamp, 'YYYY-MM-01')
            ORDER BY timestamp ASC
          `;
          params = [startTime];
        } else {
          query = `
            SELECT
              TO_CHAR(time::timestamp, 'YYYY-MM-01') || 'T00:00:00.000Z' as timestamp,
              AVG(price) as price
            FROM xrp_price
            GROUP BY TO_CHAR(time::timestamp, 'YYYY-MM-01')
            ORDER BY timestamp ASC
          `;
          params = [];
        }
      }
      // Default fallback (should not happen with valid intervals)
      else {
        if (startTime) {
          query = `
            SELECT price, time as timestamp
            FROM xrp_price
            WHERE time >= $1
            ORDER BY time ASC
            LIMIT 500
          `;
          params = [startTime];
        } else {
          query = `
            SELECT price, time as timestamp
            FROM xrp_price
            ORDER BY time ASC
            LIMIT 500
          `;
          params = [];
        }
      }

      const result = await db.query(query, params);

      // Format prices as strings to match frontend expectations
      const formattedData = result.rows.map((row) => ({
        price: row.price.toString(),
        timestamp:
          typeof row.timestamp === "string"
            ? row.timestamp
            : row.timestamp.toISOString(),
      }));

      res.json({
        success: true,
        timeframe,
        intvl: intvl,
        data: formattedData,
        dataPoints: formattedData.length,
      });
    } catch (error) {
      console.error("Graph API error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Price export CSV endpoint - Zipped CSV with documentation
  app.get("/api/price/export/csv", async (req, res) => {
    try {
      // For now, build CSV in memory - optimize later if needed
      let csvContent = "time,price\n";

      const result = await db.query(
        "SELECT time, price FROM xrp_price ORDER BY time ASC",
      );

      result.rows.forEach((row) => {
        csvContent += `${row.time},${row.price}\n`;
      });

      // Create zip archive
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Best compression
      });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=xrp_price_history_csv.zip",
      );

      archive.pipe(res);

      // Add CSV content
      archive.append(csvContent, { name: "xrp_price_history.csv" });

      // Add documentation
      const docPath = path.join(process.cwd(), "price_data_documentation.md");
      if (fs.existsSync(docPath)) {
        archive.file(docPath, { name: "price_data_documentation.md" });
      }

      archive.finalize();
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
