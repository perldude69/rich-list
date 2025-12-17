// Rich-List SPA Main Entry Point
// Initializes the application

import store from "./store.js";
import { router } from "./router.js";
import api from "./services/api.js";
import socket from "./services/socket.js";
import walletService from "./services/walletService.js";
import xrplService from "./services/xrplService.js";
import oracleService from "./services/oracleService.js";
import { initMobileCSSLoader } from "./utils/mobileCSSLoader.js";

// Initialize the application
async function initializeApp() {
  // Initialize mobile CSS loader (must be first)
  initMobileCSSLoader();

  // Load saved settings
  store.loadSettings();

  // Apply saved theme
  const theme = store.getState("theme");
  if (theme) {
    document.body.className = `theme-${theme}`;
  }

  // Hide loading spinner
  const loader = document.querySelector(".app-loading");
  if (loader) {
    loader.style.display = "none";
  }

  // Initialize router
  router.init();

  // Initialize Wallet Service
  try {
    await walletService.fetchAllBalances();
  } catch (error) {
    // Failed to fetch initial wallet balances
  }

  // Auto-connect to XRPL
  try {
    await xrplService.autoConnect();
  } catch (error) {
    // XRPL auto-connect failed
  }

  // Fetch initial XRP price
  try {
    const priceData = await api.get("/price/latest");
    if (priceData && priceData.data && priceData.data.price) {
      walletService.setPrice(priceData.data.price);
    }
  } catch (error) {
    // Failed to fetch initial XRP price
  }

  // Set up periodic balance fetching (every 60 seconds)
  setInterval(async () => {
    try {
      await walletService.fetchAllBalances();
    } catch (error) {
      // Failed to fetch wallet balances during interval
    }
  }, 60000); // 60 seconds

  // Test API connection
  try {
    await api.health();
    store.setMessage("Connected to server");
  } catch (error) {
    console.error("API connection failed:", error);
    store.setError("Failed to connect to server");
  }

  // Initialize Socket.IO
  socket.connect();

  // Wait for socket connection before subscribing
  socket.on("connected", () => {
    socket.subscribeStats();
    socket.subscribePrice();
  });

  // If already connected, subscribe immediately
  if (socket.isConnected) {
    socket.subscribeStats();
    socket.subscribePrice();
  }

  // Subscribe to store changes
  store.subscribe(() => {
    // Store updated
  }, "currentPage");
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
