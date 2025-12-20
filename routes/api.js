// Main API Routes Orchestrator
// Imports and orchestrates all API modules

import sessionTracker from "../services/sessionTracker.js";
import { setupRoutes as setupAnalyticsRoutes } from "./analyticsApi.js";
import { setupRoutes as setupAdminRoutes } from "./adminApi.js";
import { setupRoutes as setupStatsRoutes } from "./statsApi.js";
import { setupRoutes as setupAccountsRoutes } from "./accountsApi.js";
import { setupRoutes as setupEscrowsRoutes } from "./escrowsApi.js";
import { setupRoutes as setupPricesRoutes } from "./pricesApi.js";
import { setupRoutes as setupMaintenanceRoutes } from "./maintenanceApi.js";

export async function setupRoutes(app) {
  // Session tracking middleware - track active users on all API calls
  app.use("/api/*", async (req, res, next) => {
    try {
      await sessionTracker.trackActivity(req);
    } catch (error) {
      console.error("Session tracking error:", error);
      // Don't block the request if tracking fails
    }
    next();
  });

  // Setup all API route modules
  setupAnalyticsRoutes(app);
  setupAdminRoutes(app);
  setupStatsRoutes(app);
  setupAccountsRoutes(app);
  setupEscrowsRoutes(app);
  setupPricesRoutes(app);
  setupMaintenanceRoutes(app);
}
