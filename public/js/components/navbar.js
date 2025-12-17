// Shared Navbar Component
// Includes theme switcher and navigation

import store from "../store.js";
import walletService from "../services/walletService.js";
import walletBadgesModule from "../modules/walletBadges.js";

const THEMES = [
  { id: "plain", label: "⚪ Plain" },
  { id: "crypto-classic", label: "💰 Crypto Classic" },
  { id: "data-minimalist", label: "📊 Data Minimalist" },
  { id: "night-market", label: "🌙 Night Market" },
  { id: "ocean", label: "🌊 Ocean" },
  { id: "forest", label: "🌲 Forest" },
];

export function renderNavbar() {
  return `
    <nav class="navbar">
      <div class="container-fluid">
        <a href="/" class="navbar-brand">Rich-List.Info</a>
        
        <div class="navbar-main">
          <ul class="navbar-nav">
            <li><a href="/" class="nav-link">Search</a></li>
            <li><a href="/price-chart" class="nav-link">Price</a></li>
            <li><a href="/stats" class="nav-link">Statistics</a></li>
            <li><a href="/escrow" class="nav-link">Escrow</a></li>
          </ul>
        </div>

        <!-- Navbar Bottom Row (Mobile Symbols + Right Elements) -->
        <div class="navbar-bottom-row">
          <div class="navbar-symbols">
            <div class="symbol-item" id="xrpl-status">
              <span class="symbol-dot" id="xrpl-dot"></span>
            </div>
            <button class="symbol-item mobile-wallet-toggle" id="mobile-wallet-toggle">
              <span class="symbol-icon">💰</span>
              <span class="symbol-text" id="wallet-count">0</span>
            </button>
          </div>

          <div class="navbar-right">
            <div class="theme-switcher">
              <select id="theme-select" class="form-control" style="width: 180px;">
                ${THEMES.map(
                  (theme) => `
                  <option value="${theme.id}" ${store.getState("theme") === theme.id ? "selected" : ""}>
                    ${theme.label}
                  </option>
                `,
                ).join("")}
              </select>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;
}

// Mobile wallet panel functionality
let mobileWalletPanelOpen = false;

export function toggleMobileWalletPanel() {
  const panel = document.getElementById("mobile-wallet-panel");
  const backdrop =
    document.getElementById("mobile-wallet-backdrop") || createBackdrop();

  if (!panel) return;

  mobileWalletPanelOpen = !mobileWalletPanelOpen;

  if (mobileWalletPanelOpen) {
    panel.classList.add("open");
    backdrop.classList.add("active");
    populateMobileWalletPanel();
    document.body.style.overflow = ""; // Prevent background scrolling
  } else {
    panel.classList.remove("open");
    backdrop.classList.remove("active");
    document.body.style.overflow = ""; // Restore scrolling
  }
}

function createBackdrop() {
  const backdrop = document.createElement("div");
  backdrop.id = "mobile-wallet-backdrop";
  backdrop.className = "mobile-wallet-backdrop";
  backdrop.addEventListener("click", toggleMobileWalletPanel);
  document.body.appendChild(backdrop);
  return backdrop;
}

function populateMobileWalletPanel() {
  const content = document.getElementById("mobile-wallet-content");
  if (!content) return;

  const walletService =
    window.richListApp?.walletService || window.walletService;
  if (!walletService) {
    content.innerHTML =
      '<p class="text-muted">Wallet service not available</p>';
    return;
  }

  const wallets = walletService.getAllWallets();

  if (wallets.length === 0) {
    content.innerHTML = '<p class="text-muted">No wallets monitored</p>';
    return;
  }

  content.innerHTML = wallets
    .map(
      (wallet) => `
    <div class="mobile-wallet-item" data-address="${wallet.address || wallet.xrpAmount}" data-type="${wallet.type}">
      <div class="mobile-wallet-info">
        <div class="mobile-wallet-name">${wallet.customName || (wallet.type === "wallet" ? wallet.address : wallet.xrpAmount + " XRP")}</div>
        <div class="mobile-wallet-type">${wallet.type}</div>
      </div>
      <div class="mobile-wallet-actions">
        <button class="mobile-wallet-edit" data-address="${wallet.address || wallet.xrpAmount}" data-type="${wallet.type}">✏️</button>
        <button class="mobile-wallet-remove" data-address="${wallet.address || wallet.xrpAmount}" data-type="${wallet.type}">×</button>
      </div>
    </div>
  `,
    )
    .join("");

  // Add button listeners
  content.querySelectorAll(".mobile-wallet-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const address = e.target.dataset.address;
      const type = e.target.dataset.type;
      editWalletFromMobile(address, type);
    });
  });

  content.querySelectorAll(".mobile-wallet-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const address = e.target.dataset.address;
      const type = e.target.dataset.type;
      removeWalletFromMobile(address, type);
    });
  });
}

function removeWalletFromMobile(identifier, type) {
  const walletService =
    window.richListApp?.walletService || window.walletService;
  if (walletService) {
    walletService.removeWallet(identifier, type);
    updateNavbarSymbols(); // Update the count
    populateMobileWalletPanel(); // Refresh the panel
  }
}

function editWalletFromMobile(identifier, type) {
  const walletService =
    window.richListApp?.walletService || window.walletService;
  if (!walletService) return;

  // Find the wallet using the service's getWallet method
  const wallet = walletService.getWallet(
    type === "exchange" ? parseFloat(identifier) : identifier,
  );

  if (!wallet) {
    alert("Wallet not found");
    return;
  }

  // Create mobile edit dialog
  createMobileEditDialog(wallet);
}

function createMobileEditDialog(wallet) {
  const walletService =
    window.richListApp?.walletService || window.walletService;
  if (!walletService) return;

  // Remove existing dialog if present
  const existingDialog = document.getElementById("mobile-edit-dialog");
  if (existingDialog) existingDialog.remove();

  const isExchange = wallet.type === "exchange";

  const dialog = document.createElement("div");
  dialog.id = "mobile-edit-dialog";
  dialog.className = "mobile-edit-dialog";
  dialog.innerHTML = `
    <div class="mobile-edit-overlay" id="mobile-edit-overlay"></div>
    <div class="mobile-edit-content">
      <div class="mobile-edit-header">
        <h3>Edit ${isExchange ? "Exchange" : "Wallet"}</h3>
        <button id="mobile-edit-close">×</button>
      </div>

      <div class="mobile-edit-body">
        <div class="mobile-edit-field">
          <label>Custom Name</label>
          <input type="text" id="mobile-edit-name" value="${wallet.customName || ""}" maxlength="30" placeholder="Optional name">
        </div>

        ${
          isExchange
            ? `<div class="mobile-edit-field">
            <label>XRP Amount</label>
            <input type="number" id="mobile-edit-amount" value="${wallet.xrpAmount}" step="0.000001" min="0" placeholder="XRP amount">
          </div>`
            : `<div class="mobile-edit-field">
            <label>Address</label>
            <input type="text" id="mobile-edit-address" value="${wallet.address}" readonly>
          </div>
          <div class="mobile-edit-field">
            <label class="checkbox-label">
              <input type="checkbox" id="mobile-edit-monitor" ${wallet.trackActivity ? "checked" : ""}>
              Monitor activity
            </label>
          </div>`
        }

        <div id="mobile-edit-error"></div>
      </div>

      <div class="mobile-edit-footer">
        <button class="btn btn-danger" id="mobile-edit-delete">Delete</button>
        <div class="mobile-edit-actions">
          <button class="btn btn-secondary" id="mobile-edit-cancel">Cancel</button>
          <button class="btn btn-primary" id="mobile-edit-save">Save</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Event listeners
  const overlay = dialog.querySelector("#mobile-edit-overlay");
  const closeBtn = dialog.querySelector("#mobile-edit-close");
  const cancelBtn = dialog.querySelector("#mobile-edit-cancel");
  const saveBtn = dialog.querySelector("#mobile-edit-save");
  const deleteBtn = dialog.querySelector("#mobile-edit-delete");
  const errorDiv = dialog.querySelector("#mobile-edit-error");

  const closeDialog = () => dialog.remove();

  overlay.addEventListener("click", closeDialog);
  closeBtn.addEventListener("click", closeDialog);
  cancelBtn.addEventListener("click", closeDialog);

  deleteBtn.addEventListener("click", async () => {
    if (
      confirm(
        "Are you sure you want to delete this wallet? This action cannot be undone.",
      )
    ) {
      try {
        const identifier = isExchange ? wallet.xrpAmount : wallet.address;
        await walletService.deleteWallet(identifier);
        closeDialog();
        populateMobileWalletPanel();
        updateNavbarSymbols();
      } catch (error) {
        errorDiv.className = "wallet-error";
        errorDiv.textContent = error.message;
      }
    }
  });

  saveBtn.addEventListener("click", async () => {
    const nameInput = dialog.querySelector("#mobile-edit-name");
    const customName = nameInput.value.trim();

    try {
      const identifier = isExchange ? wallet.xrpAmount : wallet.address;

      // Update custom name
      await walletService.updateWalletCustomName(identifier, customName);

      if (isExchange) {
        // Update exchange amount if changed
        const amountInput = dialog.querySelector("#mobile-edit-amount");
        const newAmount = parseFloat(amountInput.value);
        if (newAmount !== wallet.xrpAmount) {
          await walletService.updateExchangeAmount(
            wallet.xrpAmount,
            newAmount,
            customName,
          );
        }
      } else {
        // Update monitoring for wallets
        const monitorInput = dialog.querySelector("#mobile-edit-monitor");
        await walletService.updateWalletMonitoring(
          identifier,
          monitorInput.checked,
        );
      }

      closeDialog();
      populateMobileWalletPanel();
      updateNavbarSymbols();
    } catch (error) {
      errorDiv.className = "wallet-error";
      errorDiv.textContent = error.message;
    }
  });
}

// Update mobile status symbols
export function updateNavbarSymbols() {
  // Update XRPL connection status
  const xrplDot = document.getElementById("xrpl-dot");
  const xrplStatus = document.getElementById("xrpl-status");

  if (xrplDot && xrplStatus) {
    // Check if XRPL service is available and connected
    const xrplService = window.richListApp?.xrplService || window.xrplService;
    if (xrplService && xrplService.isConnected) {
      xrplDot.classList.add("connected");
      xrplStatus.title = "Connected to XRPL";
    } else {
      xrplDot.classList.remove("connected");
      xrplStatus.title = "Disconnected from XRPL";
    }
  }

  // Update wallet count
  const walletCount = document.getElementById("wallet-count");
  if (walletCount) {
    const walletService =
      window.richListApp?.walletService || window.walletService;
    if (walletService) {
      const count = walletService.getAllWallets().length;
      walletCount.textContent = count;
    }
  }
}

export function attachNavbarListeners() {
  // Update symbols initially
  updateNavbarSymbols();

  // Set up periodic updates for status symbols
  setInterval(updateNavbarSymbols, 5000); // Update every 5 seconds

  // Mobile wallet toggle
  const walletToggle = document.getElementById("mobile-wallet-toggle");
  if (walletToggle) {
    walletToggle.addEventListener("click", toggleMobileWalletPanel);
  }

  // Close mobile wallet panel
  const closeBtn = document.getElementById("close-mobile-wallet-panel");
  if (closeBtn) {
    closeBtn.addEventListener("click", toggleMobileWalletPanel);
  }

  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) {
    console.log("themeSelect found:", themeSelect);
    console.log("themeSelect disabled:", themeSelect.disabled);
    console.log(
      "themeSelect style pointerEvents:",
      themeSelect.style.pointerEvents,
    );
    console.log(
      "themeSelect bounding rect:",
      themeSelect.getBoundingClientRect(),
    );
    themeSelect.addEventListener("click", (e) => {
      console.log("Theme select clicked");
    });
    themeSelect.addEventListener("change", (e) => {
      const theme = e.target.value;
      setTheme(theme);
    });
  }

  // Initialize wallet badges if not already done
  if (walletBadgesModule && walletBadgesModule.initializeIfNeeded) {
    walletBadgesModule.initializeIfNeeded();
  }
}

export function setTheme(theme) {
  console.log("Setting theme to:", theme);
  // Update body class
  document.body.className = "theme-" + theme;

  // Save to store
  store.setState({ theme });

  // Save to localStorage
  localStorage.setItem("richlist-theme", theme);
}

export function initTheme() {
  // Load saved theme from localStorage
  const savedTheme = localStorage.getItem("richlist-theme") || "plain";
  setTheme(savedTheme);
}

export { THEMES };
