// Gap Tracker Service
// Monitors and tracks price data gaps for alerting and analytics

import { getPriceHistory } from "../models/priceModel.mjs";
import db from "../config/database.js";

class GapTracker {
  constructor() {
    this.isRunning = false;
  }

  async scanForGaps() {
    try {
      console.log("🔍 Starting gap scanning...");

      const existingPrices = await this.getPriceDataFromDB();
      console.log(
        `Found ${existingPrices.length} existing prices (from 2022-01-01)`,
      );

      const gaps = this.identifyGaps(existingPrices);
      console.log(`Identified ${gaps.length} gaps`);

      // Insert gaps into price_gaps table
      for (const gap of gaps) {
        try {
          await db.query(
            "INSERT INTO price_gaps (start_time, end_time) VALUES ($1, $2)",
            [gap.startTime, gap.endTime],
          );
        } catch (error) {
          console.error("Error inserting gap:", error.message);
        }
      }

      console.log(`✅ Inserted ${gaps.length} gaps into price_gaps table`);
    } catch (error) {
      console.error("Error during gap scanning:", error.message);
    }
  }

  identifyGaps(existingPrices) {
    const gaps = [];
    const TIME_THRESHOLD = 120000; // 2 minutes in ms
    const MAX_GAPS = 10000;

    // Sort by time
    existingPrices.sort((a, b) => new Date(a.time) - new Date(b.time));

    if (existingPrices.length === 0) return gaps;

    let lastTime = new Date(existingPrices[0].time);

    for (let i = 1; i < existingPrices.length && gaps.length < MAX_GAPS; i++) {
      const currentTime = new Date(existingPrices[i].time);

      if (currentTime - lastTime > TIME_THRESHOLD) {
        gaps.push({
          startTime: lastTime,
          endTime: currentTime,
        });
      }

      lastTime = currentTime;
    }

    // Check for ongoing gap
    const currentTime = new Date();
    if (currentTime - lastTime > TIME_THRESHOLD && gaps.length < MAX_GAPS) {
      gaps.push({
        startTime: lastTime,
        endTime: currentTime,
      });
    }

    // Filter out invalid gaps (e.g., future dates)
    const validGaps = gaps.filter(
      (gap) => gap.startTime <= currentTime && gap.endTime <= currentTime,
    );

    return validGaps;
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

  async getCurrentGaps() {
    try {
      const result = await db.query(
        "SELECT * FROM price_gaps ORDER BY start_time",
      );
      return result.rows;
    } catch (error) {
      console.error("Error getting current gaps:", error.message);
      return [];
    }
  }
}

export default GapTracker;
