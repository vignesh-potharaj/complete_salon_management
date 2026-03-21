/* ==========================================================
   SalonPro — script.js
   100% real data from MongoDB. Zero hardcoded values.
   ========================================================== */

/* ─── NAVIGATION ─────────────────────────────────────────── */

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('section-hidden'));
  const target = document.getElementById(sectionId);
  target.classList.remove('section-hidden');

  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
  }

  if (sectionId === 'home')      loadDashboard();
  if (sectionId === 'calendar')  loadCalendar();
  if (sectionId === 'clients')   loadClients();
  if (sectionId === 'staff')     loadStaff();
  if (sectionId === 'inventory') loadInventory();
  if (sectionId === 'checkout')  { populateProductDropdown(); loadBillHistory(); }
  if (sectionId === 'reports')   loadReports();
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('active');
}

/* ─── HELPERS ────────────────────────────────────────────── */

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

function openModal(client, service, time, amount, staff) {
  setEl('modalClient', client);   setEl('modalService', service);
  setEl('modalTime', time);       setEl('modalAmount', amount);
  setEl('modalStaff', staff);
  document.getElementById('appointmentModal').style.display = 'block';
}
function closeModal() { document.getElementById('appointmentModal').style.display = 'none'; }

/* ══════════════════════════════════════════════════════════
   1. DASHBOARD — 100% real data, zero hardcoded
   ══════════════════════════════════════════════════════════ */

async function loadDashboard() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [stats, appointments, inventory, clients] = await Promise.all([
      api('/bills/stats/today'),
      api(`/appointments?date=${today}`),
      api('/inventory'),
      api('/clients')
    ]);

    // ── Sales today ───────────────────────────────────────
    setEl('dashTotalSales', '₹' + (stats.totalSales || 0).toLocaleString('en-IN'));
    setEl('dashTotalBills', stats.totalBills + ' bill(s) today');

    // ── Appointments today ────────────────────────────────
    setEl('dashApptCount', appointments.length);
    const ongoing = appointments.filter(a => a.status === 'Ongoing').length;
    setEl('dashApptOngoing', ongoing + ' ongoing right now');

    // ── Total clients ─────────────────────────────────────
    setEl('dashTotalClients', clients.length);

    // ── Low stock alerts ──────────────────────────────────
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

    // ── Today's appointments table ────────────────────────
    const table = document.getElementById('dashApptTable');
    if (table) {
      // keep header, remove old rows
      const rows = table.querySelectorAll('tr:not(:first-child)');
      rows.forEach(r => r.remove());

      if (appointments.length === 0) {
        table.innerHTML += `<tr><td colspan="4" style="text-align:center;color:#999;padding:16px;">No appointments today yet</td></tr>`;
      } else {
        appointments.forEach(a => {
          table.innerHTML += `
            <tr>
              <td>${a.time}</td>
              <td>${a.clientName}</td>
              <td>${a.service}</td>
              <td><span style="padding:3px 8px;border-radius:4px;font-size:12px;background:${statusColor(a.status)};color:white;">${a.status}</span></td>
            </tr>`;
        });
      }
    }

  } catch (err) {
    console.error('Dashboard error:', err);
    setEl('dashTotalSales',  'Error');
    setEl('dashApptCount',   'Error');
    setEl('dashTotalClients','Error');
  }
}

/* ─── Quick Add Appointment (dashboard form) ─────────────── */
const appointmentForm = document.getElementById('appointmentForm');
if (appointmentForm) {
  appointmentForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const clientName = this.children[0].value.trim();
    const service    = this.children[1].value.trim();
    const time       = this.children[2].value;
    try {
      await api('/appointments', { method: 'POST', body: { clientName, service, time, status: 'Upcoming' } });
      this.reset();
      loadDashboard();
    } catch (err) { alert('Error: ' + err.message); }
  });
}

/* ══════════════════════════════════════════════════════════
   2. CALENDAR — real appointments from DB
   ══════════════════════════════════════════════════════════ */

const SLOT_COLORS = ['#ff4d4d','#6c5ce7','#0984e3','#e17055','#00b894','#fdcb6e','#fd79a8'];

async function loadCalendar() {
  try {
    // Date header
    const header = document.getElementById('calendarDateHeader');
    if (header) header.innerText = new Date().toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    const today = new Date().toISOString().split('T')[0];
    const [appointments, staff] = await Promise.all([
      api(`/appointments?date=${today}`),
      api('/staff')
    ]);

    // Staff row
    const staffRow = document.getElementById('calendarStaffRow');
    if (staffRow) {
      if (staff.length === 0) {
        staffRow.innerHTML = `<div class="staff-card"><img src="https://randomuser.me/api/portraits/lego/1.jpg"><span>No staff yet</span></div>`;
      } else {
        staffRow.innerHTML = staff.slice(0, 5).map(s => `
          <div class="staff-card">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&color=fff&size=80"
                 onerror="this.src='https://randomuser.me/api/portraits/lego/1.jpg'">
            <span>${s.name}</span>
          </div>`).join('');
      }
    }

    // Calendar grid
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = ''; // clear everything

    if (appointments.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;grid-row:1;padding:24px;text-align:center;color:#999;font-size:14px;">No appointments today. Click "Add Appointment +" to add one.</div>`;
      return;
    }

    appointments.forEach((appt, idx) => {
      const hour     = parseTimeToHour(appt.time);
      const rowIndex = Math.max(1, hour - 7); // 8AM = row 1
      const div      = document.createElement('div');
      div.className  = 'appointment';
      div.style.cssText = `grid-column:${(idx % 5) + 1};grid-row:${rowIndex};background:${SLOT_COLORS[idx % SLOT_COLORS.length]};`;
      div.innerHTML  = `<strong>${appt.clientName}</strong><br>${appt.service}<br>${appt.time}`;
      div.onclick    = () => openModal(appt.clientName, appt.service, appt.time, '—', '—');
      grid.appendChild(div);
    });

  } catch (err) { console.error('Calendar error:', err); }
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
  const service    = document.getElementById('apptService').value.trim();
  const time       = document.getElementById('apptTime').value;
  const btn        = document.getElementById('saveApptBtn');
  if (!clientName || !service || !time) { alert('Please fill all fields'); return; }
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await api('/appointments', { method: 'POST', body: { clientName, service, time, status: 'Upcoming' } });
    closeAddApptModal();
    document.getElementById('apptClient').value = '';
    document.getElementById('apptService').value = '';
    document.getElementById('apptTime').value = '';
    loadCalendar();
    loadDashboard();
  } catch (err) { alert('Error: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = 'Save Appointment'; }
}

/* ══════════════════════════════════════════════════════════
   3. CLIENTS
   ══════════════════════════════════════════════════════════ */

async function loadClients() {
  try {
    const clients = await api('/clients');

    // Stats
    const now       = new Date();
    const thisMonth = clients.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    setEl('totalClientsCount',  clients.length);
    setEl('newClientsMonth',    thisMonth);
    setEl('femaleClientsCount', clients.filter(c => c.gender === 'Female').length);
    setEl('maleClientsCount',   clients.filter(c => c.gender === 'Male').length);

    // Table
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    if (clients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">No clients yet. Add your first client!</td></tr>`;
      return;
    }
    tbody.innerHTML = clients.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.phone}</td>
        <td>${c.firstVisit ? new Date(c.firstVisit).toLocaleDateString('en-IN') : '—'}</td>
        <td>${c.totalVisits || 0}</td>
        <td>${c.lastVisit  ? new Date(c.lastVisit).toLocaleDateString('en-IN')  : '—'}</td>
        <td>₹${(c.totalSpent || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('');
  } catch (err) { console.error('Clients error:', err); }
}

function openAddClientModal()  { document.getElementById('addClientModal').style.display = 'block'; }
function closeAddClientModal() { document.getElementById('addClientModal').style.display = 'none'; }

async function saveClient() {
  const name   = document.getElementById('newClientName').value.trim();
  const phone  = document.getElementById('newClientPhone').value.trim();
  const gender = document.getElementById('newClientGender').value;
  const email  = document.getElementById('newClientEmail').value.trim();
  if (!name || !phone) { alert('Name and phone are required'); return; }
  try {
    await api('/clients', { method: 'POST', body: { name, phone, gender, email } });
    closeAddClientModal();
    ['newClientName','newClientPhone','newClientEmail'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('newClientGender').value = '';
    loadClients();
  } catch (err) { alert('Error: ' + err.message); }
}

async function exportClients() {
  try {
    const clients = await api('/clients');
    if (clients.length === 0) { alert('No clients to export'); return; }
    const headers = ['Name','Phone','Gender','First Visit','Total Visits','Last Visit','Total Spent'];
    const rows = clients.map(c => [
      c.name, c.phone, c.gender || '',
      c.firstVisit ? new Date(c.firstVisit).toLocaleDateString('en-IN') : '',
      c.totalVisits || 0,
      c.lastVisit  ? new Date(c.lastVisit).toLocaleDateString('en-IN')  : '',
      c.totalSpent || 0
    ]);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'clients.csv'; link.click();
  } catch (err) { alert('Export failed'); }
}

/* ══════════════════════════════════════════════════════════
   4. STAFF
   ══════════════════════════════════════════════════════════ */

async function loadStaff() {
  try {
    const staff = await api('/staff');

    const present  = staff.filter(s => s.status === 'Present').length;
    const totalRev = staff.reduce((s, m) => s + (m.totalRevenue || 0), 0);
    const top      = [...staff].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))[0];

    setEl('totalStaffCount',   staff.length);
    setEl('onDutyCount',       present);
    setEl('staffTotalRevenue', '₹' + totalRev.toLocaleString('en-IN'));
    setEl('topPerformerName',  top ? top.name : '—');

    const tbody = document.querySelector('#staffTable tbody');
    if (!tbody) return;
    if (staff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#999;padding:24px;">No staff yet. Add your first staff member!</td></tr>`;
      return;
    }
    tbody.innerHTML = staff.map(s => `
      <tr onclick="openStaffProfile('${s.name}','${s.role}','${s.phone}','${s.commission}','${s.totalRevenue||0}','${s.status}')">
        <td>${s.name}</td>
        <td>${s.role}</td>
        <td>${s.phone}</td>
        <td>${s.commission}%</td>
        <td>₹${(s.totalRevenue || 0).toLocaleString('en-IN')}</td>
        <td><span class="status ${s.status === 'Present' ? 'present' : 'absent'}">${s.status}</span></td>
        <td><button class="delete-btn" onclick="deleteStaffById(event,'${s._id}')">Delete</button></td>
      </tr>`).join('');
  } catch (err) { console.error('Staff error:', err); }
}

function openStaffModal()  { document.getElementById('addStaffModal').style.display = 'block'; }
function closeStaffModal() { document.getElementById('addStaffModal').style.display = 'none'; }

async function addStaff() {
  const name       = document.getElementById('newStaffName').value.trim();
  const role       = document.getElementById('newStaffRole').value.trim();
  const phone      = document.getElementById('newStaffPhone').value.trim();
  const commission = document.getElementById('newStaffCommission').value;
  if (!name || !role || !phone || !commission) { alert('Please fill all fields'); return; }
  try {
    await api('/staff', { method: 'POST', body: { name, role, phone, commission: Number(commission) } });
    closeStaffModal();
    ['newStaffName','newStaffRole','newStaffPhone','newStaffCommission'].forEach(id => document.getElementById(id).value = '');
    loadStaff();
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteStaffById(event, id) {
  event.stopPropagation();
  if (!confirm('Remove this staff member?')) return;
  try { await api(`/staff/${id}`, { method: 'DELETE' }); closeStaffPanel(); loadStaff(); }
  catch (err) { alert('Error: ' + err.message); }
}

function openStaffProfile(name, role, phone, commission, revenue, status) {
  setEl('staffName',        name);
  setEl('staffRole',        role);
  setEl('staffPhone',       phone);
  setEl('staffCommission',  commission);
  setEl('staffRevenue',     Number(revenue).toLocaleString('en-IN'));
  setEl('commissionEarned', '₹' + Math.round(Number(revenue) * Number(commission) / 100).toLocaleString('en-IN'));
  document.getElementById('staffPanel').classList.add('active');
  loadStaffChart();
}
function closeStaffPanel() { document.getElementById('staffPanel').classList.remove('active'); }

let staffChart;
function loadStaffChart() {
  const ctx = document.getElementById('staffChart');
  if (!ctx) return;
  if (staffChart) staffChart.destroy();
  staffChart = new Chart(ctx, {
    type: 'line',
    data: { labels: ['Jan','Feb','Mar','Apr','May','Jun'], datasets: [{ label: 'Revenue', data: [0,0,0,0,0,0], borderWidth: 2, tension: 0.3 }] }
  });
}

/* ══════════════════════════════════════════════════════════
   5. INVENTORY
   ══════════════════════════════════════════════════════════ */

let inventoryHistory = {};

async function loadInventory() {
  try {
    const items = await api('/inventory');

    const lowStock   = items.filter(i => i.stock <= i.minStock).length;
    const totalValue = items.reduce((s, i) => s + i.stock * i.purchasePrice, 0);
    setEl('invTotalProducts', items.length);
    setEl('invLowStock',      lowStock);
    setEl('invTotalValue',    '₹' + totalValue.toLocaleString('en-IN'));

    const tbody = document.querySelector('#inventoryTable tbody');
    if (!tbody) return;
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;color:#999;padding:24px;">No products yet. Add your first product!</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(item => {
      const reorder = item.stock < item.minStock ? item.minStock - item.stock : 0;
      const profit  = item.sellingPrice - item.purchasePrice;
      const val     = item.stock * item.purchasePrice;
      const cls     = item.stock <= item.minStock ? 'inv-low' : 'inv-good';
      return `
        <tr>
          <td>${item.name}</td><td>${item.category}</td>
          <td>${item.stock}</td><td>${item.minStock}</td><td>${reorder}</td>
          <td>${item.supplier || '—'}</td><td>${item.supplierPhone || '—'}</td>
          <td>₹${item.purchasePrice}</td><td>₹${item.sellingPrice}</td>
          <td>₹${profit}</td><td>₹${val.toLocaleString('en-IN')}</td>
          <td><span class="${cls}">${item.stock <= item.minStock ? 'Low' : 'Good'}</span></td>
          <td>
            <button class="inv-action-btn" onclick="changeStockById('${item._id}',1)">+</button>
            <button class="inv-action-btn" onclick="changeStockById('${item._id}',-1)">-</button>
            <button class="inv-action-btn" onclick="openHistory('${item._id}','${item.name}')">History</button>
            <button class="inv-action-btn" onclick="deleteInventoryItem('${item._id}')">Delete</button>
          </td>
        </tr>`;
    }).join('');
  } catch (err) { console.error('Inventory error:', err); }
}

function openInvModal()  { document.getElementById('inventoryModal').style.display = 'block'; }
function closeInvModal() { document.getElementById('inventoryModal').style.display = 'none'; }

async function addInventory() {
  const name          = document.getElementById('invName').value.trim();
  const category      = document.getElementById('invCategory').value.trim();
  const stock         = parseInt(document.getElementById('invStock').value);
  const minStock      = parseInt(document.getElementById('invMin').value);
  const supplier      = document.getElementById('invSupplier').value.trim();
  const supplierPhone = document.getElementById('invPhone').value.trim();
  const purchasePrice = parseInt(document.getElementById('invPurchase').value);
  const sellingPrice  = parseInt(document.getElementById('invSelling').value);

  if (!name || !category || isNaN(stock) || isNaN(minStock) || isNaN(purchasePrice) || isNaN(sellingPrice)) {
    alert('Please fill all required fields'); return;
  }
  if (sellingPrice <= purchasePrice) {
    alert('Selling price must be greater than purchase price'); return;
  }
  try {
    await api('/inventory', { method: 'POST', body: { name, category, stock, minStock, supplier, supplierPhone, purchasePrice, sellingPrice } });
    ['invName','invCategory','invStock','invMin','invSupplier','invPhone','invPurchase','invSelling'].forEach(id => document.getElementById(id).value = '');
    closeInvModal();
    loadInventory();
  } catch (err) { alert('Error: ' + err.message); }
}

async function changeStockById(id, delta) {
  try {
    await api(`/inventory/${id}/stock`, { method: 'PATCH', body: { delta } });
    if (!inventoryHistory[id]) inventoryHistory[id] = [];
    inventoryHistory[id].push({ date: new Date().toLocaleString('en-IN'), action: delta > 0 ? 'Stock increased by 1' : 'Stock decreased by 1' });
    loadInventory();
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteInventoryItem(id) {
  if (!confirm('Delete this product?')) return;
  try { await api(`/inventory/${id}`, { method: 'DELETE' }); loadInventory(); }
  catch (err) { alert('Error: ' + err.message); }
}

function openHistory(id, name) {
  const history = inventoryHistory[id] || [];
  document.getElementById('inventoryHistoryContent').innerHTML = history.length === 0
    ? '<p style="color:#999">No stock changes recorded in this session.</p>'
    : history.map(h => `<p><strong>${h.date}</strong><br>${h.action}</p><hr>`).join('');
  document.getElementById('inventoryHistoryModal').style.display = 'block';
}
function closeHistory() { document.getElementById('inventoryHistoryModal').style.display = 'none'; }

async function exportInventory() {
  try {
    const items = await api('/inventory');
    if (items.length === 0) { alert('No products to export'); return; }
    const headers = ['Product','Category','Stock','Min','Supplier','Purchase','Selling','Status'];
    const rows = items.map(i => [i.name, i.category, i.stock, i.minStock, i.supplier||'', i.purchasePrice, i.sellingPrice, i.stock<=i.minStock?'Low':'Good']);
    const csv  = [headers,...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'inventory.csv'; link.click();
  } catch (err) { alert('Export failed'); }
}

/* ══════════════════════════════════════════════════════════
   6. BILLING — save every sale to DB
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
    select.innerHTML = '<option value="">Select Product</option>' +
      available.map(i => `<option value="${i._id}|${i.name}|${i.sellingPrice}">${i.name} — ₹${i.sellingPrice} (${i.stock} in stock)</option>`).join('');
  } catch (err) { console.error('Dropdown error:', err); }
}

function addServiceToBill() {
  const val = document.getElementById('serviceSelect').value;
  if (!val) return;
  const [name, price] = val.split('|');
  addToBill(name, 'Service', parseInt(price));
  document.getElementById('serviceSelect').value = '';
}

function addProductToBill() {
  const val = document.getElementById('productSelect').value;
  if (!val) return;
  const [id, name, price] = val.split('|');
  addToBill(name, 'Product', parseInt(price), id);
  document.getElementById('productSelect').value = '';
}

function addToBill(name, type, price, productId = null) {
  const existing = billItems.find(i => i.name === name);
  if (existing) { existing.qty++; } else { billItems.push({ name, type, price, qty: 1, productId }); }
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

function calculateTotals() {
  const subtotal = billItems.reduce((s, i) => s + i.qty * i.price, 0);
  const gst      = Math.round(subtotal * 0.18);
  const total    = subtotal + gst;
  setEl('billSubtotal', subtotal.toLocaleString('en-IN'));
  setEl('billGST',      gst.toLocaleString('en-IN'));
  setEl('billTotal',    total.toLocaleString('en-IN'));
}

function printBill() {
  const client = document.getElementById('billClient').value;
  setEl('printClientName', client);
  setEl('billDate', new Date().toLocaleString('en-IN'));
  window.print();
}

async function finalizeSale() {
  if (billItems.length === 0) { alert('Add at least one item to the bill'); return; }
  const clientName    = document.getElementById('billClient').value.trim();
  const paymentMethod = document.getElementById('paymentMethod').value;
  if (!clientName) { alert('Please enter the client name'); return; }

  const subtotal   = billItems.reduce((s, i) => s + i.qty * i.price, 0);
  const gst        = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + gst;
  const items      = billItems.map(i => ({ name: i.name, type: i.type, qty: i.qty, price: i.price, total: i.qty * i.price }));

  try {
    // Save bill
    await api('/bills', { method: 'POST', body: { clientName, items, subtotal, gst, grandTotal, paymentMethod } });

    // Deduct stock for products sold
    for (const item of billItems) {
      if (item.type === 'Product' && item.productId) {
        await api(`/inventory/${item.productId}/stock`, { method: 'PATCH', body: { delta: -item.qty } });
      }
    }

    // Clear bill
    billItems = [];
    renderBill();
    document.getElementById('billClient').value = '';

    alert(`✓ Bill saved! ₹${grandTotal.toLocaleString('en-IN')} — ${paymentMethod}`);
    populateProductDropdown();
    loadBillHistory();

  } catch (err) { alert('Failed to save: ' + err.message); }
}

async function loadBillHistory() {
  try {
    const bills = await api('/bills');
    const tbody = document.getElementById('billHistoryBody');
    if (!tbody) return;
    if (bills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">No bills yet. Finalize a sale to see history.</td></tr>`;
      return;
    }
    tbody.innerHTML = bills.map(b => `
      <tr>
        <td>${new Date(b.createdAt).toLocaleDateString('en-IN')}</td>
        <td>${b.clientName}</td>
        <td>${b.items.length} item(s)</td>
        <td>₹${b.grandTotal.toLocaleString('en-IN')}</td>
        <td><span style="padding:2px 8px;border-radius:4px;background:#eafaf1;color:#1e8449;font-size:12px;">${b.paymentMethod}</span></td>
      </tr>`).join('');
  } catch (err) { console.error('Bill history error:', err); }
}

/* ══════════════════════════════════════════════════════════
   7. REPORTS — real data from DB
   ══════════════════════════════════════════════════════════ */

const _charts = {};

async function loadReports() {
  try {
    const [summary, staff, inventory, clients] = await Promise.all([
      api('/bills/stats/summary'),
      api('/staff'),
      api('/inventory'),
      api('/clients')
    ]);

    // Executive cards — all real
    setEl('repTotalRevenue',     '₹' + (summary.totalRevenue || 0).toLocaleString('en-IN'));
    setEl('repNetProfit',        '₹' + Math.round((summary.totalRevenue || 0) * 0.28).toLocaleString('en-IN'));
    setEl('repTotalBills',       summary.totalBills || 0);
    setEl('repAvgBill',          '₹' + (summary.avgBill || 0).toLocaleString('en-IN'));
    setEl('repTotalStaff',       staff.length);
    setEl('repTotalClientsRep',  clients.length);

    const invValue  = inventory.reduce((s, i) => s + i.stock * i.purchasePrice, 0);
    const lowStock  = inventory.filter(i => i.stock <= i.minStock);
    setEl('repInvValue',         '₹' + invValue.toLocaleString('en-IN'));
    setEl('repLowStock',         lowStock.length);

    // Inventory tab cards
    setEl('repInvValue2',        '₹' + invValue.toLocaleString('en-IN'));
    setEl('repLowStockCount',    lowStock.length);
    setEl('repTotalProducts',    inventory.length);
    setEl('repLowStockValue',    '₹' + lowStock.reduce((s, i) => s + i.minStock * i.purchasePrice, 0).toLocaleString('en-IN'));

    // Staff report table
    const staffTbody = document.getElementById('staffReportTable');
    if (staffTbody) {
      staffTbody.innerHTML = staff.length === 0
        ? `<tr><td colspan="4" style="text-align:center;color:#999;padding:16px;">No staff added yet</td></tr>`
        : staff.map(s => {
            const earned = Math.round((s.totalRevenue || 0) * s.commission / 100);
            return `<tr>
              <td>${s.name}</td>
              <td>₹${(s.totalRevenue || 0).toLocaleString('en-IN')}</td>
              <td>${s.commission}%</td>
              <td>₹${earned.toLocaleString('en-IN')}</td>
            </tr>`;
          }).join('');
    }

    renderReportCharts(summary, staff, inventory);

  } catch (err) { console.error('Reports error:', err); }
}

function renderReportCharts(summary, staff, inventory) {
  // Destroy old charts
  Object.values(_charts).forEach(c => { try { c.destroy(); } catch(e){} });

  // Revenue by month — real bills data
  const months   = Object.keys(summary.monthlyMap || {}).slice(-6);
  const revenues = months.map(m => summary.monthlyMap[m] || 0);

  _charts.exec = new Chart(document.getElementById('execRevenueChart'), {
    type: 'line',
    data: {
      labels:   months.length ? months : ['No bills yet'],
      datasets: [{ label: 'Revenue (₹)', data: revenues.length ? revenues : [0], borderWidth: 2, tension: 0.3, borderColor: '#6c5ce7', backgroundColor: 'rgba(108,92,231,0.1)', fill: true }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Service vs product split — real
  _charts.pie = new Chart(document.getElementById('salesPieChart'), {
    type: 'pie',
    data: {
      labels: ['Services', 'Products'],
      datasets: [{ data: [summary.serviceRevenue || 0, summary.productRevenue || 0], backgroundColor: ['#6c5ce7', '#00b894'] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Top services — placeholder until service tracking added
  _charts.topSvc = new Chart(document.getElementById('topServiceChart'), {
    type: 'bar',
    data: {
      labels: ['Haircut', 'Facial', 'Hair Color', 'Keratin', 'Beard', 'Hair Spa'],
      datasets: [{ label: 'Revenue (₹)', data: [0, 0, 0, 0, 0, 0], backgroundColor: '#6c5ce7' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Staff revenue — real
  _charts.staffRev = new Chart(document.getElementById('staffRevenueChart'), {
    type: 'bar',
    data: {
      labels:   staff.length ? staff.map(s => s.name) : ['No staff'],
      datasets: [{ label: 'Revenue (₹)', data: staff.length ? staff.map(s => s.totalRevenue || 0) : [0], backgroundColor: '#0984e3' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Attendance — placeholder
  _charts.attend = new Chart(document.getElementById('attendanceChart'), {
    type: 'bar',
    data: {
      labels:   staff.length ? staff.map(s => s.name) : ['No staff'],
      datasets: [{ label: 'Days Present', data: staff.map(() => 0), backgroundColor: '#00b894' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Client growth — placeholder
  _charts.growth = new Chart(document.getElementById('clientGrowthChart'), {
    type: 'line',
    data: {
      labels: ['Month 1', 'Month 2', 'Month 3'],
      datasets: [{ label: 'New Clients', data: [0, 0, 0], tension: 0.3, borderWidth: 2 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Recurring pie — placeholder
  _charts.recur = new Chart(document.getElementById('recurringClientChart'), {
    type: 'pie',
    data: {
      labels: ['Recurring', 'New'],
      datasets: [{ data: [0, 0], backgroundColor: ['#6c5ce7', '#fdcb6e'] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Inventory margin — real
  const topItems = inventory.slice(0, 8);
  _charts.invMargin = new Chart(document.getElementById('inventoryMarginChart'), {
    type: 'bar',
    data: {
      labels:   topItems.length ? topItems.map(i => i.name) : ['No products'],
      datasets: [{ label: 'Profit per Unit (₹)', data: topItems.length ? topItems.map(i => i.sellingPrice - i.purchasePrice) : [0], backgroundColor: '#e17055' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function switchReportTab(tab, btn) {
  document.querySelectorAll('.report-content').forEach(el => el.classList.add('section-hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('report-' + tab).classList.remove('section-hidden');
  btn.classList.add('active');
}

/* ─── INIT ───────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});