// Backfills missing XRP prices from the oracle account in historical ledger data

import { insertPrice, getPriceHistory } from "../models/priceModel.mjs";
import db from "../config/database.js";

class PriceBackfiller {
  constructor(xrplService) {
    this.xrplService = xrplService;
    this.backfillInProgress = false;
    this.backfillStartTime = null;
    this.pricesBackfilled = 0;
  }

  async backfillMissingPrices() {
    if (this.backfillInProgress) {
      console.log("⏳ Backfill already in progress, skipping...");
      return;
    }

    this.backfillInProgress = true;
    this.backfillStartTime = new Date();
    this.pricesBackfilled = 0;

    try {
      console.log("📊 Starting price backfill process...");

      // Get gaps from price_gaps table
      const gapsResult = await db.query(
        "SELECT * FROM price_gaps ORDER BY start_time",
      );
      const gaps = gapsResult.rows;
      console.log(`   Found ${gaps.length} gaps to solve`);

      if (gaps.length === 0) {
        console.log("   No gaps to process, exiting backfill");
        return;
      }

      for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i];
        if (this.cancelled) {
          console.log("Backfill cancelled");
          break;
        }

        console.log(
          `   Processing gap ${i + 1}/${gaps.length} (ID: ${gap.id}): ${gap.start_time} to ${gap.end_time}`,
        );
        await this.solveGap(gap);
      }

      console.log(`Backfill completed: ${this.pricesBackfilled} prices added`);
    } catch (error) {
      console.error("Error during backfill:", error.message);
    } finally {
      this.backfillInProgress = false;
    }
  }

  async solveGap(gap) {
    // Find price before gap
    const beforeResult = await db.query(
      "SELECT ledger FROM xrp_price WHERE time < $1 ORDER BY time DESC LIMIT 1",
      [gap.start_time],
    );
    if (beforeResult.rows.length === 0) {
      console.log(`   No price before gap ${gap.id}, skipping`);
      return;
    }
    const beforeLedger = parseInt(beforeResult.rows[0].ledger);

    // Find price after gap
    const afterResult = await db.query(
      "SELECT ledger FROM xrp_price WHERE time > $1 ORDER BY time ASC LIMIT 1",
      [gap.end_time],
    );
    if (afterResult.rows.length === 0) {
      console.log(`   No price after gap ${gap.id}, skipping`);
      return;
    }
    const afterLedger = parseInt(afterResult.rows[0].ledger);

    // Estimate ledger range
    let startLedger = beforeLedger + 1;
    let endLedger = afterLedger - 1;

    if (startLedger > endLedger) {
      console.log(
        `   Invalid range for gap ${gap.id}: ${startLedger} - ${endLedger}, deleting invalid gap`,
      );
      await db.query("DELETE FROM price_gaps WHERE id = $1", [gap.id]);
      return;
    }

    // Skip gaps that require querying very old ledgers (before ~2024)
    const minLedger = 95000000; // Approximate ledger around 2024
    if (startLedger < minLedger) {
      console.log(
        `   Gap ${gap.id} requires old ledger ${startLedger}, deleting as unfillable`,
      );
      await db.query("DELETE FROM price_gaps WHERE id = $1", [gap.id]);
      return;
    }

    // Split into chunks to avoid large range queries
    const maxRange = 17;
    const chunks = [];
    for (let s = startLedger; s <= endLedger; s += maxRange) {
      const e = Math.min(s + maxRange - 1, endLedger);
      chunks.push({ start: s, end: e });
    }

    console.log(`   Split into ${chunks.length} chunks for gap ${gap.id}`);

    let totalInserted = 0;
    let allOutOfRange = true;
    let chunkIndex = 0;
    for (const chunk of chunks) {
      console.log(
        `Querying single ledger ${chunk.start} (${++chunkIndex}/${chunks.length}) for gap ${gap.id}`,
      );
      const result = await this.backfillLedgerRange(chunk.start, chunk.end);
      if (result === "outOfRange") {
        // skip
      } else {
        allOutOfRange = false;
        totalInserted += result;
        if (result > 0)
          console.log(`Price inserted at ledger ${chunk.start}, gap shrinking`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Rate limit for single queries
    }

    if (totalInserted > 0) {
      // Delete the gap since it was filled
      await db.query("DELETE FROM price_gaps WHERE id = $1", [gap.id]);
      console.log(`   ✅ Solved gap ${gap.id}, deleted from table`);
    } else if (allOutOfRange) {
      // Delete the gap since it's unfillable (out of server range)
      await db.query("DELETE FROM price_gaps WHERE id = $1", [gap.id]);
      console.log(`   🗑️ Deleted unfillable gap ${gap.id} (out of range)`);
    } else if (!allOutOfRange) {
      // Some chunks had data, so gap is likely invalid (prices exist)
      await db.query("DELETE FROM price_gaps WHERE id = $1", [gap.id]);
      console.log(
        `   🗑️ Deleted gap ${gap.id} (prices already exist or gap invalid)`,
      );
    } else {
      await db.query(
        "UPDATE price_gaps SET status = 'retry_later' WHERE id = $1",
        [gap.id],
      );
      console.log(`   ⏳ Marked gap ${gap.id} for retry later`);
    }
  }

  async backfillLedgerRange(startLedger, endLedger) {
    console.log(
      `   Querying Oracle TX for ledger range: ${startLedger} - ${endLedger}`,
    );

    let insertedCount = 0;
    try {
      const response = await this.xrplService.request({
        command: "account_tx",
        account: "rXUMMaPpZqPutoRszR29jtC8amWq3APkx",
        ledger_index_min: startLedger,
        ledger_index_max: endLedger,
        limit: 1000,
        forward: false,
      });

      if (response.result && response.result.transactions) {
        const transactions = response.result.transactions;
        console.log(`   Found ${transactions.length} TX in range`);

        for (const txWrapper of transactions) {
          try {
            const tx = txWrapper.tx_json || txWrapper.tx || txWrapper;
            if (
              tx.TransactionType === "TrustSet" &&
              tx.Account === "rXUMMaPpZqPutoRszR29jtC8amWq3APkx"
            ) {
              if (tx.LimitAmount && tx.LimitAmount.currency === "USD") {
                const price = parseFloat(tx.LimitAmount.value);
                if (!isNaN(price) && price > 0) {
                  const inserted = await insertPrice(
                    price,
                    tx.date
                      ? this.xrplService.rippleToUnixTime(tx.date)
                      : Date.now(),
                    tx.ledger_index || tx.inLedger,
                    tx.Sequence,
                  );
                  if (inserted) {
                    this.pricesBackfilled++;
                    insertedCount++;
                  }
                }
              }
            }
          } catch (txError) {
            console.warn("Warning: Could not process TX:", txError.message);
          }
        }
      } else {
        console.log("No TX found in range");
      }
    } catch (error) {
      console.error("Error querying account_tx:", error.message);
      // If out of range, return special value
      if (error.message.includes("ledgerSeqMinOutOfRange")) {
        return "outOfRange";
      }
    }
    return insertedCount;
  }

  async getPriceDataFromDB() {
    try {
      // Fetch prices from Jan 1, 2022, onwards for comprehensive gap detection
      const result = await getPriceHistory(
        "2022-01-01T00:00:00.000Z",
        new Date().toISOString(),
        100000,
      );
      return result;
    } catch (error) {
      console.error("Error fetching prices for gap tracking:", error.message);
      return [];
    }
  }

  getStatus() {
    return {
      backfillInProgress: this.backfillInProgress,
      pricesBackfilled: this.pricesBackfilled,
      backfillDuration: this.backfillStartTime
        ? Math.floor((Date.now() - this.backfillStartTime) / 1000) + "s"
        : "not started",
    };
  }
}

export default PriceBackfiller;
