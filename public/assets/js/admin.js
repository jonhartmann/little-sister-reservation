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
    sessionStorage.removeItem('ls_session');
    window.location.href = '/';
  });

  // ── Admin calendar ────────────────────────────────────────

  const adminCal = new ReservationCalendar({
    containerId: 'admin-calendar-container',
    prevBtnId:   'admin-cal-prev',
    nextBtnId:   'admin-cal-next',
    labelId:     'admin-cal-month-label',
    readOnly:    true,
  });
  adminCal.render();

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

  // ── Load ──────────────────────────────────────────────────

  async function load() {
    const wrapper = document.getElementById('admin-table-wrapper');
    try {
      allReservations = await API.get('/api/admin/reservations');
      adminCal.setBookedRanges(
        allReservations.filter(r => ['approved', 'pending', 'blocked'].includes(r.status))
      );
      renderGroups();
    } catch (err) {
      wrapper.innerHTML = `<div class="msg-error">${err.message}</div>`;
    }
  }

  // ── Grouped render ────────────────────────────────────────

  function renderGroups() {
    const wrapper = document.getElementById('admin-table-wrapper');
    const todayKey = new Date().toISOString().slice(0, 10);

    const byStart = (a, b) => a.start_date < b.start_date ? -1 : 1;
    const byStartDesc = (a, b) => a.start_date < b.start_date ? 1 : -1;

    const groups = [
      {
        label: 'Pending',
        rows: allReservations
          .filter(r => r.status === 'pending')
          .sort(byStart),
      },
      {
        label: 'Upcoming',
        rows: allReservations
          .filter(r => r.status === 'approved' || (r.status === 'blocked' && r.start_date >= todayKey))
          .sort(byStart),
      },
      {
        label: 'Complete',
        rows: allReservations
          .filter(r => r.status === 'complete')
          .sort(byStartDesc),
      },
      {
        label: 'Cancelled',
        rows: allReservations
          .filter(r => ['cancelled', 'denied', 'expired'].includes(r.status))
          .sort(byStartDesc),
      },
    ];

    const populated = groups.filter(g => g.rows.length > 0);

    if (!populated.length) {
      wrapper.innerHTML = `<div class="empty-state">
        <div class="empty-icon">&#x1F4C5;</div>
        <p>No reservations yet.</p>
      </div>`;
      return;
    }

    wrapper.innerHTML = populated.map(group => `
      <div class="res-group">
        <div class="res-group-header">${group.label}</div>
        <div class="res-cards">
          ${group.rows.map(r => renderCard(r)).join('')}
        </div>
      </div>
    `).join('');

    wrapper.querySelectorAll('.status-form, .arc-block-form').forEach(form => {
      form.addEventListener('submit', handleStatusUpdate);
    });
  }

  function renderCard(r) {
    const isBlock = r.status === 'blocked';
    const name = isBlock
      ? 'Admin Block'
      : ([r.user_first_name, r.user_last_name].filter(Boolean).join(' ') || r.user_email);

    const dates = fmtAdminDateRange(r.start_date, r.end_date);

    const commentParts = [
      r.description ? escapeHtml(r.description) : null,
      r.admin_note  ? `<span class="arc-note">Note: ${escapeHtml(r.admin_note)}</span>` : null,
    ].filter(Boolean);
    const commentsHtml = commentParts.join('<br>');

    if (isBlock) {
      return `
        <div class="admin-res-card" data-id="${r.id}">
          <div class="arc-row1">
            <span class="arc-dates">${dates}</span>
            <span class="arc-guest">${escapeHtml(name)}</span>
            <div class="arc-right">
              <span class="badge badge-blocked">blocked</span>
              <form class="arc-block-form" data-id="${r.id}">
                <input type="hidden" name="status" value="cancelled" />
                <button type="submit" class="button small">Remove</button>
              </form>
            </div>
          </div>
        </div>`;
    }

    let actionsHtml = '';
    if (['pending', 'approved'].includes(r.status)) {
      actionsHtml = `
        <details class="arc-update">
          <summary>Update &#9662;</summary>
          <form class="status-form" data-id="${r.id}">
            <select name="status">
              <option value="">— set status —</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <textarea name="note" placeholder="Optional note for guest…"></textarea>
            <button type="submit" class="button primary small">Save</button>
          </form>
        </details>`;
    }

    const row2 = commentsHtml || actionsHtml ? `
      <div class="arc-row2">
        <div class="arc-comments">${commentsHtml}</div>
        ${actionsHtml ? `<div class="arc-actions">${actionsHtml}</div>` : ''}
      </div>` : '';

    return `
      <div class="admin-res-card" data-id="${r.id}">
        <div class="arc-row1">
          <span class="arc-dates">${dates}</span>
          <span class="arc-guest">${escapeHtml(name)}</span>
          <div class="arc-right">
            <span class="badge badge-${r.status}">${r.status}</span>
          </div>
        </div>
        ${row2}
      </div>`;
  }

  async function handleStatusUpdate(e) {
    e.preventDefault();
    const form   = e.currentTarget;
    const id     = form.dataset.id;
    const status = form.querySelector('[name="status"]').value;
    const note   = form.querySelector('[name="note"]')?.value.trim() ?? '';

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
      await load();
    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }

  await load();
})();

function fmtAdminDateRange(startStr, endStr) {
  const currentYear = new Date().getFullYear();
  const [sy, sm, sd] = startStr.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = endStr.slice(0, 10).split('-').map(Number);
  const showYear = sy !== currentYear || ey !== currentYear || sy !== ey;
  if (showYear) {
    return `${sm}/${sd}/${String(sy).slice(2)} \u2192 ${em}/${ed}/${String(ey).slice(2)}`;
  }
  return `${sm}/${sd} \u2192 ${em}/${ed}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
