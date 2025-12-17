// Oracle Subscriber Service
// Polls the XRPL Oracle account via Clio for price updates
// Extracts XRP price from LimitAmount.value and updates database

import db from "../config/database.js";
import { insertPrice } from "../models/priceModel.mjs";

class OracleSubscriber {
  constructor(xrplService) {
    this.xrplService = xrplService;
    this.isSubscribed = false;
    this.oracleAccount = "rXUMMaPpZqPutoRszR29jtC8amWq3APkx";
    this.lastPrice = null;
    this.lastLedger = null;
    this.subscriptionStartTime = null;
    this.pricesReceived = 0;
    this.priceUpdates = 0;
    this.pollingInterval = null;
    this.lastSeenTxHash = null; // Track last seen transaction to detect new ones
  }

  async start() {
    try {
      if (!this.xrplService.isConnected) {
        console.log(
          "⏳ Waiting for XRPL connection before starting oracle polling...",
        );
        // Wait up to 30 seconds for connection
        for (let i = 0; i < 30; i++) {
          if (this.xrplService.isConnected) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!this.xrplService.isConnected) {
        throw new Error("XRPL service not connected");
      }

      await this.subscribe();
      this.subscriptionStartTime = new Date();
      console.log("🎯 Oracle Subscriber started");
    } catch (error) {
      console.error("❌ Failed to start Oracle Subscriber:", error.message);
    }
  }

  async subscribe() {
    try {
      console.log(
        `📡 Setting up Oracle price polling for: ${this.oracleAccount}`,
      );

      // Start polling for new transactions from the oracle account
      // Poll every minute to catch price updates
      this.pollingInterval = setInterval(() => {
        this.pollOracleTransactions().catch((error) => {
          console.error("❌ Error polling oracle:", error.message);
        });
      }, 60000);

      // Do an initial poll immediately
      await this.pollOracleTransactions();

      this.isSubscribed = true;
      console.log(`✅ Oracle polling started`);
      console.log(`   Oracle Account: ${this.oracleAccount}`);
      console.log(`   Polling interval: 1 minute`);

      return { result: { status: "polling_active" } };
    } catch (error) {
      console.error("❌ Error setting up oracle polling:", error.message);
      this.isSubscribed = false;
      throw error;
    }
  }

  async pollOracleTransactions() {
    try {
      // Fetch the most recent transactions
      const response = await this.xrplService.request({
        command: "account_tx",
        account: this.oracleAccount,
        limit: 5, // Check last 5 transactions
      });

      const transactions = response.result.transactions || [];

      // Process transactions in reverse order (oldest first)
      for (const txObj of transactions.reverse()) {
        const tx = txObj.tx_json || txObj.tx;
        if (!tx) continue;

        // Skip if we've already processed this transaction
        if (txObj.hash === this.lastSeenTxHash) {
          continue;
        }

        // Update the last seen transaction hash if it's newer
        if (!this.lastSeenTxHash || txObj.hash !== this.lastSeenTxHash) {
          if (
            tx.TransactionType === "TrustSet" &&
            tx.LimitAmount?.currency === "USD"
          ) {
            await this.handleOracleUpdate(tx, txObj);
          }
        }
      }

      // Remember the latest transaction hash we've seen
      if (transactions.length > 0) {
        this.lastSeenTxHash = transactions[0].hash;
      }
    } catch (error) {
      // Silently ignore polling errors, we'll try again next interval
    }
  }

  async handleOracleUpdate(tx, txObj = null) {
    try {
      // Check if this is a TrustSet transaction from the oracle account
      if (
        tx.Account !== this.oracleAccount ||
        tx.TransactionType !== "TrustSet"
      ) {
        return;
      }

      // Extract price from LimitAmount
      const price = parseFloat(tx.LimitAmount?.value);

      if (!isNaN(price) && price > 0) {
        this.pricesReceived++;

        // Check if price actually changed
        if (price !== this.lastPrice) {
          this.priceUpdates++;
          console.log(
            `💹 Oracle Price Update: $${this.lastPrice || "initial"} → $${price}`,
          );

          // Get ledger info
          const ledger =
            txObj?.ledger_index || tx.ledger_index || this.lastLedger;
          const sequence = tx.Sequence || null;
          const timestamp = tx.date || Date.now();

          // Update database
          try {
            await insertPrice(price, timestamp, ledger, sequence);
            console.log(
              `   ✓ Inserted price into database (Ledger: ${ledger})`,
            );
          } catch (dbError) {
            console.error(
              "   ✗ Error inserting price into database:",
              dbError.message,
            );
          }

          this.lastPrice = price;
          this.lastLedger = ledger;
        }
      }
    } catch (error) {
      console.error("Error handling oracle update:", error.message);
    }
  }

  async unsubscribe() {
    try {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
        console.log("✓ Stopped Oracle polling");
      }
      this.isSubscribed = false;
    } catch (error) {
      console.error("Error stopping oracle polling:", error.message);
    }
  }

  getStatus() {
    return {
      isSubscribed: this.isSubscribed,
      oracleAccount: this.oracleAccount,
      lastPrice: this.lastPrice,
      lastLedger: this.lastLedger,
      pricesReceived: this.pricesReceived,
      priceUpdates: this.priceUpdates,
      uptime: this.subscriptionStartTime
        ? Math.floor((Date.now() - this.subscriptionStartTime) / 1000) + "s"
        : "not started",
    };
  }
}

export default OracleSubscriber;
