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

  // Load booked dates and the user's own active reservations in parallel
  let propertyInfo = {};
  try {
    const [booked, mine, info] = await Promise.all([
      API.get('/api/reservations/calendar'),
      API.get('/api/reservations/mine'),
      API.get('/api/property-info').catch(() => ({})),
    ]);
    cal.setBookedRanges(booked);
    cal.setOwnRanges(mine.filter(r => r.status === 'pending' || r.status === 'approved'));
    propertyInfo = info;
    renderReservations(mine, propertyInfo);
  } catch {
    cal.render();
    renderReservations([], {});
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
      showMessage('booking-message', "Reservation request sent! We'll be in touch soon.", 'success');
      cal.clearSelection();
      hideBookingForm();
      await refreshReservations();
    } catch (err) {
      showMessage('booking-message', err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Reservation';
    }
  });

  // ── Reservations ─────────────────────────────────────────

  async function refreshReservations() {
    try {
      const mine = await API.get('/api/reservations/mine');
      cal.setOwnRanges(mine.filter(r => r.status === 'pending' || r.status === 'approved'));
      renderReservations(mine, propertyInfo);
    } catch (err) {
      document.getElementById('reservations-list').innerHTML =
        `<div class="msg-error">${err.message}</div>`;
    }
  }

  function renderReservations(reservations, info) {
    const list = document.getElementById('reservations-list');
    if (!reservations.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">&#x1F4C5;</div>
        <p>You don't have any reservations yet.</p>
      </div>`;
      return;
    }

    const canCancel = (s) => s === 'pending' || s === 'approved';
    const canChange = (s) => s === 'pending';

    list.innerHTML = reservations.map(r => {
      const arrivalHtml = r.status === 'approved' && (info.address || info.checkin_time)
        ? `<div class="res-arrival">
            <strong>Arrival details</strong>
            <dl class="res-arrival-dl">
              ${info.address      ? `<dt>Address</dt><dd>${escapeHtml(info.address)}</dd>` : ''}
              ${info.checkin_time ? `<dt>Check-in</dt><dd>${escapeHtml(info.checkin_time)}</dd>` : ''}
              ${info.checkout_time? `<dt>Check-out</dt><dd>${escapeHtml(info.checkout_time)}</dd>` : ''}
              ${info.contact_name ? `<dt>Contact</dt><dd>${escapeHtml(info.contact_name)}${info.contact_phone ? ' · ' + escapeHtml(info.contact_phone) : ''}</dd>` : ''}
            </dl>
          </div>`
        : '';

      const actionsHtml = (canCancel(r.status) || canChange(r.status))
        ? `<div class="res-card-actions">
            ${canChange(r.status) ? `<button class="button small btn-change-dates" data-id="${r.id}" data-start="${r.start_date}" data-end="${r.end_date}">Change Dates</button>` : ''}
            ${canCancel(r.status) ? `<button class="button small btn-cancel-reservation" data-id="${r.id}">Cancel</button>` : ''}
          </div>`
        : '';

      return `<div class="res-card">
        <div class="res-card-header">
          <div class="res-dates">${formatDate(r.start_date)} &rarr; ${formatDate(r.end_date)}</div>
          <span class="badge badge-${r.status}">${r.status}</span>
        </div>
        <div class="res-submitted">Submitted ${formatDate(r.created_at)}</div>
        ${r.description ? `<div class="res-description">${escapeHtml(r.description)}</div>` : ''}
        ${r.admin_note  ? `<div class="res-note"><strong>Note from host:</strong> ${escapeHtml(r.admin_note)}</div>` : ''}
        ${arrivalHtml}
        ${actionsHtml}
      </div>`;
    }).join('');

    list.querySelectorAll('.btn-cancel-reservation').forEach(btn => {
      btn.addEventListener('click', () => cancelReservation(Number(btn.dataset.id), btn));
    });

    list.querySelectorAll('.btn-change-dates').forEach(btn => {
      btn.addEventListener('click', () => showChangeDatesForm(btn));
    });
  }

  // ── Cancel reservation ────────────────────────────────────

  async function cancelReservation(id, btn) {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;
    btn.disabled = true;
    btn.textContent = 'Cancelling…';
    try {
      await API.patch(`/api/reservations/${id}/cancel`);
      await refreshReservations();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Cancel';
      alert(err.message);
    }
  }

  // ── Change dates (pending only) ───────────────────────────

  function showChangeDatesForm(btn) {
    const card = btn.closest('.res-card');
    // Avoid double-inserting
    if (card.querySelector('.change-dates-form')) {
      card.querySelector('.change-dates-form').remove();
      return;
    }

    const id    = btn.dataset.id;
    const start = String(btn.dataset.start).slice(0, 10);
    const end   = String(btn.dataset.end).slice(0, 10);

    const formDiv = document.createElement('div');
    formDiv.className = 'change-dates-form';
    formDiv.innerHTML = `
      <form class="change-dates-inner">
        <div class="change-dates-fields">
          <label>Check-in <input type="date" name="start_date" value="${start}" required /></label>
          <label>Check-out <input type="date" name="end_date" value="${end}" required /></label>
        </div>
        <div class="change-dates-actions">
          <button type="submit" class="button primary small">Save New Dates</button>
          <button type="button" class="button small btn-cancel-change">Cancel</button>
        </div>
        <div class="change-dates-message"></div>
      </form>`;

    card.querySelector('.res-card-actions').before(formDiv);

    formDiv.querySelector('.btn-cancel-change').addEventListener('click', () => formDiv.remove());
    formDiv.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const start_date = e.target.start_date.value;
      const end_date   = e.target.end_date.value;
      const saveBtn    = e.target.querySelector('[type="submit"]');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      try {
        await API.patch(`/api/reservations/${id}/dates`, { start_date, end_date });
        await refreshReservations();
      } catch (err) {
        const msgEl = formDiv.querySelector('.change-dates-message');
        msgEl.innerHTML = `<div class="msg-error" style="margin-top:0.5em;">${err.message}</div>`;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save New Dates';
      }
    });
  }

  // ── Message the host ──────────────────────────────────────

  document.getElementById('form-contact')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('contact-message').value.trim();
    if (!message) return;
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      await API.post('/api/contact', { message });
      showMessage('contact-message-status', 'Message sent! We\'ll get back to you soon.', 'success');
      e.target.reset();
    } catch (err) {
      showMessage('contact-message-status', err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  });
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

function showMessage(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div class="msg-${type}">${text}</div>`;
}
