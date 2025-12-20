import crypto from "crypto";
import db from "../config/database.js";

// Session tracking service for anonymous user analytics
class SessionTracker {
  constructor() {
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
  }

  // Generate anonymous session hash from IP + User-Agent
  generateSessionHash(req) {
    const fingerprint = `${req.ip}-${req.headers["user-agent"]}-${Date.now()}`;
    return crypto
      .createHash("sha256")
      .update(fingerprint)
      .digest("hex")
      .substring(0, 16);
  }

  // Hash IP address for privacy
  hashIP(ip) {
    return crypto
      .createHash("sha256")
      .update(ip || "")
      .digest("hex")
      .substring(0, 16);
  }

  // Hash User-Agent for privacy
  hashUserAgent(userAgent) {
    return crypto
      .createHash("sha256")
      .update(userAgent || "")
      .digest("hex")
      .substring(0, 16);
  }

  // Track user activity - called on every API request
  async trackActivity(req) {
    try {
      const sessionHash = this.generateSessionHash(req);
      const ipHash = this.hashIP(req.ip);
      const userAgentHash = this.hashUserAgent(req.headers["user-agent"]);

      // Insert or update session
      await db.query(
        `
        INSERT INTO active_user_sessions (session_hash, last_activity, ip_hash, user_agent_hash)
        VALUES ($1, CURRENT_TIMESTAMP, $2, $3)
        ON CONFLICT (session_hash) DO UPDATE SET
          last_activity = CURRENT_TIMESTAMP
      `,
        [sessionHash, ipHash, userAgentHash],
      );

      return sessionHash;
    } catch (error) {
      console.error("Error tracking user activity:", error);
      // Don't throw - we don't want analytics to break the app
    }
  }

  // Get current active user count
  async getActiveUserCount() {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM active_user_sessions
        WHERE last_activity > CURRENT_TIMESTAMP - INTERVAL '30 minutes'
      `);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error("Error getting active user count:", error);
      return 0;
    }
  }

  // Clean up expired sessions (called periodically)
  async cleanupExpiredSessions() {
    try {
      const result = await db.query(`
        DELETE FROM active_user_sessions
        WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '30 minutes'
      `);

      if (result.rowCount > 0) {
        console.log(`Cleaned up ${result.rowCount} expired user sessions`);
      }

      return result.rowCount;
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
      return 0;
    }
  }

  // Get session statistics
  async getSessionStats() {
    try {
      const result = await db.query(`
        SELECT
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN last_activity > CURRENT_TIMESTAMP - INTERVAL '30 minutes' THEN 1 END) as active_sessions,
          COUNT(CASE WHEN last_activity > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as sessions_24h
        FROM active_user_sessions
      `);
      return result.rows[0];
    } catch (error) {
      console.error("Error getting session stats:", error);
      return { total_sessions: 0, active_sessions: 0, sessions_24h: 0 };
    }
  }
}

// Export singleton instance
const sessionTracker = new SessionTracker();
export default sessionTracker;
