// Analytics API Routes
// User analytics and session tracking endpoints

import sessionTracker from "../services/sessionTracker.js";
import userAnalytics from "../services/userAnalytics.js";

export async function setupRoutes(app) {
  // Analytics endpoints
  app.get("/api/analytics/active-users/current", async (req, res) => {
    try {
      const count = await sessionTracker.getActiveUserCount();
      res.json({ success: true, active_users: count });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/analytics/active-users/daily", async (req, res) => {
    try {
      const data = await userAnalytics.getAnalyticsData(
        "daily",
        req.query.interval || "1h",
      );
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/analytics/active-users/weekly", async (req, res) => {
    try {
      const data = await userAnalytics.getAnalyticsData(
        "weekly",
        req.query.interval || "1d",
      );
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/analytics/active-users/monthly", async (req, res) => {
    try {
      const data = await userAnalytics.getAnalyticsData(
        "monthly",
        req.query.interval || "1d",
      );
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/analytics/active-users/yearly", async (req, res) => {
    try {
      const data = await userAnalytics.getAnalyticsData(
        "yearly",
        req.query.interval || "1M",
      );
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
