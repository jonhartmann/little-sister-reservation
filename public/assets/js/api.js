/* Little Sister — API client */
'use strict';

const API = {
  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get:    (path)       => API.request('GET',    path),
  post:   (path, body) => API.request('POST',   path, body),
  put:    (path, body) => API.request('PUT',    path, body),
  patch:  (path, body) => API.request('PATCH',  path, body),
};

function showMessage(containerId, text, type) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="msg-${type}">${text}</div>`;
}

function formatDate(dateStr) {
  const [year, month, day] = String(dateStr).slice(0, 10).split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}
