/* ==========================================================
   SalonPro — script.js
   Frontend Orchestration (Vanilla JS)
   ========================================================== */

/* ─── NAVIGATION ─────────────────────────────────────────── */

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('section-hidden'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.remove('section-hidden');

  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
  }

  if (sectionId === 'home')      loadDashboard();
  if (sectionId === 'calendar')  loadCalendar();
  if (sectionId === 'clients')   loadClients();
  if (sectionId === 'staff')     loadStaff();
  if (sectionId === 'services')  loadServices();
  if (sectionId === 'inventory') loadInventory();
  if (sectionId === 'checkout')  { populateProductDropdown(); populateServiceDropdown(); populateClientDropdown(); loadBillHistory(); }
  if (sectionId === 'reports')   loadReports();
  if (sectionId === 'settings')  loadSettings();
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('active');
}

/* ─── DOM HELPERS ────────────────────────────────────────── */

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

function openModal(client, service, time, amount, staff, id) {
  setEl('modalClient', client);   setEl('modalService', service);
  setEl('modalTime', time);       setEl('modalAmount', amount);
  setEl('modalStaff', staff);
  
  // Attach appointment ID for converting to bill
  const appointmentModal = document.getElementById('appointmentModal');
  appointmentModal.dataset.apptId = id;
  appointmentModal.dataset.apptClient = client;
  appointmentModal.dataset.apptService = service;
  appointmentModal.dataset.apptStaff = staff;
  
  appointmentModal.style.display = 'block';
}
function closeModal() { document.getElementById('appointmentModal').style.display = 'none'; }


/* ══════════════════════════════════════════════════════════
   1. DASHBOARD
   ══════════════════════════════════════════════════════════ */

async function loadDashboard() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [stats, appointments, inventory, clients] = await Promise.all([
      api('/bills/stats/today'),
      api(`/appointments`), // Fetch all then filter locally for simplicity, or API could filter
      api('/inventory'),
      api('/clients')
    ]);

    const todaysAppointments = appointments.filter(a => a.date === today);

    // Sales today
    setEl('dashTotalSales', '₹' + (stats.totalSales || 0).toLocaleString('en-IN'));

    // Appointments today
    setEl('dashApptCount', todaysAppointments.length);
    const ongoing = todaysAppointments.filter(a => a.status === 'Ongoing').length;
    setEl('dashApptOngoing', ongoing + ' ongoing right now');

    // Total clients
    setEl('dashTotalClients', clients.length);

    // Low stock alerts
    const lowItems  = inventory.filter(i => i.stock <= i.minStock);
    const alertList = document.getElementById('dashLowStockList');
    if (alertList) {
      if (lowItems.length === 0) {
        alertList.innerHTML = '<li style="color:#27ae60;">All stock levels OK</li>';
      } else {
        alertList.innerHTML = lowItems
          .map(i => `<li>${i.name} – ${i.stock} left</li>`)
          .join('');
      }
    }

    // Today's appointments table
    const table = document.getElementById('dashApptTable');
    if (table) {
      const rows = table.querySelectorAll('tr:not(:first-child)');
      rows.forEach(r => r.remove());

      if (todaysAppointments.length === 0) {
        table.innerHTML += `<tr><td colspan="4" style="text-align:center;color:#999;padding:16px;">No appointments today yet</td></tr>`;
      } else {
        todaysAppointments.forEach(a => {
          table.innerHTML += `
            <tr>
              <td>${a.time}</td>
              <td>${a.clientName}</td>
              <td>${a.serviceName}</td>
              <td><span style="padding:3px 8px;border-radius:4px;font-size:12px;background:${statusColor(a.status)};color:white;">${a.status}</span></td>
            </tr>`;
        });
      }
    }

  } catch (err) {
    showToast('Dashboard error', 'error');
  }
}

// Quick Add Appointment form on dashboard
const appointmentForm = document.getElementById('appointmentForm');
if (appointmentForm) {
  appointmentForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const clientName = this.children[0].value.trim();
    const serviceName    = this.children[1].value.trim();
    const time       = this.children[2].value;
    const date       = new Date().toISOString().split('T')[0]; // Today
    
    try {
      // Need a default client and staff ID normally. Let's create dummy ones or fetch first available.
      // Quick add assumes some defaults if not specified
      const clients = await api('/clients');
      const services = await api('/services');
      const staffList = await api('/staff');
      
      let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
      if (!client) {
          // Create client
          client = await api('/clients', { method: 'POST', body: { name: clientName, phone: '0000000000' } });
      }

      let _staff = staffList.length > 0 ? staffList[0] : null;
      let _service = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase()) || (services.length > 0 ? services[0] : null);

      if (!_staff || !_service) throw new Error('Add at least one Staff and Service in settings first.');

      await api('/appointments', { 
        method: 'POST', 
        body: { 
          clientId: client._id, clientName: client.name, 
          serviceId: _service._id, serviceName: serviceName, 
          staffId: _staff._id, staffName: _staff.name,
          date, time, duration: _service.durationMins || 30, status: 'Upcoming' 
        } 
      });
      
      this.reset();
      showToast('Appointment added');
      loadDashboard();
    } catch (err) { showToast(err.message, 'error'); }
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
      api(`/appointments`),
      api('/staff')
    ]);

    const todaysAppointments = appointments.filter(a => a.date === today);

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

    if (todaysAppointments.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;grid-row:1;padding:24px;text-align:center;color:#999;font-size:14px;">No appointments today.</div>`;
    } else {
      todaysAppointments.forEach((appt, idx) => {
        const hour     = parseTimeToHour(appt.time);
        const rowIndex = Math.max(1, hour - 7); 
        const div      = document.createElement('div');
        div.className  = 'appointment';
        div.style.cssText = `grid-column:${(idx % 5) + 1};grid-row:${rowIndex};background:${SLOT_COLORS[idx % SLOT_COLORS.length]};`;
        div.innerHTML  = `<strong>${appt.clientName}</strong><br>${appt.serviceName}<br>${appt.time}`;
        div.onclick    = () => openModal(appt.clientName, appt.serviceName, appt.time, 'See Bill', appt.staffName, appt._id);
        grid.appendChild(div);
      });
    }

  } catch (err) { showToast('Calendar error', 'error'); }
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
          date: new Date().toISOString().split('T')[0], time, duration: _service.durationMins || 30, status: 'Upcoming' 
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
        <td>${c.name}</td>
        <td>${c.phone}</td>
        <td>${new Date(c.createdAt).toLocaleDateString()}</td>
        <td>${c.totalVisits || 0}</td>
        <td>${c.lastVisit  ? new Date(c.lastVisit).toLocaleDateString()  : '—'}</td>
        <td>₹${(c.totalSpend || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('');
  } catch (err) { showToast('Clients error', 'error'); }
}

function openAddClientModal()  { document.getElementById('addClientModal').style.display = 'block'; }
function closeAddClientModal() { document.getElementById('addClientModal').style.display = 'none'; }

async function saveClient() {
  const name   = document.getElementById('newClientName').value.trim();
  const phone  = document.getElementById('newClientPhone').value.trim();
  const email  = document.getElementById('newClientEmail').value.trim();
  
  if (!name || !phone) { showToast('Name and phone are required', 'error'); return; }
  try {
    await api('/clients', { method: 'POST', body: { name, phone, email } });
    closeAddClientModal();
    ['newClientName','newClientPhone','newClientEmail'].forEach(id => document.getElementById(id).value = '');
    showToast('Client added');
    refreshRelated(['clients', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
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
        <td>${s.name}</td>
        <td>${s.role}</td>
        <td>${s.phone}</td>
        <td>${s.commissionPct}%</td>
        <td>₹${(s.totalRevenue || 0).toLocaleString('en-IN')}</td>
        <td><span class="status ${s.active ? 'present' : 'absent'}">${s.active ? 'Active' : 'Inactive'}</span></td>
        <td><button class="no-print" style="color:red" onclick="deleteStaffById(event,'${s._id}')">Delete</button></td>
      </tr>`).join('');
  } catch (err) { showToast('Staff error', 'error'); }
}

function openStaffModal()  { document.getElementById('addStaffModal').style.display = 'block'; }
function closeStaffModal() { document.getElementById('addStaffModal').style.display = 'none'; }

async function addStaff() {
  const name       = document.getElementById('newStaffName').value.trim();
  const role       = document.getElementById('newStaffRole').value.trim();
  const phone      = document.getElementById('newStaffPhone').value.trim();
  const commission = document.getElementById('newStaffCommission').value;
  if (!name || !role || !phone || !commission) { showToast('Please fill all fields', 'error'); return; }
  try {
    await api('/staff', { method: 'POST', body: { name, role, phone, commissionPct: Number(commission) } });
    closeStaffModal();
    ['newStaffName','newStaffRole','newStaffPhone','newStaffCommission'].forEach(id => document.getElementById(id).value = '');
    showToast('Staff added');
    refreshRelated(['staff']);
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteStaffById(event, id) {
  event.stopPropagation();
  if (!confirm('Remove this staff member?')) return;
  try { await api(`/staff/${id}`, { method: 'DELETE' }); closeStaffPanel(); showToast('Staff deleted'); refreshRelated(['staff']); }
  catch (err) { showToast(err.message, 'error'); }
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
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">No services yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = services.map(s => `
            <tr>
                <td>${s.name}</td>
                <td>${s.category}</td>
                <td>${s.durationMins} m</td>
                <td>₹${s.defaultPrice}</td>
                <td><span class="status ${s.active ? 'present' : 'absent'}">${s.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="no-print" style="color:red" onclick="deleteServiceById('${s._id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch(err) { showToast('Services error', 'error'); }
}

function openAddServiceModal() { document.getElementById('addServiceModal').style.display = 'block'; }
function closeAddServiceModal() { document.getElementById('addServiceModal').style.display = 'none'; }

async function saveService() {
    const name = document.getElementById('newServiceName').value.trim();
    const category = document.getElementById('newServiceCategory').value.trim();
    const duration = document.getElementById('newServiceDuration').value;
    const price = document.getElementById('newServicePrice').value;

    if(!name || !category || !duration || !price) { showToast('Fill all fields', 'error'); return; }

    try {
        await api('/services', {
            method: 'POST',
            body: { name, category, durationMins: Number(duration), defaultPrice: Number(price) }
        });
        closeAddServiceModal();
        ['newServiceName','newServiceCategory','newServiceDuration','newServicePrice'].forEach(id => document.getElementById(id).value = '');
        showToast('Service saved');
        refreshRelated(['services']);
    } catch(err) { showToast(err.message, 'error'); }
}

async function deleteServiceById(id) {
    if(!confirm('Delete service?')) return;
    try {
        await api(`/services/${id}`, { method: 'DELETE' });
        showToast('Service deleted');
        refreshRelated(['services']);
    } catch(err) { showToast(err.message, 'error')}
}


/* ══════════════════════════════════════════════════════════
   6. INVENTORY
   ══════════════════════════════════════════════════════════ */

async function loadInventory() {
  try {
    const items = await api('/inventory');

    const lowStock   = items.filter(i => i.stock <= i.minStock).length;
    const totalValue = items.reduce((s, i) => s + i.stock * i.costPrice, 0);
    setEl('invTotalProducts', items.length);
    setEl('invLowStock',      lowStock);
    setEl('invTotalValue',    '₹' + totalValue.toLocaleString('en-IN'));

    const tbody = document.querySelector('#inventoryTable tbody');
    if (!tbody) return;
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;color:#999;padding:24px;">No products yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(item => {
      const profit  = item.sellPrice - item.costPrice;
      const val     = item.stock * item.costPrice;
      const cls     = item.stock <= item.minStock ? 'inv-low' : 'inv-good';
      return `
        <tr>
          <td>${item.name}</td><td>${item.category}</td>
          <td>${item.stock} ${item.unit}</td><td>${item.minStock}</td>
          <td>Reorder ${item.stock < item.minStock ? item.minStock - item.stock : 0}</td>
          <td>${item.brand || '—'}</td><td>—</td>
          <td>₹${item.costPrice}</td><td>₹${item.sellPrice}</td>
          <td>₹${profit}</td><td>₹${val.toLocaleString('en-IN')}</td>
          <td><span class="${cls}">${item.stock <= item.minStock ? 'Low' : 'Good'}</span></td>
          <td>
            <button class="inv-action-btn" onclick="changeStockById('${item._id}',1)">+</button>
            <button class="inv-action-btn" onclick="changeStockById('${item._id}',-1)">-</button>
            <button class="inv-action-btn" style="color:red" onclick="deleteInventoryItem('${item._id}')">Delete</button>
          </td>
        </tr>`;
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
  try {
    await api('/inventory', { method: 'POST', body: { name, category, stock, minStock, brand, unit: 'pcs', costPrice: purchasePrice, sellPrice: sellingPrice } });
    ['invName','invCategory','invStock','invMin','invSupplier','invPhone','invPurchase','invSelling'].forEach(id => document.getElementById(id).value = '');
    closeInvModal();
    showToast('Product saved');
    refreshRelated(['inventory', 'dashboard', 'checkout']);
  } catch (err) { showToast(err.message, 'error'); }
}

async function changeStockById(id, delta) {
  try {
    await api(`/inventory/${id}/adjust-stock`, { method: 'POST', body: { adjustment: delta, reason: 'Manual update' } });
    refreshRelated(['inventory', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteInventoryItem(id) {
  if (!confirm('Delete this product?')) return;
  try { await api(`/inventory/${id}`, { method: 'DELETE' }); refreshRelated(['inventory']); }
  catch (err) { showToast(err.message, 'error'); }
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
  } catch (err) {}
}

async function populateServiceDropdown() {
  try {
    const services  = await api('/services');
    const select = document.getElementById('serviceSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select Service...</option>' +
      services.map(s => `<option value="${s._id}|${s.name}|${s.defaultPrice}">${s.name} — ₹${s.defaultPrice}</option>`).join('');
  } catch(err) {}
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
        <td>${item.name}</td>
        <td>${item.type}</td>
        <td>
          <button class="qty-btn" onclick="changeQty(${index},-1)">−</button>
          <span style="margin:0 6px;">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${index},1)">+</button>
        </td>
        <td>₹${item.price.toLocaleString('en-IN')}</td>
        <td>₹${(item.qty * item.price).toLocaleString('en-IN')}</td>
        <td><button class="no-print" onclick="removeItem(${index})" style="background:#e74c3c;color:white;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;">✕</button></td>
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

  try {
      // Create or find client
      const clients = await api('/clients');
      let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()) || await api('/clients', { method: 'POST', body: { name: clientName, phone: '0000000000' } });

      // Need staff ID. Default to first staff.
      const staffList = await api('/staff');
      let _staff = staffList[0];
      if (!_staff) throw new Error('Create Staff first to link a bill');

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

  } catch(err) { showToast(err.message, 'error'); }
}

async function loadBillHistory() {
  try {
    const bills = await api('/bills');
    const tbody = document.getElementById('billHistoryBody');
    if (!tbody) return;
    if (bills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">No bills yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = bills.map(b => `
      <tr>
        <td>${new Date(b.createdAt).toLocaleDateString('en-IN')}</td>
        <td>${b.clientName}</td>
        <td>${b.lineItems.length} item(s)</td>
        <td>₹${b.grandTotal.toLocaleString('en-IN')}</td>
        <td><span style="padding:2px 8px;border-radius:4px;background:#eafaf1;color:#1e8449;font-size:12px;">${b.paymentMethod}</span></td>
      </tr>`).join('');
  } catch (err) { }
}

/* ══════════════════════════════════════════════════════════
   8. REPORTS
   ══════════════════════════════════════════════════════════ */

const _charts = {};

async function loadReports() {
  try {
    const [bills, staff, inventory, clients] = await Promise.all([
      api('/bills/stats/range'), // Fetches all bills by default
      api('/staff'),
      api('/inventory'),
      api('/clients')
    ]);

    const totalRev = bills.reduce((acc, b) => acc + b.grandTotal, 0);
    const avgBill = bills.length ? Math.round(totalRev / bills.length) : 0;

    setEl('repTotalRevenue', '₹' + totalRev.toLocaleString('en-IN'));
    setEl('repTotalBills', bills.length);
    setEl('repAvgBill', '₹' + avgBill.toLocaleString('en-IN'));
    setEl('repNetProfit', '₹' + Math.round(totalRev * 0.3).toLocaleString('en-IN')); // Estimation
    
    setEl('repTotalStaff', staff.length);
    setEl('repTotalClientsRep', clients.length);

    const invValue  = inventory.reduce((s, i) => s + i.stock * i.costPrice, 0);
    const lowStock  = inventory.filter(i => i.stock <= i.minStock).length;
    setEl('repInvValue', '₹' + invValue.toLocaleString('en-IN'));
    setEl('repLowStock', lowStock);

    // Render Charts
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch(e){} });

    // Revenue chart
    const monthMap = {};
    bills.forEach(b => {
        const m = new Date(b.date).toLocaleDateString('en-US', { month: 'short' });
        monthMap[m] = (monthMap[m]||0) + b.grandTotal;
    });

    _charts.exec = new Chart(document.getElementById('execRevenueChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(monthMap).length ? Object.keys(monthMap) : ['No Data'],
        datasets: [{ label: 'Revenue (₹)', data: Object.values(monthMap).length ? Object.values(monthMap) : [0], backgroundColor: '#6c5ce7' }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

  } catch (err) { showToast('Reports error', 'error'); }
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

        taxPctGlobal = s.taxPct || 0; // Set global
    } catch(err) { showToast('Settings error', 'error'); }
}

async function saveSettings() {
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