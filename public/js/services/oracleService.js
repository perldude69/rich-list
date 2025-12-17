// XRPL Oracle Service
// Subscribes to XRPL Ledger Oracle for real-time XRP price updates

import xrplService from "./xrplService.js";

class XRPLOracleService {
  constructor() {
    this.oracleAccount = "rXUMMaPpZqPutoRszR29jtC8amWq3APkx";
    this.isSubscribed = false;
    this.listeners = [];
    this.currentPrice = null;
    this.lastUpdated = null;
    this.subscriptionHandle = null;

    // Listen for XRPL connection changes
    xrplService.addListener((event, data) => {
      if (event === "connected") {
        this.subscribe();
      } else if (event === "disconnected") {
        this.unsubscribe();
      }
    });

    // Auto-subscribe if XRPL is already connected
    if (xrplService.getStatus().isConnected) {
      this.subscribe();
    }
  }

  // Listener management
  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch (error) {
        console.error("Error in oracle listener:", error);
      }
    });
  }

  // Subscribe to oracle account
  async subscribe() {
    if (this.isSubscribed || !xrplService.getStatus().isConnected) {
      return;
    }

    try {
      const connection = xrplService.connection;
      if (!connection) {
        return;
      }

      // Subscribe to account ledger entry changes
      this.subscriptionHandle = await connection.request({
        command: "subscribe",
        accounts: [this.oracleAccount],
      });

      // Listen for ledger entry updates and transactions
      connection.on("ledgerEntryState", (message) => {
        this.handleLedgerUpdate(message);
      });

      connection.on("transaction", (message) => {
        this.handleTransactionUpdate(message);
      });

      this.isSubscribed = true;

      // Fetch initial oracle data
      await this.fetchOracleData();

      this.notifyListeners("subscribed", {
        account: this.oracleAccount,
      });
    } catch (error) {
      console.error("Error subscribing to oracle account:", error);
      this.notifyListeners("subscriptionFailed", {
        error: error.message,
      });
    }
  }

  // Unsubscribe from oracle account
  async unsubscribe() {
    if (!this.isSubscribed) {
      return;
    }

    try {
      const connection = xrplService.connection;
      if (connection && this.subscriptionHandle) {
        await connection.request({
          command: "unsubscribe",
          accounts: [this.oracleAccount],
        });
      }

      this.isSubscribed = false;
      this.notifyListeners("unsubscribed", {});
    } catch (error) {
      console.error("Error unsubscribing from oracle account:", error);
    }
  }

  // Fetch initial oracle data
  async fetchOracleData() {
    try {
      const connection = xrplService.connection;
      if (!connection) {
        throw new Error("XRPL connection not available");
      }

      // Get account info with ledger entries
      const response = await connection.request({
        command: "account_objects",
        account: this.oracleAccount,
        ledger_index: "validated",
        type: "state",
      });

      if (response.account_objects && response.account_objects.length > 0) {
        // Look for ledger entry with xrpPrice
        for (const obj of response.account_objects) {
          if (obj.AffectedNodes) {
            for (const node of obj.AffectedNodes) {
              const nodeData = node.CreatedNode || node.ModifiedNode;
              if (nodeData && nodeData.FinalFields) {
                this.parseOraclePrice(nodeData.FinalFields);
              }
            }
          }
        }
      }

      // Also try direct ledger_entry request
      await this.fetchDirectOracleEntry();
    } catch (error) {
      // Error fetching initial oracle data
    }
  }

  // Fetch oracle data directly from ledger entry
  async fetchDirectOracleEntry() {
    try {
      const connection = xrplService.connection;
      if (!connection) {
        return;
      }

      // Query the oracle object directly
      const response = await connection.request({
        command: "ledger_entry",
        account_root: this.oracleAccount,
        ledger_index: "validated",
      });

      if (response.node && response.node.Fields) {
        this.parseOraclePrice(response.node.Fields);
      }
    } catch (error) {
      // Error fetching direct oracle entry
    }
  }

  // Handle ledger entry state updates
  handleLedgerUpdate(message) {
    if (message.type === "ledgerEntryState" || message.type === "transaction") {
      const node = message.node || message.account_data;
      if (node && node.Fields) {
        this.parseOraclePrice(node.Fields);
      }

      // Also check in AffectedNodes if present
      if (message.AffectedNodes) {
        for (const affectedNode of message.AffectedNodes) {
          const nodeData =
            affectedNode.CreatedNode || affectedNode.ModifiedNode;
          if (nodeData && nodeData.FinalFields) {
            this.parseOraclePrice(nodeData.FinalFields);
          }
        }
      }
    }
  }

  // Handle transaction updates - PRIMARY method for oracle price extraction
  handleTransactionUpdate(message) {
    try {
      // Check if this is from the oracle account
      if (
        message.Account !== this.oracleAccount &&
        message.account !== this.oracleAccount
      ) {
        return;
      }

      // Check transaction type
      if (message.TransactionType !== "TrustSet") {
        return;
      }

      // Primary: Extract from transaction.transaction.LimitAmount.value
      if (message.transaction && message.transaction.LimitAmount) {
        const price = parseFloat(message.transaction.LimitAmount.value);
        if (!isNaN(price) && price > 0) {
          this.updatePrice(price);
          return;
        }
      }

      // Fallback: Direct LimitAmount
      if (message.LimitAmount) {
        const price = parseFloat(message.LimitAmount.value);
        if (!isNaN(price) && price > 0) {
          this.updatePrice(price);
          return;
        }
      }
    } catch (error) {
      // Error processing transaction update
    }
  }

  // Parse xrpPrice from oracle data
  parseOraclePrice(fields) {
    if (!fields) return;

    // Check various possible field names where price might be stored
    const possiblePriceFields = [
      "xrpPrice",
      "XRPPrice",
      "Price",
      "price",
      "OraclePrice",
      "oraclePrice",
    ];

    let price = null;

    for (const fieldName of possiblePriceFields) {
      if (fields[fieldName] !== undefined) {
        const rawValue = fields[fieldName];

        // Handle different data formats
        if (typeof rawValue === "number") {
          price = rawValue;
        } else if (typeof rawValue === "string") {
          price = parseFloat(rawValue);
        } else if (typeof rawValue === "object") {
          // Might be encoded or nested
          if (rawValue.value !== undefined) {
            price = parseFloat(rawValue.value);
          } else if (rawValue.amount !== undefined) {
            price = parseFloat(rawValue.amount);
          }
        }

        if (price && !isNaN(price) && price > 0) {
          break;
        }
      }
    }

    // If found a valid price, update it
    if (price && !isNaN(price) && price > 0) {
      this.updatePrice(price);
    }
  }

  // Update price and notify listeners
  updatePrice(newPrice) {
    if (newPrice === this.currentPrice) {
      return; // No change
    }

    const oldPrice = this.currentPrice;
    this.currentPrice = newPrice;
    this.lastUpdated = new Date().toISOString();

    this.notifyListeners("priceUpdated", {
      price: newPrice,
      previousPrice: oldPrice,
      timestamp: this.lastUpdated,
    });
  }

  // Get current price
  getPrice() {
    return this.currentPrice;
  }

  // Get subscription status
  getStatus() {
    return {
      isSubscribed: this.isSubscribed,
      currentPrice: this.currentPrice,
      lastUpdated: this.lastUpdated,
      oracleAccount: this.oracleAccount,
    };
  }
}

// Create singleton instance
let oracleServiceInstance = null;

function getOracleService() {
  if (!oracleServiceInstance) {
    oracleServiceInstance = new XRPLOracleService();
  }
  return oracleServiceInstance;
}

// Export singleton
const oracleService = getOracleService();
export default oracleService;
