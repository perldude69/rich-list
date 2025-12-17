// Rich-List Socket.IO Service
// Real-time communication with the backend

import store from "../store.js";
import walletService from "./walletService.js";

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.subscriptions = new Set();
  }

  // Initialize Socket.IO connection
  connect() {
    if (this.socket) return this.socket;

    this.socket = io(window.location.origin, {
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ["websocket", "polling"],
    });

    // Connection events
    this.socket.on("connect", () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      store.setConnected(true);

      // Re-emit pending subscriptions
      this.subscriptions.forEach((sub) => {
        this.emit(`subscribe:${sub}`);
      });

      this.emit("connected", { id: this.socket.id });
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      store.setConnected(false);
      this.emit("disconnected", { reason });
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error);
      this.reconnectAttempts++;
      this.emit("error", { error: error.message });
    });

    this.socket.on("reconnect_attempt", () => {
      // Reconnection attempt
    });

    // Listen for all events
    this.socket.onAny((eventName, ...args) => {
      this.handleEvent(eventName, args);
    });

    return this.socket;
  }

  // Disconnect Socket.IO
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Emit event
  emit(eventName, data = {}) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit(eventName, data);
  }

  // Listen to event
  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(listener);
  }

  // Remove event listener
  off(eventName, listener) {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Handle incoming events
  handleEvent(eventName, args) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in listener for ${eventName}:`, error);
        }
      });
    }

    // Also emit to store for global reactivity
    store.setState({ lastUpdate: Date.now() });
  }

  // Subscribe to event stream
  subscribe(eventName) {
    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.add(eventName);
      // Queue subscription if not connected
      if (this.isConnected) {
        this.emit(`subscribe:${eventName}`);
      }
    }
  }

  // Unsubscribe from event stream
  unsubscribe(eventName) {
    if (this.subscriptions.has(eventName)) {
      this.subscriptions.delete(eventName);
      this.emit(`unsubscribe:${eventName}`);
    }
  }

  // Subscribe to stats updates
  subscribeStats() {
    this.subscribe("stats");
    this.on("stats:update", (data) => {
      store.setState({ lastUpdate: Date.now() });
      this.emit("stats", data);
    });
  }

  // Subscribe to price updates
  subscribePrice() {
    this.subscribe("price");
    this.on("price:update", (data) => {
      // Update wallet service with new price
      if (data && data.data && data.data.price) {
        walletService.setPrice(data.data.price);
      } else if (data && data.price) {
        walletService.setPrice(data.price);
      }
      store.addPriceHistory([data]);
      store.setState({ lastUpdate: Date.now() });
      this.emit("price", data);
    });
  }

  // Subscribe to ledger updates
  subscribeLedger() {
    this.subscribe("ledger");
    this.on("ledger:update", (data) => {
      store.setState({ lastUpdate: Date.now() });
      this.emit("ledger", data);
    });
  }

  // Subscribe to transaction updates
  subscribeTransactions() {
    this.subscribe("transactions");
    this.on("transaction:update", (data) => {
      store.setState({ lastUpdate: Date.now() });
      this.emit("transaction", data);
    });
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
      subscriptions: Array.from(this.subscriptions),
      listeners: Array.from(this.listeners.keys()),
    };
  }

  // Get statistics
  getStats() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      listenerCount: this.listeners.size,
      subscriptionCount: this.subscriptions.size,
    };
  }
}

// Create and export singleton
const socket = new SocketService();

export { socket, SocketService };
export default socket;
