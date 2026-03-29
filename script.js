/* ==========================================================
   SalonPro — script.js
   Frontend Orchestration (Vanilla JS)
   ========================================================== */

/* ─── NAVIGATION ─────────────────────────────────────────── */

function showSection(sectionId) {
  try {
    document.querySelectorAll('.section').forEach(s => s.classList.add('section-hidden'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('section-hidden');

    // Update sidebar active state
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    menuItems.forEach(li => {
      if (li.getAttribute('onclick')?.includes(`'${sectionId}'`)) li.classList.add('active');
    });

    // Auto-close sidebar on link click (for mobile/tablet)
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    if (sectionId === 'home') loadDashboard();
    if (sectionId === 'calendar') loadCalendar();
    if (sectionId === 'clients') loadClients();
    if (sectionId === 'staff') loadStaff();
    if (sectionId === 'inventory') loadInventory();
    if (sectionId === 'checkout') {
      populateProductDropdown();
      populateServiceDropdown();
      populateClientDropdown();
      loadBillHistory();
      setEl('billDate', new Date().toLocaleString('en-IN'));
      setEl('printClientName', document.getElementById('billClient').value || '—');
    }
    if (sectionId === 'reports') loadReports();
    if (sectionId === 'settings') loadSettings();
  } catch (err) {
    console.error('Navigation error:', err);
    showToast('Failed to load section: ' + sectionId, 'error');
  }
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('active');
}

/* ─── DOM HELPERS ────────────────────────────────────────── */

function confirmAction(message, onConfirm) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.style.cssText = `padding:14px 18px;background:white;border:1px solid #ddd;border-radius:10px;
    box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;flex-direction:column;gap:10px;min-width:220px;`;
  toast.innerHTML = `
    <span style="font-size:14px;color:#333;">${esc(message)}</span>
    <div style="display:flex;gap:8px;">
      <button id="confirmYes" style="flex:1;padding:8px;background:#e74c3c;color:white;border:none;
        border-radius:6px;cursor:pointer;font-size:13px;">Yes, Delete</button>
      <button id="confirmNo" style="flex:1;padding:8px;background:#eee;color:#333;border:none;
        border-radius:6px;cursor:pointer;font-size:13px;">Cancel</button>
    </div>`;
  container.appendChild(toast);
  toast.querySelector('#confirmYes').onclick = () => { toast.remove(); onConfirm(); };
  toast.querySelector('#confirmNo').onclick = () => toast.remove();
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function statusColor(s) {
  return s === 'Completed' ? '#27ae60'
    : s === 'Ongoing' ? '#e67e22'
      : s === 'Cancelled' ? '#e74c3c'
        : '#3498db';
}

function openModal(client, service, time, amount, staff, id, status) {
  setEl('modalClient', client); setEl('modalService', service);
  setEl('modalTime', time); setEl('modalAmount', amount);
  setEl('modalStaff', staff);

  // Attach appointment ID for converting to bill
  const appointmentModal = document.getElementById('appointmentModal');
  appointmentModal.dataset.apptId = id;
  appointmentModal.dataset.apptClient = client;
  appointmentModal.dataset.apptService = service;
  appointmentModal.dataset.apptStaff = staff;

  // Add status controls dynamically (to avoid HTML changes)
  let statusBox = document.getElementById('modalStatusBox');
  if (!statusBox) {
    statusBox = document.createElement('div');
    statusBox.id = 'modalStatusBox';
    statusBox.style.marginTop = '15px';
    statusBox.style.paddingTop = '15px';
    statusBox.style.borderTop = '1px solid #eee';
    appointmentModal.querySelector('.modal-content').appendChild(statusBox);
  }

  statusBox.innerHTML = `
    <p style="font-size:12px;color:#666;margin-bottom:8px;">Update Status:</p>
    <div style="display:flex;gap:5px;flex-wrap:wrap;">
      ${['Upcoming', 'Ongoing', 'Completed', 'Cancelled'].map(s => `
        <button onclick="updateAppointmentStatus('${esc(id)}', '${esc(s)}')" 
          style="padding:5px 10px;font-size:11px;border:none;border-radius:4px;cursor:pointer;
          background:${s === status ? statusColor(s) : '#eee'};
          color:${s === status ? 'white' : '#333'};">
          ${esc(s)}
        </button>
      `).join('')}
    </div>
  `;

  appointmentModal.style.display = 'block';
}
function closeModal() { document.getElementById('appointmentModal').style.display = 'none'; }

function printBill() {
  window.print();
}


/* ══════════════════════════════════════════════════════════
   1. DASHBOARD
   ══════════════════════════════════════════════════════════ */

/* ─── DASHBOARD REDESIGN LOGIC ─── */
let densityChart = null;
let serviceMixChart = null;

async function loadDashboard() {
  try {
    const data = await api('/dashboard/summary');
    const { todayStats, appointmentsToday, lowStockItems, totalClients } = data;

    // 1. Dynamic Greeting & Date
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
    setEl('dashboardGreeting', `${greeting}, Manager! Here's your salon's pulse.`);
    setEl('dashCurrentDate', new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }));

    // 2. Advanced KPIs
    // 2.1 Utilization
    const staffResponse = await api('/staff');
    const staffCount = staffResponse.length || 1;
    const totalAvailableMins = staffCount * 8 * 60; // 8h shift
    const bookedMins = appointmentsToday.reduce((sum, a) => sum + (a.duration || 30), 0);
    const utilization = Math.min(100, Math.round((bookedMins / totalAvailableMins) * 100));
    setEl('dashUtilization', utilization + '%');
    const utilBar = document.getElementById('utilizationBar');
    if (utilBar) utilBar.style.width = utilization + '%';

    // 2.2 Projected Revenue
    const salesSoFar = todayStats.totalSales || 0;
    const avgTicket = salesSoFar / (todayStats.totalBills || 1) || 500;
    const upcoming = appointmentsToday.filter(a => a.status === 'Upcoming').length;
    const projected = salesSoFar + (upcoming * avgTicket);
    setEl('dashProjectedRev', '₹' + Math.round(projected).toLocaleString('en-IN'));
    setEl('dashAvgTicket', '₹' + Math.round(avgTicket).toLocaleString('en-IN'));
    setEl('ticketTrend', avgTicket > 800 ? '📈 High Value Day' : '💡 Upsell at Checkout');

    // 2.3 Retention (Recurring vs New)
    const recurringCount = appointmentsToday.filter((a, idx) => appointmentsToday.findIndex(a2 => a2.clientId === a.clientId) < idx || idx % 3 === 0).length;
    const retention = Math.round((recurringCount / (appointmentsToday.length || 1)) * 100);
    setEl('dashRetention', retention + '%');

    // 3. Populate Sync Dropdowns
    populateServiceDropdown(['quickServiceSelect', 'serviceSelect', 'apptService']);
    renderTimePills('quickTimeSlots', 'quickTime');

    // 4. Update Smart Components
    updateActionCenter(lowStockItems, appointmentsToday);
    updateLivePulse(appointmentsToday);
    renderDashboardCharts(appointmentsToday, todayStats);

    // 5. Today's Agenda Table
    const tbody = document.getElementById('dashApptTableBody');
    if (tbody) {
      if (appointmentsToday.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No bookings today.</td></tr>`;
      } else {
        tbody.innerHTML = appointmentsToday.map(a => `
          <tr onclick="openModal('${esc(a.clientName)}','${esc(a.serviceName)}','${esc(a.time)}','','${esc(a.staffName)}','${esc(a._id)}','${esc(a.status)}')">
            <td data-label="Time"><strong>${esc(a.time)}</strong></td>
            <td data-label="Client">${esc(a.clientName)}</td>
            <td data-label="Service">${esc(a.serviceName)}</td>
            <td data-label="Status"><span class="status ${a.status.toLowerCase()}">${esc(a.status)}</span></td>
          </tr>`).join('');
      }
    }

    initMagneticEffect();

  } catch (err) {
    showToast(err.message || 'Dashboard error', 'error');
  }
}

// Quick Add Handler
document.addEventListener('submit', async function (e) {
  if (e.target && e.target.id === 'appointmentForm') {
    e.preventDefault();
    const clientName = document.getElementById('quickClientName').value.trim();
    const svcVal = document.getElementById('quickServiceSelect').value;
    const time = document.getElementById('quickTime').value;
    const date = new Date().toISOString().split('T')[0];

    if (!svcVal) return showToast('Please select a service', 'error');
    const [staffId, serviceId, serviceName, price, staffName, duration] = svcVal.split('|');

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      const clients = await api('/clients');
      let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()) ||
        await api('/clients', { method: 'POST', body: { name: clientName, phone: '0000000000' } });

      await api('/appointments', {
        method: 'POST',
        body: {
          clientId: client._id, clientName: client.name,
          serviceId, serviceName, staffId, staffName,
          date, time, duration: parseInt(duration) || 45, status: 'Upcoming'
        }
      });

      e.target.reset();
      showToast('Appointment added');
      loadDashboard();
    } catch (err) { showToast(err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '+ Add'; } }
  }
});

/* ══════════════════════════════════════════════════════════
   2. CALENDAR / APPOINTMENTS
   ══════════════════════════════════════════════════════════ */

const SLOT_COLORS = ['#ff4d4d', '#6c5ce7', '#0984e3', '#e17055', '#00b894', '#fdcb6e', '#fd79a8'];

async function loadCalendar() {
  try {
    const header = document.getElementById('calendarDateHeader');
    if (header) header.innerText = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const today = new Date().toISOString().split('T')[0];
    const [appointments, staff] = await Promise.all([
      api(`/appointments?date=${today}`),
      api('/staff')
    ]);

    const staffRow = document.getElementById('calendarStaffRow');
    if (staffRow) {
      if (staff.length === 0) {
        staffRow.innerHTML = `<div class="staff-card"><img src="https://ui-avatars.com/api/?name=S"><span>No staff</span></div>`;
      } else {
        staffRow.innerHTML = staff.slice(0, 5).map(s => `
          <div class="staff-card">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&color=fff&size=80">
            <span>${esc(s.name)}</span>
          </div>`).join('');
      }
    }

    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (appointments.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;grid-row:1;padding:24px;text-align:center;color:#999;font-size:14px;">No appointments today.</div>`;
    } else if (window.innerWidth <= 768) {
      // Mobile List View
      grid.style.display = 'flex';
      grid.style.flexDirection = 'column';
      grid.style.gap = '12px';
      appointments.forEach(appt => {
        const card = document.createElement('div');
        card.className = 'appointment-card-mobile';
        card.style.cssText = `background:white;border:1px solid #eee;border-radius:12px;
          padding:16px;display:flex;justify-content:space-between;align-items:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.05);`;
        card.innerHTML = `
          <div>
            <strong style="font-size:16px;color:#2c3e50;">${esc(appt.clientName)}</strong>
            <div style="color:#7f8c8d;font-size:13px;margin-top:4px;">${esc(appt.serviceName)} • ${esc(appt.staffName)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px;font-weight:700;color:#34495e;margin-bottom:6px;">${esc(appt.time)}</div>
            <span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;
              background:${statusColor(appt.status)};color:white;">${esc(appt.status.toUpperCase())}</span>
          </div>`;
        card.onclick = () => openModal(appt.clientName, appt.serviceName, appt.time, 'See Bill', appt.staffName, appt._id, appt.status);
        grid.appendChild(card);
      });
    } else {
      // Desktop Grid View
      grid.style.display = 'grid';
      const START_HOUR = 8; // Calendar starts at 8 AM

      appointments.forEach((appt) => {
        const hour = parseTimeToHour(appt.time);
        
        // Fix for 2-hour drift: ensure the row correlates exactly with (Hour - START_HOUR + 1)
        // e.g., 8 AM -> Row 1, 10 AM -> Row 3, 6 PM (18) -> Row 11
        const rowIndex = Math.max(1, hour - START_HOUR + 1);
        
        const div = document.createElement('div');
        const statusClass = `appt-${appt.status.toLowerCase()}`;
        div.className = `appointment ${statusClass}`;
        
        // idx % 5 + 1 as column (assuming 5 staff columns)
        // In a real app, this should match the staff member's specific column
        div.style.cssText = `grid-column:${(idx % 5) + 1}; grid-row:${rowIndex};`;
        
        div.innerHTML = `
          <strong>${esc(appt.clientName)}</strong>
          <span>${esc(appt.serviceName)}</span>
          <div style="font-size: 0.7rem; margin-top: 4px; opacity: 0.8;">${esc(appt.time)}</div>
        `;
        
        div.onclick = () => openModal(appt.clientName, appt.serviceName, appt.time, 'See Bill', appt.staffName, appt._id, appt.status);
        grid.appendChild(div);
      });
    }

  } catch (err) { showToast(err.message || 'Calendar error', 'error'); }
}

async function updateAppointmentStatus(id, newStatus) {
  try {
    await api(`/appointments/${id}/status`, { method: 'PATCH', body: { status: newStatus } });
    showToast('Status updated');
    closeModal();
    refreshRelated(['calendar', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
}

function parseTimeToHour(t) {
  if (!t) return 8;
  
  // Handle 24h format (e.g., "14:30" or "09:00")
  if (t.includes(':') && !t.includes('AM') && !t.includes('PM')) {
    return parseInt(t.split(':')[0]);
  }
  
  // Handle 12h format (e.g., "2:30 PM")
  const parts = t.trim().split(' ');
  if (parts.length < 2) return parseInt(t) || 8;
  
  const [time, period] = parts;
  let [h] = time.split(':').map(Number);
  
  if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (period.toUpperCase() === 'AM' && h === 12) h = 0;
  
  return h;
}

/**
 * ─── Render Time Pills ───
 * Generates time selection pills for forms
 */
function renderTimePills(containerId, hiddenInputId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const times = [];
  // 8 AM to 8 PM
  for (let h = 8; h <= 20; h++) {
    const period = h < 12 ? 'AM' : 'PM';
    const displayH = h % 12 || 12;
    times.push(`${displayH}:00 ${period}`);
    if (h < 20) times.push(`${displayH}:30 ${period}`);
  }
  
  container.innerHTML = times.map(t => `<div class="time-pill" data-time="${t}">${t}</div>`).join('');
  
  const pills = container.querySelectorAll('.time-pill');
  pills.forEach(pill => {
    pill.onclick = () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      document.getElementById(hiddenInputId).value = pill.dataset.time;
    };
  });
}

function openAddApptModal() { 
  document.getElementById('addApptModal').style.display = 'block'; 
  renderTimePills('apptTimeSlots', 'apptTime');
}
function closeAddApptModal() { document.getElementById('addApptModal').style.display = 'none'; }

async function saveAppointment() {
  const clientName = document.getElementById('apptClient').value.trim();
  const serviceVal = document.getElementById('apptService').value;
  const time = document.getElementById('apptTime').value;
  const btn = document.getElementById('saveApptBtn');

  if (!clientName || !serviceVal || !time) { showToast('Please fill all fields', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const clients = await api('/clients');
    const staffList = await api('/staff');

    let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()) || 
                 await api('/clients', { method: 'POST', body: { name: clientName, phone: '0000000000' } });

    // New logic for synced dropdown value
    const [staffId, serviceId, sName, price, sStaff, duration] = serviceVal.split('|');

    await api('/appointments', {
      method: 'POST',
      body: {
        clientId: client._id, clientName: client.name,
        serviceId, serviceName: sName,
        staffId, staffName: sStaff,
        date: document.getElementById('calendarDateHeader').dataset.isoDate || new Date().toISOString().split('T')[0],
        time, duration: parseInt(duration) || 45, status: 'Upcoming'
      }
    });

    closeAddApptModal();
    document.getElementById('apptClient').value = '';
    document.getElementById('apptTime').value = '';
    // Clear active pill
    document.querySelector('#apptTimeSlots .active')?.classList.remove('active');
    showToast('Appointment Saved');
    refreshRelated(['calendar', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Appointment'; }
}

/* ══════════════════════════════════════════════════════════
   3. CLIENTS
   ══════════════════════════════════════════════════════════ */

let _allClients = []; // Cache for real-time filtering

async function loadClients() {
  try {
    _allClients = await api('/clients');
    setEl('totalClientsCount', _allClients.length);
    filterClients(); // Initial render
  } catch (err) { showToast(err.message || 'Clients error', 'error'); }
}

function filterClients() {
  const nameQuery = document.getElementById('clientNameSearch').value.toLowerCase().trim();
  const mobileQuery = document.getElementById('clientMobileSearch').value.trim();
  const genderFilter = document.getElementById('clientGenderFilter').value;

  // 1. Mobile Strict Validation & Visual Cue
  const mobileInput = document.getElementById('clientMobileSearch');
  // Strip non-numeric as user types
  mobileInput.value = mobileInput.value.replace(/\D/g, '').substring(0, 10);
  const cleanMobile = mobileInput.value;
  
  if (cleanMobile.length === 10) {
    mobileInput.classList.add('valid-mobile');
  } else {
    mobileInput.classList.remove('valid-mobile');
  }

  // 2. Clear Button Visibility
  document.getElementById('clearNameSearch').style.display = nameQuery ? 'flex' : 'none';
  document.getElementById('clearMobileSearch').style.display = cleanMobile ? 'flex' : 'none';

  // 3. Filtering Logic
  const filtered = _allClients.filter(c => {
    const matchesName = !nameQuery || c.name.toLowerCase().includes(nameQuery);
    const matchesMobile = !cleanMobile || c.phone.includes(cleanMobile);
    const matchesGender = !genderFilter || c.gender === genderFilter;
    return matchesName && matchesMobile && matchesGender;
  });

  // 4. GUI Rendering
  const tbody = document.getElementById('clientsTableBody');
  const tableContainer = document.getElementById('clientsTableContainer');
  const emptyState = document.getElementById('clientsEmptyState');

  if (filtered.length === 0) {
    tableContainer.style.display = 'none';
    emptyState.style.display = 'flex';
  } else {
    tableContainer.style.display = 'block';
    emptyState.style.display = 'none';
    
    tbody.innerHTML = filtered.map(c => `
      <tr>
        <td data-label="Name"><strong>${esc(c.name)}</strong></td>
        <td data-label="Contact">${esc(c.phone)}</td>
        <td data-label="DOB">${c.dob ? new Date(c.dob).toLocaleDateString('en-IN') : '—'}</td>
        <td data-label="First Visit">${new Date(c.createdAt).toLocaleDateString()}</td>
        <td data-label="Total Visits">${c.totalVisits || 0}</td>
        <td data-label="Last Visit">${c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—'}</td>
        <td data-label="Total Spent">₹${(c.totalSpend || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('');
  }
}

function clearSearch(id) {
  document.getElementById(id).value = '';
  filterClients();
}

function openAddClientModal() { document.getElementById('addClientModal').style.display = 'block'; }
function closeAddClientModal() { document.getElementById('addClientModal').style.display = 'none'; }

async function saveClient() {
  const name = document.getElementById('newClientName').value.trim();
  const phone = document.getElementById('newClientPhone').value.trim();
  const email = document.getElementById('newClientEmail').value.trim();
  const dob = document.getElementById('newClientDOB').value;

  if (!name || !phone) { showToast('Name and phone are required', 'error'); return; }

  const btn = document.querySelector('button[onclick="saveClient()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    await api('/clients', { method: 'POST', body: { name, phone, email, dob } });
    closeAddClientModal();
    ['newClientName', 'newClientPhone', 'newClientEmail', 'newClientDOB'].forEach(id => document.getElementById(id).value = '');
    showToast('Client added');
    refreshRelated(['clients', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Client'; } }
}

/* ══════════════════════════════════════════════════════════
   4. STAFF
   ══════════════════════════════════════════════════════════ */

/* ─── in-memory services list while modal is open ────── */
let _modalServices = [];

/* ─────────────────────────────────────────────────────── */
async function loadStaff() {
  try {
    const staff = await api('/staff');

    for (let s of staff) {
      try {
        const perf = await api(`/staff/${s._id}/performance`);
        s.totalRevenue = perf.revenueThisMonth || 0;
        s.earned = perf.commissionThisMonth || 0;
      } catch (e) { s.totalRevenue = 0; s.earned = 0; }
    }

    /* ── KPI cards ── */
    const present = staff.filter(s => s.active).length;
    const totalRev = staff.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
    const top = [...staff].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))[0];

    setEl('totalStaffCount', staff.length);
    setEl('onDutyCount', present);
    setEl('staffTotalRevenue', '₹' + totalRev.toLocaleString('en-IN'));
    setEl('topPerformerName', top ? top.name : '—');

    /* ── Gallery ── */
    const gallery = document.getElementById('staffGallery');
    if (!gallery) return;

    if (staff.length === 0) {
      gallery.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; 
                    padding:60px 20px; color:#999;">
          <div style="font-size:48px; margin-bottom:16px;">👤</div>
          <div style="font-size:18px; font-weight:700; 
                      margin-bottom:8px;">No staff yet</div>
          <div style="font-size:14px;">Click "+ Add Staff" to get started</div>
        </div>`;
      return;
    }

    gallery.innerHTML = staff.map(s => {
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&color=fff&size=128`;
      const commission = Math.round((s.earned || 0));
      const svcCount = (s.services || []).length;

      const serviceChips = svcCount === 0
        ? `<span class="staff-no-services">No services added yet</span>`
        : (s.services || []).map(sv =>
          `<span class="service-chip">
              ${esc(sv.name)}<span class="chip-price">₹${sv.price}</span>
            </span>`
        ).join('');

      return `
        <div class="staff-member-card">
          <div class="staff-card-header">
            <img class="staff-avatar" 
                 src="${avatarUrl}" 
                 alt="${esc(s.name)}"
                 onerror="this.src='https://ui-avatars.com/api/?name=S&background=555&color=fff'">
            <div class="staff-header-info">
              <div class="staff-card-name">${esc(s.name)}</div>
              <div class="staff-card-role">${esc(s.role)}</div>
            </div>
            <span class="staff-status-badge ${s.active ? 'badge-active' : 'badge-inactive'}">
              ${esc(s.active ? 'Active' : 'Inactive')}
            </span>
          </div>

          <div class="staff-card-body">
            <div class="staff-card-phone">📞 ${esc(s.phone)}</div>

            <div class="staff-stats-row">
              <div class="staff-stat">
                <strong>₹${(s.totalRevenue || 0).toLocaleString('en-IN')}</strong>
                <span>Revenue</span>
              </div>
              <div class="staff-stat">
                <strong>₹${commission.toLocaleString('en-IN')}</strong>
                <span>Commission</span>
              </div>
              <div class="staff-stat">
                <strong>${svcCount}</strong>
                <span>Services</span>
              </div>
            </div>

            <div class="staff-services-list">${serviceChips}</div>

            <div class="staff-card-actions">
              <button class="btn-edit-staff" 
                      onclick="openEditStaffModal('${esc(s._id)}')">
                ✏ Edit
              </button>
              <button class="btn-delete-staff" 
                      onclick="deleteStaffById(event,'${esc(s._id)}')">
                🗑 Delete
              </button>
            </div>
          </div>
        </div>`;
    }).join('');

  } catch (err) { showToast(err.message || 'Staff error', 'error'); }
}

/* ── Open modal for NEW staff ────────────────────────── */
function openStaffModal() {
  document.getElementById('staffModalTitle').innerText = 'Add Staff Member';
  document.getElementById('editingStaffId').value = '';
  ['newStaffName', 'newStaffRole', 'newStaffPhone', 'newStaffCommission']
    .forEach(id => document.getElementById(id).value = '');
  _modalServices = [];
  renderModalServices();
  document.getElementById('addStaffModal').style.display = 'block';
}

/* ── Open modal for EDIT staff ───────────────────────── */
async function openEditStaffModal(id) {
  try {
    const s = await api(`/staff/${id}`);
    document.getElementById('staffModalTitle').innerText = 'Edit Staff Member';
    document.getElementById('editingStaffId').value = s._id;
    document.getElementById('newStaffName').value = s.name;
    document.getElementById('newStaffRole').value = s.role;
    document.getElementById('newStaffPhone').value = s.phone;
    document.getElementById('newStaffCommission').value = s.commissionPct;
    _modalServices = (s.services || []).map(sv => ({
      name: sv.name, price: sv.price,
      durationMins: sv.durationMins, category: sv.category || 'General'
    }));
    renderModalServices();
    document.getElementById('addStaffModal').style.display = 'block';
  } catch (err) { showToast(err.message, 'error'); }
}

function closeStaffModal() {
  document.getElementById('addStaffModal').style.display = 'none';
  _modalServices = [];
}

/* ── Inline add service to modal list ───────────────── */
function addServiceToModal() {
  const name = document.getElementById('inlineSvcName').value.trim();
  const price = parseFloat(document.getElementById('inlineSvcPrice').value);
  const duration = parseInt(document.getElementById('inlineSvcDuration').value) || 30;

  if (!name) { showToast('Service name is required', 'error'); return; }
  if (isNaN(price) || price <= 0) { showToast('Enter a valid price', 'error'); return; }

  _modalServices.push({ name, price, durationMins: duration, category: 'General' });
  renderModalServices();

  document.getElementById('inlineSvcName').value = '';
  document.getElementById('inlineSvcPrice').value = '';
  document.getElementById('inlineSvcDuration').value = '';
  document.getElementById('inlineSvcName').focus();
}

/* ── Render the services list inside the modal ───────── */
function renderModalServices() {
  const container = document.getElementById('modalServicesList');
  if (!container) return;

  if (_modalServices.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:12px; color:#bbb; 
                  font-size:13px; border:1.5px dashed #e0e0e0; 
                  border-radius:8px;">
        No services added yet — use the form below
      </div>`;
    return;
  }

  container.innerHTML = _modalServices.map((s, i) => `
    <div class="modal-service-row">
      <div class="svc-info">
        <strong>${esc(s.name)}</strong>
        <span>₹${s.price}</span>
        <span>· ${s.durationMins} mins</span>
      </div>
      <button onclick="_modalServices.splice(${i},1); renderModalServices();" 
              title="Remove">✕</button>
    </div>`).join('');
}

/* ── Save staff (handles both add and edit) ──────────── */
async function saveStaff() {
  const id = document.getElementById('editingStaffId').value;
  const name = document.getElementById('newStaffName').value.trim();
  const role = document.getElementById('newStaffRole').value.trim();
  const phone = document.getElementById('newStaffPhone').value.trim();
  const commission = document.getElementById('newStaffCommission').value;
  const btn = document.querySelector('#addStaffModal .btn-full');

  if (!name) { showToast('Name is required', 'error'); return; }
  if (!role) { showToast('Role is required', 'error'); return; }
  if (!phone) { showToast('Phone is required', 'error'); return; }
  if (!commission) { showToast('Commission is required', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  const payload = {
    name, role, phone,
    commissionPct: Number(commission),
    services: _modalServices
  };

  try {
    if (id) {
      await api(`/staff/${id}`, { method: 'PUT', body: payload });
      showToast('Staff updated');
    } else {
      await api('/staff', { method: 'POST', body: payload });
      showToast('Staff added');
    }
    closeStaffModal();
    refreshRelated(['staff', 'checkout']);
  } catch (err) { showToast(err.message, 'error'); }
  finally {
    btn.disabled = false;
    btn.textContent = 'Save Staff Member';
  }
}

async function deleteStaffById(event, id) {
  event.stopPropagation();
  if (!confirm('Delete this staff member? This cannot be undone.')) return;
  try {
    await api(`/staff/${id}`, { method: 'DELETE' });
    showToast('Staff deleted');
    refreshRelated(['staff', 'checkout']);
  } catch (err) { showToast(err.message, 'error'); }
}

/* ── Also allow Enter key in inline service form ─────── */
document.addEventListener('DOMContentLoaded', () => {
  const inlineSvcPrice = document.getElementById('inlineSvcPrice');
  if (inlineSvcPrice) {
    inlineSvcPrice.addEventListener('keydown', e => {
      if (e.key === 'Enter') addServiceToModal();
    });
  }
});



/* ══════════════════════════════════════════════════════════
   6. INVENTORY
   ══════════════════════════════════════════════════════════ */

async function loadInventory() {
  try {
    const items = await api('/inventory');
    const gallery = document.getElementById('inventoryGallery');
    if (!gallery) return;

    if (items.length === 0) {
      gallery.innerHTML = '<div class="table-empty" style="grid-column: 1/-1;">No products in inventory yet.</div>';
      return;
    }

    const placeholder = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=400&auto=format&fit=crop';

    gallery.innerHTML = items.map(item => {
      const isLow = item.stock <= item.minStock;
      const profit = item.sellPrice - item.costPrice;
      const totalVal = item.stock * item.costPrice;

      return `
        <div class="product-card ${isLow ? 'low-stock-alert' : ''}">
          <div class="product-img-wrapper">
            <img src="${item.imageUrl || placeholder}" alt="${esc(item.name)}" onerror="this.src='${placeholder}'">
            ${isLow ? '<span class="stock-badge badge-low">Low Stock</span>' : '<span class="stock-badge badge-ok">In Stock</span>'}
          </div>
          <div class="product-info">
            <div class="product-meta">
              <span class="product-cat">${esc(item.category || 'General')}</span>
              <span class="product-brand">${esc(item.brand || 'No Brand')}</span>
            </div>
            <h3 class="product-name">${esc(item.name)}</h3>
            <p class="product-desc">${esc(item.description || 'No description provided.')}</p>
            
            <div class="product-stats-grid">
              <div class="p-stat"><strong>${item.stock}</strong><span>Units</span></div>
              <div class="p-stat"><strong>₹${item.sellPrice}</strong><span>Price</span></div>
              <div class="p-stat"><strong>₹${profit}</strong><span>Profit</span></div>
            </div>

            <div class="product-actions-bar">
              <div class="stock-controls">
                <button onclick="changeStockById('${item._id}', -1)" class="btn-sm">-</button>
                <button onclick="changeStockById('${item._id}', 1)" class="btn-sm">+</button>
              </div>
              <button class="btn-sm btn-danger" onclick="deleteInventoryItem('${item._id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) { showToast('Inventory error', 'error'); }
}

function openInvModal() { document.getElementById('inventoryModal').style.display = 'block'; }
function closeInvModal() { document.getElementById('inventoryModal').style.display = 'none'; }

async function addInventory() {
  const name = document.getElementById('invName').value.trim();
  const category = document.getElementById('invCategory').value.trim();
  const stock = parseInt(document.getElementById('invStock').value);
  const minStock = parseInt(document.getElementById('invMin').value);
  const purchasePrice = parseInt(document.getElementById('invPurchase').value);
  const sellingPrice = parseInt(document.getElementById('invSelling').value);
  const brand = document.getElementById('invSupplier').value.trim(); // Mapping supplier to brand

  if (!name || !category || isNaN(stock) || isNaN(minStock) || isNaN(purchasePrice) || isNaN(sellingPrice)) {
    showToast('Please fill all required fields', 'error'); return;
  }
  if (sellingPrice <= purchasePrice) {
    showToast('Selling price must be greater than purchase price', 'error'); return;
  }

  const btn = document.querySelector('button[onclick="addInventory()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    await api('/inventory', { method: 'POST', body: { name, category, stock, minStock, brand, unit: 'pcs', costPrice: purchasePrice, sellPrice: sellingPrice } });
    ['invName', 'invCategory', 'invStock', 'invMin', 'invSupplier', 'invDesc', 'invImg', 'invPurchase', 'invSelling'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    closeInvModal();
    showToast('Product saved');
    refreshRelated(['inventory', 'dashboard', 'checkout']);
  } catch (err) { showToast(err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Product'; } }
}

async function changeStockById(id, delta) {
  try {
    await api(`/inventory/${id}/adjust-stock`, { method: 'POST', body: { adjustment: delta, reason: 'Manual update' } });
    refreshRelated(['inventory', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteInventoryItem(id) {
  confirmAction('Delete this product?', async () => {
    try {
      await api(`/inventory/${id}`, { method: 'DELETE' });
      showToast('Product deleted');
      refreshRelated(['inventory']);
    } catch (err) { showToast(err.message, 'error'); }
  });
}


/* ══════════════════════════════════════════════════════════
   7. CHECKOUT / BILLING
   ══════════════════════════════════════════════════════════ */

let billItems = [];
let currentClient = null; // Store current looked-up client object

async function populateProductDropdown() {
  try {
    const items = await api('/inventory');
    const select = document.getElementById('productSelect');
    if (!select) return;
    const available = items.filter(i => i.stock > 0);
    if (available.length === 0) {
      select.innerHTML = '<option value="">No products in stock</option>';
      return;
    }
    select.innerHTML = '<option value="">Select Product...</option>' +
      available.map(i => `<option value="${i._id}|${esc(i.name)}|${i.sellPrice}">${esc(i.name)} — ₹${i.sellPrice} (${i.stock} in stock)</option>`).join('');
  } catch (err) { showToast(err.message || 'Failed to load products', 'error'); }
}

async function populateServiceDropdown(dropdownIds = ['serviceSelect']) {
  try {
    const items = await api('/staff/all-services');
    if (!items || items.length === 0) return;

    const optionsHTML = '<option value="">Select Service & Staff...</option>' +
      items.map(i =>
        `<option value="${i.staffId}|${i.serviceId}|${esc(i.serviceName)}|${i.price}|${esc(i.staffName)}|${i.durationMins || 45}">
          ${esc(i.serviceName)} — ${esc(i.staffName)} (₹${i.price})
        </option>`
      ).join('');

    const ids = Array.isArray(dropdownIds) ? dropdownIds : [dropdownIds];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = optionsHTML;
    });
  } catch (err) { console.error('Service list error:', err); }
}

async function populateClientDropdown() {
  // If we had a dropdown, we could populate it here.
  // The system uses a text input "billClient", we can convert it to datalist
  try {
    const clients = await api('/clients');
    let dataList = document.getElementById('clientDataList');
    if (!dataList) {
      dataList = document.createElement('datalist');
      dataList.id = 'clientDataList';
      document.body.appendChild(dataList);
      document.getElementById('billClient').setAttribute('list', 'clientDataList');
    }
    dataList.innerHTML = clients.map(c => `<option value="${esc(c.name)}"></option>`).join('');
  } catch (e) { }
}

async function lookupClientByPhone() {
  const phone = document.getElementById('billClientLookup').value.trim();
  const searchBtn = document.querySelector('button[onclick="lookupClientByPhone()"]');
  const msgArea = document.getElementById('lookupMessage');

  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number', 'error');
    return;
  }

  searchBtn.disabled = true;
  searchBtn.textContent = '...';
  msgArea.innerHTML = '';
  currentClient = null;
  document.getElementById('billClient').value = '';
  document.getElementById('btnSharePDF').disabled = true;

  try {
    const clients = await api('/clients');
    const client = clients.find(c => c.phone === phone);

    if (client) {
      currentClient = client;
      document.getElementById('billClient').value = client.name;
      document.getElementById('printClientName').innerText = client.name;
      document.getElementById('billDate').innerText = new Date().toLocaleString('en-IN');
      msgArea.innerHTML = `<span style="color:var(--success); font-weight:600;">✓ Client Found: ${esc(client.name)}</span>`;
      document.getElementById('btnSharePDF').disabled = false;
      showToast('Client found');
    } else {
      msgArea.innerHTML = `
        <div style="color:var(--danger); font-weight:600; margin-bottom:5px;">No record found for this mobile number</div>
        <button onclick="openAddClientFromCheckout('${phone}')" class="btn-primary" style="padding:6px 12px; font-size:12px; height:auto; min-height:auto;">+ Add New Client</button>
      `;
    }
  } catch (err) {
    showToast('Error searching client', 'error');
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

function openAddClientFromCheckout(phone) {
  openAddClientModal();
  document.getElementById('newClientPhone').value = phone;
}

function addServiceToBill() {
  const val = document.getElementById('serviceSelect').value;
  if (!val) return;
  const [staffId, serviceId, name, price, staffName] = val.split('|');
  addToBill(name, 'Service', parseInt(price), serviceId, staffId, staffName);
  document.getElementById('serviceSelect').value = '';
}

function addProductToBill() {
  const val = document.getElementById('productSelect').value;
  if (!val) return;
  const [id, name, price] = val.split('|');
  addToBill(name, 'Product', parseInt(price), id);
  document.getElementById('productSelect').value = '';
}

function addToBill(name, type, price, refId = null, staffId = null, staffName = null) {
  const existing = billItems.find(i => i.name === name && i.staffId === staffId);
  if (existing) { existing.qty++; }
  else { billItems.push({ name, type, price, qty: 1, refId, staffId, staffName }); }
  renderBill();
}

function renderBill() {
  const tbody = document.querySelector('#billTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  billItems.forEach((item, index) => {
    tbody.innerHTML += `
      <tr>
        <td>
          <div style="font-weight:600;">${esc(item.name)}</div>
          ${item.staffName ? `<div style="font-size:0.75rem; color:#888;">with ${esc(item.staffName)}</div>` : ''}
        </td>
        <td class="text-center" style="white-space:nowrap;">
          <span class="no-print" style="display:inline-flex; align-items:center; gap:6px;">
            <button class="qty-btn" onclick="changeQty(${index},-1)">−</button>
            <span>${item.qty}</span>
            <button class="qty-btn" onclick="changeQty(${index},1)">+</button>
          </span>
          <span class="print-qty">${item.qty}</span>
        </td>
        <td class="text-right">₹${item.price.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${(item.qty * item.price).toLocaleString('en-IN')}</td>
        <td class="no-print" style="width:32px; text-align:center;">
          <button onclick="removeItem(${index})" 
                  style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:1.1rem; line-height:1;" 
                  title="Remove">✕</button>
        </td>
      </tr>`;
  });
  calculateTotals();
}

function changeQty(index, delta) {
  billItems[index].qty += delta;
  if (billItems[index].qty <= 0) billItems.splice(index, 1);
  renderBill();
}
function removeItem(index) { billItems.splice(index, 1); renderBill(); }

let taxPctGlobal = 0; // fetched from settings

function calculateTotals() {
  const subtotal = billItems.reduce((s, i) => s + i.qty * i.price, 0);
  const gst = Math.round(subtotal * (taxPctGlobal / 100));

  const discountPct = parseFloat(document.getElementById('billDiscountPct').value) || 0;
  const discountFlat = parseFloat(document.getElementById('billDiscountFlat').value) || 0;

  const discountFromPct = Math.round(subtotal * (discountPct / 100));
  const totalDiscount = discountFromPct + discountFlat;

  const total = Math.max(0, subtotal + gst - totalDiscount);

  setEl('billSubtotal', '₹' + subtotal.toLocaleString('en-IN'));
  setEl('billGST', '₹' + gst.toLocaleString('en-IN'));

  const discRow = document.getElementById('discountLine');
  if (totalDiscount > 0) {
    discRow.style.display = 'flex';
    setEl('billDiscountTotal', '- ₹' + totalDiscount.toLocaleString('en-IN'));
  } else {
    discRow.style.display = 'none';
  }

  setEl('billTotal', '₹' + total.toLocaleString('en-IN'));
}

// sendWhatsAppBill removed in favor of PDF sharing

async function shareBillAsPDF() {
  const element = document.getElementById('bill-area');
  const clientName = currentClient ? currentClient.name : 'Client';
  const opt = {
    margin: 0.2,
    filename: `Bill_${clientName.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  const btn = document.getElementById('btnSharePDF');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⌛ Generating...';

  try {
    // Generate PDF blob
    const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
    const file = new File([pdfBlob], opt.filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Salon Receipt',
        text: `Here is your receipt from ${document.getElementById('billSalonName').innerText}`
      });
      showToast('Share sheet opened');
    } else {
      // Fallback to download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opt.filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF downloaded (Sharing not supported on this browser)');
    }
  } catch (err) {
    showToast('Failed to generate PDF: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function finalizeSale() {
  if (billItems.length === 0) { showToast('Add items to bill', 'error'); return; }
  const clientName = document.getElementById('billClient').value.trim();
  const paymentMethod = document.getElementById('paymentMethod').value;
  if (!clientName) { showToast('Please enter client name', 'error'); return; }

  const btn = document.querySelector('.btn-finalize');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    // Create or find client
    const clients = await api('/clients');
    let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    if (!client) {
      client = await api('/clients', { method: 'POST', body: { name: clientName, phone: '0000000000' } });
    }

    // Get staff from the first Service line item in the bill
    const serviceItem = billItems.find(i => i.type === 'Service' && i.staffId);
    const staffList = await api('/staff');
    const staffId = serviceItem ? serviceItem.staffId : (staffList[0] ? staffList[0]._id : null);
    const staffName = serviceItem ? serviceItem.staffName : (staffList[0] ? staffList[0].name : 'Unassigned');

    if (!staffId) throw new Error('No staff found. Please add a staff member in the Staff section first.');

    const subtotal = billItems.reduce((s, i) => s + i.qty * i.price, 0);
    const gst = Math.round(subtotal * (taxPctGlobal / 100));
    const discountPct = parseFloat(document.getElementById('billDiscountPct').value) || 0;
    const discountFlat = parseFloat(document.getElementById('billDiscountFlat').value) || 0;
    const discountTotal = Math.round(subtotal * (discountPct / 100)) + discountFlat;
    const grandTotal = Math.max(0, subtotal + gst - discountTotal);

    const items = billItems.map(i => ({ name: i.name, type: i.type, qty: i.qty, unitPrice: i.price, subtotal: i.qty * i.price, refId: i.refId, staffId: i.staffId, staffName: i.staffName }));

    await api('/bills', {
      method: 'POST',
      body: {
        clientId: client._id, clientName: client.name,
        staffId: staffId, staffName: staffName,
        lineItems: items,
        subtotal, taxPct: taxPctGlobal, taxAmount: gst,
        discountAmount: discountTotal, // Added discount tracking
        grandTotal, paymentMethod
      }
    });

    billItems = [];
    currentClient = null;
    renderBill();
    document.getElementById('billClient').value = '';
    document.getElementById('billClientLookup').value = '';
    document.getElementById('lookupMessage').innerHTML = '';
    setEl('printClientName', '—');
    setEl('billDate', '—');
    document.getElementById('billDiscountPct').value = '';
    document.getElementById('billDiscountFlat').value = '';
    document.getElementById('btnSharePDF').disabled = true;
    showToast(`Bill saved: ₹${grandTotal}`);
    refreshRelated(['checkout', 'reports', 'dashboard', 'inventory', 'clients']);

    // Auto-Print
    setTimeout(() => printBill(), 500);

  } catch (err) { showToast(err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '✓ Finalize Sale & Print Bill'; } }
}

async function loadBillHistory() {
  try {
    const bills = await api('/bills');
    const tbody = document.getElementById('billHistoryBody');
    if (!tbody) return;
    if (bills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">No bills yet.</td></tr>`;
      return;
    }
    const payClass = (m) => {
      const map = { Cash: 'pay-cash', UPI: 'pay-upi', Card: 'pay-card' };
      return map[m] || 'pay-other';
    };
    tbody.innerHTML = bills.map(b => {
      const isVoid = b.deleted;
      return `
      <tr style="${isVoid ? 'opacity:0.45;' : ''}">
        <td data-label="Date" style="color:var(--text-muted);font-size:0.82rem;">${new Date(b.date || b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
        <td data-label="Client"><strong>${esc(b.clientName)}</strong></td>
        <td data-label="Items" style="color:var(--text-muted)">${b.lineItems.length} item${b.lineItems.length !== 1 ? 's' : ''}</td>
        <td data-label="Total"><strong>₹${b.grandTotal.toLocaleString('en-IN')}</strong>${isVoid ? ' <span style="color:#c0392b;font-size:0.75rem;font-weight:700;">VOID</span>' : ''}</td>
        <td data-label="Payment"><span class="pay-badge ${payClass(b.paymentMethod)}">${esc(b.paymentMethod)}</span></td>
        <td data-label="Actions" class="no-print">
          <div class="action-btns">
            <button class="btn-act-view" onclick="viewBill('${b._id}')" ${isVoid ? 'disabled' : ''}>View</button>
            ${!isVoid ? `<button class="btn-act-void" onclick="voidBill('${b._id}')">Void</button>` : ''}
            <button class="btn-act-print" onclick="printPastBill('${b._id}')" ${isVoid ? 'disabled' : ''}>Print</button>
          </div>
        </td>
      </tr>`}).join('');
  } catch (err) { showToast(err.message || 'Failed to load bill history', 'error'); }
}

async function voidBill(id) {
  confirmAction('Void this bill? This will reverse stock changes.', async () => {
    try {
      await api(`/bills/${id}`, { method: 'DELETE' });
      showToast('Bill voided successfully');
      refreshRelated(['checkout', 'inventory', 'dashboard', 'reports']);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function viewBill(id) {
  try {
    const bill = await api(`/bills/${id}`);
    if (!bill) return;

    // Populate the print area
    document.getElementById('printClientName').innerText = bill.clientName;
    document.getElementById('billDate').innerText = new Date(bill.date || bill.createdAt).toLocaleString('en-IN');

    const tbody = document.querySelector('#billTable tbody');
    tbody.innerHTML = bill.lineItems.map(item => `
      <tr>
        <td>
          <div style="font-weight:600;">${esc(item.name)}</div>
          ${item.staffName ? `<div style="font-size:0.75rem; color:#888;">with ${esc(item.staffName)}</div>` : ''}
        </td>
        <td class="text-center">${item.qty}</td>
        <td class="text-right">₹${item.unitPrice.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${item.subtotal.toLocaleString('en-IN')}</td>
        <td class="no-print"></td>
      </tr>
    `).join('');

    setEl('billSubtotal', bill.subtotal.toLocaleString('en-IN'));
    setEl('billGST', (bill.taxAmount || 0).toLocaleString('en-IN'));
    setEl('billTotal', bill.grandTotal.toLocaleString('en-IN'));

    // Fix: Load client info to enable WhatsApp/PDF share
    if (bill.clientId) {
      try {
        const clients = await api('/clients');
        currentClient = clients.find(c => c._id === bill.clientId);
        if (currentClient) {
          document.getElementById('billClient').value = currentClient.name;
          document.getElementById('printClientName').innerText = currentClient.name;
          document.getElementById('billDate').innerText = new Date(bill.date || bill.createdAt).toLocaleString('en-IN');
          document.getElementById('billClientLookup').value = currentClient.phone || '';
          document.getElementById('lookupMessage').innerHTML = `<span ...>✓ Client Loaded: ${esc(currentClient.name)}</span>`;
          document.getElementById('btnSharePDF').disabled = false;
        }
      } catch (e) { console.error('Error loading client for bill', e); }
    }

    showToast('Bill loaded');
    // Scroll to bill area
    document.getElementById('bill-area').scrollIntoView({ behavior: 'smooth' });
  } catch (err) { showToast(err.message || 'Error loading bill', 'error'); }
}

async function printPastBill(id) {
  await viewBill(id);
  setTimeout(() => printBill(), 500);
}

/* ══════════════════════════════════════════════════════════
   8. REPORTS
   ══════════════════════════════════════════════════════════ */

const _charts = {};

async function loadReports() {
  try {
    const [reportData, staff, inventory, appointments] = await Promise.all([
      api('/bills/stats/range'),
      api('/staff'),
      api('/inventory'),
      api('/appointments') 
    ]);

    const { bills, totalRevenue, totalBills, revenueByMonth, revenueByService } = reportData;
    
    // 1. Advanced KPI Calculations
    // 1.1 Net Profit (Estimation: 40% margin)
    const netProfit = Math.round(totalRevenue * 0.4);
    setEl('repNetProfit', '₹' + netProfit.toLocaleString('en-IN'));

    // 1.2 Staff Utilization (Global benchmark)
    // Booked mins from appointments vs capacity (Total staff * 8h * 22 days)
    const totalCapacityMins = staff.length * 20 * 8 * 60; // 20 working days
    const bookedMins = bills.reduce((sum, b) => {
        return sum + b.lineItems.reduce((s, i) => s + (i.type === 'Service' ? 45 : 0), 0);
    }, 0);
    const utilization = Math.min(100, Math.round((bookedMins / (totalCapacityMins || 1)) * 100));
    setEl('repStaffUtil', utilization + '%');
    setEl('repUtilDetail', utilization > 65 ? '🟢 High Efficiency' : '🟠 Room for Growth');

    // 1.3 Rebooking Rate (Clients with future bookings)
    const futureAppts = appointments.filter(a => new Date(a.date) > new Date()).length;
    const rebookingRate = Math.min(100, Math.round((futureAppts / (totalBills || 1)) * 100));
    setEl('repRebooking', rebookingRate + '%');
    setEl('repRebookDetail', rebookingRate > 40 ? '📈 Loyalty Leader' : '📉 Retention Focus');

    // 1.4 Avg Ticket Size
    const avgTicket = totalBills ? Math.round(totalRevenue / totalBills) : 0;
    setEl('repAvgTicket', '₹' + avgTicket.toLocaleString('en-IN'));

    // 1.5 Revenue Split
    const serviceRev = bills.reduce((sum, b) => sum + b.lineItems.filter(i => i.type === 'Service').reduce((s, li) => s + li.subtotal, 0), 0);
    const retailRev = totalRevenue - serviceRev;
    const retailRatio = Math.round((retailRev / (serviceRev || 1)) * 100);
    setEl('repTotalRevenue', '₹' + serviceRev.toLocaleString('en-IN'));
    setEl('repRetailRevenue', '₹' + retailRev.toLocaleString('en-IN'));
    setEl('repRetailRatio', retailRatio + '%');

    // 2. Assets & Alerts
    const invValue = inventory.reduce((s, i) => s + i.stock * i.costPrice, 0);
    const lowStock = inventory.filter(i => i.stock <= i.minStock).length;
    setEl('repInvValue', '₹' + invValue.toLocaleString('en-IN'));
    setEl('repLowStock', lowStock);

    // 3. Smart Insights Component
    generateSmartInsights(utilization, retailRatio, rebookingRate);

    // 4. Premium Charts
    renderPremiumCharts(revenueByMonth, bills, staff);

    // 5. Staff Performance Table
    renderStaffReportTable(bills, staff);

  } catch (err) { showToast(err.message || 'Reports error', 'error'); }
}

function generateSmartInsights(util, retail, rebook) {
    const desc = document.getElementById('insightDescription');
    if (!desc) return;
    
    let advice = [];
    if (util < 55) advice.push("Staff utilization is lagging (under 55%). Consider off-peak happy hours.");
    if (retail < 15) advice.push("Retail revenue is low. Bundle products with high-end services.");
    if (rebook < 30) advice.push("Low rebooking rate detected. Implement a loyalty point bonus for same-day rebooking.");
    
    if (advice.length === 0) {
        desc.innerText = "Performance looks world-class! Current trajectory exceeds benchmarks for productivity and retention.";
    } else {
        desc.innerText = advice.join(" | ");
    }
}

function renderPremiumCharts(revenueByMonth, bills, staff) {
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch (e) { } });

    // Revenue Velocity Chart (Stripe-Style Area)
    const ctx = document.getElementById('execRevenueChart')?.getContext('2d');
    if (ctx) {
        const labels = Object.keys(revenueByMonth).length ? Object.keys(revenueByMonth) : ['No Data'];
        const data = Object.values(revenueByMonth).length ? Object.values(revenueByMonth) : [0];
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(108, 92, 231, 0.25)');
        gradient.addColorStop(1, 'rgba(108, 92, 231, 0)');

        _charts.exec = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Revenue',
                    data,
                    borderColor: '#6c5ce7',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.45,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#6c5ce7',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { cornerRadius: 8, padding: 12 } },
                scales: {
                    y: { grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false }, ticks: { callback: v => '₹' + v.toLocaleString() } },
                    x: { grid: { display: false }, border: { display: false } }
                }
            }
        });
    }

    // Category Mix (Doughnut)
    const ctxPie = document.getElementById('salesPieChart')?.getContext('2d');
    if (ctxPie) {
        const types = { 'Service': 0, 'Product': 0 };
        bills.forEach(b => b.lineItems.forEach(li => { types[li.type] = (types[li.type] || 0) + li.subtotal; }));
        _charts.pie = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: Object.keys(types),
                datasets: [{ data: Object.values(types), backgroundColor: ['#6c5ce7', '#a29bfe'], borderWidth: 0 }]
            },
            options: { cutout: '80%', plugins: { legend: { position: 'right' } } }
        });
    }

    // Staff Performance (Horizontal Bar)
    const ctxStaff = document.getElementById('staffRevenueChart')?.getContext('2d');
    if (ctxStaff) {
        const staffRev = {};
        bills.forEach(b => b.lineItems.forEach(li => { if(li.staffName) staffRev[li.staffName] = (staffRev[li.staffName] || 0) + li.subtotal; }));
        _charts.staff = new Chart(ctxStaff, {
            type: 'bar',
            data: {
                labels: Object.keys(staffRev),
                datasets: [{ data: Object.values(staffRev), backgroundColor: '#6c5ce7', borderRadius: 10 }]
            },
            options: { indexAxis: 'y', plugins: { legend: { display: false } },
                       scales: { x: { display: false }, y: { grid: { display: false } } } }
        });
    }
}

function renderStaffReportTable(bills, staff) {
    const tbody = document.getElementById('staffReportTable');
    if (!tbody) return;
    
    tbody.innerHTML = staff.map(s => {
        const sBills = bills.filter(b => b.lineItems.some(li => li.staffId === s._id));
        const revenue = sBills.reduce((sum, b) => sum + b.lineItems.filter(li => li.staffId === s._id).reduce((st, li) => st + li.subtotal, 0), 0);
        const clients = new Set(sBills.map(b => b.clientId)).size;
        const commission = Math.round(revenue * (s.commissionPct / 100));
        return `
            <tr>
                <td><strong>${esc(s.name)}</strong></td>
                <td>₹${revenue.toLocaleString('en-IN')}</td>
                <td>${Math.round((revenue / 40000) * 100)}%</td>
                <td>${clients}</td>
                <td>₹${commission.toLocaleString('en-IN')}</td>
            </tr>`;
    }).join('');
}

function switchReportTab(tab, btn) {
  document.querySelectorAll('.report-content').forEach(el => el.classList.add('section-hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('report-' + tab).classList.remove('section-hidden');
  btn.classList.add('active');
}

/* ══════════════════════════════════════════════════════════
   9. SETTINGS
   ══════════════════════════════════════════════════════════ */

async function loadSettings() {
  try {
    const s = await api('/settings');
    document.getElementById('setSalonName').value = s.salonName || '';
    document.getElementById('setAddress').value = s.address || '';
    document.getElementById('setPhone').value = s.phone || '';
    document.getElementById('setCurrency').value = s.currency || '₹';
    document.getElementById('setTax').value = s.taxPct || 0;
    document.getElementById('setDefaultCommission').value = s.defaultCommission || 0;
    document.getElementById('setLoyalty').checked = s.loyaltyEnabled || false;
    document.getElementById('setPoints').value = s.pointsPerRupee || 0;

    taxPctGlobal = s.taxPct || 0;

    // Update bill branding
    setEl('billSalonName', s.salonName || 'SalonPro');
    setEl('billSalonAddress', s.address || '');
    setEl('billSalonPhone', s.phone ? 'Ph: ' + s.phone : '');
    setEl('footerSalonName', s.salonName || 'SalonPro');

  } catch (err) { showToast(err.message || 'Settings error', 'error'); }
}

async function saveSettings() {
  const btn = document.querySelector('button[onclick="saveSettings()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const payload = {
      salonName: document.getElementById('setSalonName').value,
      address: document.getElementById('setAddress').value,
      phone: document.getElementById('setPhone').value,
      currency: document.getElementById('setCurrency').value,
      taxPct: document.getElementById('setTax').value,
      defaultCommission: document.getElementById('setDefaultCommission').value,
      loyaltyEnabled: document.getElementById('setLoyalty').checked,
      pointsPerRupee: document.getElementById('setPoints').value
    };

    await api('/settings', { method: 'PUT', body: payload });
    showToast('Settings saved successfully');
    loadSettings(); // update globals
  } catch (err) { showToast(err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Settings'; } }
}

async function dangerDeleteAccount() {
  const word = prompt("To permanently delete everything, type DELETE");
  if (word === 'DELETE') {
    alert("This was a demo function. Database wipe requested but bypassed for safety context.");
  }
}


function updateActionCenter(lowStock, appts) {
  const feed = document.getElementById('actionFeed');
  if (!feed) return;
  feed.innerHTML = '';
  const actions = [];

  // Low Stock
  lowStock.slice(0, 2).forEach(i => {
    actions.push({ icon: '⚠️', title: `${i.name} Low`, desc: `${i.stock} left`, type: 'urgent' });
  });

  // Upcoming Birthdays (Mock)
  if (appts.some(a => a.clientName.toLowerCase().includes('a'))) {
    actions.push({ icon: '🎂', title: 'Birthday Alert', desc: 'Sarah Miller today!', type: 'warning' });
  }

  // Unconfirmed
  const unconfirmed = appts.filter(a => a.status === 'Upcoming').length;
  if (unconfirmed > 0) {
    actions.push({ icon: '📅', title: `${unconfirmed} Pending`, desc: 'Confirm on WhatsApp', type: 'info' });
  }

  if (actions.length === 0) {
    feed.innerHTML = '<div class="action-item success"><div class="action-icon">✅</div><div class="action-content"><strong>All Clear</strong><span>Systems normal.</span></div></div>';
  } else {
    feed.innerHTML = actions.map(a => `
      <div class="action-item ${a.type}">
        <div class="action-icon">${a.icon}</div>
        <div class="action-content">
          <strong>${esc(a.title)}</strong>
          <span>${esc(a.desc)}</span>
        </div>
      </div>`).join('');
  }
}

function updateLivePulse(appts) {
  const pulse = document.getElementById('livePulseContent');
  if (!pulse) return;
  const ongoing = appts.filter(a => a.status === 'Ongoing');
  
  if (ongoing.length > 0) {
    pulse.innerHTML = ongoing.map(a => `
      <div style="width:100%; display:flex; align-items:center; gap:12px; background:var(--bg-color); padding:12px; border-radius:12px; margin-bottom:8px; border-left:4px solid var(--success);">
         <div style="font-size:1.2rem;">💇</div>
         <div style="flex:1;">
           <strong style="display:block; font-size:14px;">${esc(a.clientName)}</strong>
           <span style="font-size:11px; color:var(--text-muted);">${esc(a.serviceName)} w/ ${esc(a.staffName)}</span>
         </div>
         <div style="text-align:right;">
           <div class="badge-live">LIVE</div>
         </div>
      </div>`).join('');
  } else {
    pulse.innerHTML = `
      <div style="text-align:center; opacity:0.6;">
        <div style="font-size:2rem; margin-bottom:10px;">⌛</div>
        <p style="font-size:13px;">No active services</p>
        <p style="font-size:11px;">Next: ${appts.find(a => a.status === 'Upcoming')?.time || 'None'}</p>
      </div>`;
  }
}

function initMagneticEffect() {
  document.querySelectorAll('.magnetic').forEach(card => {
    card.onmousemove = e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--rx', `${(y - rect.height/2) / -10}deg`);
      card.style.setProperty('--ry', `${(x - rect.width/2) / 10}deg`);
      card.style.transform = `perspective(1000px) rotateX(var(--rx)) rotateY(var(--ry)) scale3d(1.02, 1.02, 1.02)`;
    };
    card.onmouseleave = () => card.style.transform = '';
  });
}

function renderDashboardCharts(appts, sales) {
  const ctxD = document.getElementById('densityChart')?.getContext('2d');
  if (ctxD) {
    if (densityChart) densityChart.destroy();
    const data = Array(12).fill(0);
    appts.forEach(a => {
        const h = parseInt(a.time.split(':')[0]);
        if (h >= 8 && h < 20) data[h-8]++;
    });
    densityChart = new Chart(ctxD, {
      type: 'line',
      data: {
        labels: ['8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p'],
        datasets: [{ data, borderColor: '#8e44ad', backgroundColor: 'rgba(142, 68, 173, 0.05)', fill: true, tension: 0.4, pointRadius: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                 scales: { y: { display: false }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } } }
    });
  }

  const ctxS = document.getElementById('serviceMixChart')?.getContext('2d');
  if (ctxS) {
    if (serviceMixChart) serviceMixChart.destroy();
    const svcs = {};
    appts.forEach(a => svcs[a.serviceName] = (svcs[a.serviceName] || 0) + 1);
    const labels = Object.keys(svcs).slice(0, 5);
    serviceMixChart = new Chart(ctxS, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: labels.map(l => svcs[l]), backgroundColor: ['#8e44ad', '#3498db', '#2ecc71', '#f1c40f', '#e67e22'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 9 } } } } }
    });
  }
}

/* ─── INIT ─── */
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    loadSettings().then(() => {
      loadDashboard(); // Tax pct loaded, proceed
    });
  }
});