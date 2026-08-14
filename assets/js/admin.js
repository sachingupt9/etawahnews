/* ===================================================================
   admin.js — Admin dashboard stats + query management table.
   Talks to the same backend API used by contact.js.
=================================================================== */

const AdminAPI = (() => {
  const BASE = 'http://localhost:4000/api';
  async function listQueries(){
    const res = await fetch(`${BASE}/contact`);
    if (!res.ok) throw new Error('Could not load queries');
    return res.json();
  }
  async function updateStatus(queryId, status){
    const res = await fetch(`${BASE}/contact/${queryId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Could not update status');
    return res.json();
  }
  async function deleteQuery(queryId){
    const res = await fetch(`${BASE}/contact/${queryId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete query');
    return res.json();
  }
  function exportUrl(params){
    const qs = new URLSearchParams(params).toString();
    return `${BASE}/contact/export${qs ? '?' + qs : ''}`;
  }
  return { listQueries, updateStatus, deleteQuery, exportUrl };
})();

/* ---------------- Dashboard stats (dashboard.html) ---------------- */
async function initDashboardStats(){
  const el = document.querySelector('#dashboard-stats');
  if (!el) return;
  try{
    const queries = await AdminAPI.listQueries();
    const total = queries.length;
    const byStatus = s => queries.filter(q => q.status === s).length;
    const stats = [
      { num: total, lbl: 'Total Queries' },
      { num: byStatus('New'), lbl: 'New Queries' },
      { num: byStatus('In Progress'), lbl: 'In Progress' },
      { num: byStatus('Resolved') + byStatus('Closed'), lbl: 'Resolved' },
    ];
    el.querySelectorAll('.admin-stat').forEach((card, i) => {
      if (!stats[i]) return;
      card.querySelector('.num').textContent = stats[i].num;
      card.querySelector('.lbl').textContent = stats[i].lbl;
    });
    animateCounters(el);

    const recentBody = document.querySelector('#recent-queries-body');
    if (recentBody){
      const recent = [...queries].sort((a,b) => b.queryId.localeCompare(a.queryId)).slice(0, 5);
      recentBody.innerHTML = recent.map(rowHTML).join('') || `<tr><td colspan="6">No queries yet.</td></tr>`;
    }
  }catch(err){
    el.innerHTML = `<p style="color:var(--color-accent);grid-column:1/-1;">Could not reach the backend API at http://localhost:4000. Start the backend server (see README) to see live stats.</p>`;
  }
}

function animateCounters(container){
  container.querySelectorAll('.num').forEach(el => {
    const target = parseInt(el.textContent, 10) || 0;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
      current += step;
      if (current >= target){ current = target; clearInterval(timer); }
      el.textContent = current;
    }, 20);
  });
}

/* ---------------- Query management table (queries.html) ---------------- */
let ALL_QUERIES = [];

function rowHTML(q){
  const statusClass = { 'New':'new', 'In Progress':'progress', 'Resolved':'resolved', 'Closed':'closed' }[q.status] || 'new';
  return `
    <tr data-id="${q.queryId}">
      <td><span style="font-family:var(--font-mono);">${q.queryId}</span></td>
      <td>${q.fullName}</td>
      <td>${q.email}</td>
      <td>${q.mobile}</td>
      <td>${q.subject}</td>
      <td>${q.queryType}</td>
      <td>${q.submissionDate}</td>
      <td><span class="status-pill ${statusClass}">${q.status}</span></td>
      <td>
        <div class="row-actions">
          <button data-action="view" data-id="${q.queryId}">View</button>
          <button data-action="status" data-id="${q.queryId}">Status</button>
          <button data-action="delete" data-id="${q.queryId}">Delete</button>
        </div>
      </td>
    </tr>`;
}

async function initQueryTable(){
  const tbody = document.querySelector('#queries-table-body');
  if (!tbody) return;

  async function refresh(){
    tbody.innerHTML = `<tr><td colspan="9">Loading queries...</td></tr>`;
    try{
      ALL_QUERIES = await AdminAPI.listQueries();
      applyFilters();
    }catch(err){
      tbody.innerHTML = `<tr><td colspan="9" style="color:var(--color-accent);">Could not reach backend API at http://localhost:4000. Start the backend server (see README).</td></tr>`;
    }
  }

  function applyFilters(){
    const statusFilter = document.querySelector('#filter-status')?.value || '';
    const typeFilter = document.querySelector('#filter-type')?.value || '';
    const search = (document.querySelector('#filter-search')?.value || '').toLowerCase();

    let rows = ALL_QUERIES;
    if (statusFilter) rows = rows.filter(q => q.status === statusFilter);
    if (typeFilter) rows = rows.filter(q => q.queryType === typeFilter);
    if (search) rows = rows.filter(q =>
      q.fullName.toLowerCase().includes(search) ||
      q.email.toLowerCase().includes(search) ||
      q.queryId.toLowerCase().includes(search)
    );
    tbody.innerHTML = rows.length ? rows.map(rowHTML).join('') : `<tr><td colspan="9">No matching queries.</td></tr>`;
  }

  document.querySelector('#filter-status')?.addEventListener('change', applyFilters);
  document.querySelector('#filter-type')?.addEventListener('change', applyFilters);
  document.querySelector('#filter-search')?.addEventListener('input', applyFilters);

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const q = ALL_QUERIES.find(x => x.queryId === id);
    if (btn.dataset.action === 'view') openViewModal(q);
    if (btn.dataset.action === 'status') openStatusModal(q, refresh);
    if (btn.dataset.action === 'delete'){
      if (confirm(`Delete query ${id}? This cannot be undone.`)){
        try{ await AdminAPI.deleteQuery(id); PV.toast('Query deleted.', 'success'); refresh(); }
        catch(err){ PV.toast('Delete failed.', 'error'); }
      }
    }
  });

  document.querySelector('#export-btn')?.addEventListener('click', () => {
    const status = document.querySelector('#filter-status')?.value || '';
    const queryType = document.querySelector('#filter-type')?.value || '';
    window.location.href = AdminAPI.exportUrl({ status, queryType });
  });

  refresh();
}

function openViewModal(q){
  if (!q) return;
  const overlay = document.querySelector('#query-modal-overlay');
  overlay.querySelector('.modal-body').innerHTML = `
    <h3>Query ${q.queryId}</h3>
    <p><strong>Name:</strong> ${q.fullName}</p>
    <p><strong>Email:</strong> ${q.email}</p>
    <p><strong>Mobile:</strong> ${q.mobile}</p>
    <p><strong>Subject:</strong> ${q.subject}</p>
    <p><strong>Type:</strong> ${q.queryType}</p>
    <p><strong>Message:</strong> ${q.message}</p>
    <p><strong>Attachment:</strong> ${q.attachment || 'None'}</p>
    <p><strong>Submitted:</strong> ${q.submissionDate} ${q.submissionTime}</p>
    <p><strong>Status:</strong> <span class="status-pill new">${q.status}</span></p>
  `;
  overlay.classList.add('open');
}

function openStatusModal(q, onDone){
  if (!q) return;
  const overlay = document.querySelector('#query-modal-overlay');
  overlay.querySelector('.modal-body').innerHTML = `
    <h3>Update Status — ${q.queryId}</h3>
    <div class="form-group">
      <label for="status-select">New status</label>
      <select id="status-select">
        ${['New','In Progress','Resolved','Closed'].map(s => `<option value="${s}" ${s===q.status?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-block" id="status-save-btn">Save Status</button>
  `;
  overlay.classList.add('open');
  overlay.querySelector('#status-save-btn').addEventListener('click', async () => {
    const newStatus = overlay.querySelector('#status-select').value;
    try{
      await AdminAPI.updateStatus(q.queryId, newStatus);
      PV.toast('Status updated.', 'success');
      overlay.classList.remove('open');
      onDone();
    }catch(err){ PV.toast('Update failed.', 'error'); }
  });
}

function initModalClose(){
  const overlay = document.querySelector('#query-modal-overlay');
  if (!overlay) return;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
  overlay.querySelector('.modal-close')?.addEventListener('click', () => overlay.classList.remove('open'));
}

function highlightAdminNav(){
  const page = window.location.pathname.split('/').pop();
  const map = { 'dashboard.html':'dashboard', 'queries.html':'queries', 'news-management.html':'news' };
  const key = map[page];
  if (!key) return;
  document.querySelector(`.admin-nav a[data-nav="${key}"]`)?.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  initDashboardStats();
  initQueryTable();
  initModalClose();
  highlightAdminNav();
});
