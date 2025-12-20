import db from "../config/database.js";

// User analytics service for aggregating user data
class UserAnalytics {
  constructor() {
    this.isRunning = false;
  }

  // Run hourly aggregation
  async aggregateHourly() {
    try {
      console.log("Running hourly user aggregation...");

      // Get active user count for current hour
      const activeCount = await this.getCurrentActiveUsers();

      // Insert into hourly table
      await db.query(
        `
        INSERT INTO hourly_active_users (date, hour, active_users)
        VALUES (CURRENT_DATE, EXTRACT(hour FROM CURRENT_TIMESTAMP), $1)
        ON CONFLICT (date, hour) DO UPDATE SET
          active_users = $1,
          created_at = CURRENT_TIMESTAMP
      `,
        [activeCount],
      );

      console.log(`✓ Hourly aggregation complete: ${activeCount} active users`);
      return activeCount;
    } catch (error) {
      console.error("Error in hourly aggregation:", error);
      throw error;
    }
  }

  // Run daily aggregation
  async aggregateDaily() {
    try {
      console.log("Running daily user aggregation...");

      // Calculate daily active users from hourly data
      const result = await db.query(`
        SELECT AVG(active_users) as daily_avg
        FROM hourly_active_users
        WHERE date = CURRENT_DATE
      `);

      const dailyActive = Math.round(result.rows[0]?.daily_avg || 0);

      // Insert into daily table
      await db.query(
        `
        INSERT INTO daily_active_users (date, active_users)
        VALUES (CURRENT_DATE, $1)
        ON CONFLICT (date) DO UPDATE SET
          active_users = $1,
          created_at = CURRENT_TIMESTAMP
      `,
        [dailyActive],
      );

      console.log(
        `✓ Daily aggregation complete: ${dailyActive} average active users`,
      );
      return dailyActive;
    } catch (error) {
      console.error("Error in daily aggregation:", error);
      throw error;
    }
  }

  // Run weekly aggregation
  async aggregateWeekly() {
    try {
      console.log("Running weekly user aggregation...");

      // Calculate weekly active users (max daily users in the week)
      const result = await db.query(`
        SELECT MAX(active_users) as weekly_max
        FROM daily_active_users
        WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
          AND date < DATE_TRUNC('week', CURRENT_DATE + INTERVAL '1 week')
      `);

      const weeklyActive = result.rows[0]?.weekly_max || 0;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)

      // Insert into weekly table
      await db.query(
        `
        INSERT INTO weekly_active_users (week_start, active_users)
        VALUES ($1, $2)
        ON CONFLICT (week_start) DO UPDATE SET
          active_users = $2,
          created_at = CURRENT_TIMESTAMP
      `,
        [weekStart.toISOString().split("T")[0], weeklyActive],
      );

      console.log(
        `✓ Weekly aggregation complete: ${weeklyActive} max active users`,
      );
      return weeklyActive;
    } catch (error) {
      console.error("Error in weekly aggregation:", error);
      throw error;
    }
  }

  // Run monthly aggregation
  async aggregateMonthly() {
    try {
      console.log("Running monthly user aggregation...");

      // Calculate monthly active users (max daily users in the month)
      const result = await db.query(`
        SELECT MAX(active_users) as monthly_max
        FROM daily_active_users
        WHERE EXTRACT(year FROM date) = EXTRACT(year FROM CURRENT_DATE)
          AND EXTRACT(month FROM date) = EXTRACT(month FROM CURRENT_DATE)
      `);

      const monthlyActive = result.rows[0]?.monthly_max || 0;

      // Insert into monthly table
      await db.query(
        `
        INSERT INTO monthly_active_users (year, month, active_users)
        VALUES (EXTRACT(year FROM CURRENT_DATE), EXTRACT(month FROM CURRENT_DATE), $1)
        ON CONFLICT (year, month) DO UPDATE SET
          active_users = $1,
          created_at = CURRENT_TIMESTAMP
      `,
        [monthlyActive],
      );

      console.log(
        `✓ Monthly aggregation complete: ${monthlyActive} max active users`,
      );
      return monthlyActive;
    } catch (error) {
      console.error("Error in monthly aggregation:", error);
      throw error;
    }
  }

  // Run yearly aggregation
  async aggregateYearly() {
    try {
      console.log("Running yearly user aggregation...");

      // Calculate yearly active users (max monthly users in the year)
      const result = await db.query(`
        SELECT MAX(active_users) as yearly_max
        FROM monthly_active_users
        WHERE year = EXTRACT(year FROM CURRENT_DATE)
      `);

      const yearlyActive = result.rows[0]?.yearly_max || 0;

      // Insert into yearly table
      await db.query(
        `
        INSERT INTO yearly_active_users (year, active_users)
        VALUES (EXTRACT(year FROM CURRENT_DATE), $1)
        ON CONFLICT (year) DO UPDATE SET
          active_users = $1,
          created_at = CURRENT_TIMESTAMP
      `,
        [yearlyActive],
      );

      console.log(
        `✓ Yearly aggregation complete: ${yearlyActive} max active users`,
      );
      return yearlyActive;
    } catch (error) {
      console.error("Error in yearly aggregation:", error);
      throw error;
    }
  }

  // Get current active users
  async getCurrentActiveUsers() {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM active_user_sessions
        WHERE last_activity > CURRENT_TIMESTAMP - INTERVAL '30 minutes'
      `);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error("Error getting current active users:", error);
      return 0;
    }
  }

  // Get analytics data for charts
  async getAnalyticsData(period, interval) {
    try {
      let query,
        params = [];

      switch (period) {
        case "daily":
          if (interval === "1h") {
            // Last 24 hours of hourly data
            query = `
              SELECT
                date || ' ' || LPAD(hour::text, 2, '0') || ':00:00' as label,
                active_users as value
              FROM hourly_active_users
              WHERE (date = CURRENT_DATE AND hour <= EXTRACT(hour FROM CURRENT_TIMESTAMP))
                 OR (date = CURRENT_DATE - INTERVAL '1 day' AND hour > EXTRACT(hour FROM CURRENT_TIMESTAMP))
              ORDER BY date, hour
              LIMIT 24
            `;
          } else if (interval === "1d") {
            // Last 7 days of daily data
            query = `
              SELECT
                date::text as label,
                active_users as value
              FROM daily_active_users
              WHERE date >= CURRENT_DATE - INTERVAL '7 days'
              ORDER BY date
            `;
          }
          break;

        case "weekly":
          if (interval === "1d") {
            // Daily data for current week
            query = `
              SELECT
                date::text as label,
                active_users as value
              FROM daily_active_users
              WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
              ORDER BY date
            `;
          } else if (interval === "1w") {
            // Weekly data for last 4 weeks
            query = `
              SELECT
                week_start::text as label,
                active_users as value
              FROM weekly_active_users
              WHERE week_start >= CURRENT_DATE - INTERVAL '4 weeks'
              ORDER BY week_start
            `;
          }
          break;

        case "monthly":
          if (interval === "1d") {
            // Daily data for current month
            query = `
              SELECT
                date::text as label,
                active_users as value
              FROM daily_active_users
              WHERE EXTRACT(year FROM date) = EXTRACT(year FROM CURRENT_DATE)
                AND EXTRACT(month FROM date) = EXTRACT(month FROM CURRENT_DATE)
              ORDER BY date
            `;
          } else if (interval === "1w") {
            // Weekly data for current quarter
            query = `
              SELECT
                week_start::text as label,
                active_users as value
              FROM weekly_active_users
              WHERE week_start >= DATE_TRUNC('quarter', CURRENT_DATE)
              ORDER BY week_start
            `;
          } else if (interval === "1M") {
            // Monthly data for last 12 months
            query = `
              SELECT
                year || '-' || LPAD(month::text, 2, '0') as label,
                active_users as value
              FROM monthly_active_users
              WHERE (year = EXTRACT(year FROM CURRENT_DATE) AND month <= EXTRACT(month FROM CURRENT_DATE))
                 OR (year = EXTRACT(year FROM CURRENT_DATE) - 1 AND month > EXTRACT(month FROM CURRENT_DATE))
              ORDER BY year, month
              LIMIT 12
            `;
          }
          break;

        case "yearly":
          if (interval === "1M") {
            // Monthly data for current year
            query = `
              SELECT
                year || '-' || LPAD(month::text, 2, '0') as label,
                active_users as value
              FROM monthly_active_users
              WHERE year = EXTRACT(year FROM CURRENT_DATE)
              ORDER BY month
            `;
          } else if (interval === "1y") {
            // Yearly data for last 5 years
            query = `
              SELECT
                year::text as label,
                active_users as value
              FROM yearly_active_users
              WHERE year >= EXTRACT(year FROM CURRENT_DATE) - 4
              ORDER BY year
            `;
          }
          break;
      }

      if (!query) {
        return { labels: [], data: [] };
      }

      const result = await db.query(query, params);
      return {
        labels: result.rows.map((row) => row.label),
        data: result.rows.map((row) => row.value),
      };
    } catch (error) {
      console.error("Error getting analytics data:", error);
      return { labels: [], data: [] };
    }
  }

  // Export all data to CSV
  async exportAllToCSV() {
    try {
      // Get all tables data and combine into CSV
      const tables = [
        "hourly_active_users",
        "daily_active_users",
        "weekly_active_users",
        "monthly_active_users",
        "yearly_active_users",
      ];

      let csv = "Table,Date/Time,Active Users\n";

      for (const table of tables) {
        const result = await db.query(
          `SELECT * FROM ${table} ORDER BY created_at`,
        );

        for (const row of result.rows) {
          let dateStr = "";
          if (table === "hourly_active_users") {
            dateStr = `${row.date} ${String(row.hour).padStart(2, "0")}:00:00`;
          } else if (table === "daily_active_users") {
            dateStr = row.date.toISOString().split("T")[0];
          } else if (table === "weekly_active_users") {
            dateStr = row.week_start.toISOString().split("T")[0];
          } else if (table === "monthly_active_users") {
            dateStr = `${row.year}-${String(row.month).padStart(2, "0")}-01`;
          } else if (table === "yearly_active_users") {
            dateStr = `${row.year}-01-01`;
          }

          csv += `${table},${dateStr},${row.active_users}\n`;
        }
      }

      return csv;
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      throw error;
    }
  }

  // Start aggregation jobs
  startAggregationJobs() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log("Starting user analytics aggregation jobs...");

    // Hourly aggregation - every hour at :00
    const hourlyJob = setInterval(() => {
      const now = new Date();
      if (now.getMinutes() === 0) {
        // Run at the top of each hour
        this.aggregateHourly().catch(console.error);
      }
    }, 60 * 1000); // Check every minute

    // Daily aggregation - every day at 23:59
    const dailyJob = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 23 && now.getMinutes() === 59) {
        this.aggregateDaily().catch(console.error);
      }
    }, 60 * 1000);

    // Weekly aggregation - every Sunday at 23:59
    const weeklyJob = setInterval(() => {
      const now = new Date();
      if (
        now.getDay() === 0 &&
        now.getHours() === 23 &&
        now.getMinutes() === 59
      ) {
        this.aggregateWeekly().catch(console.error);
      }
    }, 60 * 1000);

    // Monthly aggregation - last day of month at 23:59
    const monthlyJob = setInterval(() => {
      const now = new Date();
      const lastDayOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      if (
        now.getDate() === lastDayOfMonth &&
        now.getHours() === 23 &&
        now.getMinutes() === 59
      ) {
        this.aggregateMonthly().catch(console.error);
      }
    }, 60 * 1000);

    // Yearly aggregation - December 31 at 23:59
    const yearlyJob = setInterval(() => {
      const now = new Date();
      if (
        now.getMonth() === 11 &&
        now.getDate() === 31 &&
        now.getHours() === 23 &&
        now.getMinutes() === 59
      ) {
        this.aggregateYearly().catch(console.error);
      }
    }, 60 * 1000);

    // Session cleanup - every 5 minutes
    const cleanupJob = setInterval(
      () => {
        // Import sessionTracker here to avoid circular dependency
        import("./sessionTracker.js").then(({ default: sessionTracker }) => {
          sessionTracker.cleanupExpiredSessions().catch(console.error);
        });
      },
      5 * 60 * 1000,
    );

    console.log("✓ User analytics aggregation jobs started");
  }

  // Stop aggregation jobs
  stopAggregationJobs() {
    this.isRunning = false;
    console.log("User analytics aggregation jobs stopped");
  }
}

// Export singleton instance
const userAnalytics = new UserAnalytics();
export default userAnalytics;
