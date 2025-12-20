import xrpl from "xrpl";

class XRPLService {
  constructor() {
    this.servers = ["wss://s2.ripple.com", "wss://xrplcluster.com"];
    this.currentServerIndex = 0;
    this.client = null;
    this.isConnected = false;
    this.io = null;
    this.lastRequestTime = 0;
  }

  setSocketIo(io) {
    this.io = io;
  }

  async connect() {
    for (let i = 0; i < this.servers.length; i++) {
      const server = this.servers[this.currentServerIndex];
      try {
        console.log(`🔗 Connecting to XRPL server: ${server}`);
        this.client = new xrpl.Client(server);
        await this.client.connect();
        this.isConnected = true;
        console.log(`✅ Connected to XRPL server: ${server}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to connect to ${server}:`, error.message);
        this.currentServerIndex =
          (this.currentServerIndex + 1) % this.servers.length;
      }
    }
    console.error("❌ Failed to connect to any XRPL server");
    this.isConnected = false;
    return false;
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log("Disconnected from XRPL server");
    }
  }

  async request(command) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000; // 1 second

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      if (!this.isConnected) {
        await this.connect();
      }
      const result = await this.client.request(command);
      this.lastRequestTime = Date.now();
      return result;
    } catch (error) {
      console.error("Request failed:", error.message);
      // Attempt failover on connection errors
      if (
        error.message.includes("connection") ||
        error.message.includes("disconnected")
      ) {
        console.log("🔄 Attempting failover to next server...");
        this.isConnected = false;
        this.currentServerIndex =
          (this.currentServerIndex + 1) % this.servers.length;
        await this.connect();
        // Retry the request once after failover
        try {
          const result = await this.client.request(command);
          this.lastRequestTime = Date.now();
          return result;
        } catch (retryError) {
          console.error("Retry after failover failed:", retryError.message);
          throw retryError;
        }
      }
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      currentServer: this.servers[this.currentServerIndex],
      servers: this.servers,
    };
  }

  async getLedgerTransactions(ledgerIndex) {
    try {
      const response = await this.request({
        command: "ledger",
        ledger_index: ledgerIndex,
        accounts: false,
        expand: true,
        transactions: true,
      });

      return response.result.transactions || [];
    } catch (error) {
      console.error(
        `Error fetching transactions for ledger ${ledgerIndex}:`,
        error.message,
      );
      return [];
    }
  }

  async extractPriceFromLedger(ledgerIndex) {
    try {
      const transactions = await this.getLedgerTransactions(ledgerIndex);
      const oracleAccount = "rXUMMaPpZqPutoRszR29jtC8amWq3APkx";

      for (const tx of transactions) {
        if (tx.TransactionType === "TrustSet" && tx.Account === oracleAccount) {
          if (tx.LimitAmount && tx.LimitAmount.currency === "USD") {
            const price = parseFloat(tx.LimitAmount.value);
            if (!isNaN(price) && price > 0) {
              return {
                price,
                ledgerIndex,
                timestamp: tx.date
                  ? this.rippleToUnixTime(tx.date)
                  : Date.now(),
              };
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Error extracting price from ledger:", error.message);
      return null;
    }
  }

  rippleToUnixTime(rippleTime) {
    // Ripple epoch is 946684800 seconds after Unix epoch
    const RIPPLE_EPOCH = 946684800;
    return (rippleTime + RIPPLE_EPOCH) * 1000;
  }

  async getCurrentPrice() {
    try {
      const response = await this.request({
        command: "server_info",
      });

      const ledgerIndex = response.result.info.validated_ledger.seq;
      console.log(`📊 Current ledger: ${ledgerIndex}`);

      // Try to get price from current ledger
      let priceData = await this.extractPriceFromLedger(ledgerIndex);

      // If not found, try a few recent ledgers
      if (!priceData) {
        for (let i = 1; i <= 5; i++) {
          priceData = await this.extractPriceFromLedger(ledgerIndex - i);
          if (priceData) break;
        }
      }

      return priceData;
    } catch (error) {
      console.error("Error getting current price:", error.message);
      return null;
    }
  }
}

export default XRPLService;
