// Historic Data Page Component
// Historical data with date picker and analysis

import store from '../store.js';
import api from '../services/api.js';
import { renderNavbar, attachNavbarListeners } from '../components/navbar.js';

class Historic {
  constructor() {
    this.name = 'Historic';
    this.container = document.getElementById('app');
    this.historicalData = [];
  }

  async render() {
    this.container.innerHTML = `
      <div class="layout">
        ${renderNavbar()}

        <div class="main-content">
          <div class="container">
            <h1>Historical Data</h1>
            <p class="text-muted">View historical price snapshots and trends</p>
            
            <div class="card mt-3">
              <div class="card-header">
                <h3>Load Historical Data</h3>
              </div>
              <div class="card-body">
                <div class="grid grid-2">
                  <div class="form-group">
                    <label class="form-label">Start Date</label>
                    <input type="date" class="form-control" id="start-date">
                  </div>
                  <div class="form-group">
                    <label class="form-label">End Date</label>
                    <input type="date" class="form-control" id="end-date">
                  </div>
                </div>
                <button class="btn btn-primary" id="load-btn">Load Historical Data</button>
              </div>
            </div>

            <div class="card mt-3" id="history-card" style="display: none;">
              <div class="card-header">
                <h3>Price History</h3>
              </div>
              <div class="card-body">
                <table class="table" id="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Open</th>
                      <th>High</th>
                      <th>Low</th>
                      <th>Close</th>
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody id="history-tbody">
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
    
    // Attach event listeners
    this.attachListeners();

    // Load initial historical data
    await this.loadHistoricalData();
  }

  attachListeners() {
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => this.loadHistoricalData());
    }
  }

  async loadHistoricalData() {
    store.setLoading(true);
    try {
      const response = await api.get('/price/history');
      this.historicalData = response.data || [];
      this.displayHistoricalData();
    } catch (error) {
      store.setError(`Failed to load historical data: ${error.message}`);
      this.displayError();
    } finally {
      store.setLoading(false);
    }
  }

  displayHistoricalData() {
    if (!this.historicalData || this.historicalData.length === 0) {
      this.displayError();
      return;
    }

    const formatPrice = (num) => {
      return parseFloat(num).toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    const formatNumber = (num) => {
      return parseFloat(num).toLocaleString('en-US', { maximumFractionDigits: 0 });
    };

    const rows = this.historicalData.map(record => {
      const date = new Date(parseInt(record.timestamp));
      const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return `
        <tr>
          <td>${dateStr}</td>
          <td>$${formatPrice(record.open)}</td>
          <td>$${formatPrice(record.high)}</td>
          <td>$${formatPrice(record.low)}</td>
          <td>$${formatPrice(record.close)}</td>
          <td>${formatNumber(record.volume)}</td>
        </tr>
      `;
    }).join('');

    const tbody = document.getElementById('history-tbody');
    const card = document.getElementById('history-card');
    
    if (tbody) {
      tbody.innerHTML = rows;
    }

    if (card) {
      card.style.display = 'block';
    }
  }

  displayError() {
    const tbody = document.getElementById('history-tbody');
    const card = document.getElementById('history-card');

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No historical data available</td></tr>';
    }

    if (card) {
      card.style.display = 'block';
    }
  }
}

export { Historic };
