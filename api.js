const API_BASE = 'http://localhost:5000/api';

// ── Auth guard ──────────────────────────────────────────────
(function checkAuth() {
  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
  }
})();

// ── Show user info in sidebar ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const sidebar = document.querySelector('.sidebar');
  if (sidebar && user.name) {
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
      position: absolute; bottom: 20px; left: 0; right: 0;
      padding: 0 16px; font-size: 12px; color: #aaa;
    `;
    infoDiv.innerHTML = `
      <div style="border-top:1px solid #333;padding-top:12px;margin-bottom:8px;"></div>
      <div style="font-weight:bold;color:#fff;font-size:13px;margin-bottom:2px;">
        ${user.salonName || 'My Salon'}
      </div>
      <div style="color:#aaa;margin-bottom:2px;">@${user.userId || user.name}</div>
      <div style="color:#666;font-size:11px;margin-bottom:10px;">${user.name}</div>
      <button onclick="logout()" style="
        width:100%;padding:7px;background:#e74c3c;
        color:white;border:none;border-radius:6px;
        cursor:pointer;font-size:12px;
      ">Log Out</button>
    `;
    sidebar.appendChild(infoDiv);
  }
});

// ── Logout ──────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// ── Authenticated fetch helper ───────────────────────────────
async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');

  const options = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  if (body) options.body = JSON.stringify(body);

  const res  = await fetch(API_BASE + path, options);
  const data = await res.json();

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
    return;
  }

  if (!res.ok) throw new Error(data.message || 'API error');

  return data;
}