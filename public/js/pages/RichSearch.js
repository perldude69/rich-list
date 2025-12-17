// Rich Search / Ranking Search Page Component
// Search for wallets by address or find ranking by XRP amount

import store from "../store.js";
import api from "../services/api.js";
import socket from "../services/socket.js";
import walletService from "../services/walletService.js";
import { renderNavbar, attachNavbarListeners } from "../components/navbar.js";

class RichSearch {
  constructor() {
    this.name = "RichSearch";
    this.container = document.getElementById("app");
    this.searchMode = "ranking"; // 'ranking' or 'details'
  }

  async render() {
    this.container.innerHTML = `
      <div class="layout">
        ${renderNavbar()}

        <div class="main-content">
          <div class="container">
            <div class="card">
              <div class="card-header">
                <h2>Ranking Search</h2>
                <p class="text-muted">Find where a wallet address or XRP amount ranks on the XRPL</p>
              </div>
              <div class="card-body">
                <div class="form-group">
                  <label class="form-label">Wallet Addresses or XRP Amounts</label>
                   <textarea
                     class="form-control"
                     id="search-input"
                     rows="3"
                     placeholder="Enter wallet addresses (starting with 'r') or XRP amounts, separated by commas, spaces, semicolons, or hyphens&#10;e.g., rABC123, 1000000; rDEF456 - 500000"
                   ></textarea>
                  <small class="text-muted">Enter one or more wallet addresses and/or XRP amounts, separated by commas, spaces, semicolons, or hyphens</small>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                  <button class="btn btn-primary" id="search-btn">Search Ranking</button>
                  <button class="btn btn-secondary btn-sm" id="add-watched-btn" title="Add all monitored wallets to search">Add Watched Wallets</button>
                </div>
              </div>
            </div>

            <div id="search-results" class="mt-3"></div>
          </div>
        </div>
      </div>
    `;

    // Initialize navbar listeners
    attachNavbarListeners();

    // Attach event listeners
    this.attachListeners();
  }

  attachListeners() {
    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");

    searchBtn.addEventListener("click", () => this.search());
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.search();
    });

    // Add watched wallets button
    const addWatchedBtn = document.getElementById("add-watched-btn");
    if (addWatchedBtn) {
      addWatchedBtn.addEventListener("click", () => this.addWatchedWallets());
    }
  }

  addWatchedWallets() {
    const watchedWallets = walletService.getAllWallets();
    if (watchedWallets.length === 0) {
      store.setError("No monitored wallets found");
      return;
    }

    const entries = [];
    watchedWallets.forEach((wallet) => {
      if (wallet.type === "wallet") {
        entries.push(wallet.address);
      } else if (wallet.type === "exchange") {
        entries.push(wallet.xrpAmount.toString());
      }
    });

    const currentInput = document.getElementById("search-input").value.trim();
    const newInput = currentInput
      ? `${currentInput}, ${entries.join(", ")}`
      : entries.join(", ");

    document.getElementById("search-input").value = newInput;
    store.setError(""); // Clear any previous errors
  }

  parseSearchInput(input) {
    // Split on commas, semicolons, hyphens, or whitespace
    const entries = input
      .split(/[,;-\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const addresses = [];
    const amounts = [];
    const errors = [];

    entries.forEach((entry) => {
      if (entry.startsWith("r") && entry.length >= 25) {
        addresses.push(entry);
      } else if (/^\d+(\.\d+)?$/.test(entry) && parseFloat(entry) > 0) {
        amounts.push(entry);
      } else {
        errors.push(`Invalid entry: "${entry}"`);
      }
    });

    return { addresses, amounts, errors };
  }

  async search() {
    const input = document.getElementById("search-input").value.trim();
    if (!input) {
      store.setError("Please enter wallet addresses or XRP amounts");
      return;
    }

    const parsed = this.parseSearchInput(input);
    if (parsed.addresses.length === 0 && parsed.amounts.length === 0) {
      store.setError("No valid wallet addresses or XRP amounts found");
      return;
    }

    if (parsed.errors.length > 0) {
      store.setError(`Invalid entries: ${parsed.errors.join(", ")}`);
      return;
    }

    const allValues = [...parsed.addresses, ...parsed.amounts];
    const queryParam = `values=${encodeURIComponent(allValues.join(","))}`;

    store.setLoading(true);
    try {
      const response = await api.get(`/ranking-search?${queryParam}`);

      if (!response.success || !response.data) {
        this.displayNoResults(input);
      } else {
        this.displayRankingResults(response.data, parsed);
      }

      store.setState({ currentAccount: response.data });
    } catch (error) {
      store.setError(`Search failed: ${error.message}`);
      this.displayError(error.message);
    } finally {
      store.setLoading(false);
    }
  }

  displayNoResults(searchValue) {
    const resultsDiv = document.getElementById("search-results");
    resultsDiv.innerHTML = `
      <div class="alert alert-info">
        <strong>Wallet Not Found</strong><br>
        The wallet address "${searchValue}" was not found in the XRPL database.
      </div>
    `;
  }

  displayRankingResults(data, parsed) {
    const resultsDiv = document.getElementById("search-results");

    const formatNumber = (num) => {
      return parseFloat(num).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      });
    };

    const formatAddress = (addr) => {
      if (!addr) return "N/A";
      return `<code style="word-break: break-all;">${addr}</code>`;
    };

    const balance_xrp = data.balance_xrp;
    const rank = data.rank;
    const total = data.total_wallets;
    const wallets_above = data.wallets_above;
    const wallets_below = data.wallets_below;
    const percentile = data.percentile;

    // Calculate percentage of wallets below this balance
    const percentBelowThreshold = (((total - rank) / total) * 100).toFixed(3);

    // Build nearby wallets tables
    let nearbyHtml = "";
    if (data.nearby_wallets_above && data.nearby_wallets_above.length > 0) {
      const walletsAboveRows = data.nearby_wallets_above
        .map(
          (w) => `
        <tr>
          <td>${formatAddress(w.account_id)}</td>
          <td>${formatNumber(w.balance_xrp)} XRP</td>
        </tr>
      `,
        )
        .join("");

      nearbyHtml += `
        <div class="mt-3">
          <h4>Wallets Just Above This Balance</h4>
          <table class="table">
            <thead>
              <tr>
                <th>Wallet Address</th>
                <th>Balance (XRP)</th>
              </tr>
            </thead>
            <tbody>${walletsAboveRows}</tbody>
          </table>
        </div>
      `;
    }

    if (data.nearby_wallets_below && data.nearby_wallets_below.length > 0) {
      const walletsBelowRows = data.nearby_wallets_below
        .map(
          (w) => `
        <tr>
          <td>${formatAddress(w.account_id)}</td>
          <td>${formatNumber(w.balance_xrp)} XRP</td>
        </tr>
      `,
        )
        .join("");

      nearbyHtml += `
        <div class="mt-3">
          <h4>Wallets Just Below This Balance</h4>
          <table class="table">
            <thead>
              <tr>
                <th>Wallet Address</th>
                <th>Balance (XRP)</th>
              </tr>
            </thead>
            <tbody>${walletsBelowRows}</tbody>
          </table>
        </div>
      `;
    }

    // Build progress bar
    const progressPercent = (((total - rank) / total) * 100).toFixed(2);

    // Build breakdown of individual contributions
    let breakdownHtml = "";
    if (data.breakdown && data.breakdown.length > 0) {
      const breakdownRows = data.breakdown
        .map(
          (item) => `
        <tr style="color: var(--text-primary);">
          <td>${item.type === "address" ? formatAddress(item.value) : formatNumber(item.value) + " XRP"}</td>
          <td>${formatNumber(item.balance_xrp)} XRP</td>
        </tr>
      `,
        )
        .join("");

      breakdownHtml = `
        <div style="background-color: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px; color: var(--text-primary);">
          <h4 style="color: var(--text-primary);">Input Breakdown</h4>
          <table class="table table-sm" style="color: var(--text-primary);">
            <thead>
              <tr style="color: var(--text-primary);">
                <th>Input</th>
                <th>Balance (XRP)</th>
              </tr>
            </thead>
            <tbody>${breakdownRows}</tbody>
          </table>
        </div>
      `;
    }

    resultsDiv.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Ranking Results</h3>
          <p class="text-muted">Combined ranking of ${parsed.addresses.length + parsed.amounts.length} entries</p>
        </div>
        <div class="card-body">
          ${breakdownHtml}
          <div class="grid grid-2" style="gap: 20px; margin-bottom: 30px;">
            <div>
              <h4>Total Balance</h4>
              <p style="font-size: 1.8rem; font-weight: bold; color: #007bff;">
                ${formatNumber(balance_xrp)} XRP
              </p>
            </div>
            <div>
              <h4>Combined Ranking</h4>
              <p style="font-size: 1.8rem; font-weight: bold; color: #28a745;">
                #${rank.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}
              </p>
            </div>
          </div>

          <div style="background-color: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 30px; color: var(--text-primary);">
            <h4 style="margin-top: 0; color: var(--text-primary);">Summary</h4>
            <p style="margin: 8px 0; color: var(--text-primary);">
              <strong style="color: var(--text-primary);">Wallets with more XRP:</strong> ${wallets_above.toLocaleString("en-US")}
            </p>
            <p style="margin: 8px 0; color: var(--text-primary);">
              <strong style="color: var(--text-primary);">Wallets with less XRP:</strong> ${wallets_below.toLocaleString("en-US")}
            </p>
            <p style="margin: 8px 0; color: var(--text-primary);">
              <strong style="color: var(--text-primary);">Percentile:</strong> Top ${percentile}% of all wallets
            </p>
            ${data.breakdown ? `<p style="margin: 8px 0; color: var(--text-primary);"><strong style="color: var(--text-primary);">Combined entries:</strong> ${parsed.addresses.length + parsed.amounts.length}</p>` : ""}
          </div>

          <div style="margin-bottom: 30px;">
            <h4>Percentile Distribution</h4>
            <div style="background-color: #e9ecef; height: 30px; border-radius: 4px; overflow: hidden; border: 1px solid #dee2e6;">
              <div style="
                background: linear-gradient(90deg, #007bff, #0056b3);
                height: 100%;
                width: ${progressPercent}%;
                transition: width 0.5s ease;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                padding-right: 10px;
                color: white;
                font-weight: bold;
                font-size: 0.9rem;
              ">
                ${progressPercent}%
              </div>
            </div>
            <small class="text-muted" style="display: block; margin-top: 8px;">
              You are in the top ${percentile}% of all XRPL wallets by balance
            </small>
          </div>

          ${nearbyHtml}

          <div style="margin-top: 30px; padding: 16px; background-color: #f9f9f9; border-left: 4px solid #007bff; border-radius: 4px;">
            <h4 style="margin-top: 0;">About This Search</h4>
            <p style="margin: 8px 0; font-size: 0.9rem;">
              This ranking is based on account balances in the XRP Ledger. 
              The data is from the rich-list database and may be slightly different from real-time ledger state.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  displayError(message) {
    const resultsDiv = document.getElementById("search-results");
    resultsDiv.innerHTML = `<div class="alert alert-danger">
      <strong>Search Error:</strong><br>
      ${message}
    </div>`;
  }
}

export { RichSearch };
