import xrpl from "xrpl";

// Allow self-signed certificates for local connection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

class XRPLService {
  constructor() {
    this.localClioServer = "ws://127.0.0.1:51233";
    this.client = null;
    this.isConnected = false;
    this.io = null;
  }

  setSocketIo(io) {
    this.io = io;
  }

  async connect() {
    try {
      console.log("🔗 Connecting to local Clio server...");
      this.client = new xrpl.Client(this.localClioServer);
      await this.client.connect();
      this.isConnected = true;
      console.log("✅ Connected to local Clio server");
      return true;
    } catch (error) {
      console.error("❌ Failed to connect to Clio server:", error.message);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log("Disconnected from Clio server");
    }
  }

  async request(command) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.request(command);
    } catch (error) {
      console.error("Request failed:", error.message);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      server: this.localClioServer,
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
