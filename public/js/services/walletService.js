// Wallet Service Module
// Manages wallet monitoring, storage, and operations

import api from "./api.js";
import xrplService from "./xrplService.js";
import oracleService from "./oracleService.js";

class WalletService {
  constructor() {
    this.wallets = [];
    this.maxWallets = 100; // Increased limit
    this.storageKey = "richlist-wallets";
    this.listeners = [];
    this.currentPrice = 1.0;
    this.alertWallets = new Set(); // Track wallets with unread alerts
    this.alertHistory = []; // Track recent alerts with timestamps
    this.maxAlertHistory = 50;
    this.init();
  }

  // Initialize service and load saved wallets
  init() {
    this.loadWallets();

    // Listen to oracle price updates
    oracleService.addListener((event, data) => {
      if (event === "priceUpdated" && data.price) {
        this.setPrice(data.price);
      }
    });

    // Listen to XRPL transaction events
    xrplService.addListener((event, data) => {
      if (event === "transaction") {
        this.handleTransaction(data);
      }
    });

    // Subscribe to wallets when XRPL connects
    xrplService.addListener((event, data) => {
      if (event === "connected") {
        this.subscribeToAllWallets();
      } else if (event === "disconnected") {
        // Subscriptions are cleared automatically by xrplService
      }
    });
  }

  // Load wallets from localStorage
  loadWallets() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.wallets = JSON.parse(stored);
        // Sanitize and migrate wallets
        this.wallets = this.wallets
          .filter((w) => {
            if (!w) return false;

            // Migrate old format to new
            if (!w.type) {
              if (w.address) {
                w.type = "wallet";
                w.customName = w.nickname || "";
              } else {
                return false; // Invalid
              }
            }

            // Validate based on type
            if (w.type === "wallet") {
              return (
                w.address && w.address.startsWith("r") && w.address.length >= 25
              );
            } else if (w.type === "exchange") {
              return w.xrpAmount && w.xrpAmount > 0;
            }
            return false;
          })
          .map((w) => {
            // Ensure customName exists
            if (!w.customName) w.customName = w.nickname || "";
            return w;
          });

        localStorage.setItem(this.storageKey, JSON.stringify(this.wallets));
      }

      // Load alert state
      const alertsStored = localStorage.getItem(this.storageKey + "-alerts");
      if (alertsStored) {
        const alerts = JSON.parse(alertsStored);
        this.alertWallets = new Set(alerts);
      }

      // Load alert history
      const historyStored = localStorage.getItem(
        this.storageKey + "-alert-history",
      );
      if (historyStored) {
        this.alertHistory = JSON.parse(historyStored);
      }
    } catch (error) {
      console.error("Error loading wallets:", error);
      this.wallets = [];
      this.alertWallets = new Set();
    }
  }

  // Save wallets to localStorage
  saveWallets() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.wallets));
      localStorage.setItem(
        this.storageKey + "-alerts",
        JSON.stringify([...this.alertWallets]),
      );
      localStorage.setItem(
        this.storageKey + "-alert-history",
        JSON.stringify(this.alertHistory),
      );
      this.notifyListeners("walletsUpdated");
    } catch (error) {
      console.error("Error saving wallets:", error);
    }
  }

  // Add wallet with validation
  async addWallet(
    type = "wallet",
    address = null,
    xrpAmount = null,
    customName = "",
  ) {
    // Validate type
    if (type !== "wallet" && type !== "exchange") {
      throw new Error("Invalid wallet type");
    }

    // Validate based on type
    if (type === "wallet") {
      if (!address || !address.startsWith("r") || address.length < 25) {
        throw new Error("Invalid XRPL address");
      }
      // Check if already added
      if (
        this.wallets.some((w) => w.type === "wallet" && w.address === address)
      ) {
        throw new Error("Wallet already added");
      }
    } else if (type === "exchange") {
      if (xrpAmount === null || xrpAmount <= 0 || isNaN(xrpAmount)) {
        throw new Error("Invalid XRP amount for exchange");
      }
    }

    // Check limit
    if (this.wallets.length >= this.maxWallets) {
      throw new Error(`Maximum ${this.maxWallets} wallets reached`);
    }

    // Validate custom name length
    if (customName && customName.length > 30) {
      throw new Error("Custom name must be 30 characters or less");
    }

    // Create wallet object
    const wallet = {
      type,
      customName: customName.trim(),
      trackActivity: type === "wallet", // Exchanges don't track activity
      balance: { xrp: null, usd: null, lastUpdated: null },
      transactions: [],
      createdAt: new Date().toISOString(),
    };

    // Type-specific fields
    if (type === "wallet") {
      wallet.address = address;
    } else if (type === "exchange") {
      wallet.xrpAmount = xrpAmount;
      wallet.balance.xrp = xrpAmount;
      wallet.balance.usd = (xrpAmount * this.currentPrice).toFixed(2);
      wallet.balance.lastUpdated = new Date().toISOString();
    }

    // Fetch initial balance for wallet type
    if (type === "wallet") {
      try {
        const response = await api.get(
          `/search?account=${encodeURIComponent(address)}`,
        );
        if (response.success && response.data && response.data.balance_xrp) {
          wallet.balance.xrp = response.data.balance_xrp;
          wallet.balance.usd = (
            response.data.balance_xrp * this.currentPrice
          ).toFixed(2);
          wallet.balance.lastUpdated = new Date().toISOString();
        }
      } catch (error) {
        wallet.balance.usd = "0.00";
      }
    }

    this.wallets.push(wallet);
    this.saveWallets();

    // Subscribe to transactions if monitoring enabled and XRPL connected
    if (wallet.trackActivity && xrplService.getStatus().isConnected) {
      try {
        await xrplService.subscribeToAccount(wallet.address);
      } catch (error) {
        // Failed to subscribe
      }
    }

    return wallet;
  }

  // Delete wallet
  async deleteWallet(identifier) {
    const index = this.wallets.findIndex(
      (w) =>
        (w.type === "wallet" && w.address === identifier) ||
        (w.type === "exchange" && w.xrpAmount === identifier),
    );
    if (index === -1) {
      throw new Error("Wallet not found");
    }

    const wallet = this.wallets[index];

    // Unsubscribe if wallet type and connected
    if (wallet.type === "wallet" && xrplService.getStatus().isConnected) {
      try {
        await xrplService.unsubscribeFromAccount(wallet.address);
      } catch (error) {
        // Failed to unsubscribe
      }
    }

    // Remove alerts for this wallet
    this.alertWallets.delete(
      wallet.type === "wallet" ? wallet.address : wallet.xrpAmount,
    );

    this.wallets.splice(index, 1);
    this.saveWallets();
  }

  // Update wallet custom name
  updateWalletCustomName(identifier, customName) {
    const wallet = this.getWallet(identifier);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (customName && customName.length > 30) {
      throw new Error("Custom name must be 30 characters or less");
    }

    wallet.customName = customName.trim();
    this.saveWallets();
  }

  // Update exchange amount
  updateExchangeAmount(oldAmount, newAmount, customName = "") {
    const wallet = this.getWallet(oldAmount);
    if (!wallet || wallet.type !== "exchange") {
      throw new Error("Exchange wallet not found");
    }

    if (newAmount <= 0 || isNaN(newAmount)) {
      throw new Error("Invalid XRP amount");
    }

    // Check if new amount conflicts with existing exchange
    if (
      this.wallets.some(
        (w) =>
          w.type === "exchange" &&
          w.xrpAmount === newAmount &&
          w.xrpAmount !== oldAmount,
      )
    ) {
      throw new Error("Exchange amount already exists");
    }

    wallet.xrpAmount = newAmount;
    wallet.customName = customName.trim();
    wallet.balance.xrp = newAmount;
    wallet.balance.usd = (newAmount * this.currentPrice).toFixed(2);
    wallet.balance.lastUpdated = new Date().toISOString();

    this.saveWallets();
    this.notifyListeners("balanceUpdated", {
      address: newAmount,
      balance: wallet.balance,
    });
  }

  // Update wallet monitoring preference
  async updateWalletMonitoring(identifier, enabled) {
    const wallet = this.getWallet(identifier);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.type === "exchange") {
      throw new Error("Exchange wallets cannot have monitoring enabled");
    }

    const wasEnabled = wallet.trackActivity;
    wallet.trackActivity = enabled;
    this.saveWallets();

    // Subscribe/unsubscribe based on XRPL connection
    if (xrplService.getStatus().isConnected) {
      try {
        if (enabled && !wasEnabled) {
          await xrplService.subscribeToAccount(wallet.address);
        } else if (!enabled && wasEnabled) {
          await xrplService.unsubscribeFromAccount(wallet.address);
        }
      } catch (error) {
        // Failed to update subscription
      }
    }
  }

  // Get wallet by identifier (address for wallets, xrpAmount for exchanges)
  getWallet(identifier) {
    return this.wallets.find(
      (w) =>
        (w.type === "wallet" && w.address === identifier) ||
        (w.type === "exchange" && w.xrpAmount === identifier),
    );
  }

  // Get all wallets
  getAllWallets() {
    return [...this.wallets];
  }

  // Get wallet count
  getWalletCount() {
    return this.wallets.length;
  }

  // Check if at max capacity
  isAtCapacity() {
    return this.wallets.length >= this.maxWallets;
  }

  // Update wallet balance
  updateWalletBalance(address, xrpBalance) {
    const wallet = this.getWallet(address);
    if (!wallet) return;

    wallet.balance.xrp = xrpBalance;
    wallet.balance.usd = (xrpBalance * this.currentPrice).toFixed(2);
    wallet.balance.lastUpdated = new Date().toISOString();
    this.saveWallets();
    this.notifyListeners("balanceUpdated", {
      address,
      balance: wallet.balance,
    });
  }

  // Update all wallet USD values based on price
  updateAllUSDValues(price) {
    this.currentPrice = price;
    let walletCount = 0;
    let totalXrp = 0;
    let totalUsd = 0;

    this.wallets.forEach((wallet) => {
      if (wallet.balance && wallet.balance.xrp !== null) {
        wallet.balance.usd = (wallet.balance.xrp * price).toFixed(2);
        totalXrp += parseFloat(wallet.balance.xrp);
        totalUsd += parseFloat(wallet.balance.usd);
        walletCount++;
      }
    });
    this.saveWallets();

    this.notifyListeners("priceUpdated", { price });
  }

  // Handle incoming XRPL transactions
  handleTransaction(tx) {
    // Check if this transaction involves any of our wallets
    const wallet = this.getWalletByTransaction(tx);
    if (!wallet) return;

    // Add transaction to wallet's history (limit to 10)
    if (!wallet.transactions) wallet.transactions = [];
    wallet.transactions.unshift(tx);
    wallet.transactions = wallet.transactions.slice(0, 10);

    // Mark wallet as having alerts
    const alertKey =
      wallet.type === "wallet" ? wallet.address : wallet.xrpAmount;
    this.alertWallets.add(alertKey);

    // Add to alert history
    const alertEntry = {
      wallet: alertKey,
      walletType: wallet.type,
      transaction: tx,
      timestamp: new Date().toISOString(),
    };
    this.alertHistory.unshift(alertEntry);
    this.alertHistory = this.alertHistory.slice(0, this.maxAlertHistory);

    // Save changes
    this.saveWallets();

    // Notify listeners
    this.notifyListeners("transactionAlert", {
      wallet: alertKey,
      walletType: wallet.type,
      transaction: tx,
      alertCount: this.alertWallets.size,
    });

    // Browser notification (if permission granted)
    this.showBrowserNotification(wallet, tx);
  }

  // Show browser notification for transaction alert
  showBrowserNotification(wallet, tx) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      const title = `Transaction Alert: ${wallet.customName || (wallet.type === "wallet" ? wallet.address.substring(0, 6) + "..." : "Exchange")}`;
      const body = `${tx.type} transaction: ${tx.amount} XRP`;

      const notification = new Notification(title, {
        body: body,
        icon: "/images/xrpl.png", // Use XRPL logo
        tag: `xrpl-alert-${wallet.type === "wallet" ? wallet.address : wallet.xrpAmount}`, // Prevent spam
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }

  // Find wallet involved in transaction (comprehensive matching)
  getWalletByTransaction(tx) {
    // For wallet type only (exchanges don't monitor transactions)
    const walletWallets = this.wallets.filter((w) => w.type === "wallet");

    // Check direct sender/receiver
    let wallet = walletWallets.find(
      (wallet) =>
        wallet.address === tx.account || wallet.address === tx.destination,
    );

    if (wallet) return wallet;

    // For more complex transactions, check additional fields
    // Some transactions might involve the account in other ways
    const txJson = tx.rawTransaction || tx;
    const allAddresses = this.extractAddressesFromTransaction(txJson);

    wallet = walletWallets.find((wallet) =>
      allAddresses.includes(wallet.address),
    );

    return wallet;
  }

  // Extract all addresses involved in a transaction
  extractAddressesFromTransaction(tx) {
    const addresses = new Set();

    // Direct fields
    if (tx.Account) addresses.add(tx.Account);
    if (tx.Destination) addresses.add(tx.Destination);
    if (tx.Owner) addresses.add(tx.Owner);
    if (tx.Issuer) addresses.add(tx.Issuer);
    if (tx.RegularKey) addresses.add(tx.RegularKey);

    // Check nested objects for addresses
    const checkObject = (obj) => {
      if (!obj || typeof obj !== "object") return;

      for (const [key, value] of Object.entries(obj)) {
        if (
          typeof value === "string" &&
          value.startsWith("r") &&
          value.length >= 25
        ) {
          addresses.add(value);
        } else if (typeof value === "object") {
          checkObject(value);
        }
      }
    };

    checkObject(tx);

    return Array.from(addresses);
  }

  // Subscribe to all wallets that have monitoring enabled (skip exchanges)
  async subscribeToAllWallets() {
    if (!xrplService.getStatus().isConnected) {
      return;
    }

    const walletWallets = this.wallets.filter(
      (w) => w.type === "wallet" && w.trackActivity,
    );

    if (walletWallets.length === 0) {
      return;
    }
    let successCount = 0;
    let failureCount = 0;

    for (const wallet of walletWallets) {
      try {
        await xrplService.subscribeToAccount(wallet.address);
        successCount++;
      } catch (error) {
        failureCount++;
      }
    }

    // Listen for subscription events
    xrplService.addListener((event, data) => {
      if (event === "subscriptionSuccess") {
      } else if (event === "subscriptionFailed") {
        console.error(
          `❌ Subscription failed for ${data.address}: ${data.error}`,
        );
      }
    });
  }

  // Set current price
  setPrice(price) {
    if (this.currentPrice !== price) {
      // Price updated
    }
    this.currentPrice = price;
    this.updateAllUSDValues(price);
  }

  // Fetch balances for all wallets (skip exchanges)
  async fetchAllBalances() {
    const walletWallets = this.wallets.filter((w) => w.type === "wallet");
    if (walletWallets.length === 0) return;

    const useXrpl = xrplService.getStatus().isConnected;

    try {
      const promises = walletWallets.map((wallet) => {
        if (useXrpl) {
          // Try XRPL first if connected
          return xrplService
            .getAccountInfo(wallet.address)
            .then((info) => {
              this.updateWalletBalance(wallet.address, info.xrpBalance);
            })
            .catch((error) => {
              // Fall back to API
              return this.fetchBalanceFromAPI(wallet.address);
            });
        } else {
          // Use API
          return this.fetchBalanceFromAPI(wallet.address);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  }

  // Helper method to fetch balance from API
  async fetchBalanceFromAPI(address) {
    try {
      const response = await api.get(
        `/search?account=${encodeURIComponent(address)}`,
      );
      if (response.success && response.data && response.data.balance_xrp) {
        this.updateWalletBalance(address, response.data.balance_xrp);
      }
    } catch (error) {
      // Failed to fetch balance
    }
  }

  // Add listener for wallet updates
  addListener(callback) {
    this.listeners.push(callback);
  }

  // Remove listener
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notify all listeners
  notifyListeners(event, data = {}) {
    this.listeners.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error("Error in wallet listener:", error);
      }
    });
  }

  // Export wallets as JSON
  exportWallets() {
    return JSON.stringify(this.wallets, null, 2);
  }

  // Import wallets from JSON
  importWallets(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (!Array.isArray(imported)) {
        throw new Error("Invalid format");
      }

      // Validate and filter
      const validated = imported
        .filter(
          (w) =>
            w &&
            w.address &&
            w.address.startsWith("r") &&
            w.address.length >= 25,
        )
        .slice(0, this.maxWallets);

      this.wallets = validated;
      this.saveWallets();
      return validated.length;
    } catch (error) {
      console.error("Error importing wallets:", error);
      throw error;
    }
  }

  // Alert management
  hasAlerts(identifier) {
    return this.alertWallets.has(identifier);
  }

  clearAlerts(identifier) {
    this.alertWallets.delete(identifier);
    this.saveWallets();
  }

  clearAllAlerts() {
    this.alertWallets.clear();
    this.saveWallets();
  }

  getAlertCount() {
    return this.alertWallets.size;
  }

  getAlertHistory() {
    return [...this.alertHistory];
  }

  clearAlertHistory() {
    this.alertHistory = [];
    this.saveWallets();
  }

  // Clear all wallets
  async clearAllWallets() {
    // Unsubscribe from all wallets
    if (xrplService.getStatus().isConnected) {
      for (const wallet of this.wallets) {
        try {
          await xrplService.unsubscribeFromAccount(wallet.address);
        } catch (error) {
          // Failed to unsubscribe
        }
      }
    }

    this.wallets = [];
    this.alertWallets.clear();
    this.saveWallets();
  }
}

// Create singleton instance
const walletService = new WalletService();

export default walletService;
