// Admin API Routes
// Admin panel functionality and settings

import db from "../config/database.js";
import userAnalytics from "../services/userAnalytics.js";

export async function setupRoutes(app) {
  // Admin dashboard toggle
  app.post("/api/admin/toggle-dashboard", async (req, res) => {
    try {
      const { enabled } = req.body;
      const enabledBool = enabled === true || enabled === "true";

      await db.query(
        `
        INSERT INTO admin_settings (setting_key, setting_value)
        VALUES ('admin_dashboard_enabled', $1)
        ON CONFLICT (setting_key) DO UPDATE SET
          setting_value = $1,
          updated_at = CURRENT_TIMESTAMP
      `,
        [enabledBool],
      );

      res.json({ success: true, enabled: enabledBool });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/dashboard-enabled", async (req, res) => {
    try {
      const result = await db.query(`
        SELECT setting_value FROM admin_settings
        WHERE setting_key = 'admin_dashboard_enabled'
      `);
      const enabled = result.rows[0]?.setting_value || false;
      res.json({ success: true, enabled });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // CSV export endpoint
  app.get("/api/admin/export/csv", async (req, res) => {
    try {
      const csv = await userAnalytics.exportAllToCSV();

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="user-analytics.csv"',
      );
      res.send(csv);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
