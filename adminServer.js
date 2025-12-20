import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import db from "./config/database.js";
import userAnalytics from "./services/userAnalytics.js";
import sessionTracker from "./services/sessionTracker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_PORT = 32112;
let adminServer = null;

// Check if admin dashboard is enabled
async function checkAdminDashboardEnabled() {
  try {
    const result = await db.query(`
      SELECT setting_value FROM admin_settings
      WHERE setting_key = 'admin_dashboard_enabled'
    `);
    return result.rows[0]?.setting_value || false;
  } catch (error) {
    console.error("Error checking admin dashboard status:", error);
    return false;
  }
}

// Start admin dashboard server
async function startAdminDashboard() {
  if (adminServer) {
    console.log("Admin dashboard already running");
    return;
  }

  const enabled = await checkAdminDashboardEnabled();
  if (!enabled) {
    console.log("Admin dashboard disabled, not starting server");
    return;
  }

  const app = express();
  adminServer = app;

  // Serve static files from admin directory
  app.use(express.static(path.join(__dirname, "public", "admin")));

  // Enable CORS for development
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    next();
  });

  // Middleware to check if dashboard is enabled
  app.use(async (req, res, next) => {
    const enabled = await checkAdminDashboardEnabled();
    if (!enabled) {
      return res.status(403).json({
        error: "Admin dashboard is disabled",
        message: "Enable the dashboard via /api/admin/toggle-dashboard",
      });
    }
    next();
  });

  // API endpoints for dashboard data
  app.get("/api/current", async (req, res) => {
    try {
      const activeUsers = await sessionTracker.getActiveUserCount();
      const sessionStats = await sessionTracker.getSessionStats();

      res.json({
        active_users: activeUsers,
        total_sessions: sessionStats.total_sessions,
        active_sessions: sessionStats.active_sessions,
        sessions_24h: sessionStats.sessions_24h,
      });
    } catch (error) {
      console.error("Admin API error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chart/:period/:interval", async (req, res) => {
    try {
      const { period, interval } = req.params;
      const data = await userAnalytics.getAnalyticsData(period, interval);
      res.json(data);
    } catch (error) {
      console.error("Admin chart API error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // CSV export endpoint for admin dashboard
  app.get("/api/export/csv", async (req, res) => {
    try {
      const csv = await userAnalytics.exportAllToCSV();

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="user-analytics.csv"',
      );
      res.send(csv);
    } catch (error) {
      console.error("Admin CSV export error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chart/:period/:interval", async (req, res) => {
    try {
      const { period, interval } = req.params;
      const data = await userAnalytics.getAnalyticsData(period, interval);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Serve main dashboard
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
  });

  // API documentation page
  app.get("/api-docs", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin", "api-docs.html"));
  });

  // Start server
  app.listen(ADMIN_PORT, () => {
    console.log(`🖥️  Admin dashboard started on port ${ADMIN_PORT}`);
    console.log(`   Dashboard: http://localhost:${ADMIN_PORT}`);
    console.log(`   API Docs:  http://localhost:${ADMIN_PORT}/api-docs`);
  });

  return app;
}

// Stop admin dashboard server
function stopAdminDashboard() {
  if (adminServer) {
    adminServer.close(() => {
      console.log("🖥️  Admin dashboard stopped");
      adminServer = null;
    });
  }
}

// Check and start/stop dashboard based on setting
async function updateAdminDashboard() {
  const enabled = await checkAdminDashboardEnabled();

  if (enabled && !adminServer) {
    await startAdminDashboard();
  } else if (!enabled && adminServer) {
    stopAdminDashboard();
  }
}

// Export functions
export {
  startAdminDashboard,
  stopAdminDashboard,
  updateAdminDashboard,
  checkAdminDashboardEnabled,
};

// Auto-start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startAdminDashboard().catch(console.error);
}
