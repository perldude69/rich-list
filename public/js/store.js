// Rich-List State Management Store
// Simple, reactive state management for the SPA

class Store {
  constructor() {
    this.state = {
      // Navigation
      currentPage: "search",
      previousPage: null,

      // Theme
      theme: localStorage.getItem("richlist-theme") || "plain",

      // User preferences
      preferences: JSON.parse(localStorage.getItem("richlist-prefs") || "{}"),

      // Data
      accounts: [],
      accountCount: 0,
      currentAccount: null,

      // Charts and stats
      priceHistory: [],
      ledgerStats: [],
      escrows: [],

      // UI State
      loading: false,
      error: null,
      message: null,

      // Pagination
      pagination: {
        current: 1,
        pageSize: 100,
        total: 0,
      },

      // Filters and search
      searchQuery: "",
      filters: {
        sortBy: "balance",
        sortOrder: "desc",
        minBalance: 0,
      },

      // Real-time
      isConnected: false,
      lastUpdate: null,
      updateInterval: 60000,

      // Settings
      settings: {
        autoRefresh: true,
        refreshInterval: 60000,
        chartType: "line",
        theme: "plain",
        notifications: true,
      },
    };

    this.subscribers = new Map();
    this.historyStack = [];
    this.maxHistory = 50;
  }

  // Get state value
  getState(path) {
    if (!path) return this.state;
    return path.split(".").reduce((obj, key) => obj?.[key], this.state);
  }

  // Set state value with deep reactivity
  setState(updates) {
    const previousState = JSON.parse(JSON.stringify(this.state));

    // Deep merge updates
    Object.keys(updates).forEach((key) => {
      if (
        typeof updates[key] === "object" &&
        updates[key] !== null &&
        !Array.isArray(updates[key])
      ) {
        this.state[key] = { ...this.state[key], ...updates[key] };
      } else {
        this.state[key] = updates[key];
      }
    });

    // Add to history for undo/redo
    this.historyStack.push(previousState);
    if (this.historyStack.length > this.maxHistory) {
      this.historyStack.shift();
    }

    // Notify all subscribers
    this.notifySubscribers(previousState, this.state);
  }

  // Subscribe to state changes
  subscribe(listener, path = null) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, []);
    }
    const listeners = this.subscribers.get(path);
    listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  // Notify all subscribers
  notifySubscribers(previousState, newState) {
    // Notify path-specific subscribers
    this.subscribers.forEach((listeners, path) => {
      if (path === null) {
        // Notify global subscribers
        listeners.forEach((listener) => listener(newState, previousState));
      } else {
        // Notify path-specific subscribers if that part changed
        const prevValue = this.getValueAt(previousState, path);
        const newValue = this.getValueAt(newState, path);
        if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
          listeners.forEach((listener) => listener(newValue, prevValue));
        }
      }
    });
  }

  // Get value at path for comparison
  getValueAt(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  // Add data
  addAccounts(accounts) {
    this.setState({
      accounts: [...this.state.accounts, ...accounts],
      accountCount: this.state.accounts.length + accounts.length,
    });
  }

  addPriceHistory(data) {
    this.setState({
      priceHistory: [...this.state.priceHistory, ...data],
    });
  }

  // Clear data
  clearAccounts() {
    this.setState({
      accounts: [],
      accountCount: 0,
    });
  }

  clearErrors() {
    this.setState({
      error: null,
    });
  }

  // Settings management
  saveSetting(key, value) {
    const newSettings = { ...this.state.settings, [key]: value };
    this.setState({ settings: newSettings });
    localStorage.setItem("richlist-settings", JSON.stringify(newSettings));
  }

  loadSettings() {
    const saved = localStorage.getItem("richlist-settings");
    if (saved) {
      this.setState({ settings: JSON.parse(saved) });
    }
  }

  // Theme management
  setTheme(theme) {
    this.setState({ theme });
    localStorage.setItem("richlist-theme", theme);
    document.body.className = `theme-${theme}`;
  }

  getTheme() {
    return this.state.theme;
  }

  // Navigation
  navigateTo(page) {
    this.setState({
      previousPage: this.state.currentPage,
      currentPage: page,
    });
  }

  // Search
  setSearchQuery(query) {
    this.setState({
      searchQuery: query,
      pagination: { ...this.state.pagination, current: 1 },
    });
  }

  // Filters
  setFilter(key, value) {
    this.setState({
      filters: { ...this.state.filters, [key]: value },
      pagination: { ...this.state.pagination, current: 1 },
    });
  }

  // Pagination
  setPage(page) {
    this.setState({
      pagination: { ...this.state.pagination, current: page },
    });
  }

  // Connection status
  setConnected(connected) {
    this.setState({ isConnected: connected });
  }

  // Loading state
  setLoading(loading) {
    this.setState({ loading });
  }

  // Error handling
  setError(error) {
    this.setState({ error });
    console.error("Store Error:", error);
  }

  setMessage(message) {
    this.setState({ message });
    setTimeout(() => {
      this.setState({ message: null });
    }, 5000);
  }

  // History/Undo
  undo() {
    if (this.historyStack.length > 0) {
      this.state = this.historyStack.pop();
      this.notifySubscribers(null, this.state);
    }
  }

  // Export state
  export() {
    return JSON.stringify(this.state, null, 2);
  }

  // Import state
  import(data) {
    try {
      const imported = JSON.parse(data);
      this.state = { ...this.state, ...imported };
      this.notifySubscribers({}, this.state);
    } catch (error) {
      console.error("Failed to import state:", error);
    }
  }

  // Reset to defaults
  reset() {
    const defaultState = {
      currentPage: "search",
      theme: "plain",
      accounts: [],
      loading: false,
      error: null,
    };
    this.state = { ...this.state, ...defaultState };
    this.notifySubscribers({}, this.state);
  }
}

// Create and export singleton
const store = new Store();

// Apply initial theme
if (store.getState("theme")) {
  document.body.className = `theme-${store.getState("theme")}`;
}

export default store;
