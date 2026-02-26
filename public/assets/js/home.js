/* Little Sister — Home page logic */
'use strict';

(async function () {
  const cal = new ReservationCalendar({
    onRangeSelect: showReservationForm,
    onError: (msg) => {
      document.getElementById('cal-status').innerHTML = `<p class="cal-error">${msg}</p>`;
      hideReservationForm();
    },
  });

  // Load booked dates
  try {
    const booked = await API.get('/api/reservations/calendar');
    cal.setBookedRanges(booked);
  } catch (err) {
    cal.render(); // render empty calendar on failure
  }

  // ── Reservation form ───────────────────────────────────────

  function showReservationForm(start, end) {
    document.getElementById('cal-status').innerHTML = '';
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('selected-dates-display').textContent =
      `Check-in: ${fmt(start)}  →  Check-out: ${fmt(end)}`;
    document.getElementById('reservation-form').style.display = 'block';
    document.getElementById('reservation-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideReservationForm() {
    document.getElementById('reservation-form').style.display = 'none';
    document.getElementById('form-message').innerHTML = '';
  }

  document.getElementById('btn-clear-dates')?.addEventListener('click', () => {
    cal.clearSelection();
    hideReservationForm();
  });

  document.getElementById('form-reservation')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email       = document.getElementById('res-email').value.trim();
    const description = document.getElementById('res-description').value.trim();
    const start = cal.selectedStart;
    const end   = cal.selectedEnd;

    if (!start || !end) {
      showMessage('form-message', 'Please select a date range first.', 'error');
      return;
    }

    const fmt = (d) => d.toISOString().split('T')[0];
    const submitBtn = e.target.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      await API.post('/api/auth/request', {
        email,
        start_date:  fmt(start),
        end_date:    fmt(end),
        description: description || undefined,
      });
      showMessage('form-message',
        'Reservation request received! Check your email for a sign-in link to confirm.',
        'success');
      e.target.reset();
      cal.clearSelection();
      hideReservationForm();
    } catch (err) {
      showMessage('form-message', err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Reservation';
    }
  });

  // ── Sign-in form ───────────────────────────────────────────

  document.getElementById('form-signin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const submitBtn = e.target.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      await API.post('/api/auth/signin', { email });
      showMessage('signin-message',
        'Sign-in link sent! Check your inbox and click the link to continue.',
        'success');
      e.target.reset();
    } catch (err) {
      showMessage('signin-message', err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Sign-In Link';
    }
  });
})();
