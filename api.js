// api.js - Global API Helper and Auth

const BASE_URL = 'http://localhost:5000/api';

// Global API helper
async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const res = await fetch(BASE_URL + path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401) { 
    logout(); 
    return; 
  }
  
  if (!res.ok) {
    const errText = await res.text();
    let errMsg = errText;
    try {
        const errObj = JSON.parse(errText);
        errMsg = errObj.msg || errObj.message || errText;
    } catch(e) {}
    throw new Error(errMsg);
  }
  
  return res.json();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Ensure user is logged in before rendering the SPA
if (!localStorage.getItem('token') && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
  window.location.href = 'login.html';
}

// Global Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '8px';
  toast.style.color = 'white';
  toast.style.fontWeight = 'bold';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  toast.style.background = type === 'success' ? '#27ae60' : '#e74c3c';
  toast.style.transition = 'opacity 0.3s ease-in-out';
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Centralized refresher for cross-module updates
function refreshRelated(modules) {
  // If the currently visible section is in the modules array, reload it.
  const activeSection = document.querySelector('.section:not(.section-hidden)');
  if (activeSection) {
      const activeId = activeSection.id; // e.g., 'home', 'inventory'
      
      // Map div IDs to load functions
      const reloadMap = {
          'home': loadDashboard,
          'calendar': loadCalendar,
          'clients': loadClients,
          'staff': loadStaff,
          'services': loadServices,
          'inventory': loadInventory,
          'checkout': () => { populateProductDropdown(); populateServiceDropdown(); loadBillHistory(); },
          'reports': loadReports,
          'settings': loadSettings
      };

      // Check if the current active tab needs a reload
      // 'dashboard' in modules -> reload 'home'
      if (modules.includes('dashboard') && activeId === 'home') reloadMap['home']();
      if (modules.includes(activeId) && reloadMap[activeId]) {
          reloadMap[activeId]();
      }
  }
}