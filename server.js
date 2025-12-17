// Rich-List SPA Server
// Main Express application entry point
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import db from "./config/database.js";
import { setupRoutes } from "./routes/api.js";
import XRPLService from "./services/xrplService.mjs";
import OracleSubscriber from "./services/oracleSubscriber.mjs";
import PriceBackfiller from "./services/priceBackfiller.mjs";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : "*",
    credentials: true,
  },
  pingInterval: parseInt(process.env.SOCKET_IO_PING_INTERVAL || "25000"),
  pingTimeout: parseInt(process.env.SOCKET_IO_PING_TIMEOUT || "60000"),
});

const PORT = process.env.PORT || 9876;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Setup API routes
setupRoutes(app);

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const dbHealthy = await db.testConnection();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: dbHealthy ? "connected" : "disconnected",
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// NOTE: API routes are now defined in routes/api.js and loaded above via setupRoutes()

// SPA catch-all handler - serve index.html for client-side routing
app.get("*", (req, res) => {
  // Skip API routes (should return 404 for unmatched APIs)
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }

  // Serve the main SPA HTML file for all other routes
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Broadcast real-time data to all connected clients
async function broadcastUpdates() {
  try {
    // Broadcast stats update
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as accounts,
        SUM(balance)::bigint as total_xrp,
        SUM(balance) / COUNT(*) as avg_balance,
        EXTRACT(EPOCH FROM NOW())::bigint as timestamp
      FROM accounts`,
    );
    const stats = statsResult.rows[0];

    io.emit("stats:update", {
      success: true,
      data: {
        accounts: parseInt(stats.accounts),
        total_xrp: parseInt(stats.total_xrp),
        average_balance_xrp: parseFloat(stats.avg_balance) / 1000000,
        timestamp: stats.timestamp,
      },
    });

    // Broadcast price update with 24h high/low
    const priceResult = await db.query(
      `SELECT id, price, time as timestamp, ledger, sequence 
         FROM xrp_price 
         ORDER BY time DESC 
         LIMIT 1`,
    );

    // Get 24h high and low
    const highLowResult = await db.query(
      `SELECT 
         MAX(price) as high_24h,
         MIN(price) as low_24h
       FROM xrp_price
       WHERE time >= NOW() - INTERVAL '24 hours'`,
    );

    if (priceResult.rows.length > 0) {
      const latestPrice = priceResult.rows[0];
      const highLow = highLowResult.rows[0];

      const broadcastData = {
        success: true,
        data: {
          ...latestPrice,
          high: parseFloat(highLow?.high_24h || latestPrice.price),
          low: parseFloat(highLow?.low_24h || latestPrice.price),
        },
      };

      io.emit("price:update", broadcastData);
    }

    // Broadcast ledger update
    const ledgerResult = await db.query(
      `SELECT 
        COUNT(*) as total_accounts,
        SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) as funded_accounts,
        EXTRACT(EPOCH FROM NOW())::bigint as timestamp
      FROM accounts`,
    );
    const ledger = ledgerResult.rows[0];

    io.emit("ledger:update", {
      success: true,
      data: {
        total_accounts: parseInt(ledger.total_accounts),
        funded_accounts: parseInt(ledger.funded_accounts),
        timestamp: ledger.timestamp,
      },
    });
  } catch (error) {
    console.error("Error broadcasting updates:", error);
  }
}

// Start broadcasting updates every 10 seconds
setInterval(broadcastUpdates, 10000);

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Subscribe to stats updates
  socket.on("subscribe:stats", async () => {
    try {
      const result = await db.query(
        `SELECT 
          COUNT(*) as accounts,
          SUM(balance)::bigint as total_xrp,
          SUM(balance) / COUNT(*) as avg_balance,
          EXTRACT(EPOCH FROM NOW())::bigint as timestamp
        FROM accounts`,
      );
      const stats = result.rows[0];
      socket.emit("stats:update", {
        success: true,
        data: {
          accounts: parseInt(stats.accounts),
          total_xrp: parseInt(stats.total_xrp),
          average_balance_xrp: parseFloat(stats.avg_balance) / 1000000,
          timestamp: stats.timestamp,
        },
      });
    } catch (error) {
      socket.emit("stats:update", { success: false, error: error.message });
    }
  });

  // Subscribe to price updates
  socket.on("subscribe:price", async () => {
    try {
      const result = await db.query(
        `SELECT id, price, time as timestamp, ledger, sequence 
          FROM xrp_price 
          ORDER BY time DESC 
          LIMIT 1`,
      );
      if (result.rows.length > 0) {
        socket.emit("price:update", {
          success: true,
          data: result.rows[0],
        });
      } else {
        socket.emit("price:update", {
          success: false,
          error: "No price data available",
        });
      }
    } catch (error) {
      socket.emit("price:update", { success: false, error: error.message });
    }
  });

  // Subscribe to ledger updates
  socket.on("subscribe:ledger", async () => {
    try {
      const result = await db.query(
        `SELECT 
          COUNT(*) as total_accounts,
          SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) as funded_accounts,
          MAX(balance) as max_balance,
          MIN(balance) as min_balance,
          EXTRACT(EPOCH FROM NOW())::bigint as timestamp
        FROM accounts`,
      );
      const ledger = result.rows[0];
      socket.emit("ledger:update", {
        success: true,
        data: {
          total_accounts: parseInt(ledger.total_accounts),
          funded_accounts: parseInt(ledger.funded_accounts),
          max_balance: parseInt(ledger.max_balance),
          min_balance: parseInt(ledger.min_balance),
          timestamp: ledger.timestamp,
        },
      });
    } catch (error) {
      socket.emit("ledger:update", { success: false, error: error.message });
    }
  });

  // Subscribe to escrow updates
  socket.on("subscribe:escrow", async () => {
    try {
      const result = await db.query(
        `SELECT 
          COUNT(*) as total_escrows,
          SUM(amount)::bigint as total_amount,
          AVG(amount)::bigint as avg_amount,
          EXTRACT(EPOCH FROM NOW())::bigint as timestamp
        FROM escrows`,
      );
      const escrow = result.rows[0];
      socket.emit("escrow:update", {
        success: true,
        data: {
          total_escrows: parseInt(escrow.total_escrows),
          total_amount: parseInt(escrow.total_amount),
          avg_amount: parseInt(escrow.avg_amount),
          timestamp: escrow.timestamp,
        },
      });
    } catch (error) {
      socket.emit("escrow:update", { success: false, error: error.message });
    }
  });

  // Unsubscribe handlers
  socket.on("unsubscribe:stats", () => {
    // Clean up subscription
  });

  socket.on("unsubscribe:price", () => {
    // Clean up subscription
  });

  socket.on("unsubscribe:ledger", () => {
    // Clean up subscription
  });

  socket.on("unsubscribe:escrow", () => {
    // Clean up subscription
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected && process.env.NODE_ENV === "production") {
      throw new Error("Database connection failed");
    }

    // Initialize XRPL Service
    console.log("🔧 Initializing XRPL Service...");
    const xrplService = new XRPLService();
    await xrplService.connect();

    // Initialize Oracle Subscriber
    console.log("🔧 Initializing Oracle Subscriber...");
    const oracleSubscriber = new OracleSubscriber(xrplService);
    await oracleSubscriber.start();

    // Initialize Price Backfiller (runs in background)
    console.log("🔧 Initializing Price Backfiller...");
    const priceBackfiller = new PriceBackfiller(xrplService);
    // Start backfill asynchronously so it doesn't delay server startup
    // priceBackfiller.start().catch((error) => {
    //   console.error("Error in price backfiller:", error.message);
    // });

    httpServer.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║       Rich-List SPA Server Started      ║
╚════════════════════════════════════════╝

Server:     http://localhost:${PORT}
Environment: ${process.env.NODE_ENV || "development"}
Database:   ${process.env.DB_HOST}:${process.env.DB_PORT}
WebSocket:  WS://localhost:${PORT}

Phase 0: Database Setup Complete ✓
Phase 1: XRPL Services Initialized ✓
Phase 2: Oracle Subscriber Running ✓
Phase 3: WebSocket Broadcasting (active)

Type: npm start to restart
      npm run docker:start to start PostgreSQL
      `);
    });

    // Make services available for debugging
    global.richListServices = {
      xrplService,
      oracleSubscriber,
      priceBackfiller,
    };
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  httpServer.close(() => {
    db.pool.end(() => {
      console.log("Server and database connections closed");
      process.exit(0);
    });
  });
});

// Start the server
startServer();

export { app, httpServer, io, db };
