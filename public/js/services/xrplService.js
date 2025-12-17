// XRPL Connection Service
// Manages connections to XRPL servers and fetches data from the ledger

class XRPLService {
  constructor() {
    this.connection = null;
    this.selectedServer = null;
    this.isConnected = false;
    this.listeners = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10; // Increased for better recovery
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.xrplReady = false;
    this.subscribedAccounts = new Set(); // Track subscribed accounts
    this.isAutoConnecting = false; // Prevent multiple auto-connect attempts

    // Default servers - prioritize XRPL Cluster
    this.servers = {
      xrplcluster: {
        name: "XRPL Cluster (Mainnet)",
        url: "wss://xrplcluster.com",
        network: "mainnet",
      },
      ripple_s2: {
        name: "Ripple S2 (Mainnet)",
        url: "wss://s2.ripple.com",
        network: "mainnet",
      },
    };

    this.loadSelectedServer();
    this.initXrplLibrary();
  }

  // Initialize xrpl library
  async initXrplLibrary() {
    try {
      if (typeof window !== "undefined" && !window.xrpl) {
        const script = document.createElement("script");
        script.src = "/js/lib/xrpl-latest-min.js";
        script.type = "text/javascript";
        script.onload = () => {
          this.xrplReady = true;
        };
        script.onerror = () => {
          console.error("Failed to load xrpl.js library");
        };
        document.head.appendChild(script);
      } else if (window.xrpl) {
        this.xrplReady = true;
      }
    } catch (error) {
      console.error("Error initializing xrpl library:", error);
    }
  }

  // Get Client class from xrpl library
  getClient() {
    if (!this.xrplReady || !window.xrpl) {
      throw new Error("xrpl.js library is not ready");
    }
    return window.xrpl.Client;
  }

  // Listener management
  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach((listener) => listener(event, data));
  }

  // Persist selected server to localStorage
  saveSelectedServer() {
    if (this.selectedServer) {
      localStorage.setItem("richlist-xrpl-server", this.selectedServer);
    }
  }

  // Load selected server from localStorage
  loadSelectedServer() {
    const saved = localStorage.getItem("richlist-xrpl-server");
    if (saved && this.servers[saved]) {
      this.selectedServer = saved;
    }
  }

  // Get all available servers
  getAvailableServers() {
    return Object.entries(this.servers).map(([key, server]) => ({
      id: key,
      ...server,
    }));
  }

  // Connect to XRPL server
  async connect(serverId) {
    // Wait for xrpl library to be ready
    let attempts = 0;
    while (!this.xrplReady && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.xrplReady) {
      throw new Error("xrpl.js library failed to load");
    }

    // Disconnect existing connection
    if (this.connection) {
      await this.disconnect();
    }

    const server = this.servers[serverId];
    if (!server) {
      throw new Error(`Unknown server: ${serverId}`);
    }

    try {
      this.selectedServer = serverId;
      this.saveSelectedServer();

      const Client = this.getClient();
      this.connection = new Client(server.url);

      await this.connection.connect();

      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Set up transaction listener for subscriptions
      this.setupTransactionListener();

      this.notifyListeners("connected", {
        server: serverId,
        serverName: server.name,
        url: server.url,
      });

      return true;
    } catch (error) {
      console.error(`Failed to connect to XRPL ${serverId}:`, error);
      this.isConnected = false;
      this.notifyListeners("connectionFailed", {
        server: serverId,
        error: error.message,
      });
      throw error;
    }
  }

  // Disconnect from XRPL server
  async disconnect() {
    if (this.connection) {
      try {
        await this.connection.disconnect();
        this.isConnected = false;
        this.connection = null;
        this.subscribedAccounts.clear(); // Clear subscriptions on disconnect
        this.notifyListeners("disconnected", {});
      } catch (error) {
        console.error("Error disconnecting from XRPL:", error);
      }
    }
  }

  // Fetch account info (balance) from XRPL
  async getAccountInfo(address) {
    if (!this.isConnected || !this.connection) {
      throw new Error("Not connected to XRPL");
    }

    try {
      const response = await this.connection.request({
        command: "account_info",
        account: address,
        ledger_index: "validated",
      });

      // xrpl.js wraps the response in a result property
      const accountData =
        response.result?.account_data || response.account_data;

      if (!accountData) {
        throw new Error(`No account data in response for ${address}`);
      }

      // Balance is in drops (1 XRP = 1,000,000 drops)
      const xrpBalance = parseInt(accountData.Balance) / 1_000_000;

      return {
        address: address,
        xrpBalance: xrpBalance,
        flags: accountData.Flags,
        sequence: accountData.Sequence,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error fetching account info for ${address}:`, error);
      throw error;
    }
  }

  // Fetch XRP price from XRPL (requires connection to server with price data)
  async getXRPPrice() {
    if (!this.isConnected || !this.connection) {
      throw new Error("Not connected to XRPL");
    }

    try {
      // Note: XRP price is not directly available from XRPL
      // This would require querying an oracle or external service
      // For now, we'll rely on the API endpoint
      return null;
    } catch (error) {
      console.error("Error fetching XRP price from XRPL:", error);
      throw error;
    }
  }

  // Subscribe to account transactions
  async subscribeToAccount(address) {
    if (!this.isConnected || !this.connection) {
      throw new Error("Not connected to XRPL server");
    }

    if (this.subscribedAccounts.has(address)) {
      return true;
    }

    try {
      const response = await this.connection.request({
        command: "subscribe",
        accounts: [address],
      });

      // Check if subscription was successful
      if (response && response.result) {
        this.subscribedAccounts.add(address);
        this.notifyListeners("subscriptionSuccess", { address });
        return true;
      } else {
        throw new Error("Subscription request failed");
      }
    } catch (error) {
      console.error(`❌ Failed to subscribe to ${address}:`, error);
      this.notifyListeners("subscriptionFailed", {
        address,
        error: error.message,
      });
      throw error;
    }
  }

  // Unsubscribe from account transactions
  async unsubscribeFromAccount(address) {
    if (!this.isConnected || !this.connection) {
      this.subscribedAccounts.delete(address);
      this.notifyListeners("unsubscriptionSuccess", { address });
      return;
    }

    if (!this.subscribedAccounts.has(address)) {
      return;
    }

    try {
      await this.connection.request({
        command: "unsubscribe",
        accounts: [address],
      });

      this.subscribedAccounts.delete(address);
      this.notifyListeners("unsubscriptionSuccess", { address });
    } catch (error) {
      console.error(`❌ Failed to unsubscribe from ${address}:`, error);
      // Still remove from set even if unsubscribe failed
      this.subscribedAccounts.delete(address);
      this.notifyListeners("unsubscriptionFailed", {
        address,
        error: error.message,
      });
    }
  }

  // Set up transaction event listener
  setupTransactionListener() {
    if (!this.connection) return;

    this.connection.on("transaction", (tx) => {
      this.handleTransaction(tx);
    });
  }

  // Handle incoming transaction events
  handleTransaction(txData) {
    try {
      const tx = txData.transaction || txData.tx_json || txData;
      if (!tx) return;

      // Extract relevant transaction info
      const transaction = {
        hash: txData.transaction?.hash || tx.hash || txData.hash,
        type: tx.TransactionType,
        account: tx.Account,
        destination: tx.Destination,
        amount: this.extractAmount(tx),
        fee: tx.Fee ? parseInt(tx.Fee) / 1000000 : 0, // Convert drops to XRP
        timestamp: tx.date || txData.date || Date.now(),
        ledger: txData.ledger_index || tx.ledger_index,
        sequence: tx.Sequence,
      };

      // Emit transaction event for all listeners
      this.notifyListeners("transaction", transaction);
    } catch (error) {
      console.error("Error processing transaction:", error);
    }
  }

  // Extract amount from transaction
  extractAmount(tx) {
    if (!tx.Amount) return 0;

    if (typeof tx.Amount === "string") {
      // XRP amount in drops
      return parseInt(tx.Amount) / 1000000;
    } else if (tx.Amount.currency === "XRP") {
      // XRP object
      return parseInt(tx.Amount.value) / 1000000;
    } else {
      // Other currencies - return as object for now
      return tx.Amount;
    }
  }

  // Get list of subscribed accounts
  getSubscribedAccounts() {
    return Array.from(this.subscribedAccounts);
  }

  // Auto-connect to default server
  async autoConnect() {
    if (this.isAutoConnecting || this.isConnected) return;

    this.isAutoConnecting = true;

    // Use XRPL Cluster as default if no server selected
    const defaultServer = this.selectedServer || "xrplcluster";

    try {
      await this.connect(defaultServer);
    } catch (error) {
      // Auto-connect failed, will retry
      // Don't start reconnection here, let main.js handle it
    } finally {
      this.isAutoConnecting = false;
    }
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      selectedServer: this.selectedServer,
      serverName: this.selectedServer
        ? this.servers[this.selectedServer].name
        : null,
      reconnectAttempts: this.reconnectAttempts,
      subscribedAccounts: this.subscribedAccounts.size,
      isAutoConnecting: this.isAutoConnecting,
    };
  }

  // Attempt to reconnect with exponential backoff
  async attemptReconnect() {
    if (
      this.selectedServer &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.reconnectAttempts++;

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay,
      );

      try {
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.connect(this.selectedServer);
        this.reconnectAttempts = 0; // Reset on success
      } catch (error) {
        console.error("Reconnection attempt failed:", error.message);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          // Schedule next reconnection attempt
          setTimeout(() => this.attemptReconnect(), 1000); // Short delay before next exponential backoff
        } else {
          console.error("Max reconnection attempts reached");
          this.notifyListeners("maxReconnectAttemptsReached", {
            attempts: this.reconnectAttempts,
          });
        }
      }
    }
  }
}

// Create singleton instance
let xrplServiceInstance = null;

function getXRPLService() {
  if (!xrplServiceInstance) {
    xrplServiceInstance = new XRPLService();
  }
  return xrplServiceInstance;
}

// Export singleton
const xrplService = getXRPLService();
export default xrplService;
