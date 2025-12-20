// Investigate why ledger 100836758 causes "Ledger index malformed" in backfill

import { Client } from "xrpl";

async function investigateLedger100836758() {
  const client = new Client("wss://xrplcluster.com");

  try {
    await client.connect();
    console.log("Connected to xrplcluster.com");

    // Check server info
    const serverInfo = await client.request({ command: "server_info" });
    console.log(
      "Server complete_ledgers:",
      serverInfo.result.info.complete_ledgers,
    );

    // Validate the specific ledger
    try {
      const ledgerInfo = await client.request({
        command: "ledger",
        ledger_index: 100836758,
        transactions: false,
      });
      console.log("Ledger 100836758 exists:", !!ledgerInfo.result.ledger);
    } catch (error) {
      console.log("Ledger 100836758 validation error:", error.message);
    }

    // Test single ledger query
    console.log("\nTesting single ledger query...");
    try {
      const response = await client.request({
        command: "account_tx",
        account: "rXUMMaPpZqPutoRszR29jtC8amWq3APkx",
        ledger_index: 100836758,
        limit: 10,
      });
      console.log(
        "Single ledger query success, TX count:",
        response.result.transactions.length,
      );
    } catch (error) {
      console.log("Single ledger query error:", error.message);
    }

    // Test ranges
    const ranges = [
      { min: 100836758, max: 100836758, desc: "Single ledger" },
      { min: 100836750, max: 100836758, desc: "Small range (9 ledgers)" },
      { min: 100836000, max: 100836758, desc: "Medium range (~759 ledgers)" },
      { min: 981, max: 100836758, desc: "Large range (failing case)" },
    ];

    for (const range of ranges) {
      console.log(
        `\nTesting range: ${range.desc} (${range.min} - ${range.max})`,
      );
      try {
        const response = await client.request({
          command: "account_tx",
          account: "rXUMMaPpZqPutoRszR29jtC8amWq3APkx",
          ledger_index_min: range.min,
          ledger_index_max: range.max,
          limit: 10,
        });
        console.log(
          "Range query success, TX count:",
          response.result.transactions.length,
        );
      } catch (error) {
        console.log("Range query error:", error.message);
      }
      // Delay to respect limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error("Connection or general error:", error.message);
  } finally {
    await client.disconnect();
  }
}

investigateLedger100836758();
