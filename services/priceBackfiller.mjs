// Price Backfiller Service
// Backfills missing XRP prices from the oracle account in historical ledger data

import { insertPrice, getPriceHistory } from "../models/priceModel.mjs";

class PriceBackfiller {
  constructor(xrplService) {
    this.xrplService = xrplService;
    this.backfillInProgress = false;
    this.backfillStartTime = null;
    this.pricesBackfilled = 0;
  }

  async start() {
    try {
      if (!this.xrplService.isConnected) {
        console.log(
          "⏳ Waiting for XRPL connection before starting backfill...",
        );
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

      await this.backfillMissingPrices();
      console.log("✅ Price backfill completed");
    } catch (error) {
      console.error("❌ Error during price backfill:", error.message);
    }
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

      // Get current ledger index and available ledger range
      const serverInfo = await this.xrplService.request({
        command: "server_info",
      });

      const currentLedger = serverInfo.result.info.validated_ledger.seq;

      // Parse complete_ledgers to get oldest available
      let oldestLedger = 1;
      if (serverInfo.result.info.complete_ledgers) {
        const ledgerRange = serverInfo.result.info.complete_ledgers;
        const parts = ledgerRange.split("-");
        if (parts.length === 2) {
          oldestLedger = parseInt(parts[0]);
        }
      }

      console.log(`   Current ledger: ${currentLedger}`);
      console.log(`   Oldest available ledger: ${oldestLedger}`);

      // Get existing prices to find gaps
      const existingPrices = await this.getPriceDataFromDB();
      console.log(
        `   Found ${existingPrices.length} existing prices in database`,
      );

      if (existingPrices.length === 0) {
        console.log(
          "   No existing prices, starting from recent available ledgers...",
        );
        // Backfill recent ledgers that are available on server
        const startLedger = Math.max(oldestLedger, currentLedger - 1000);
        await this.backfillLedgerRange(startLedger, currentLedger);
      } else {
        // Find gaps and backfill only those within available ledger range
        const gaps = this.identifyGaps(existingPrices, currentLedger);
        console.log(`   Identified ${gaps.length} gaps in price data`);

        for (const gap of gaps) {
          // Only backfill gaps that are within available ledger range on server
          const backfillStart = Math.max(gap.start, oldestLedger);
          const backfillEnd = Math.min(gap.end, currentLedger);

          if (backfillStart <= backfillEnd) {
            console.log(
              `   Backfilling available gap: ${backfillStart} - ${backfillEnd}`,
            );
            await this.backfillLedgerRange(backfillStart, backfillEnd);
          } else {
            console.log(
              `   Skipping gap ${gap.start} - ${gap.end} (outside available ledger range)`,
            );
          }
        }
      }

      console.log(
        `✅ Backfill completed: ${this.pricesBackfilled} prices added`,
      );
    } catch (error) {
      console.error("Error during backfill:", error.message);
    } finally {
      this.backfillInProgress = false;
    }
  }

  identifyGaps(existingPrices, currentLedger) {
    const gaps = [];
    const SAMPLE_SIZE = 100; // Check every 100 ledgers

    // Sort by ledger index
    existingPrices.sort((a, b) => (a.ledger || 0) - (b.ledger || 0));

    let lastLedger = 0;

    for (const price of existingPrices) {
      const priceLedger = price.ledger || 0;

      // Check for gap
      if (priceLedger - lastLedger > SAMPLE_SIZE) {
        gaps.push({
          start: lastLedger + 1,
          end: priceLedger - 1,
        });
      }

      lastLedger = priceLedger;
    }

    // Check if there's a gap between last known price and current ledger
    if (currentLedger - lastLedger > SAMPLE_SIZE) {
      gaps.push({
        start: lastLedger + 1,
        end: currentLedger,
      });
    }

    return gaps;
  }

  async backfillLedgerRange(startLedger, endLedger) {
    const BATCH_SIZE = 50; // Check 50 ledgers at a time
    const SAMPLE_RATE = 10; // Sample every 10th ledger to reduce API calls

    console.log(`   Backfilling ledger range: ${startLedger} - ${endLedger}`);

    for (let ledger = startLedger; ledger <= endLedger; ledger += SAMPLE_RATE) {
      try {
        // Extract price from ledger
        const priceData = await this.xrplService.extractPriceFromLedger(ledger);

        if (priceData && priceData.price) {
          // Insert into database
          try {
            await insertPrice(
              priceData.price,
              priceData.timestamp,
              priceData.ledgerIndex,
              null,
            );
            this.pricesBackfilled++;
          } catch (dbError) {
            // ON CONFLICT will silently skip duplicates, so ignore
            if (!dbError.message.includes("duplicate")) {
              console.error(
                `Error inserting price for ledger ${ledger}:`,
                dbError.message,
              );
            }
          }
        }

        // Progress indicator
        if ((ledger - startLedger) % (BATCH_SIZE * SAMPLE_RATE) === 0) {
          const progress = Math.floor(
            ((ledger - startLedger) / (endLedger - startLedger)) * 100,
          );
          console.log(
            `      Progress: ${progress}% (${this.pricesBackfilled} prices added)`,
          );
        }
      } catch (error) {
        console.warn(
          `   Warning: Could not extract price from ledger ${ledger}:`,
          error.message,
        );
      }

      // Small delay to avoid overwhelming the Clio server
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async getPriceDataFromDB() {
    try {
      // Get all prices from database (limit to recent to avoid timeout)
      const result = await getPriceHistory(
        "1970-01-01",
        new Date().toISOString(),
        10000,
      );
      return result;
    } catch (error) {
      console.error("Error fetching prices from database:", error.message);
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
