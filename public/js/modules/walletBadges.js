// Wallet Badges Module
// Renders and manages wallet badge display in navbar

import store from "../store.js";
import walletService from "../services/walletService.js";
import xrplService from "../services/xrplService.js";

class WalletBadgesModule {
  constructor() {
    this.container = null;
    this.currentTooltip = null;
    this.setupAttempts = 0;
    this.maxSetupAttempts = 10; // Try up to 10 times
    this.init();
  }

  init() {
    // Set up wallet service listeners
    walletService.addListener((event, data) => {
      if (
        event === "walletsUpdated" ||
        event === "balanceUpdated" ||
        event === "priceUpdated" ||
        event === "transactionAlert"
      ) {
        this.render();
        if (event === "transactionAlert") {
          this.updateNavbarAlert();
        }
      }
    });
  }

  startInitialization() {
    // Reset setup attempts for this initialization
    this.setupAttempts = 0;

    // This is called after the navbar is rendered
    // Use a small delay to ensure DOM is fully updated
    setTimeout(() => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () =>
          this.trySetupContainer(),
        );
      } else {
        this.trySetupContainer();
      }
    }, 10);
  }

  trySetupContainer() {
    if (this.setupContainer()) {
      return;
    }

    // Retry if not successful
    if (this.setupAttempts < this.maxSetupAttempts) {
      this.setupAttempts++;
      setTimeout(() => this.trySetupContainer(), 100 * this.setupAttempts);
    } else {
      console.error(
        "Failed to initialize wallet badges after multiple attempts",
      );
    }
  }

  setupContainer() {
    // Find navbar right container
    const navbarRight = document.querySelector(".navbar-right");
    if (!navbarRight) {
      return false;
    }

    // Remove old wallet monitor elements if they exist (from previous page render)
    const oldTotals = navbarRight.querySelector("#wallet-totals");
    const oldSettings = navbarRight.querySelector("#settings-toggle-btn");
    const oldSecondRow = document.querySelector("#navbar-second-row");

    if (oldTotals) oldTotals.remove();
    if (oldSettings) oldSettings.remove();
    if (oldSecondRow) oldSecondRow.remove();

    // Hide original theme switcher
    const themeSwitcher = navbarRight.querySelector(".theme-switcher");
    if (themeSwitcher) {
      themeSwitcher.style.display = "none";
    }

    // Create wallet totals display (money bag icon with totals)
    const totalsDiv = document.createElement("div");
    totalsDiv.id = "wallet-totals";
    totalsDiv.setAttribute("title", "Total value of all monitored wallets");

    const totalsIcon = document.createElement("div");
    totalsIcon.id = "wallet-totals-icon";
    totalsIcon.innerHTML = "💰";
    totalsDiv.appendChild(totalsIcon);

    // Create alert indicator
    const alertIndicator = document.createElement("div");
    alertIndicator.id = "wallet-alert-indicator";
    alertIndicator.innerHTML = "🚨";
    alertIndicator.style.display = "none";
    alertIndicator.style.fontSize = "1.2em";
    alertIndicator.style.marginLeft = "0.5rem";
    alertIndicator.setAttribute(
      "title",
      "Wallets have unread transaction alerts",
    );
    alertIndicator.addEventListener("click", () => this.clearAllAlerts());
    totalsDiv.appendChild(alertIndicator);

    const totalsValues = document.createElement("div");
    totalsValues.id = "wallet-totals-values";

    const xrpItem = document.createElement("div");
    xrpItem.className = "wallet-total-item";
    xrpItem.innerHTML =
      '<div class="wallet-total-label">XRP</div><div class="wallet-total-amount" id="total-xrp">0</div>';

    const usdItem = document.createElement("div");
    usdItem.className = "wallet-total-item";
    usdItem.innerHTML =
      '<div class="wallet-total-label">USD</div><div class="wallet-total-amount" id="total-usd">$0</div>';

    totalsValues.appendChild(xrpItem);
    totalsValues.appendChild(usdItem);
    totalsDiv.appendChild(totalsValues);

    navbarRight.insertBefore(totalsDiv, navbarRight.firstChild);
    this.totalsDiv = totalsDiv;

    // Create XRPL connection status indicator
    const connectionStatus = document.createElement("div");
    connectionStatus.id = "xrpl-connection-status-indicator";
    connectionStatus.innerHTML = "🔴";
    connectionStatus.setAttribute("title", "XRPL Connection Status");
    navbarRight.insertBefore(connectionStatus, totalsDiv);

    // Create settings gear icon button
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "settings-toggle-btn";
    settingsBtn.innerHTML = "⚙️";
    settingsBtn.setAttribute("title", "Toggle wallet settings");
    settingsBtn.setAttribute("aria-label", "Settings");
    settingsBtn.addEventListener("click", () => this.toggleSecondRow());
    navbarRight.insertBefore(settingsBtn, totalsDiv.nextSibling);

    // Create second navbar row
    const secondRow = document.createElement("div");
    secondRow.id = "navbar-second-row";
    secondRow.setAttribute("role", "region");
    secondRow.setAttribute("aria-label", "Wallet settings");

    // Insert second row right after navbar
    const navbar = document.querySelector(".navbar");
    navbar.parentNode.insertBefore(secondRow, navbar.nextSibling);

    // Create wallet badges container (in second row)
    const container = document.createElement("div");
    container.id = "wallet-badges-container";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Monitored wallets");
    secondRow.appendChild(container);
    this.container = container;
    this.secondRow = secondRow;
    this.settingsBtn = settingsBtn;

    // Create a wrapper for action buttons (add wallet + disk icon)
    const actionButtonsWrapper = document.createElement("div");
    actionButtonsWrapper.id = "action-buttons-wrapper";
    actionButtonsWrapper.style.display = "flex";
    actionButtonsWrapper.style.alignItems = "center";
    actionButtonsWrapper.style.gap = "0.5rem";
    actionButtonsWrapper.style.marginLeft = "auto";

    // Create add wallet button
    const addBtn = document.createElement("button");
    addBtn.id = "add-wallet-btn";
    addBtn.textContent = "+ Add Wallet";
    addBtn.setAttribute("title", "Add a wallet to monitor");
    addBtn.addEventListener("click", () => this.openAddWalletModal());
    actionButtonsWrapper.appendChild(addBtn);

    // Create save/load button (disk icon) - after add wallet button
    const saveLoadBtn = document.createElement("button");
    saveLoadBtn.id = "save-load-btn";
    saveLoadBtn.innerHTML = "💾";
    saveLoadBtn.setAttribute("title", "Save or load wallet configuration");
    saveLoadBtn.addEventListener("click", () => this.toggleSaveLoadPanel());
    actionButtonsWrapper.appendChild(saveLoadBtn);

    // Create XRPL network button - after save/load button
    const xrplNetworkBtn = document.createElement("button");
    xrplNetworkBtn.id = "xrpl-network-btn";
    xrplNetworkBtn.setAttribute("title", "XRPL Network Connection");
    xrplNetworkBtn.innerHTML = "🔗";
    xrplNetworkBtn.addEventListener("click", () =>
      this.toggleXrplConnectionPanel(),
    );
    actionButtonsWrapper.appendChild(xrplNetworkBtn);
    this.xrplNetworkBtn = xrplNetworkBtn;

    // Create clear data button (trash icon) - after XRPL network button
    const clearDataBtn = document.createElement("button");
    clearDataBtn.id = "clear-data-btn";
    clearDataBtn.innerHTML = "🗑️";
    clearDataBtn.setAttribute("title", "Clear all user data");
    clearDataBtn.addEventListener("click", () => this.openClearDataConfirm());
    actionButtonsWrapper.appendChild(clearDataBtn);

    // Create GDPR info button (EU flag emoji) - after clear data button
    const gdprBtn = document.createElement("button");
    gdprBtn.id = "gdpr-info-btn";
    gdprBtn.innerHTML = "🇪🇺";
    gdprBtn.setAttribute("title", "GDPR Compliance Information");
    gdprBtn.addEventListener("click", () => this.openGDPRModal());
    actionButtonsWrapper.appendChild(gdprBtn);

    // Append the wrapper to the second row
    secondRow.appendChild(actionButtonsWrapper);

    // Create save/load panel - append to action buttons wrapper for relative positioning
    const saveLoadPanel = document.createElement("div");
    saveLoadPanel.id = "save-load-panel";
    saveLoadPanel.innerHTML = `
      <h3>Wallet Configuration</h3>
      <div id="save-load-panel-content">
        <button class="save-load-btn save" id="save-wallets-btn">
          💾 Save as JSON
        </button>
        <button class="save-load-btn load" id="load-wallets-btn">
          📂 Load from JSON
        </button>
        <input type="file" id="load-file-input" accept=".json" />
      </div>
    `;
    actionButtonsWrapper.appendChild(saveLoadPanel);
    this.saveLoadPanel = saveLoadPanel;

    // Create XRPL connection panel
    const xrplConnectionPanel = document.createElement("div");
    xrplConnectionPanel.id = "xrpl-connection-panel";
    xrplConnectionPanel.innerHTML = `
      <h3>XRPL Network</h3>
      <div id="xrpl-connection-panel-content"></div>
      <div id="xrpl-connection-status"></div>
    `;
    actionButtonsWrapper.appendChild(xrplConnectionPanel);
    this.xrplConnectionPanel = xrplConnectionPanel;

    // Setup XRPL service listeners
    xrplService.addListener((event, data) => {
      this.updateXrplStatus();
    });

    // Update initial XRPL status
    this.updateXrplStatus();

    // Add event listeners for save/load
    const saveBtn = saveLoadPanel.querySelector("#save-wallets-btn");
    const loadBtn = saveLoadPanel.querySelector("#load-wallets-btn");
    const fileInput = saveLoadPanel.querySelector("#load-file-input");

    saveBtn.addEventListener("click", () => this.saveWallets());
    loadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => this.loadWallets(e));

    // Move theme selector to second row (without label)
    if (themeSwitcher) {
      const themeSelector = document.createElement("div");
      themeSelector.id = "theme-selector-row";
      const select = themeSwitcher.querySelector("select");
      if (select) {
        const clonedSelect = select.cloneNode(true);
        themeSelector.appendChild(clonedSelect);
        secondRow.appendChild(themeSelector);

        // Update event listener on cloned select
        clonedSelect.addEventListener("change", (e) => {
          const select = themeSwitcher.querySelector("select");
          select.value = e.target.value;
          select.dispatchEvent(new Event("change"));
        });
      }
    }

    // Initial render
    this.render();
    this.updateNavbarAlert();
    return true;
  }

  updateNavbarAlert() {
    const alertIndicator = document.getElementById("wallet-alert-indicator");
    if (alertIndicator) {
      const alertCount = walletService.getAlertCount();
      alertIndicator.style.display = alertCount > 0 ? "inline" : "none";
      alertIndicator.setAttribute(
        "title",
        `${alertCount} wallet(s) have unread transaction alerts`,
      );

      // Add/remove pulsing animation
      if (alertCount > 0) {
        alertIndicator.classList.add("alert-pulse");
      } else {
        alertIndicator.classList.remove("alert-pulse");
      }
    }
  }

  clearAllAlerts() {
    walletService.clearAllAlerts();
    this.render();
    this.updateNavbarAlert();
  }

  toggleSecondRow() {
    if (this.secondRow) {
      const wasExpanded = this.secondRow.classList.contains("expanded");
      this.secondRow.classList.toggle("expanded");
      this.settingsBtn.classList.toggle("active");

      // Re-render badges when expanding to ensure they are up to date
      if (!wasExpanded) {
        this.render();
        this.showOnboardingIfFirstTime();
      }
    }
  }

  showOnboardingIfFirstTime() {
    const onboardingKey = "richlist-wallet-onboarding-shown";
    if (localStorage.getItem(onboardingKey)) return; // Already shown

    const wallets = walletService.getAllWallets();
    if (wallets.length === 0) {
      // Show onboarding for first-time users
      setTimeout(() => {
        alert(
          `Welcome to Wallet Monitoring!\n\n• Add XRPL wallet addresses to monitor their activity\n• Add exchange amounts to track hypothetical balances\n• Enable monitoring to get real-time transaction alerts\n• Green indicator means connected to XRPL for live updates\n\nClick the gear icon anytime to manage your wallets.`,
        );
        localStorage.setItem(onboardingKey, "true");
      }, 500); // Delay to let UI render
    }
  }

  toggleSaveLoadPanel() {
    if (this.saveLoadPanel) {
      const isOpen = this.saveLoadPanel.classList.toggle("open");

      if (isOpen) {
        // Position the panel below the disk icon when opened
        const saveLoadBtn = document.getElementById("save-load-btn");
        if (saveLoadBtn) {
          const rect = saveLoadBtn.getBoundingClientRect();
          this.saveLoadPanel.style.top = rect.bottom + 10 + "px";
          this.saveLoadPanel.style.right =
            window.innerWidth - rect.right + "px";
        }
      } else {
        // Close XRPL panel when save/load closes
        this.closeXrplConnectionPanel();
      }
    }
  }

  toggleXrplConnectionPanel() {
    if (this.xrplConnectionPanel) {
      const isOpen = this.xrplConnectionPanel.classList.toggle("open");

      if (isOpen) {
        // Close save/load panel when opening XRPL panel
        if (this.saveLoadPanel) {
          this.saveLoadPanel.classList.remove("open");
        }
        // Render server options
        this.renderXrplServerOptions();
        // Position the panel below the XRPL button
        const xrplBtn = document.getElementById("xrpl-network-btn");
        if (xrplBtn) {
          const rect = xrplBtn.getBoundingClientRect();
          this.xrplConnectionPanel.style.top = rect.bottom + 10 + "px";
          this.xrplConnectionPanel.style.right =
            window.innerWidth - rect.right + "px";
        }
      }
    }
  }

  closeXrplConnectionPanel() {
    if (this.xrplConnectionPanel) {
      this.xrplConnectionPanel.classList.remove("open");
    }
  }

  renderXrplServerOptions() {
    const content = document.getElementById("xrpl-connection-panel-content");
    if (!content) return;

    content.innerHTML = "";

    const servers = xrplService.getAvailableServers();
    const currentStatus = xrplService.getStatus();

    servers.forEach((server) => {
      const option = document.createElement("div");
      option.className = "xrpl-server-option";
      if (
        currentStatus.selectedServer === server.id &&
        currentStatus.isConnected
      ) {
        option.classList.add("selected");
      }
      option.innerHTML = `
        <div class="xrpl-server-name">${server.name}</div>
        <div class="xrpl-server-url">${server.url}</div>
      `;
      option.addEventListener("click", () =>
        this.connectToXrplServer(server.id),
      );
      content.appendChild(option);
    });
  }

  async connectToXrplServer(serverId) {
    try {
      const xrplBtn = document.getElementById("xrpl-network-btn");
      if (xrplBtn) {
        xrplBtn.style.opacity = "0.6";
        xrplBtn.style.pointerEvents = "none";
      }

      await xrplService.connect(serverId);
      this.updateXrplStatus();
      this.renderXrplServerOptions();
    } catch (error) {
      console.error("Failed to connect to XRPL server:", error);
      const status = document.getElementById("xrpl-connection-status");
      if (status) {
        status.className = "disconnected";
        status.textContent = `Error: ${error.message}`;
      }
    } finally {
      const xrplBtn = document.getElementById("xrpl-network-btn");
      if (xrplBtn) {
        xrplBtn.style.opacity = "1";
        xrplBtn.style.pointerEvents = "auto";
      }
    }
  }

  updateXrplStatus() {
    const status = document.getElementById("xrpl-connection-status");
    const indicator = document.getElementById(
      "xrpl-connection-status-indicator",
    );
    const xrplBtn = this.xrplNetworkBtn;

    if (!status || !indicator) return;

    const xrplStatus = xrplService.getStatus();

    if (xrplStatus.isConnected) {
      status.className = "connected";
      status.textContent = `✓ Connected to ${xrplStatus.serverName} (${xrplStatus.subscribedAccounts} subscriptions)`;
      indicator.innerHTML = "🟢";
      indicator.setAttribute("title", `Connected to ${xrplStatus.serverName}`);
      if (xrplBtn) xrplBtn.classList.add("connected");
    } else if (xrplStatus.isAutoConnecting) {
      status.className = "connecting";
      status.textContent = "Connecting to XRPL...";
      indicator.innerHTML = "🟡";
      indicator.setAttribute("title", "Connecting to XRPL...");
      if (xrplBtn) xrplBtn.classList.remove("connected");
    } else {
      status.className = "disconnected";
      status.textContent = "Not connected";
      indicator.innerHTML = "🔴";
      indicator.setAttribute("title", "Not connected to XRPL");
      if (xrplBtn) xrplBtn.classList.remove("connected");
    }
  }

  saveWallets() {
    try {
      const wallets = walletService.getAllWallets();

      const dataToExport = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        wallets: wallets,
      };

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement("a");
      a.href = url;
      a.download = `rich-list-wallets-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert("Wallets exported successfully!");
      this.toggleSaveLoadPanel();
    } catch (error) {
      console.error("Error saving wallets:", error);
      alert("Failed to export wallets: " + error.message);
    }
  }

  loadWallets(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);

          if (data.wallets && Array.isArray(data.wallets)) {
            const response = confirm(
              `Load ${data.wallets.length} wallet(s)? This will replace your current wallets.`,
            );

            if (response) {
              walletService.clearAllWallets();

              // Load wallets using the service's addWallet method to ensure proper data structure
              for (const wallet of data.wallets) {
                if (wallet.type === "exchange" || wallet.address) {
                  const type =
                    wallet.type || (wallet.address ? "wallet" : null);
                  if (!type) continue;

                  // Add wallet (async, but we don't wait)
                  walletService
                    .addWallet(
                      type,
                      wallet.address || null,
                      wallet.xrpAmount || null,
                      wallet.customName || wallet.nickname || "",
                    )
                    .catch((error) => {
                      // Failed to load wallet
                    });
                }
              }

              // Fetch fresh balances for loaded wallets
              walletService.fetchAllBalances();

              alert(`${data.wallets.length} wallet(s) loaded successfully!`);
              this.toggleSaveLoadPanel();
            }
          } else {
            alert("Invalid wallet file format");
          }
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError);
          alert("Invalid JSON file: " + parseError.message);
        }
      };

      reader.readAsText(file);
      // Reset file input so same file can be loaded again
      event.target.value = "";
    } catch (error) {
      console.error("Error loading wallets:", error);
      alert("Failed to load wallets: " + error.message);
    }
  }

  updateTotals(wallets) {
    if (!this.totalsDiv) return;

    // Calculate totals
    let totalXrp = 0;
    let totalUsd = 0;

    wallets.forEach((wallet) => {
      if (wallet.balance) {
        const xrpAmount = parseFloat(wallet.balance.xrp) || 0;
        totalXrp += xrpAmount;
        // Calculate USD based on current XRP amount and current price
        totalUsd += xrpAmount * walletService.currentPrice;
      }
    });

    // Update XRP total
    const xrpElement = document.getElementById("total-xrp");
    if (xrpElement) {
      xrpElement.textContent = totalXrp.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    // Update USD total
    const usdElement = document.getElementById("total-usd");
    if (usdElement) {
      usdElement.textContent =
        "$" +
        totalUsd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
    }
  }

  render() {
    if (!this.container) return;

    // Clear existing badges (keep the add button)
    const existingBadges = this.container.querySelectorAll(".wallet-badge");
    existingBadges.forEach((badge) => badge.remove());

    // Get all wallets
    const wallets = walletService.getAllWallets();

    // Update totals
    this.updateTotals(wallets);

    // Update navbar alert
    this.updateNavbarAlert();

    // Render each wallet badge
    wallets.forEach((wallet) => {
      const badge = this.createBadge(wallet);
      this.container.appendChild(badge);
    });
  }

  createBadge(wallet) {
    const badge = document.createElement("div");
    badge.className = "wallet-badge";
    const identifier =
      wallet.type === "wallet" ? wallet.address : wallet.xrpAmount;
    badge.setAttribute("data-identifier", identifier);
    badge.setAttribute("role", "button");
    badge.setAttribute("tabindex", "0");

    // Add pulsing animation if wallet has alerts
    if (walletService.hasAlerts(identifier)) {
      badge.classList.add("alert-pulse");
    }

    // Determine icon
    const hasAlerts = walletService.hasAlerts(identifier);
    let icon = "💰"; // Default
    if (wallet.type === "exchange") {
      icon = "🔒";
    } else if (hasAlerts) {
      icon = "⚠️";
    }

    // Determine label
    let label, title;
    if (wallet.type === "wallet") {
      label = wallet.customName || wallet.address.substring(0, 6) + "...";
      title = wallet.address;
    } else if (wallet.type === "exchange") {
      const formatNumber = (num) =>
        num.toLocaleString("en-US", { maximumFractionDigits: 2 });
      label =
        wallet.customName || `Exchange: ${formatNumber(wallet.xrpAmount)} XRP`;
      title = `Exchange Amount: ${formatNumber(wallet.xrpAmount)} XRP`;
    }

    // Get USD value
    const usdValue =
      wallet.balance && wallet.balance.usd ? wallet.balance.usd : "0.00";

    badge.innerHTML = `
      <span class="wallet-badge-icon">${icon}</span>
      <span class="wallet-badge-label" title="${title}">${label}</span>
      <span class="wallet-badge-value">$${usdValue}</span>
    `;

    // Add click and keyboard listeners
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showTooltip(wallet);
    });
    badge.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this.showTooltip(wallet);
      }
    });

    return badge;
  }

  showTooltip(wallet) {
    const identifier =
      wallet.type === "wallet" ? wallet.address : wallet.xrpAmount;
    // Close existing tooltip
    this.closeTooltip();

    // Clear alerts for this wallet
    walletService.clearAlerts(identifier);
    this.updateNavbarAlert();

    // Create tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "wallet-tooltip open";
    tooltip.setAttribute("role", "dialog");
    tooltip.setAttribute("aria-modal", "true");
    tooltip.style.display = "block"; // Force display to ensure visibility

    let displayLabel,
      addressDisplay,
      balanceDisplay,
      monitoringDisplay = "",
      statusClass = "";

    if (wallet.type === "wallet") {
      displayLabel =
        wallet.customName || wallet.address.substring(0, 6) + "...";
      addressDisplay = wallet.address;
      balanceDisplay =
        wallet.balance && wallet.balance.xrp !== null
          ? wallet.balance.xrp.toLocaleString("en-US", {
              minimumFractionDigits: 6,
              maximumFractionDigits: 6,
            })
          : "0.000000";
      monitoringDisplay = wallet.trackActivity
        ? "✓ Monitoring"
        : "Not monitoring";
      statusClass = wallet.trackActivity ? "" : "inactive";
    } else if (wallet.type === "exchange") {
      displayLabel =
        wallet.customName ||
        `Exchange: ${wallet.xrpAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} XRP`;
      addressDisplay = `Exchange Amount: ${wallet.xrpAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} XRP`;
      balanceDisplay = wallet.xrpAmount.toLocaleString("en-US", {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      });
    }

    const usdValue =
      wallet.balance && wallet.balance.usd ? wallet.balance.usd : "0.00";

    tooltip.innerHTML = `
      <h4>${displayLabel}</h4>

      <div class="wallet-tooltip-info">
        <label>${wallet.type === "wallet" ? "Address:" : "Exchange Amount:"}</label>
        <code>${addressDisplay}</code>
      </div>

      <div class="wallet-tooltip-info">
        <label>Balance:</label>
        <div>${balanceDisplay} XRP</div>
      </div>

      <div class="wallet-tooltip-info">
        <label>USD Value:</label>
        <div>$${usdValue}</div>
      </div>

      ${
        wallet.type === "wallet"
          ? `
      <div class="wallet-tooltip-info">
        <label>Status:</label>
        <span class="wallet-status-badge ${statusClass}">${monitoringDisplay}</span>
      </div>
      `
          : ""
      }

      <div class="wallet-tooltip-actions">
        <button class="btn-edit" data-identifier="${identifier}">Edit</button>
        ${wallet.type === "wallet" ? `<button class="btn-view-txns" data-identifier="${identifier}">View Txns</button>` : ""}
        <button class="btn-delete" data-identifier="${identifier}">Delete</button>
      </div>
    `;

    // Position tooltip
    document.body.appendChild(tooltip);
    this.positionTooltip(tooltip, identifier);

    // Add event listeners to tooltip buttons
    tooltip.querySelector(".btn-edit").addEventListener("click", () => {
      this.openEditModal(wallet);
    });

    if (wallet.type === "wallet") {
      tooltip.querySelector(".btn-view-txns").addEventListener("click", () => {
        this.showTransactions(wallet);
      });
    }

    tooltip.querySelector(".btn-delete").addEventListener("click", () => {
      this.openDeleteConfirm(wallet);
    });

    // Close tooltip when clicking outside
    document.addEventListener("click", (e) => {
      if (!tooltip.contains(e.target) && !this.container.contains(e.target)) {
        this.closeTooltip();
      }
    });

    this.currentTooltip = tooltip;
  }

  positionTooltip(tooltip, identifier) {
    // Get the badge position
    const badge = this.container.querySelector(
      `[data-identifier="${identifier}"]`,
    );
    if (!badge) return;

    const rect = badge.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Position below badge with some offset
    let top = rect.bottom + 10;
    let left = rect.left;

    // Adjust if goes off screen
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    if (top + tooltipRect.height > window.innerHeight) {
      top = rect.top - tooltipRect.height - 10;
    }

    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
  }

  closeTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }

  openAddWalletModal() {
    // Check if at capacity
    if (walletService.isAtCapacity()) {
      alert(
        `Maximum ${walletService.maxWallets} wallets reached. Consider removing some wallets to add new ones.`,
      );
      return;
    }

    this.closeTooltip();

    // Create modal
    const modal = document.createElement("div");
    modal.className = "wallet-modal open";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="wallet-modal-content">
        <h2>Add Wallet</h2>
        <div class="wallet-form-group">
          <label>
            <input type="checkbox" id="add-wallet-type">
            This is an Exchange XRP amount (no address required)
          </label>
        </div>
        <div class="wallet-form-group" id="add-address-group">
          <label for="add-wallet-address">Wallet Address</label>
          <input type="text" id="add-wallet-address" placeholder="e.g., rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH">
        </div>
        <div class="wallet-form-group" id="add-amount-group" style="display: none;">
          <label for="add-wallet-amount">XRP Amount</label>
          <input type="number" id="add-wallet-amount" step="0.000001" min="0" placeholder="e.g., 1000000">
        </div>
        <div class="wallet-form-group">
          <label for="add-wallet-customname">Custom Name (Optional)</label>
          <input type="text" id="add-wallet-customname" placeholder="e.g., My Savings" maxlength="30">
          <span class="char-count"><span id="add-customname-count">0</span>/30</span>
        </div>
        <div class="wallet-modal-actions">
          <button class="btn-primary" id="add-wallet-confirm">Add</button>
          <button class="btn-secondary" id="add-wallet-cancel">Cancel</button>
        </div>
        <div id="add-wallet-error"></div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup event listeners
    const typeToggle = modal.querySelector("#add-wallet-type");
    const addressGroup = modal.querySelector("#add-address-group");
    const amountGroup = modal.querySelector("#add-amount-group");
    const addressInput = modal.querySelector("#add-wallet-address");
    const amountInput = modal.querySelector("#add-wallet-amount");
    const customNameInput = modal.querySelector("#add-wallet-customname");
    const charCount = modal.querySelector("#add-customname-count");
    const confirmBtn = modal.querySelector("#add-wallet-confirm");
    const cancelBtn = modal.querySelector("#add-wallet-cancel");
    const errorDiv = modal.querySelector("#add-wallet-error");

    // Type toggle handler
    typeToggle.addEventListener("change", (e) => {
      const isExchange = e.target.checked;
      addressGroup.style.display = isExchange ? "none" : "block";
      amountGroup.style.display = isExchange ? "block" : "none";
    });

    // Character counter
    customNameInput.addEventListener("input", (e) => {
      charCount.textContent = e.target.value.length;
    });

    // Add wallet
    confirmBtn.addEventListener("click", async () => {
      const isExchange = typeToggle.checked;
      const address = addressInput.value.trim();
      const xrpAmount = parseFloat(amountInput.value);
      const customName = customNameInput.value.trim();

      errorDiv.innerHTML = "";
      confirmBtn.classList.add("wallet-loading");

      try {
        await walletService.addWallet(
          isExchange ? "exchange" : "wallet",
          address,
          isExchange ? xrpAmount : null,
          customName,
        );
        this.render();
        modal.remove();
      } catch (error) {
        errorDiv.className = "wallet-error";
        errorDiv.textContent = error.message;
        confirmBtn.classList.remove("wallet-loading");
      }
    });

    // Cancel
    cancelBtn.addEventListener("click", () => {
      modal.remove();
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Focus on address input
    addressInput.focus();
  }

  openEditModal(wallet) {
    this.closeTooltip();

    // Create modal
    const modal = document.createElement("div");
    modal.className = "wallet-modal open";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const isExchange = wallet.type === "exchange";
    const displayValue = isExchange
      ? wallet.xrpAmount.toString()
      : wallet.address;

    modal.innerHTML = `
      <div class="wallet-modal-content">
        <h2>Edit ${isExchange ? "Exchange" : "Wallet"}</h2>

        <div class="wallet-form-group">
          <label>
            <input type="checkbox" id="edit-wallet-type" ${isExchange ? "checked" : ""}>
            This is an Exchange XRP amount (no address required)
          </label>
        </div>

        <div class="wallet-form-group" id="address-group" style="display: ${isExchange ? "none" : "block"};">
          <label>Address</label>
          <code style="display: block; background: var(--bg-primary); padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; word-break: break-all; color: var(--accent-primary);">
            ${wallet.address || "N/A"}
          </code>
        </div>

        <div class="wallet-form-group" id="amount-group" style="display: ${isExchange ? "block" : "none"};">
          <label for="edit-wallet-amount">XRP Amount</label>
          <input type="number" id="edit-wallet-amount" step="0.000001" min="0" placeholder="e.g., 1000000" value="${wallet.xrpAmount || ""}">
        </div>

        <div class="wallet-form-group">
          <label for="edit-wallet-customname">Custom Name (Optional)</label>
          <input type="text" id="edit-wallet-customname" placeholder="e.g., My Exchange" maxlength="30" value="${wallet.customName || ""}">
          <span class="char-count"><span id="edit-customname-count">${(wallet.customName || "").length}</span>/30</span>
        </div>

        <div class="wallet-form-group" id="monitor-group" style="display: ${isExchange ? "none" : "block"};">
          <label>
            <input type="checkbox" id="edit-wallet-monitor" ${wallet.trackActivity ? "checked" : ""}>
            Monitor Activity
          </label>
        </div>

        <div class="wallet-modal-actions">
          <button class="btn-primary" id="edit-wallet-confirm">Save</button>
          <button class="btn-secondary" id="edit-wallet-cancel">Cancel</button>
          <button class="btn-danger" id="edit-wallet-delete" style="margin-left: auto;">Delete Wallet</button>
        </div>
        <div id="edit-wallet-error"></div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup event listeners
    const typeToggle = modal.querySelector("#edit-wallet-type");
    const addressGroup = modal.querySelector("#address-group");
    const amountGroup = modal.querySelector("#amount-group");
    const amountInput = modal.querySelector("#edit-wallet-amount");
    const customNameInput = modal.querySelector("#edit-wallet-customname");
    const monitorToggle = modal.querySelector("#edit-wallet-monitor");
    const monitorGroup = modal.querySelector("#monitor-group");
    const charCount = modal.querySelector("#edit-customname-count");
    const confirmBtn = modal.querySelector("#edit-wallet-confirm");
    const cancelBtn = modal.querySelector("#edit-wallet-cancel");
    const errorDiv = modal.querySelector("#edit-wallet-error");

    // Type toggle handler
    typeToggle.addEventListener("change", (e) => {
      const isExchange = e.target.checked;
      addressGroup.style.display = isExchange ? "none" : "block";
      amountGroup.style.display = isExchange ? "block" : "none";
      monitorGroup.style.display = isExchange ? "none" : "block";
    });

    // Character counter
    customNameInput.addEventListener("input", (e) => {
      charCount.textContent = e.target.value.length;
    });

    // Delete wallet
    const deleteBtn = modal.querySelector("#edit-wallet-delete");
    deleteBtn.addEventListener("click", async () => {
      if (
        confirm(
          "Are you sure you want to delete this wallet? This action cannot be undone.",
        )
      ) {
        try {
          const identifier = isExchange ? wallet.xrpAmount : wallet.address;
          await walletService.deleteWallet(identifier);
          this.render();
          modal.remove();
        } catch (error) {
          errorDiv.className = "wallet-error";
          errorDiv.textContent = error.message;
        }
      }
    });

    // Save changes
    confirmBtn.addEventListener("click", async () => {
      const isExchange = typeToggle.checked;
      const address = addressInput.value.trim();
      const xrpAmount = parseFloat(amountInput.value);
      const customName = customNameInput.value.trim();

      try {
        const identifier = isExchange ? wallet.xrpAmount : wallet.address;

        // Update custom name
        await walletService.updateWalletCustomName(identifier, customName);

        if (isExchange) {
          // For exchange, update amount if changed
          const newAmount = parseFloat(amountInput.value);
          if (newAmount !== wallet.xrpAmount) {
            await walletService.updateExchangeAmount(
              wallet.xrpAmount,
              newAmount,
              customName,
            );
          } else {
            // Just update name
            await walletService.updateWalletCustomName(identifier, customName);
          }
        } else {
          // For wallet, update monitoring and name
          await walletService.updateWalletCustomName(identifier, customName);
          await walletService.updateWalletMonitoring(
            identifier,
            monitorToggle.checked,
          );
        }

        this.render();
        modal.remove();
      } catch (error) {
        errorDiv.className = "wallet-error";
        errorDiv.textContent = error.message;
      }
    });

    // Cancel
    cancelBtn.addEventListener("click", () => {
      modal.remove();
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Focus on custom name input
    customNameInput.focus();
  }

  openClearDataConfirm() {
    this.closeTooltip();

    const modal = document.createElement("div");
    modal.className = "wallet-modal open";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="wallet-modal-content">
        <h2>Clear All Data</h2>
        <div class="wallet-confirm-message">
          This will permanently delete all user data. This action cannot be undone.
        </div>
        <div class="wallet-confirm-message" style="color: var(--text-secondary); font-size: 0.9rem;">
          • All monitored wallets will be removed<br>
          • Transaction alerts and history will be cleared<br>
          • Theme will reset to default<br>
          • Saved search queries will be removed
        </div>
        <div class="wallet-modal-actions">
          <button class="btn-primary" id="clear-data-confirm" style="background: #dc3545;">Clear All Data</button>
          <button class="btn-secondary" id="clear-data-cancel">Cancel</button>
        </div>
        <div id="clear-data-error"></div>
      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById("clear-data-confirm")
      .addEventListener("click", async () => {
        await this.clearAllUserData();
        modal.remove();
      });

    document
      .getElementById("clear-data-cancel")
      .addEventListener("click", () => {
        modal.remove();
      });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  openGDPRModal() {
    this.closeTooltip();

    const modal = document.createElement("div");
    modal.className = "wallet-modal open";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="wallet-modal-content">
        <h2>GDPR Compliance Information</h2>

        <div class="wallet-confirm-message">
          <h3>Data Storage & Processing</h3>
          <ul style="text-align: left; margin: 1rem 0;">
            <li><strong>No Server-Side Data Storage:</strong> User data (wallets, settings) is stored exclusively in browser localStorage (client-side)</li>
            <li><strong>No Personal Data Collection:</strong> The app only accesses public XRP Ledger data; no user profiles, emails, or personal identifiers are collected</li>
            <li><strong>No Cookies:</strong> No HTTP cookies are used for tracking or session management</li>
          </ul>

          <h3>GDPR Compliance Factors</h3>
          <ul style="text-align: left; margin: 1rem 0;">
            <li><strong>No Data Controller Role:</strong> Since no personal data is collected, stored, or processed server-side, GDPR data controller obligations don't apply</li>
            <li><strong>Local Data Only:</strong> All user data remains on the user's device; no transmission to servers</li>
            <li><strong>No Third-Party Tracking:</strong> No analytics, advertising, or tracking scripts</li>
          </ul>

          <h3>Privacy-Friendly Practices</h3>
          <ul style="text-align: left; margin: 1rem 0;">
            <li><strong>Data Portability:</strong> Users can export their wallet configurations as JSON</li>
            <li><strong>Data Deletion:</strong> "Clear All Data" feature allows complete local data removal</li>
            <li><strong>No Data Sharing:</strong> No sharing of user data with third parties</li>
          </ul>

          <p style="margin-top: 1rem; font-style: italic;">
            <strong>Bottom Line:</strong> ✅ GDPR Compliant - No personal data processing means no GDPR obligations.
          </p>
        </div>

        <div class="wallet-modal-actions">
          <button class="btn-secondary" id="gdpr-close">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("gdpr-close").addEventListener("click", () => {
      modal.remove();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  openDeleteConfirm(wallet) {
    this.closeTooltip();

    // Create confirmation modal
    const modal = document.createElement("div");
    modal.className = "wallet-modal open";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const isExchange = wallet.type === "exchange";
    const displayLabel =
      wallet.customName ||
      (isExchange
        ? `Exchange: ${wallet.xrpAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} XRP`
        : wallet.address.substring(0, 6) + "...");
    const displayValue = isExchange
      ? `Exchange Amount: ${wallet.xrpAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} XRP`
      : wallet.address;

    modal.innerHTML = `
      <div class="wallet-modal-content">
        <h2>Delete ${isExchange ? "Exchange" : "Wallet"}</h2>

        <div class="wallet-confirm-message">
          Are you sure you want to delete <strong>${displayLabel}</strong>?
        </div>

        <div class="wallet-confirm-address">
          ${displayValue}
        </div>

        <div class="wallet-confirm-message" style="color: var(--text-secondary); font-size: 0.9rem;">
          This action cannot be undone.
        </div>

        <div class="wallet-modal-actions">
          <button class="btn-primary" id="delete-wallet-confirm" style="background: #dc3545;">Delete</button>
          <button class="btn-secondary" id="delete-wallet-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup event listeners
    const confirmBtn = modal.querySelector("#delete-wallet-confirm");
    const cancelBtn = modal.querySelector("#delete-wallet-cancel");

    confirmBtn.addEventListener("click", async () => {
      const identifier = isExchange ? wallet.xrpAmount : wallet.address;
      await walletService.deleteWallet(identifier);
      this.render();
      modal.remove();
    });

    cancelBtn.addEventListener("click", () => {
      modal.remove();
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  showTransactions(wallet) {
    // For now, just show an alert
    // In a full implementation, this would show a detailed transaction list
    if (!wallet.transactions || wallet.transactions.length === 0) {
      alert("No recent transactions");
    } else {
      const txList = wallet.transactions
        .map((tx) => `${tx.type}: ${tx.amount} (${tx.timestamp})`)
        .join("\n");
      alert(`Recent transactions for ${wallet.address}:\n\n${txList}`);
    }
  }
}

// Create singleton instance
let walletBadgesInstance = null;

// Helper function to get or create singleton
function getWalletBadgesInstance() {
  if (!walletBadgesInstance) {
    walletBadgesInstance = new WalletBadgesModule();
  }
  return walletBadgesInstance;
}

// Export a wrapper with initialization method
const walletBadgesModule = {
  initializeIfNeeded() {
    const instance = getWalletBadgesInstance();
    // Always try to initialize/reinitialize when navbar is rendered
    // This ensures wallet monitor appears on every page
    instance.startInitialization();
  },
  getInstance() {
    return getWalletBadgesInstance();
  },
};

export default walletBadgesModule;
