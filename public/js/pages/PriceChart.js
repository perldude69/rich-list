// Price Chart Page Component
// Interactive price charts with timeframe selectors

import store from "../store.js";
import api from "../services/api.js";
import socket from "../services/socket.js";
import oracleService from "../services/oracleService.js";
import { renderNavbar, attachNavbarListeners } from "../components/navbar.js";

class PriceChart {
  constructor() {
    this.name = "PriceChart";
    this.container = document.getElementById("app");
    this.priceData = null;
    this.chartInstance = null;
    this.updateIndicator = null;
    this.currentPeriod = "30d";
    this.currentInterval = "4h";
  }

  async render() {
    this.container.innerHTML = `
      <div class="layout">
        ${renderNavbar()}

        <div class="main-content">
          <div class="container">
            <h1>Price Chart</h1>
              <p class="text-muted">XRP/USD price analysis and trends</p>

              <div class="card mt-3">
              <div class="card-header">
                <h3>Current Price</h3>
              </div>
              <div class="card-body">
                <div class="grid grid-4" id="price-stats">
                  <div>
                    <h4>Current Price</h4>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #28a745;" id="current-price">$0.00</p>
                  </div>
                  <div>
                    <h4>24h High</h4>
                    <p style="font-size: 1.5rem; font-weight: bold;" id="high-price">$0.00</p>
                  </div>
                  <div>
                    <h4>24h Low</h4>
                    <p style="font-size: 1.5rem; font-weight: bold;" id="low-price">$0.00</p>
                  </div>
                  <div>
                    <h4>Timestamp</h4>
                    <p style="font-size: 0.9rem;" id="price-timestamp">--:--:--</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="card mt-3">
              <div class="card-header">
                <h3 style="display: flex; align-items: center; gap: 10px;">
                  Price Chart
                  <div id="price-connection-indicator" class="price-indicator" style="width: 12px; height: 12px; border-radius: 50%; background-color: #dc3545; display: inline-block;"></div>
                </h3>
              </div>
              <div class="card-body">
                <div class="chart-container" style="position: relative; height: 400px; margin-bottom: 20px;">
                  <canvas id="priceChart"></canvas>
                </div>
                
                <div class="chart-controls-panel">
                  <h4 style="margin-top: 0; margin-bottom: 12px;">Chart Controls</h4>
                  
                  <div style="margin-bottom: 12px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Period:</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <button class="period-btn" data-period="1d">1d</button>
                      <button class="period-btn" data-period="7d">7d</button>
                      <button class="period-btn active" data-period="30d">30d</button>
                      <button class="period-btn" data-period="90d">90d</button>
                      <button class="period-btn" data-period="1y">1y</button>
                      <button class="period-btn" data-period="3y">3y</button>
                      <button class="period-btn" data-period="all">All</button>
                    </div>
                  </div>

                  <div style="margin-bottom: 12px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Interval:</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <button class="interval-btn" data-interval="1m">1m</button>
                      <button class="interval-btn" data-interval="1h">1h</button>
                      <button class="interval-btn active" data-interval="4h">4h</button>
                      <button class="interval-btn" data-interval="12h">12h</button>
                      <button class="interval-btn" data-interval="1d">1d</button>
                      <button class="interval-btn" data-interval="1w">1w</button>
                      <button class="interval-btn" data-interval="1M">1M</button>
                    </div>
                  </div>

                   <button id="refreshChart" class="chart-refresh-btn">Refresh Chart</button>
                 </div>

                 <div style="margin-top: 20px; padding: 16px; border-top: 1px solid #dee2e6;">
                   <h4 style="margin-top: 0;">Download Price History</h4>
                   <button id="download-csv-btn" class="btn btn-secondary">Download CSV (ZIP)</button>
                 </div>

                 <div style="margin-top: 20px; padding: 16px; background-color: #f9f9f9; border-left: 4px solid #007bff; border-radius: 4px;">
                   <h4 style="margin-top: 0;">About Price Data</h4>
                   <p style="margin: 8px 0; font-size: 0.9rem;">
                     The displayed prices are not official exchange rates. They are sourced from diverse third-party sources and are generally accurate.
                   </p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize navbar listeners
    attachNavbarListeners();

    // Set up event listeners
    this.setupEventListeners();

    // Update interval buttons based on current period
    this.updateIntervalButtons();

    // Set up real-time update listeners
    this.setupRealtimeUpdates();

    // Load initial data
    await this.loadPrice();
    await this.loadChartData();
  }

  setupEventListeners() {
    // Period buttons
    document.querySelectorAll(".period-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".period-btn").forEach((b) => {
          b.classList.remove("active");
        });
        e.target.classList.add("active");
        this.currentPeriod = e.target.dataset.period;
        this.updateIntervalButtons();
        this.loadChartData();
      });
    });

    // Interval buttons
    document.querySelectorAll(".interval-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".interval-btn").forEach((b) => {
          b.classList.remove("active");
        });
        e.target.classList.add("active");
        this.currentInterval = e.target.dataset.interval;
        this.loadChartData();
      });
    });

    // Refresh button
    const refreshBtn = document.getElementById("refreshChart");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.loadChartData();
      });
    }

    // Download button
    const downloadCsvBtn = document.getElementById("download-csv-btn");
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener("click", () => {
        window.location.href = "/api/price/export/csv";
      });
    }
  }

  setupRealtimeUpdates() {
    // Listen for real-time price updates from socket
    socket.on("price:update", (message) => {
      if (message.success && message.data) {
        this.priceData = message.data;
        this.displayPrice();
        this.updateConnectionIndicator(true);
      }
    });

    // Listen for oracle price updates
    oracleService.addListener((event, data) => {
      if (event === "priceUpdated" && data.price) {
        // Update price data with oracle price
        if (this.priceData) {
          this.priceData.price = data.price;
          this.priceData.timestamp = data.timestamp;
          this.displayPrice();
        }
      }
    });

    // Listen for connection events
    socket.on("connected", () => {
      this.updateConnectionIndicator(true);
    });

    socket.on("disconnected", () => {
      this.updateConnectionIndicator(false);
    });

    // Subscribe to real-time updates
    socket.subscribe("price");

    // Set initial indicator state based on socket connection status
    this.updateConnectionIndicator(socket.isConnected);
  }

  updateConnectionIndicator(isConnected) {
    const indicator = document.getElementById("price-connection-indicator");
    if (!indicator) return;

    if (isConnected) {
      indicator.classList.remove("disconnected");
      indicator.classList.add("connected");
      indicator.style.backgroundColor = "#28a745";
    } else {
      indicator.classList.remove("connected");
      indicator.classList.add("disconnected");
      indicator.style.backgroundColor = "#dc3545";
    }
  }

  updateIntervalButtons() {
    const isAllPeriod = this.currentPeriod === "all";
    const isOneYearPeriod = this.currentPeriod === "1y";
    const isThreeYearPeriod = this.currentPeriod === "3y";
    const intervalButtons = document.querySelectorAll(".interval-btn");

    intervalButtons.forEach((btn) => {
      const interval = btn.dataset.interval;
      if (isAllPeriod && ["1m", "1h", "4h", "12h"].includes(interval)) {
        btn.disabled = true;
        btn.classList.add("disabled");
      } else if (
        (isOneYearPeriod || isThreeYearPeriod) &&
        ["1m", "1h", "4h"].includes(interval)
      ) {
        btn.disabled = true;
        btn.classList.add("disabled");
      } else if (isThreeYearPeriod && ["12h"].includes(interval)) {
        btn.disabled = true;
        btn.classList.add("disabled");
      } else {
        btn.disabled = false;
        btn.classList.remove("disabled");
      }
    });

    // Default intervals for each period
    if (
      isAllPeriod &&
      ["1m", "1h", "4h", "12h"].includes(this.currentInterval)
    ) {
      this.currentInterval = "1M";
      document.querySelectorAll(".interval-btn").forEach((b) => {
        b.classList.remove("active");
        if (b.dataset.interval === "1M") {
          b.classList.add("active");
        }
      });
    } else if (
      (isOneYearPeriod || isThreeYearPeriod) &&
      ["1m", "1h", "4h"].includes(this.currentInterval)
    ) {
      this.currentInterval = "1M";
      document.querySelectorAll(".interval-btn").forEach((b) => {
        b.classList.remove("active");
        if (b.dataset.interval === "1M") {
          b.classList.add("active");
        }
      });
    } else if (isThreeYearPeriod && ["12h"].includes(this.currentInterval)) {
      this.currentInterval = "1M";
      document.querySelectorAll(".interval-btn").forEach((b) => {
        b.classList.remove("active");
        if (b.dataset.interval === "1M") {
          b.classList.add("active");
        }
      });
    }
  }

  async loadPrice() {
    store.setLoading(true);
    try {
      const response = await api.get("/price/latest");
      this.priceData = response.data;
      this.displayPrice();
    } catch (error) {
      store.setError(`Failed to load price data: ${error.message}`);
      this.displayError();
    } finally {
      store.setLoading(false);
    }
  }

  async loadChartData() {
    store.setLoading(true);
    try {
      let endpoint = `/graph?timeframe=${this.currentPeriod}&interval=${this.currentInterval}`;
      const response = await api.get(endpoint);

      if (response.data && Array.isArray(response.data)) {
        this.drawChart(response.data);
      }
    } catch (error) {
      console.error("Failed to load chart data:", error);
      store.setError(`Failed to load chart data: ${error.message}`);
    } finally {
      store.setLoading(false);
    }
  }

  drawChart(priceData) {
    if (!priceData || priceData.length === 0) {
      return;
    }

    // Apply interval aggregation
    const aggregatedData = this.aggregateData(priceData);

    // Prepare chart data
    const labels = aggregatedData.map((d) => {
      const date = new Date(d.timestamp);
      // For longer periods, include year
      if (
        this.currentPeriod === "90d" ||
        this.currentPeriod === "1y" ||
        this.currentPeriod === "3y" ||
        this.currentPeriod === "all"
      ) {
        return date.toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      } else {
        return date.toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
    });

    const prices = aggregatedData.map((d) =>
      parseFloat(d.price || 0).toFixed(4),
    );

    // Calculate min and max for better scaling
    const priceValues = prices.map((p) => parseFloat(p));
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const range = maxPrice - minPrice;
    const padding = range * 0.1;

    // Destroy existing chart if it exists
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = document.getElementById("priceChart");
    if (!ctx) return;

    this.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "XRP/USD Price",
            data: prices,
            borderColor: "#007bff",
            backgroundColor: "rgba(0, 123, 255, 0.05)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 2,
            pointBackgroundColor: "#007bff",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              font: { size: 12 },
              padding: 15,
            },
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            callbacks: {
              label: function (context) {
                return `Price: $${parseFloat(context.parsed.y).toFixed(4)}`;
              },
            },
          },
        },
        scales: {
          y: {
            min: minPrice - padding,
            max: maxPrice + padding,
            ticks: {
              callback: function (value) {
                return "$" + parseFloat(value).toFixed(4);
              },
              font: { size: 11 },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
          },
          x: {
            ticks: {
              maxTicksLimit: 10,
              font: { size: 11 },
              // For longer periods, show fewer ticks to avoid crowding
              maxRotation: 45,
              minRotation: 45,
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }

  aggregateData(data) {
    if (!data || data.length === 0) return [];

    // Server-side aggregation is now handling most cases
    // This method serves as a safety net to limit points for charting performance
    const MAX_POINTS = 1000;

    if (data.length <= MAX_POINTS) {
      return data;
    }

    // Sample down to MAX_POINTS if server returned too many points
    const aggregated = [];
    const step = Math.max(1, Math.floor(data.length / MAX_POINTS));

    for (let i = 0; i < data.length; i += step) {
      aggregated.push(data[i]);
    }

    return aggregated.length > 0 ? aggregated : data.slice(0, MAX_POINTS);
  }

  displayPrice() {
    if (!this.priceData) return;

    const data = this.priceData;
    const formatPrice = (num) => {
      return parseFloat(num).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
    };

    // Handle both old and new price data formats
    const currentPrice = data.price || data.close || 0;
    const high = data.high || currentPrice;
    const low = data.low || currentPrice;

    // Format timestamp
    const timestamp = data.timestamp
      ? new Date(data.timestamp).toLocaleTimeString()
      : "N/A";

    // Update current price
    const priceEl = document.getElementById("current-price");
    if (priceEl) {
      priceEl.textContent = formatPrice(currentPrice);
    }

    const highEl = document.getElementById("high-price");
    if (highEl) {
      highEl.textContent = formatPrice(high);
    }

    const lowEl = document.getElementById("low-price");
    if (lowEl) {
      lowEl.textContent = formatPrice(low);
    }

    const tsEl = document.getElementById("price-timestamp");
    if (tsEl) {
      tsEl.textContent = timestamp;
    }
  }

  displayError() {
    const priceStats = document.getElementById("price-stats");
    if (priceStats) {
      priceStats.innerHTML =
        '<div class="alert alert-danger" style="grid-column: 1/-1;">Failed to load price data</div>';
    }
  }
}

export { PriceChart };
