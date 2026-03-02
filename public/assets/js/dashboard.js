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
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = `<div class="msg-error">${err.message}</div>`;
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
