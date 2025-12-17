// Logger Module - Reusable for all backup/restore operations
// Logs to both file and console with timestamps

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor(logFileName = 'app.log') {
    this.logDir = path.join(__dirname, 'logs');
    this.logFilePath = path.join(this.logDir, logFileName);
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Format timestamp in ISO 8601 with milliseconds
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with timestamp and level
   */
  formatMessage(level, message) {
    return `[${this.getTimestamp()}] ${level}: ${message}`;
  }

  /**
   * Write to both console and file
   */
  write(level, message) {
    const formatted = this.formatMessage(level, message);
    
    // Console output
    if (level === 'ERROR') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
    
    // File output
    try {
      fs.appendFileSync(this.logFilePath, formatted + '\n');
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  info(message) {
    this.write('INFO', message);
  }

  warn(message) {
    this.write('WARN', message);
  }

  error(message) {
    this.write('ERROR', message);
  }

  debug(message) {
    this.write('DEBUG', message);
  }

  /**
   * Log operation start
   */
  start(operation) {
    this.info(`${operation}_START`);
  }

  /**
   * Log operation success
   */
  success(operation, details = '') {
    const msg = details ? `${operation}_SUCCESS - ${details}` : `${operation}_SUCCESS`;
    this.info(msg);
  }

  /**
   * Log operation failure
   */
  failure(operation, error) {
    this.error(`${operation}_FAILURE - ${error.message || error}`);
  }

  /**
   * Get log file path (for reference)
   */
  getLogPath() {
    return this.logFilePath;
  }
}

export default Logger;
