// Test script to inspect XRPL account_tx for a sample gap range
// Does not modify the app, just reads and analyzes

import { Client } from "xrpl";
import db from "./config/database.js";

async function testGapBackfill() {
  const sampleGap = { start_ledger: 100988000, end_ledger: 100988050 };
  console.log("Testing gap:", sampleGap);

  try {
    // Fetch XRPL transactions for this gap
    const client = new Client("wss://s2.ripple.com");
    await client.connect();
    console.log("Connected to XRPL");

    const response = await client.request({
      command: "account_tx",
      account: "rXUMMaPpZqPutoRszR29jtC8amWq3APkx",
      ledger_index_min: sampleGap.start_ledger,
      ledger_index_max: sampleGap.end_ledger,
      limit: 100,
      forward: false,
    });

    console.log("XRPL Response Status: received");
    console.log("Response has result:", !!response.result);
    if (response.result && response.result.transactions) {
      const txs = response.result.transactions;
      console.log(`Found ${txs.length} transactions in range`);
      if (txs.length > 0) {
        console.log("Sample TX JSON:", JSON.stringify(txs[0], null, 2));

        // Analyze transactions
        let trustSetCount = 0;
        let oracleTrustSetCount = 0;
        let usdCount = 0;
        txs.forEach((txWrapper, index) => {
          const tx = txWrapper.tx_json || txWrapper.tx || txWrapper;
          console.log(
            `TX ${index}: Type=${tx.TransactionType}, Account=${tx.Account}`,
          );
          if (tx.TransactionType === "TrustSet") {
            trustSetCount++;
            if (tx.Account === "rXUMMaPpZqPutoRszR29jtC8amWq3APkx") {
              oracleTrustSetCount++;
              console.log(
                `  Oracle TrustSet: LimitAmount=${JSON.stringify(tx.LimitAmount)}`,
              );
              if (tx.LimitAmount && tx.LimitAmount.currency === "USD") {
                usdCount++;
                console.log(`  USD Price TX: ${tx.LimitAmount.value}`);
              }
            }
          }
        });
        console.log(
          `Analysis: ${trustSetCount} TrustSet, ${oracleTrustSetCount} Oracle TrustSet, ${usdCount} USD`,
        );
      }
    } else {
      console.log(
        "No transactions in response:",
        JSON.stringify(response, null, 2),
      );
    }

    await client.disconnect();
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await db.pool.end();
  }
}

testGapBackfill();
