/* Little Sister — User dashboard */
'use strict';

(async function () {
  // Auth check
  let user;
  try {
    user = await API.get('/api/profile');
  } catch {
    window.location.href = '/';
    return;
  }

  // Populate nav and profile form
  document.getElementById('nav-user-name').textContent =
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  document.getElementById('profile-first-name').value = user.first_name || '';
  document.getElementById('profile-last-name').value  = user.last_name  || '';
  document.getElementById('profile-email').value      = user.email;

  // Sign out
  document.getElementById('btn-signout').addEventListener('click', async () => {
    try { await API.post('/api/auth/logout'); } catch {}
    window.location.href = '/';
  });

  // ── Profile form ─────────────────────────────────────────

  document.getElementById('form-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const first_name = document.getElementById('profile-first-name').value.trim();
    const last_name  = document.getElementById('profile-last-name').value.trim();
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;

    try {
      const updated = await API.put('/api/profile', { first_name, last_name });
      document.getElementById('nav-user-name').textContent =
        [updated.first_name, updated.last_name].filter(Boolean).join(' ') || updated.email;
      showMessage('profile-message', 'Profile saved.', 'success');
    } catch (err) {
      showMessage('profile-message', err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ── Calendar + Booking form ───────────────────────────────

  const cal = new ReservationCalendar({
    onRangeSelect: showBookingForm,
    onError: (msg) => {
      document.getElementById('cal-status').innerHTML = `<p class="cal-error">${msg}</p>`;
      hideBookingForm();
    },
  });

  // Load booked dates and the user's own reservations
  try {
    const [booked, mine] = await Promise.all([
      API.get('/api/reservations/calendar'),
      API.get('/api/reservations/mine'),
    ]);
    cal.setBookedRanges(booked);
    const activeOwn = mine.filter(r => r.status === 'pending' || r.status === 'approved');
    cal.setOwnRanges(activeOwn);
  } catch {
    cal.render(); // render empty calendar on failure
  }

  function showBookingForm(start, end) {
    document.getElementById('cal-status').innerHTML = '';
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('booking-dates-display').textContent =
      `Check-in: ${fmt(start)}  →  Check-out: ${fmt(end)}`;
    const form = document.getElementById('booking-form');
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideBookingForm() {
    document.getElementById('booking-form').style.display = 'none';
    document.getElementById('booking-message').innerHTML = '';
    document.getElementById('form-booking').reset();
  }

  document.getElementById('btn-clear-dates').addEventListener('click', () => {
    cal.clearSelection();
    hideBookingForm();
  });

  document.getElementById('form-booking').addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = document.getElementById('booking-description').value.trim();
    const start = cal.selectedStart;
    const end   = cal.selectedEnd;

    if (!start || !end) {
      showMessage('booking-message', 'Please select a date range first.', 'error');
      return;
    }

    const fmt = (d) => d.toISOString().split('T')[0];
    const submitBtn = e.target.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      await API.post('/api/reservations', {
        start_date:  fmt(start),
        end_date:    fmt(end),
        description: description || undefined,
      });
      showMessage('booking-message', 'Reservation request sent! We\'ll be in touch soon.', 'success');
      cal.clearSelection();
      hideBookingForm();
      await loadReservations();
      // Refresh own ranges on the calendar so the new booking is highlighted
      try {
        const mine = await API.get('/api/reservations/mine');
        const activeOwn = mine.filter(r => r.status === 'pending' || r.status === 'approved');
        cal.setOwnRanges(activeOwn);
      } catch { /* non-critical */ }
    } catch (err) {
      showMessage('booking-message', err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Reservation';
    }
  });

  // ── Reservations ─────────────────────────────────────────

  async function loadReservations() {
    const list = document.getElementById('reservations-list');
    try {
      const reservations = await API.get('/api/reservations/mine');
      if (!reservations.length) {
        list.innerHTML = `<div class="empty-state">
          <div class="empty-icon">&#x1F4C5;</div>
          <p>You don't have any reservations yet.</p>
        </div>`;
        return;
      }
      const canCancel = (status) => status === 'pending' || status === 'approved';
      list.innerHTML = reservations.map(r => `
        <div class="res-card">
          <div class="res-card-header">
            <div class="res-dates">
              ${formatDate(r.start_date)} &rarr; ${formatDate(r.end_date)}
            </div>
            <span class="badge badge-${r.status}">${r.status}</span>
          </div>
          ${r.description ? `<div class="res-description">${escapeHtml(r.description)}</div>` : ''}
          ${r.admin_note  ? `<div class="res-note"><strong>Note from host:</strong> ${escapeHtml(r.admin_note)}</div>` : ''}
          ${canCancel(r.status) ? `<div class="res-card-actions"><button class="button small btn-cancel-reservation" data-id="${r.id}">Cancel Reservation</button></div>` : ''}
        </div>
      `).join('');

      list.querySelectorAll('.btn-cancel-reservation').forEach(btn => {
        btn.addEventListener('click', () => cancelReservation(Number(btn.dataset.id), btn));
      });
    } catch (err) {
      list.innerHTML = `<div class="msg-error">${err.message}</div>`;
    }
  }

  async function cancelReservation(id, btn) {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;
    btn.disabled = true;
    btn.textContent = 'Cancelling…';
    try {
      await API.patch(`/api/reservations/${id}/cancel`);
      await loadReservations();
      // Clear cancelled dates from the calendar
      const mine = await API.get('/api/reservations/mine');
      cal.setOwnRanges(mine.filter(r => r.status === 'pending' || r.status === 'approved'));
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Cancel Reservation';
      alert(err.message);
    }
  }

  await loadReservations();
})();

function formatDate(dateStr) {
  const [year, month, day] = String(dateStr).slice(0, 10).split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
