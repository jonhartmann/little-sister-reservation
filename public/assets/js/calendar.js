/* Little Sister — Calendar component */
'use strict';

class ReservationCalendar {
  constructor({ onRangeSelect, onError }) {
    this.bookedRanges = [];
    this.ownRanges    = [];
    this.selectedStart = null;
    this.selectedEnd   = null;
    this.viewYear  = new Date().getFullYear();
    this.viewMonth = new Date().getMonth(); // current month
    this.onRangeSelect = onRangeSelect || (() => {});
    this.onError       = onError       || (() => {});
  }

  setBookedRanges(ranges) {
    this.bookedRanges = ranges.map(r => ({
      start: this._parseDate(r.start_date),
      end:   this._parseDate(r.end_date),
    }));
    this.render();
  }

  setOwnRanges(ranges) {
    this.ownRanges = ranges.map(r => ({
      start: this._parseDate(r.start_date),
      end:   this._parseDate(r.end_date),
    }));
    this.render();
  }

  _parseDate(dateStr) {
    const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // ── Helpers ──────────────────────────────────────────────

  _today() {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }

  _dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  _isOwn(date) {
    return this.ownRanges.some(r => date >= r.start && date <= r.end);
  }

  _isBooked(date) {
    return this.bookedRanges.some(r => date >= r.start && date <= r.end)
        || this._isOwn(date);
  }

  _rangeOverlapsBooked(start, end) {
    const d = new Date(start);
    while (d <= end) {
      if (this._isBooked(d)) return true;
      d.setDate(d.getDate() + 1);
    }
    return false;
  }

  _isInSelectedRange(date) {
    if (!this.selectedStart) return false;
    const end = this.selectedEnd || this.selectedStart;
    return date > this.selectedStart && date < end;
  }

  // ── Day click ─────────────────────────────────────────────

  _handleDayClick(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = this._today();

    if (this._isBooked(date) || date < today) return;

    if (!this.selectedStart || (this.selectedStart && this.selectedEnd)) {
      // Start a new selection
      this.selectedStart = date;
      this.selectedEnd   = null;
      this.render();
      return;
    }

    // Complete the range
    let start = this.selectedStart;
    let end   = date;
    if (end < start) { [start, end] = [end, start]; }

    if (this._rangeOverlapsBooked(start, end)) {
      this.selectedStart = null;
      this.selectedEnd   = null;
      this.render();
      this.onError('Those dates overlap with an existing reservation. Please choose different dates.');
      return;
    }

    this.selectedStart = start;
    this.selectedEnd   = end;
    this.render();
    this.onRangeSelect(start, end);
  }

  clearSelection() {
    this.selectedStart = null;
    this.selectedEnd   = null;
    this.render();
  }

  // ── Rendering ─────────────────────────────────────────────

  _renderMonth(year, month) {
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const today = this._today();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow    = new Date(year, month, 1).getDay();

    let html = `<div class="cal-month">`;
    html += `<div class="cal-month-header">${MONTHS[month]} ${year}</div>`;
    html += `<div class="cal-grid">`;
    html += ['Su','Mo','Tu','We','Th','Fr','Sa']
      .map(n => `<div class="cal-day-name">${n}</div>`).join('');

    for (let i = 0; i < firstDow; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date    = new Date(year, month, day);
      const dateKey = this._dateKey(date);
      const own     = this._isOwn(date);
      const booked  = !own && this._isBooked(date);
      const past    = date < today;
      const isToday = date.getTime() === today.getTime();

      const isStart    = this.selectedStart && date.getTime() === this.selectedStart.getTime();
      const isEnd      = this.selectedEnd   && date.getTime() === this.selectedEnd.getTime();
      const inRange    = this._isInSelectedRange(date);

      let cls = 'cal-day';
      if (own)                cls += ' own-booking';
      else if (booked)        cls += ' booked';
      else if (past)          cls += ' past';
      if (isToday)            cls += ' today';
      if (isStart || isEnd)   cls += ' selected-endpoint';
      else if (inRange)       cls += ' in-range';

      const interactive = !own && !booked && !past;
      html += `<div class="${cls}"${interactive ? ` data-date="${dateKey}"` : ''}>${day}</div>`;
    }

    html += `</div></div>`;
    return html;
  }

  render() {
    const container = document.getElementById('calendar-container');
    const label     = document.getElementById('cal-month-label');
    if (!container) return;

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    const y1 = this.viewYear, m1 = this.viewMonth;
    const next  = new Date(y1, m1 + 1, 1);
    const y2 = next.getFullYear(), m2 = next.getMonth();

    if (label) label.textContent = `${MONTHS[m1]} – ${MONTHS[m2]} ${y2}`;

    let html = `<div class="cal-months-grid">`;
    html += this._renderMonth(y1, m1);
    html += this._renderMonth(y2, m2);
    html += `</div>`;

    if (this.selectedStart && !this.selectedEnd) {
      html += `<p class="cal-hint">Now click your check-out date.</p>`;
    }

    container.innerHTML = html;

    container.querySelectorAll('.cal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => this._handleDayClick(el.dataset.date));
    });

    document.getElementById('cal-prev')?.addEventListener('click', () => {
      const d = new Date(this.viewYear, this.viewMonth - 1, 1);
      this.viewYear  = d.getFullYear();
      this.viewMonth = d.getMonth();
      this.render();
    });

    document.getElementById('cal-next')?.addEventListener('click', () => {
      const d = new Date(this.viewYear, this.viewMonth + 1, 1);
      this.viewYear  = d.getFullYear();
      this.viewMonth = d.getMonth();
      this.render();
    });
  }
}
