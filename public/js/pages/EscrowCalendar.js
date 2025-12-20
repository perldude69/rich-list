// Escrow Calendar Page Component
// Full calendar view with all gamma features + enhancements

import store from "../store.js";
import api from "../services/api.js";
import socket from "../services/socket.js";
import { renderNavbar, attachNavbarListeners } from "../components/navbar.js";

class EscrowCalendar {
  constructor() {
    this.name = "EscrowCalendar";

    // Calendar state - default to current date
    this.currentDate = new Date();
    this.escrowsByDate = {};
    this.monthTotal = 0;
    this.selectedDate = null;
    this.selectedDateEscrows = [];

    // Make instance globally accessible for onclick handlers
    window.escrowCalendarInstance = this;
  }

  async render() {
    this.container = document.getElementById("app");
    if (!this.container) {
      console.error("App container not found for EscrowCalendar");
      return;
    }
    this.container.innerHTML = `
      <div class="layout">
        ${renderNavbar()}

        <div class="main-content">
          <div class="container">
            <h1>Escrow Calendar</h1>
             <p class="text-muted">XRPL escrow release schedule and details</p>
             
              <!-- Calendar View -->
              <div id="calendar-view">
               <!-- Calendar Section (Top) -->
               <div class="calendar-section">
                 <div class="card">
                   <div class="card-body">
                      <!-- Calendar Navigation -->
                      <div class="calendar-navigation">
                        <button class="btn btn-sm" id="prev-month-btn">← Previous</button>
                         <div style="text-align: center; flex: 1;">
                           <h3>
                             <span id="calendar-month">December</span>
                              <select id="year-selector" style="font-size: 1.3rem; font-family: inherit; color: inherit; border: none; background: transparent; cursor: pointer;"></select>
                             UTC
                           </h3>
                         </div>
                        <button class="btn btn-sm" id="next-month-btn">Next →</button>
                       </div>

                       <!-- Export Button -->
                       <div style="text-align: center; margin: 10px 0;">
                         <button class="btn btn-secondary" id="export-csv-btn">Download Escrow History (CSV)</button>
                       </div>

                      <!-- Calendar Weekday Headers -->
                     <div class="calendar-weekdays">
                       <div>Sun</div>
                       <div>Mon</div>
                       <div>Tue</div>
                       <div>Wed</div>
                       <div>Thu</div>
                       <div>Fri</div>
                       <div>Sat</div>
                     </div>

                     <!-- Calendar Grid -->
                     <div class="calendar-grid" id="calendar-grid">
                       <!-- Days will be inserted here -->
                     </div>
                   </div>
                 </div>
               </div>

               <!-- Details Section (Middle) -->
               <div class="details-panel">
                 <h3 id="details-title">Escrow Details</h3>

                 <!-- Day Total (hidden by default) -->
                 <div class="day-total" id="day-total" style="display: none;">
                   Total for this day: <strong id="day-total-amount">0.00</strong> XRP
                 </div>

                 <!-- Details Content -->
                 <div id="escrow-details-content">
                   <p class="text-muted">Click on a calendar date to view escrow details</p>
                 </div>
               </div>

               <!-- Stats Card (Bottom) -->
               <div class="card mb-3">
                 <div class="card-body">
                   <div class="grid grid-5">
                     <div>
                       <h4>Total Escrowed</h4>
                       <p style="font-size: 1.5rem; font-weight: bold;" id="total-escrowed">Loading...</p>
                     </div>
                     <div>
                       <h4>Future Escrow</h4>
                       <p style="font-size: 1.5rem; font-weight: bold;" id="future-escrowed">Loading...</p>
                     </div>
                     <div>
                       <h4>Expired Escrow</h4>
                       <p style="font-size: 1.5rem; font-weight: bold;" id="expired-escrowed">Loading...</p>
                     </div>
                     <div>
                       <h4>Month Total</h4>
                       <p style="font-size: 1.5rem; font-weight: bold;" id="month-total">0.00 XRP</p>
                     </div>
                     <div>
                       <h4>Total Escrows</h4>
                       <p style="font-size: 1.5rem; font-weight: bold;" id="total-count">Loading...</p>
                     </div>
                   </div>
                 </div>
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

    // Load initial data
    await this.loadCalendarData();
  }

  attachListeners() {
    // Calendar navigation
    const prevMonthBtn = document.getElementById("prev-month-btn");
    const nextMonthBtn = document.getElementById("next-month-btn");

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => this.previousMonth());
    }
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => this.nextMonth());
    }

    // Year selector
    const yearSelect = document.getElementById("year-selector");
    if (yearSelect) {
      yearSelect.addEventListener("change", (e) => {
        const newYear = parseInt(e.target.value);
        this.currentDate.setUTCFullYear(newYear);
        this.hideEscrowDetails();
        this.renderCalendar();
      });
    }

    // Export CSV button
    const exportBtn = document.getElementById("export-csv-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportEscrowsCSV());
    }
  }

  async loadCalendarData() {
    store.setLoading(true);
    try {
      // Load calendar escrows for current month
      await this.renderCalendar();

      // Load statistics
      await this.loadStatistics();

      // Populate year dropdown
      this.populateYearDropdown();
    } catch (error) {
      console.error("Error in loadCalendarData:", error);
      store.setError(`Failed to load escrow calendar: ${error.message}`);
    } finally {
      store.setLoading(false);
    }
  }

  async loadStatistics() {
    try {
      const response = await api.get("/escrows/stats");
      if (response.success) {
        const data = response.data;
        const totalElement = document.getElementById("total-escrowed");
        const countElement = document.getElementById("total-count");
        const expiredElement = document.getElementById("expired-escrowed");
        const futureElement = document.getElementById("future-escrowed");

        if (totalElement) {
          totalElement.textContent =
            data.total_xrp.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            }) + " XRP";
        }
        if (countElement) {
          countElement.textContent = data.total_escrows.toLocaleString();
        }
        if (expiredElement) {
          expiredElement.textContent =
            (data.expired_xrp || 0).toLocaleString("en-US", {
              maximumFractionDigits: 2,
            }) + " XRP";
        }
        if (futureElement) {
          futureElement.textContent =
            (data.future_xrp || 0).toLocaleString("en-US", {
              maximumFractionDigits: 2,
            }) + " XRP";
        }
      }
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  }

  async renderCalendar() {
    const year = this.currentDate.getUTCFullYear();
    const month = this.currentDate.getUTCMonth();

    // Update month display
    const monthSpan = document.getElementById("calendar-month");
    if (monthSpan) {
      const monthName = this.currentDate.toLocaleString("en-US", {
        month: "long",
        timeZone: "UTC",
      });
      monthSpan.textContent = monthName;
    }

    // Build date range for API call
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    const startDateStr = firstDay.toISOString().split("T")[0];
    const endDateStr = lastDay.toISOString().split("T")[0];

    try {
      const response = await api.get(
        `/escrows/date-range?startDate=${startDateStr}&endDate=${endDateStr}`,
      );

      if (response.success) {
        this.escrowsByDate = {};
        this.monthTotal = 0;

        // Organize data by date
        response.data.forEach((dateGroup) => {
          this.escrowsByDate[dateGroup.date] = dateGroup;
          this.monthTotal += dateGroup.total_xrp;
        });

        // Update month total display
        const monthTotalElement = document.getElementById("month-total");
        if (monthTotalElement) {
          monthTotalElement.textContent =
            this.monthTotal.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            }) + " XRP";
        }

        // Render calendar grid
        this.renderCalendarGrid();
      }
    } catch (error) {
      store.setError(`Failed to load escrows: ${error.message}`);
      this.renderCalendarGrid(); // Render empty calendar
    }
  }

  renderCalendarGrid() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) {
      console.error("calendar-grid element not found");
      return;
    }

    grid.innerHTML = "";

    const year = this.currentDate.getUTCFullYear();
    const month = this.currentDate.getUTCMonth();

    // Get first day and last day of month
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    // Calculate calendar grid start (previous month's days)
    const startDate = new Date(firstDay);
    startDate.setUTCDate(startDate.getUTCDate() - firstDay.getUTCDay());

    // Calculate calendar grid end (next month's days)
    const endDate = new Date(lastDay);
    endDate.setUTCDate(endDate.getUTCDate() + (6 - lastDay.getUTCDay()));

    // Render days using HTML for better reliability
    let currentDate = new Date(startDate);
    let dayCount = 0;
    let daysHTML = "";
    const dayElements = [];

    while (currentDate <= endDate) {
      const yearVal = currentDate.getUTCFullYear();
      const monthVal = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
      const dayNum = String(currentDate.getUTCDate()).padStart(2, "0");
      const dateKey = `${yearVal}-${monthVal}-${dayNum}`;

      const dayEscrows = this.escrowsByDate[dateKey] || {
        escrows: [],
        total_xrp: 0,
      };

      let classes = "calendar-day";
      let content = `<div style="flex: 1; display: flex; align-items: center; justify-content: center;">${currentDate.getUTCDate()}</div>`;
      let icon = "";
      let title = "";

      // Add other-month class if not in current month
      if (currentDate.getUTCMonth() !== month) {
        classes += " other-month";
      }

      // Add today class
      const today = new Date();
      const todayUTC = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
      const dateUTC = new Date(
        Date.UTC(yearVal, parseInt(monthVal) - 1, parseInt(dayNum)),
      );

      if (dateUTC.getTime() === todayUTC.getTime()) {
        classes += " today";
      }

      // Add has-escrows class if there are escrows
      if (dayEscrows.escrows && dayEscrows.escrows.length > 0) {
        classes += " has-escrows";
        icon = '<span class="escrow-icon">🕐</span>';
        title = `${dayEscrows.escrows.length} escrow(s) expiring`;
      }

      daysHTML += `<div class="${classes}" data-date="${dateKey}" title="${title}">${content}${icon}</div>`;
      dayElements.push({ dateKey, dayEscrows });

      dayCount++;
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Insert all HTML at once
    grid.innerHTML = daysHTML;

    // Attach click handlers after DOM is updated
    dayElements.forEach(({ dateKey, dayEscrows }) => {
      if (dayEscrows.escrows && dayEscrows.escrows.length > 0) {
        const dayElement = grid.querySelector(`[data-date="${dateKey}"]`);
        if (dayElement) {
          dayElement.addEventListener("click", () =>
            this.showEscrowDetails(dateKey, dayEscrows),
          );
        }
      }
    });
  }

  showEscrowDetails(dateKey, dateGroup) {
    this.selectedDate = dateKey;
    this.selectedDateEscrows = dateGroup.escrows || [];

    // Sort escrows by XRP amount (highest first)
    this.selectedDateEscrows.sort(
      (a, b) => parseFloat(b.xrp) - parseFloat(a.xrp),
    );

    const detailsContent = document.getElementById("escrow-details-content");
    const dayTotal = document.getElementById("day-total");
    const dayTotalAmount = document.getElementById("day-total-amount");

    if (!detailsContent) return;

    // Parse date for display
    const [year, month, day] = dateKey.split("-");
    const displayDate = new Date(
      Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)),
    );
    const formattedDate = displayDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

    // Show day total
    if (dayTotal && dayTotalAmount) {
      dayTotalAmount.textContent = (dateGroup.total_xrp || 0).toLocaleString(
        "en-US",
        {
          maximumFractionDigits: 2,
        },
      );
      dayTotal.style.display = "block";
    }

    // Build details HTML
    let html = `<h4>Escrows expiring on ${formattedDate} -UTC</h4>`;

    this.selectedDateEscrows.forEach((escrow, idx) => {
      const releaseDate = new Date(escrow.full_date);
      const utcDateString = releaseDate.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
      });

      html += `
        <div class="escrow-detail-item-horizontal">
          <div class="escrow-wallet-horizontal">${escrow.wallet}</div>
          <div class="escrow-amount-horizontal">${parseFloat(
            escrow.xrp,
          ).toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} XRP</div>
          <div class="escrow-date-horizontal">${utcDateString} UTC</div>
          <div class="escrow-destination-horizontal">${escrow.destination || "N/A"}</div>
        </div>
      `;
    });

    detailsContent.innerHTML = html;
  }

  hideEscrowDetails() {
    // Clear selected state
    this.selectedDate = null;
    this.selectedDateEscrows = [];

    // Hide day total
    const dayTotal = document.getElementById("day-total");
    if (dayTotal) {
      dayTotal.style.display = "none";
    }

    // Reset details content to default message
    const detailsContent = document.getElementById("escrow-details-content");
    if (detailsContent) {
      detailsContent.innerHTML =
        '<p class="text-muted">Click on a calendar date to view escrow details</p>';
    }
  }

  populateYearDropdown() {
    const yearSelect = document.getElementById("year-selector");
    if (!yearSelect) return;

    const startYear = 2013;
    const endYear = 2113;
    const currentYear = this.currentDate.getUTCFullYear();

    yearSelect.innerHTML = "";
    for (let year = startYear; year <= endYear; year++) {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      if (year === currentYear) {
        option.selected = true;
      }
      yearSelect.appendChild(option);
    }
  }

  async exportEscrowsCSV() {
    try {
      const response = await fetch("/api/escrows/export");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "xrpl_escrows.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading CSV:", error);
      alert("Failed to download escrow data. Please try again.");
    }
  }

  previousMonth() {
    this.hideEscrowDetails();
    this.currentDate.setUTCMonth(this.currentDate.getUTCMonth() - 1);
    this.renderCalendar();
  }

  nextMonth() {
    this.hideEscrowDetails();
    this.currentDate.setUTCMonth(this.currentDate.getUTCMonth() + 1);
    this.renderCalendar();
  }
}

export { EscrowCalendar };
