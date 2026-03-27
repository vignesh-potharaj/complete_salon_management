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

    if (sectionId === 'home')      loadDashboard();
    if (sectionId === 'calendar')  loadCalendar();
    if (sectionId === 'clients')   loadClients();
    if (sectionId === 'staff')     loadStaff();
    if (sectionId === 'services')  loadServices();
    if (sectionId === 'inventory') loadInventory();
    if (sectionId === 'checkout')  { populateProductDropdown(); populateServiceDropdown(); populateClientDropdown(); loadBillHistory(); }
    if (sectionId === 'reports')   loadReports();
    if (sectionId === 'settings')  loadSettings();
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
    <span style="font-size:14px;color:#333;">${message}</span>
    <div style="display:flex;gap:8px;">
      <button id="confirmYes" style="flex:1;padding:8px;background:#e74c3c;color:white;border:none;
        border-radius:6px;cursor:pointer;font-size:13px;">Yes, Delete</button>
      <button id="confirmNo" style="flex:1;padding:8px;background:#eee;color:#333;border:none;
        border-radius:6px;cursor:pointer;font-size:13px;">Cancel</button>
    </div>`;
  container.appendChild(toast);
  toast.querySelector('#confirmYes').onclick = () => { toast.remove(); onConfirm(); };
  toast.querySelector('#confirmNo').onclick  = () => toast.remove();
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function statusColor(s) {
  return s === 'Completed' ? '#27ae60'
       : s === 'Ongoing'   ? '#e67e22'
       : s === 'Cancelled' ? '#e74c3c'
       : '#3498db';
}

function openModal(client, service, time, amount, staff, id, status) {
  setEl('modalClient', client);   setEl('modalService', service);
  setEl('modalTime', time);       setEl('modalAmount', amount);
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
      ${['Upcoming','Ongoing','Completed','Cancelled'].map(s => `
        <button onclick="updateAppointmentStatus('${id}', '${s}')" 
          style="padding:5px 10px;font-size:11px;border:none;border-radius:4px;cursor:pointer;
          background:${s === status ? statusColor(s) : '#eee'};
          color:${s === status ? 'white' : '#333'};">
          ${s}
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

async function loadDashboard() {
  try {
    const data = await api('/dashboard/summary');
    const { todayStats, appointmentsToday, lowStockItems, totalClients } = data;

    // Sales today
    setEl('dashTotalSales', '₹' + (todayStats.totalSales || 0).toLocaleString('en-IN'));

    // Appointments today
    setEl('dashApptCount', appointmentsToday.length);
    const ongoing = appointmentsToday.filter(a => a.status === 'Ongoing').length;
    setEl('dashApptOngoing', ongoing + ' ongoing right now');

    // Total clients
    setEl('dashTotalClients', totalClients);

    // Low stock alerts
    const alertList = document.getElementById('dashLowStockList');
    if (alertList) {
      if (lowStockItems.length === 0) {
        alertList.innerHTML = '<li style="color:#27ae60;">All stock levels OK</li>';
      } else {
        alertList.innerHTML = lowStockItems
          .map(i => `<li>${i.name} – ${i.stock} left</li>`)
          .join('');
      }
    }

    // Today's appointments table
    const table = document.getElementById('dashApptTable');
    if (table) {
      const rows = table.querySelectorAll('tr:not(:first-child)');
      rows.forEach(r => r.remove());

      if (appointmentsToday.length === 0) {
        table.innerHTML += `<tr><td colspan="4" style="text-align:center;color:#999;padding:16px;">No appointments today yet</td></tr>`;
      } else {
        appointmentsToday.forEach(a => {
          table.innerHTML += `
            <tr>
              <td data-label="Time">${a.time}</td>
              <td data-label="Client">${a.clientName}</td>
              <td data-label="Service">${a.serviceName}</td>
              <td data-label="Status"><span style="padding:3px 8px;border-radius:4px;font-size:12px;background:${statusColor(a.status)};color:white;">${a.status}</span></td>
            </tr>`;
        });
      }
    }

  } catch (err) {
    showToast(err.message || 'Dashboard error', 'error');
  }
}

// Quick Add Appointment form on dashboard
const appointmentForm = document.getElementById('appointmentForm');
if (appointmentForm) {
  appointmentForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const clientName = document.getElementById('quickClientName').value.trim();
    const serviceName    = document.getElementById('quickService').value.trim();
    const time       = document.getElementById('quickTime').value;
    const date       = new Date().toISOString().split('T')[0]; // Today
    
    const btn = this.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }

    try {
      const [clients, services, staffList] = await Promise.all([
        api('/clients'),
        api('/services'),
        api('/staff')
      ]);
      
      let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()) || 
                   await api('/clients', { method: 'POST', body: { name: clientName, phone: '0000000000' } });

      let _staff = staffList.length > 0 ? staffList[0] : null;
      let _service = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase()) || 
                     (services.length > 0 ? services[0] : null);

      if (!_staff || !_service) {
        throw new Error('Please add at least one Staff and one Service first.');
      }

      await api('/appointments', { 
        method: 'POST', 
        body: { 
          clientId: client._id, clientName: client.name, 
          serviceId: _service._id, serviceName: _service.name, 
          staffId: _staff._id, staffName: _staff.name,
          date, time, duration: _service.durationMins || 30, status: 'Upcoming' 
        } 
      });
      
      this.reset();
      showToast('Appointment added');
      loadDashboard();
    } catch (err) { showToast(err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Add Appointment'; } }
  });
}

/* ══════════════════════════════════════════════════════════
   2. CALENDAR / APPOINTMENTS
   ══════════════════════════════════════════════════════════ */

const SLOT_COLORS = ['#ff4d4d','#6c5ce7','#0984e3','#e17055','#00b894','#fdcb6e','#fd79a8'];

async function loadCalendar() {
  try {
    const header = document.getElementById('calendarDateHeader');
    if (header) header.innerText = new Date().toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

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
            <span>${s.name}</span>
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
            <strong style="font-size:16px;color:#2c3e50;">${appt.clientName}</strong>
            <div style="color:#7f8c8d;font-size:13px;margin-top:4px;">${appt.serviceName} • ${appt.staffName}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px;font-weight:700;color:#34495e;margin-bottom:6px;">${appt.time}</div>
            <span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;
              background:${statusColor(appt.status)};color:white;">${appt.status.toUpperCase()}</span>
          </div>`;
        card.onclick = () => openModal(appt.clientName, appt.serviceName, appt.time, 'See Bill', appt.staffName, appt._id, appt.status);
        grid.appendChild(card);
      });
    } else {
      // Desktop Grid View
      grid.style.display = 'grid'; // Ensure grid display
      appointments.forEach((appt, idx) => {
        const hour     = parseTimeToHour(appt.time);
        const rowIndex = Math.max(1, hour - 7); 
        const div      = document.createElement('div');
        div.className  = 'appointment';
        div.style.cssText = `grid-column:${(idx % 5) + 1};grid-row:${rowIndex};background:${statusColor(appt.status)};`;
        div.innerHTML  = `<strong>${appt.clientName}</strong><br>${appt.serviceName}<br>${appt.time} <br><em>${appt.status}</em>`;
        div.onclick    = () => openModal(appt.clientName, appt.serviceName, appt.time, 'See Bill', appt.staffName, appt._id, appt.status);
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
  if (t.includes(':') && !t.includes('AM') && !t.includes('PM')) return parseInt(t.split(':')[0]);
  const [time, period] = t.split(' ');
  let [h] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h;
}

function openAddApptModal()  { document.getElementById('addApptModal').style.display = 'block'; }
function closeAddApptModal() { document.getElementById('addApptModal').style.display = 'none'; }

async function saveAppointment() {
  const clientName = document.getElementById('apptClient').value.trim();
  const serviceName    = document.getElementById('apptService').value.trim();
  const time       = document.getElementById('apptTime').value;
  const btn        = document.getElementById('saveApptBtn');
  
  if (!clientName || !serviceName || !time) { showToast('Please fill all fields', 'error'); return; }
  
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
      const clients = await api('/clients');
      const services = await api('/services');
      const staffList = await api('/staff');
      
      let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()) || await api('/clients', { method: 'POST', body: { name: clientName, phone: '0000000000' } });
      let _staff = staffList.length > 0 ? staffList[0] : null;
      let _service = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase()) || (services.length > 0 ? services[0] : null);

      if (!_staff || !_service) throw new Error('Missing Staff or Service details.');

      await api('/appointments', { 
        method: 'POST', 
        body: { 
          clientId: client._id, clientName: client.name, 
          serviceId: _service._id, serviceName: _service.name, 
          staffId: _staff._id, staffName: _staff.name,
          date: document.getElementById('calendarDateHeader').dataset.isoDate || new Date().toISOString().split('T')[0], 
          time, duration: _service.durationMins || 30, status: 'Upcoming' 
        } 
      });
      
    closeAddApptModal();
    document.getElementById('apptClient').value = '';
    document.getElementById('apptService').value = '';
    document.getElementById('apptTime').value = '';
    showToast('Appointment Saved');
    refreshRelated(['calendar', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Appointment'; }
}

/* ══════════════════════════════════════════════════════════
   3. CLIENTS
   ══════════════════════════════════════════════════════════ */

async function loadClients() {
  try {
    const clients = await api('/clients');
    setEl('totalClientsCount',  clients.length);

    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    if (clients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">No clients yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = clients.map(c => `
      <tr>
        <td data-label="Name">${c.name}</td>
        <td data-label="Contact">${c.phone}</td>
        <td data-label="First Visit">${new Date(c.createdAt).toLocaleDateString()}</td>
        <td data-label="Total Visits">${c.totalVisits || 0}</td>
        <td data-label="Last Visit">${c.lastVisit  ? new Date(c.lastVisit).toLocaleDateString()  : '—'}</td>
        <td data-label="Total Spent">₹${(c.totalSpend || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('');
  } catch (err) { showToast(err.message || 'Clients error', 'error'); }
}

function openAddClientModal()  { document.getElementById('addClientModal').style.display = 'block'; }
function closeAddClientModal() { document.getElementById('addClientModal').style.display = 'none'; }

async function saveClient() {
  const name   = document.getElementById('newClientName').value.trim();
  const phone  = document.getElementById('newClientPhone').value.trim();
  const email  = document.getElementById('newClientEmail').value.trim();
  
  if (!name || !phone) { showToast('Name and phone are required', 'error'); return; }
  
  const btn = document.querySelector('button[onclick="saveClient()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  
  try {
    await api('/clients', { method: 'POST', body: { name, phone, email } });
    closeAddClientModal();
    ['newClientName','newClientPhone','newClientEmail'].forEach(id => document.getElementById(id).value = '');
    showToast('Client added');
    refreshRelated(['clients', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Client'; } }
}

/* ══════════════════════════════════════════════════════════
   4. STAFF
   ══════════════════════════════════════════════════════════ */

async function loadStaff() {
  try {
    const staff = await api('/staff');
    
    // Compute async performance for each
    for (let s of staff) {
        try {
            const perf = await api(`/staff/${s._id}/performance`);
            s.totalRevenue = perf.revenueThisMonth;
            s.earned = perf.commissionThisMonth;
        } catch(e) { s.totalRevenue = 0; s.earned = 0; }
    }

    const present  = staff.filter(s => s.active).length;
    const totalRev = staff.reduce((s, m) => s + (m.totalRevenue || 0), 0);
    const top      = [...staff].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))[0];

    setEl('totalStaffCount',   staff.length);
    setEl('onDutyCount',       present);
    setEl('staffTotalRevenue', '₹' + totalRev.toLocaleString('en-IN'));
    setEl('topPerformerName',  top ? top.name : '—');

    const tbody = document.querySelector('#staffTable tbody');
    if (!tbody) return;
    if (staff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#999;padding:24px;">No staff yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = staff.map(s => `
      <tr onclick="openStaffProfile('${s.name}','${s.role}','${s.phone}','${s.commissionPct}','${s.totalRevenue}','${s.active}')">
        <td data-label="Name">${s.name}</td>
        <td data-label="Role">${s.role}</td>
        <td data-label="Phone">${s.phone}</td>
        <td data-label="Commission">${s.commissionPct}%</td>
        <td data-label="Revenue">₹${(s.totalRevenue || 0).toLocaleString('en-IN')}</td>
        <td data-label="Status"><span class="status ${s.active ? 'present' : 'absent'}">${s.active ? 'Active' : 'Inactive'}</span></td>
        <td data-label="Actions"><button class="no-print" style="color:red" onclick="deleteStaffById(event,'${s._id}')">Delete</button></td>
      </tr>`).join('');
  } catch (err) { showToast(err.message || 'Staff error', 'error'); }
}

function openStaffModal()  { document.getElementById('addStaffModal').style.display = 'block'; }
function closeStaffModal() { document.getElementById('addStaffModal').style.display = 'none'; }

async function addStaff() {
  const name       = document.getElementById('newStaffName').value.trim();
  const role       = document.getElementById('newStaffRole').value.trim();
  const phone      = document.getElementById('newStaffPhone').value.trim();
  const commission = document.getElementById('newStaffCommission').value;
  if (!name || !role || !phone || !commission) { showToast('Please fill all fields', 'error'); return; }

  const btn = document.querySelector('button[onclick="addStaff()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    await api('/staff', { method: 'POST', body: { name, role, phone, commissionPct: Number(commission) } });
    closeStaffModal();
    ['newStaffName','newStaffRole','newStaffPhone','newStaffCommission'].forEach(id => document.getElementById(id).value = '');
    showToast('Staff added');
    refreshRelated(['staff']);
  } catch (err) { showToast(err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save'; } }
}

async function deleteStaffById(event, id) {
  event.stopPropagation();
  confirmAction('Remove this staff member?', async () => {
    try { 
      await api(`/staff/${id}`, { method: 'DELETE' }); 
      closeStaffPanel(); 
      showToast('Staff deleted'); 
      refreshRelated(['staff']); 
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function openStaffProfile(name, role, phone, commission, revenue, active) {
  setEl('staffName',        name);
  setEl('staffRole',        role);
  setEl('staffPhone',       phone);
  setEl('staffCommission',  commission);
  setEl('staffRevenue',     Number(revenue).toLocaleString('en-IN'));
  setEl('commissionEarned', '₹' + Math.round(Number(revenue) * Number(commission) / 100).toLocaleString('en-IN'));
  document.getElementById('staffPanel').classList.add('active');
}
function closeStaffPanel() { document.getElementById('staffPanel').classList.remove('active'); }

/* ══════════════════════════════════════════════════════════
   5. SERVICES CATALOG
   ══════════════════════════════════════════════════════════ */

async function loadServices() {
  try {
    const services = await api('/services');
    const tbody = document.querySelector('#servicesTable tbody');
    if (!tbody) return;
    if (services.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No services added yet.</td></tr>';
      return;
    }
    tbody.innerHTML = services.map(s => `
      <tr>
        <td data-label="Service">${s.name}</td>
        <td data-label="Category">${s.category}</td>
        <td data-label="Duration">${s.durationMins} mins</td>
        <td data-label="Price">₹${s.defaultPrice}</td>
        <td data-label="Status"><span class="status ${s.active ? 'present' : 'absent'}">${s.active ? 'Active' : 'Inactive'}</span></td>
        <td data-label="Actions">
          <button class="btn-secondary" style="padding:4px 8px;font-size:12px;" onclick="editService('${s._id}')">Edit</button>
          <button class="btn-danger"    style="padding:4px 8px;font-size:12px;" onclick="deleteServiceById('${s._id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { showToast(err.message || 'Services error', 'error'); }
}

function openAddServiceModal() { 
    document.getElementById('editServiceId').value = '';
    document.getElementById('newServiceName').value = '';
    document.getElementById('newServiceCategory').value = '';
    document.getElementById('newServiceDuration').value = '';
    document.getElementById('newServicePrice').value = '';
    document.getElementById('addServiceModal').style.display = 'block'; 
}
function closeAddServiceModal() { document.getElementById('addServiceModal').style.display = 'none'; }

async function editService(id) {
    try {
        const s = await api(`/services/${id}`);
        document.getElementById('editServiceId').value = s._id;
        document.getElementById('newServiceName').value = s.name;
        document.getElementById('newServiceCategory').value = s.category;
        document.getElementById('newServiceDuration').value = s.durationMins;
        document.getElementById('newServicePrice').value = s.defaultPrice;
        document.getElementById('addServiceModal').style.display = 'block';
    } catch(err) { showToast(err.message, 'error'); }
}

async function saveService() {
  const name = document.getElementById('newServiceName').value.trim();
  const category = document.getElementById('newServiceCategory').value.trim();
  const duration = document.getElementById('newServiceDuration').value;
  const price = document.getElementById('newServicePrice').value;
  const id = document.getElementById('editServiceId').value;
  
  if (!name || !category || !duration || !price) { showToast('Fill all fields', 'error'); return; }
  
  const btn = document.querySelector('button[onclick="saveService()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/services/${id}` : '/services';
    await api(url, { method, body: { name, category, durationMins: Number(duration), defaultPrice: Number(price) } });
    showToast(id ? 'Service updated' : 'Service added');
    closeAddServiceModal();
    ['newServiceName','newServiceCategory','newServiceDuration','newServicePrice'].forEach(id => document.getElementById(id).value = '');
    loadServices();
  } catch (err) { showToast(err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Service'; } }
}

async function deleteServiceById(id) {
    confirmAction('Delete this service?', async () => {
        try {
            await api(`/services/${id}`, { method: 'DELETE' });
            showToast('Service deleted');
            loadServices();
        } catch(err) { showToast(err.message, 'error'); }
    });
}



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
            <img src="${item.imageUrl || placeholder}" alt="${item.name}" onerror="this.src='${placeholder}'">
            ${isLow ? '<span class="stock-badge badge-low">Low Stock</span>' : '<span class="stock-badge badge-ok">In Stock</span>'}
          </div>
          <div class="product-info">
            <div class="product-meta">
              <span class="product-cat">${item.category || 'General'}</span>
              <span class="product-brand">${item.brand || 'No Brand'}</span>
            </div>
            <h3 class="product-name">${item.name}</h3>
            <p class="product-desc">${item.description || 'No description provided.'}</p>
            
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

function openInvModal()  { document.getElementById('inventoryModal').style.display = 'block'; }
function closeInvModal() { document.getElementById('inventoryModal').style.display = 'none'; }

async function addInventory() {
  const name          = document.getElementById('invName').value.trim();
  const category      = document.getElementById('invCategory').value.trim();
  const stock         = parseInt(document.getElementById('invStock').value);
  const minStock      = parseInt(document.getElementById('invMin').value);
  const purchasePrice = parseInt(document.getElementById('invPurchase').value);
  const sellingPrice  = parseInt(document.getElementById('invSelling').value);
  const brand         = document.getElementById('invSupplier').value.trim(); // Mapping supplier to brand

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

async function populateProductDropdown() {
  try {
    const items  = await api('/inventory');
    const select = document.getElementById('productSelect');
    if (!select) return;
    const available = items.filter(i => i.stock > 0);
    if (available.length === 0) {
      select.innerHTML = '<option value="">No products in stock</option>';
      return;
    }
    select.innerHTML = '<option value="">Select Product...</option>' +
      available.map(i => `<option value="${i._id}|${i.name}|${i.sellPrice}">${i.name} — ₹${i.sellPrice} (${i.stock} in stock)</option>`).join('');
  } catch (err) { showToast(err.message || 'Failed to load products', 'error'); }
}

async function populateServiceDropdown() {
  try {
    const services  = await api('/services');
    const select = document.getElementById('serviceSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select Service...</option>' +
      services.map(s => `<option value="${s._id}|${s.name}|${s.defaultPrice}">${s.name} — ₹${s.defaultPrice}</option>`).join('');
  } catch(err) { showToast(err.message || 'Failed to load services', 'error'); }
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
    dataList.innerHTML = clients.map(c => `<option value="${c.name}"></option>`).join('');
  } catch(e){}
}

function addServiceToBill() {
  const val = document.getElementById('serviceSelect').value;
  if (!val) return;
  const [id, name, price] = val.split('|');
  addToBill(name, 'Service', parseInt(price), id);
  document.getElementById('serviceSelect').value = '';
}

function addProductToBill() {
  const val = document.getElementById('productSelect').value;
  if (!val) return;
  const [id, name, price] = val.split('|');
  addToBill(name, 'Product', parseInt(price), id);
  document.getElementById('productSelect').value = '';
}

function addToBill(name, type, price, refId = null) {
  const existing = billItems.find(i => i.name === name);
  if (existing) { existing.qty++; } else { billItems.push({ name, type, price, qty: 1, refId }); }
  renderBill();
}

function renderBill() {
  const tbody = document.querySelector('#billTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  billItems.forEach((item, index) => {
    tbody.innerHTML += `
      <tr>
        <td data-label="Item">${item.name}</td>
        <td data-label="Type">${item.type}</td>
        <td data-label="Qty">
          <button class="qty-btn" onclick="changeQty(${index},-1)">−</button>
          <span style="margin:0 6px;">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${index},1)">+</button>
        </td>
        <td data-label="Price">₹${item.price.toLocaleString('en-IN')}</td>
        <td data-label="Total">₹${(item.qty * item.price).toLocaleString('en-IN')}</td>
        <td data-label="Remove"><button class="no-print" onclick="removeItem(${index})" style="background:#e74c3c;color:white;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;">✕</button></td>
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
  const gst      = Math.round(subtotal * (taxPctGlobal / 100));
  const total    = subtotal + gst;
  setEl('billSubtotal', subtotal.toLocaleString('en-IN'));
  setEl('billGST',      gst.toLocaleString('en-IN'));
  setEl('billTotal',    total.toLocaleString('en-IN'));
}

async function finalizeSale() {
  if (billItems.length === 0) { showToast('Add items to bill', 'error'); return; }
  const clientName    = document.getElementById('billClient').value.trim();
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

      // Need staff ID. Default to first staff.
      const staffList = await api('/staff');
      let _staff = staffList[0];
      if (!_staff) throw new Error('No staff found. Please add a staff member in the Staff section first.');

      const subtotal   = billItems.reduce((s, i) => s + i.qty * i.price, 0);
      const gst        = Math.round(subtotal * (taxPctGlobal / 100));
      const grandTotal = subtotal + gst;
      const items      = billItems.map(i => ({ name: i.name, type: i.type, qty: i.qty, unitPrice: i.price, subtotal: i.qty * i.price, refId: i.refId }));

      await api('/bills', { 
          method: 'POST', 
          body: { 
              clientId: client._id, clientName: client.name,
              staffId: _staff._id, staffName: _staff.name,
              lineItems: items,
              subtotal, taxPct: taxPctGlobal, taxAmount: gst, grandTotal, paymentMethod 
          } 
      });

      billItems = [];
      renderBill();
      document.getElementById('billClient').value = '';
      showToast(`Bill saved: ₹${grandTotal}`);
      refreshRelated(['checkout', 'reports', 'dashboard', 'inventory', 'clients']);
      
      // Auto-Print
      setTimeout(() => printBill(), 500);

  } catch(err) { showToast(err.message, 'error'); }
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
        <td data-label="Date" style="color:var(--text-muted);font-size:0.82rem;">${new Date(b.date || b.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'2-digit' })}</td>
        <td data-label="Client"><strong>${b.clientName}</strong></td>
        <td data-label="Items" style="color:var(--text-muted)">${b.lineItems.length} item${b.lineItems.length !== 1 ? 's' : ''}</td>
        <td data-label="Total"><strong>₹${b.grandTotal.toLocaleString('en-IN')}</strong>${isVoid ? ' <span style="color:#c0392b;font-size:0.75rem;font-weight:700;">VOID</span>' : ''}</td>
        <td data-label="Payment"><span class="pay-badge ${payClass(b.paymentMethod)}">${b.paymentMethod}</span></td>
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
        <td data-label="Item">${item.name}</td>
        <td data-label="Type">${item.type}</td>
        <td data-label="Qty">${item.qty}</td>
        <td data-label="Price">₹${item.unitPrice}</td>
        <td data-label="Total">₹${item.subtotal}</td>
        <td data-label="Actions" class="no-print">—</td>
      </tr>
    `).join('');

    setEl('billSubtotal', bill.subtotal.toLocaleString('en-IN'));
    setEl('billGST', (bill.taxAmount || 0).toLocaleString('en-IN'));
    setEl('billTotal', bill.grandTotal.toLocaleString('en-IN'));

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
    const [reportData, staff, inventory] = await Promise.all([
      api('/bills/stats/range'),
      api('/staff'),
      api('/inventory')
    ]);

    const { bills, totalRevenue, totalBills, revenueByMonth } = reportData;
    const avgBill = totalBills ? Math.round(totalRevenue / totalBills) : 0;

    setEl('repTotalRevenue', '₹' + totalRevenue.toLocaleString('en-IN'));
    setEl('repTotalBills', totalBills);
    setEl('repAvgBill', '₹' + avgBill.toLocaleString('en-IN'));
    setEl('repNetProfit', '₹' + Math.round(totalRevenue * 0.3).toLocaleString('en-IN')); // Estimation
    
    setEl('repTotalStaff', staff.length);

    const invValue  = inventory.reduce((s, i) => s + i.stock * i.costPrice, 0);
    const lowStock  = inventory.filter(i => i.stock <= i.minStock).length;
    setEl('repInvValue', '₹' + invValue.toLocaleString('en-IN'));
    setEl('repLowStock', lowStock);

    // Render Charts
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch(e){} });

    _charts.exec = new Chart(document.getElementById('execRevenueChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(revenueByMonth).length ? Object.keys(revenueByMonth) : ['No Data'],
        datasets: [{ label: 'Revenue (₹)', data: Object.values(revenueByMonth).length ? Object.values(revenueByMonth) : [0], backgroundColor: '#6c5ce7' }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

  } catch (err) { showToast(err.message || 'Reports error', 'error'); }
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

    } catch(err) { showToast(err.message || 'Settings error', 'error'); }
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
    } catch(err) { showToast(err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Settings'; } }
}

async function dangerDeleteAccount() {
    const word = prompt("To permanently delete everything, type DELETE");
    if (word === 'DELETE') {
        alert("This was a demo function. Database wipe requested but bypassed for safety context.");
    }
}


/* ─── INIT ───────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    loadSettings().then(() => {
        loadDashboard(); // Tax pct loaded, proceed
    });
  }
});