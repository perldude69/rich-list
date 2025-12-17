// Current Stats Page Component
// Real-time ledger statistics and metrics from stats table

import store from "../store.js";
import api from "../services/api.js";
import socket from "../services/socket.js";
import { renderNavbar, attachNavbarListeners } from "../components/navbar.js";

class CurrentStats {
  constructor() {
    this.name = "CurrentStats";
    this.container = document.getElementById("app");
    this.stats = null;
    this.updateIndicator = null;
    this.trendData = null;
    this.trendChartInstance = null;
    this.currentTrendPeriod = "30d";
  }

  async render() {
    this.container.innerHTML = `
      <div class="layout">
        ${renderNavbar()}

        <div class="main-content">
          <div class="container">
            <h1>Network Statistics</h1>
            <p class="text-muted">XRPL ledger and network metrics</p>
            
            <div id="stats-update-indicator" style="display: none; padding: 8px 12px; background-color: #28a745; color: white; border-radius: 4px; margin-bottom: 16px; margin-top: 16px; text-align: center; font-size: 0.875rem;">
              ✓ Statistics updated
            </div>

            <!-- Distribution Tables - Moved to Top -->
            <div class="card mt-3">
              <div class="card-header">
                <h3>Balance Distribution</h3>
              </div>
              <div class="card-body">
                <div class="grid grid-2" style="gap: 20px;">
                  <!-- Balance Distribution by Range -->
                  <div>
                    <h4 style="text-align: center; margin-bottom: 12px;">By Range</h4>
                    <div style="overflow-x: auto;">
                      <table class="styled-table" border="2" id="balance-ranges-table">
                        <thead>
                          <tr align="center"><th colspan="3">Number of accounts and sum of balance range</th></tr>
                          <tr>
                            <td align="center"><strong># Accounts</strong></td>
                            <td align="center"><strong>Balance Range</strong></td>
                            <td align="center"><strong>Sum (XRP)</strong></td>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td colspan="3" style="text-align: center;">Loading...</td></tr>
                        </tbody>
                       </table>
                     </div>
                   </div>
                   <!-- Percentile Distribution -->
                   <div>
                     <h4 style="text-align: center; margin-bottom: 12px;">Percentile Distribution</h4>
                     <div style="overflow-x: auto;">
                       <table class="styled-table" border="2" id="percentiles-table">
                         <thead>
                           <tr align="center"><th colspan="3">Percentage # Accounts Balance equals (or greater than)</th></tr>
                           <tr>
                             <td align="center"><strong>Percentile</strong></td>
                             <td align="center"><strong># Accounts</strong></td>
                             <td align="center"><strong>Balance (or greater)</strong></td>
                           </tr>
                         </thead>
                         <tbody>
                           <tr><td colspan="3" style="text-align: center;">Loading...</td></tr>
                         </tbody>
                       </table>
                     </div>
                   </div>
                 </div>

                 <div class="card mt-3">
                <h4>Wallet Creation Trend</h4>
                <p class="text-muted text-small">Cumulative wallets over stored statistics period</p>
                <div style="margin-bottom: 16px;">
                  <label style="font-weight: 600;">Period:</label>
                  <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="trend-period-btn active" data-period="30d">30d</button>
                    <button class="trend-period-btn" data-period="90d">90d</button>
                    <button class="trend-period-btn" data-period="1y">1y</button>
                    <button class="trend-period-btn" data-period="all">All</button>
                  </div>
                </div>
                <div class="chart-container" style="height: 300px; border: 2px solid #ccc; border-radius: 4px;">
                  <canvas id="walletTrendChart"></canvas>
                </div>
              </div>
             </div>

             <div class="card mt-3">
              <div class="card-header">
                <h3>Ledger Information</h3>
              </div>
              <div class="card-body">
                <div class="grid grid-2">
                  <div>
                    <h4>Latest Ledger Index</h4>
                    <p style="font-size: 1.3rem; font-weight: bold;" id="ledger-index">Loading...</p>
                  </div>
                  <div>
                    <h4>Ledger Date</h4>
                    <p style="font-size: 1.1rem;" id="ledger-date">Loading...</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-2 mt-3" id="stats-grid">
              <div class="card">
                <div class="card-body">
                  <h3>Total Accounts</h3>
                  <p style="font-size: 1.5rem; font-weight: bold;" id="total-accounts">Loading...</p>
                  <p class="text-muted text-small">wallets on network</p>
                </div>
              </div>
              <div class="card">
                <div class="card-body">
                  <h3>Total XRP Supply</h3>
                  <p style="font-size: 1.5rem; font-weight: bold;" id="total-xrp">Loading...</p>
                  <p class="text-muted text-small" id="total-xrp-display">0 XRP</p>
                </div>
              </div>
              <div class="card">
                <div class="card-body">
                  <h3>Reserve Base</h3>
                  <p style="font-size: 1.5rem; font-weight: bold;">20 XRP</p>
                  <p class="text-muted text-small">Network minimum</p>
                </div>
              </div>
              <div class="card">
                <div class="card-body">
                  <h3>Reserve Increment</h3>
                  <p style="font-size: 1.5rem; font-weight: bold;">5 XRP</p>
                  <p class="text-muted text-small">Per object</p>
                </div>
              </div>
            </div>

            <div class="card mt-3">
              <div class="card-header">
                <h3>XRP Distribution</h3>
              </div>
              <div class="card-body">
                <div class="grid grid-3">
                  <div>
                    <h4>In Wallets</h4>
                    <p style="font-size: 1.3rem; font-weight: bold;" id="wallet-xrp">0 XRP</p>
                    <p class="text-muted text-small" id="wallet-percent">0%</p>
                  </div>
                  <div>
                    <h4>In Escrow</h4>
                    <p style="font-size: 1.3rem; font-weight: bold;" id="escrow-xrp">0 XRP</p>
                    <p class="text-muted text-small" id="escrow-percent">0%</p>
                  </div>
                  <div>
                    <h4>Average per Account</h4>
                    <p style="font-size: 1.3rem; font-weight: bold;" id="avg-balance">0 XRP</p>
                    <p class="text-muted text-small">in wallets</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="card mt-3">
              <div class="card-header">
                <h3>Summary</h3>
              </div>
              <div class="card-body">
                <table class="table">
                  <tbody>
                    <tr>
                      <td><strong>Total XRP in Circulation</strong></td>
                      <td id="total-xrp-text" style="text-align: right;">0 XRP</td>
                    </tr>
                    <tr>
                      <td><strong>XRP in Wallets</strong></td>
                      <td id="wallet-xrp-text" style="text-align: right;">0 XRP</td>
                    </tr>
                    <tr>
                      <td><strong>XRP in Escrow</strong></td>
                      <td id="escrow-xrp-text" style="text-align: right;">0 XRP</td>
                    </tr>
                    <tr>
                      <td><strong>Number of Accounts</strong></td>
                      <td id="num-accounts-text" style="text-align: right;">0</td>
                    </tr>
                    <tr>
                      <td><strong>Average Balance per Account</strong></td>
                      <td id="avg-balance-text" style="text-align: right;">0 XRP</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>


          </div>
        </div>
      </div>
    `;

    // Initialize navbar listeners
    attachNavbarListeners();

    // Setup trend chart event listeners
    this.setupTrendEventListeners();

    // Load data after rendering
    await this.loadStats();
    await this.loadBalanceRanges();
    await this.loadPercentiles();
    await this.loadTrendData();
  }

  async loadStats() {
    store.setLoading(true);
    try {
      const response = await api.get("/stats");

      if (!response.success || !response.data) {
        throw new Error("No statistics data available");
      }

      this.stats = response.data;
      this.displayStats();
    } catch (error) {
      store.setError(`Failed to load statistics: ${error.message}`);
      this.displayError();
    } finally {
      store.setLoading(false);
    }
  }

  async loadBalanceRanges() {
    try {
      const response = await api.get("/stats/balance-ranges");

      if (response.success && response.data) {
        this.displayBalanceRanges(response.data);
      }
    } catch (error) {
      console.error("Failed to load balance ranges:", error);
    }
  }

  async loadPercentiles() {
    try {
      const response = await api.get("/stats/percentiles");

      if (response.success && response.data) {
        this.displayPercentiles(response.data);
      }
    } catch (error) {
      console.error("Failed to load percentiles:", error);
    }
  }

  displayStats() {
    if (!this.stats) return;

    const stats = this.stats;

    const formatNumber = (num) => {
      return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
    };

    const formatXrp = (num) => {
      return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
    };

    const formatLargeXrp = (num) => {
      if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + "B XRP";
      } else if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + "M XRP";
      }
      return formatXrp(num) + " XRP";
    };

    // Calculate percentages
    const totalXrp = stats.total_xrp;
    const walletPercent =
      totalXrp > 0 ? ((stats.wallet_xrp / totalXrp) * 100).toFixed(2) : 0;
    const escrowPercent =
      totalXrp > 0 ? ((stats.escrow_xrp / totalXrp) * 100).toFixed(2) : 0;

    // Format ledger date
    const ledgerDate = new Date(stats.ledger_date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Update ledger information
    const ledgerIndexEl = document.getElementById("ledger-index");
    if (ledgerIndexEl) {
      ledgerIndexEl.textContent = formatNumber(stats.ledger_index);
    }

    const ledgerDateEl = document.getElementById("ledger-date");
    if (ledgerDateEl) {
      ledgerDateEl.textContent = ledgerDate;
    }

    // Update main stats
    const totalAccountsEl = document.getElementById("total-accounts");
    if (totalAccountsEl) {
      totalAccountsEl.textContent = formatNumber(stats.accounts);
    }

    const totalXrpEl = document.getElementById("total-xrp");
    if (totalXrpEl) {
      totalXrpEl.textContent = formatLargeXrp(totalXrp);
    }

    const totalXrpDisplayEl = document.getElementById("total-xrp-display");
    if (totalXrpDisplayEl) {
      totalXrpDisplayEl.textContent = formatXrp(totalXrp) + " XRP";
    }

    // Update XRP distribution
    const walletXrpEl = document.getElementById("wallet-xrp");
    if (walletXrpEl) {
      walletXrpEl.textContent = formatLargeXrp(stats.wallet_xrp);
    }

    const walletPercentEl = document.getElementById("wallet-percent");
    if (walletPercentEl) {
      walletPercentEl.textContent = walletPercent + "%";
    }

    const escrowXrpEl = document.getElementById("escrow-xrp");
    if (escrowXrpEl) {
      escrowXrpEl.textContent = formatLargeXrp(stats.escrow_xrp);
    }

    const escrowPercentEl = document.getElementById("escrow-percent");
    if (escrowPercentEl) {
      escrowPercentEl.textContent = escrowPercent + "%";
    }

    const avgBalanceEl = document.getElementById("avg-balance");
    if (avgBalanceEl) {
      avgBalanceEl.textContent = formatXrp(stats.average_balance_xrp) + " XRP";
    }

    // Update summary table
    const totalXrpTextEl = document.getElementById("total-xrp-text");
    if (totalXrpTextEl) {
      totalXrpTextEl.textContent = formatXrp(totalXrp) + " XRP";
    }

    const walletXrpTextEl = document.getElementById("wallet-xrp-text");
    if (walletXrpTextEl) {
      walletXrpTextEl.textContent = formatXrp(stats.wallet_xrp) + " XRP";
    }

    const escrowXrpTextEl = document.getElementById("escrow-xrp-text");
    if (escrowXrpTextEl) {
      escrowXrpTextEl.textContent = formatXrp(stats.escrow_xrp) + " XRP";
    }

    const numAccountsTextEl = document.getElementById("num-accounts-text");
    if (numAccountsTextEl) {
      numAccountsTextEl.textContent = formatNumber(stats.accounts);
    }

    const avgBalanceTextEl = document.getElementById("avg-balance-text");
    if (avgBalanceTextEl) {
      avgBalanceTextEl.textContent =
        formatXrp(stats.average_balance_xrp) + " XRP";
    }
  }

  displayBalanceRanges(data) {
    const table = document.getElementById("balance-ranges-table");
    if (!table) return;

    const formatNumber = (num) => {
      return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
    };

    const formatXrp = (num) => {
      return num.toLocaleString("en-US", { maximumFractionDigits: 6 });
    };

    let rows = "";

    data.forEach((item) => {
      rows += `<tr>
        <td align="center">${formatNumber(item.account_count)}</td>
        <td align="center">${item.balance_range}</td>
        <td align="center">${formatXrp(item.total_xrp)}</td>
      </tr>`;
    });

    const tbody = table.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML = rows;
    }
  }

  displayPercentiles(data) {
    const table = document.getElementById("percentiles-table");
    if (!table) return;

    const formatNumber = (num) => {
      return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
    };

    const formatXrp = (num) => {
      return num.toLocaleString("en-US", { maximumFractionDigits: 6 });
    };

    let rows = "";

    data.forEach((item) => {
      rows += `<tr>
        <td align="center">${item.percentile}</td>
        <td align="center">${formatNumber(item.account_count)}</td>
        <td align="center">${formatXrp(item.balance_threshold_xrp)} XRP</td>
      </tr>`;
    });

    const tbody = table.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML = rows;
    }
  }

  displayError() {
    const statsGrid = document.getElementById("stats-grid");
    if (statsGrid) {
      statsGrid.innerHTML =
        '<div class="alert alert-danger" style="grid-column: 1/-1;">Failed to load statistics</div>';
    }
  }

  setupTrendEventListeners() {
    document.querySelectorAll(".trend-period-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".trend-period-btn").forEach((b) => {
          b.classList.remove("active");
        });
        e.target.classList.add("active");
        this.currentTrendPeriod = e.target.dataset.period;
        this.loadTrendData();
      });
    });
  }

  async loadTrendData() {
    store.setLoading(true);
    try {
      const response = await api.get(
        `/accounts/trend?timeframe=${this.currentTrendPeriod}`,
      );

      if (response.success && response.data) {
        this.trendData = response.data;
        this.drawTrendChart();
      }
    } catch (error) {
      console.error("Failed to load trend data:", error);
      store.setError(`Failed to load trend data: ${error.message}`);
    } finally {
      store.setLoading(false);
    }
  }

  drawTrendChart() {
    if (!this.trendData || this.trendData.length === 0) {
      return;
    }

    const labels = this.trendData.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
      });
    });

    const accounts = this.trendData.map((d) => parseInt(d.accounts));

    if (this.trendChartInstance) {
      this.trendChartInstance.destroy();
    }

    const ctx = document.getElementById("walletTrendChart");
    if (!ctx) return;

    this.trendChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Total Wallets",
            data: accounts,
            borderColor: "#007bff",
            backgroundColor: "rgba(0, 123, 255, 0.05)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 2,
            pointBackgroundColor: "#007bff",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
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
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            callbacks: {
              title: function (context) {
                const dataIndex = context[0].dataIndex;
                const fullDate = new Date(
                  this.trendData[dataIndex].date,
                ).toLocaleDateString();
                return `Date: ${fullDate}`;
              }.bind(this),
              label: function (context) {
                const count = parseInt(context.parsed.y).toLocaleString();
                return `Wallets: ${count}`;
              },
            },
          },
        },
        scales: {
          y: {
            ticks: {
              callback: function (value) {
                if (value >= 1000000) {
                  return (value / 1000000).toFixed(1) + "M";
                } else if (value >= 1000) {
                  return (value / 1000).toFixed(0) + "K";
                }
                return value.toString();
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
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }
}

export { CurrentStats };
