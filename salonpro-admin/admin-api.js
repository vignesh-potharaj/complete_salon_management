// admin-api.js - Admin API Helper and Auth

const CONFIG = {
  API_URL: (typeof process !== 'undefined' && process.env?.API_URL) || 
           window.ENV?.API_URL || 
           (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
             ? 'http://localhost:5000/api'
             : 'https://salonpro-backend-javg.onrender.com/api')
};

const ADMIN_API_BASE = CONFIG.API_URL;

async function adminApi(path, options = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let res;
  try {
    res = await fetch(ADMIN_API_BASE + path, {
      method: options.method || 'GET',
      headers: {
        ...headers,
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (networkErr) {
    console.error('Network/CORS error on', path, networkErr);
    throw new Error('Cannot reach server. Check your connection or try again.');
  }

  if (res.status === 401 || res.status === 403) {
    adminLogout();
    return;
  }

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = errText;
    try {
      const errObj = JSON.parse(errText);
      errMsg = errObj.msg || errObj.message || errText;
    } catch (e) { }
    throw new Error(errMsg);
  }

  return res.json();
}

function adminLogout() {
  localStorage.removeItem('admin_token');
  window.location.href = '/';
}
