// Maintenance API Routes
// System maintenance and operations

import db from "../config/database.js";

export async function setupRoutes(app) {
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
