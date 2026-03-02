/* Little Sister — Admin dashboard */
'use strict';

(async function () {
  // Auth + admin check
  let user;
  try {
    user = await API.get('/api/profile');
  } catch {
    window.location.href = '/';
    return;
  }
  if (!user.is_admin) {
    window.location.href = '/dashboard.html';
    return;
  }

  document.getElementById('btn-signout').addEventListener('click', async () => {
    try { await API.post('/api/auth/logout'); } catch {}
    window.location.href = '/';
  });

  // ── Block Time form ────────────────────────────────────────

  document.getElementById('form-block').addEventListener('submit', async (e) => {
    e.preventDefault();
    const start = document.getElementById('block-start').value;
    const end   = document.getElementById('block-end').value;
    const note  = document.getElementById('block-note').value.trim();
    const btn   = document.getElementById('btn-block-submit');

    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await API.post('/api/admin/blocks', {
        start_date: start,
        end_date:   end,
        note:       note || undefined,
      });
      document.getElementById('block-message').innerHTML =
        `<div class="msg-success">Dates blocked successfully.</div>`;
      e.target.reset();
      await load();
    } catch (err) {
      document.getElementById('block-message').innerHTML =
        `<div class="msg-error">${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Block Dates';
    }
  });

  let allReservations = [];
  let activeFilter    = 'all';

  // ── Load ──────────────────────────────────────────────────

  async function load() {
    const wrapper = document.getElementById('admin-table-wrapper');
    try {
      allReservations = await API.get('/api/admin/reservations');
      renderTable();
    } catch (err) {
      wrapper.innerHTML = `<div class="msg-error">${err.message}</div>`;
    }
  }

  // ── Filter bar ────────────────────────────────────────────

  document.getElementById('filter-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    document.querySelectorAll('#filter-bar [data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTable();
  });

  // ── Table render ─────────────────────────────────────────

  function renderTable() {
    const wrapper = document.getElementById('admin-table-wrapper');
    const rows = activeFilter === 'all'
      ? allReservations
      : allReservations.filter(r => r.status === activeFilter);

    if (!rows.length) {
      wrapper.innerHTML = `<div class="empty-state">
        <div class="empty-icon">&#x1F4C5;</div>
        <p>No reservations${activeFilter !== 'all' ? ` with status "${activeFilter}"` : ''}.</p>
      </div>`;
      return;
    }

    wrapper.innerHTML = `
      <div class="table-wrapper" style="overflow-x:auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Dates</th>
              <th>About Visit</th>
              <th>Status</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => renderRow(r)).join('')}
          </tbody>
        </table>
      </div>`;

    wrapper.querySelectorAll('.status-form').forEach(form => {
      form.addEventListener('submit', handleStatusUpdate);
    });
  }

  function renderRow(r) {
    const name  = [r.user_first_name, r.user_last_name].filter(Boolean).join(' ');
    const isBlock   = r.status === 'blocked';
    const canUpdate = isBlock || ['pending','approved'].includes(r.status);

    let updateCell;
    if (isBlock) {
      updateCell = `
        <form class="status-form" data-id="${r.id}">
          <input type="hidden" name="status" value="cancelled" />
          <button type="submit" class="button small">Remove Block</button>
        </form>`;
    } else if (canUpdate) {
      updateCell = `
        <form class="status-form" data-id="${r.id}">
          <select name="status">
            <option value="">— set status —</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <textarea name="note" placeholder="Optional note for guest…"></textarea>
          <button type="submit" class="button primary small">Save</button>
        </form>`;
    } else {
      updateCell = '<span style="color:#9fa6a8;font-size:0.85em;">—</span>';
    }

    return `
      <tr data-id="${r.id}">
        <td>
          <div class="user-name">${escapeHtml(isBlock ? '(Admin block)' : (name || '—'))}</div>
          <div class="user-email">${escapeHtml(r.user_email)}</div>
        </td>
        <td style="white-space:nowrap;">
          ${fmtDate(r.start_date)}<br>
          <small style="color:#9fa6a8;">to ${fmtDate(r.end_date)}</small>
        </td>
        <td style="word-break:break-word;font-size:0.85em;">
          ${r.description ? escapeHtml(r.description) : '<em style="color:#9fa6a8;">—</em>'}
          ${r.admin_note  ? `<div style="margin-top:0.4em;font-style:italic;color:#8cd1a8;">Note: ${escapeHtml(r.admin_note)}</div>` : ''}
        </td>
        <td><span class="badge badge-${r.status}">${r.status}</span></td>
        <td>${updateCell}</td>
      </tr>`;
  }

  async function handleStatusUpdate(e) {
    e.preventDefault();
    const form   = e.currentTarget;
    const id     = form.dataset.id;
    const status = form.querySelector('[name="status"]').value;
    const note   = form.querySelector('[name="note"]').value.trim();

    if (!status) {
      alert('Please select a status.');
      return;
    }

    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await API.put(`/api/admin/reservations/${id}`, {
        status,
        admin_note: note || undefined,
      });
      await load(); // refresh table
    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }

  await load();
})();

function fmtDate(dateStr) {
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
