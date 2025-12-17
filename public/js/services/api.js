// Rich-List API Service
// Handles all API communication with the backend

class APIService {
  constructor() {
    this.baseURL = window.location.origin;
    this.timeout = 30000;
    this.cache = new Map();
    this.cacheDuration = 300000; // 5 minutes
  }

  // Make API request
  async request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseURL}/api${endpoint}`;

    // Set longer timeout for large responses
    if (endpoint === "/graph") {
      options.timeout = 120000; // 2 minutes
    }

    // Check cache for GET requests (skip cache for /api/graph)
    if (
      method === "GET" &&
      !url.includes("/api/graph") &&
      this.cache.has(url)
    ) {
      const cached = this.cache.get(url);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }
      this.cache.delete(url);
    }

    const config = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      timeout: options.timeout || this.timeout,
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await Promise.race([
        fetch(url, config),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timeout")),
            config.timeout,
          ),
        ),
      ]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Cache successful GET responses
      if (method === "GET") {
        this.cache.set(url, {
          data: result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      console.error(`API Error (${method} ${endpoint}):`, error);
      throw error;
    }
  }

  // GET request
  async get(endpoint, options = {}) {
    return this.request("GET", endpoint, null, options);
  }

  // POST request
  async post(endpoint, data, options = {}) {
    return this.request("POST", endpoint, data, options);
  }

  // PUT request
  async put(endpoint, data, options = {}) {
    return this.request("PUT", endpoint, data, options);
  }

  // PATCH request
  async patch(endpoint, data, options = {}) {
    return this.request("PATCH", endpoint, data, options);
  }

  // DELETE request
  async delete(endpoint, options = {}) {
    return this.request("DELETE", endpoint, null, options);
  }

  // ============ API Endpoints ============

  // Health check
  async health() {
    return this.get("/health");
  }

  // Statistics
  async getStats() {
    return this.get("/stats");
  }

  // Rich List
  async getRichList(limit = 100, offset = 0) {
    return this.get(`/richlist?limit=${limit}&offset=${offset}`);
  }

  // Search account
  async searchAccount(accountId) {
    return this.get(`/search?account=${encodeURIComponent(accountId)}`);
  }

  // Price chart data
  async getPriceChart(timeframe = "1d") {
    return this.get(`/graph?timeframe=${timeframe}`);
  }

  // Escrow data
  async getEscrows(limit = 100, offset = 0) {
    return this.get(`/escrows?limit=${limit}&offset=${offset}`);
  }

  // Current price
  async getCurrentPrice() {
    return this.get("/price/latest");
  }

  // Price history
  async getPriceHistory(startDate, endDate) {
    return this.get(`/price/history?start=${startDate}&end=${endDate}`);
  }

  // Account details
  async getAccountDetails(accountId) {
    return this.get(`/account/${encodeURIComponent(accountId)}`);
  }

  // Account transactions
  async getAccountTransactions(accountId, limit = 50) {
    return this.get(
      `/account/${encodeURIComponent(accountId)}/transactions?limit=${limit}`,
    );
  }

  // Clear cache
  clearCache(endpoint = null) {
    if (endpoint) {
      const url = `${this.baseURL}/api${endpoint}`;
      this.cache.delete(url);
    } else {
      this.cache.clear();
    }
  }

  // Get cache info
  getCacheInfo() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Create and export singleton
const api = new APIService();

export { api, APIService };
export default api;
