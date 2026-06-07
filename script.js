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
  setEl('modalClient', client);
  setEl('modalTime', time);
  setEl('modalStaff', staff);
  setEl('modalAmount', amount || 'See Bill');
  setEl('modalPhone', 'N/A');

  // Populate services list container with a single chip
  const servicesContainer = document.getElementById('modalServicesListContainer');
  if (servicesContainer) {
    servicesContainer.innerHTML = '';
    const chip = document.createElement('span');
    chip.className = 'service-chip';
    chip.innerText = service;
    servicesContainer.appendChild(chip);
  }

  // Status badge
  const badge = document.getElementById('modalStatusBadge');
  if (badge) {
    badge.innerText = (status || 'Upcoming').toUpperCase();
    badge.style.background = statusColor(status || 'Upcoming');
  }

  // Hide notes row for legacy calls
  const notesRow = document.getElementById('modalNotesRow');
  if (notesRow) notesRow.style.display = 'none';

  // Attach appointment ID for converting to bill
  const appointmentModal = document.getElementById('appointmentModal');
  appointmentModal.dataset.apptId = id;
  appointmentModal.dataset.apptClient = client;
  appointmentModal.dataset.apptService = service;
  appointmentModal.dataset.apptStaff = staff;

  // Show/hide action buttons based on status
  const btnStart = document.getElementById('btnDetailStart');
  const btnComplete = document.getElementById('btnDetailComplete');
  const btnCancel = document.getElementById('btnDetailCancel');
  if (btnStart) btnStart.style.display = status === 'Upcoming' ? 'block' : 'none';
  if (btnComplete) btnComplete.style.display = (status === 'Upcoming' || status === 'Ongoing') ? 'block' : 'none';
  if (btnCancel) btnCancel.style.display = (status === 'Upcoming' || status === 'Ongoing') ? 'block' : 'none';

  appointmentModal.style.display = 'block';
}
function closeModal() { document.getElementById('appointmentModal').style.display = 'none'; }

async function printBill() {
  if (!currentBillId && billItems.length > 0) {
    // If not saved to history yet, save it first
    const success = await finalizeSale(false); // pass false to avoid double print
    if (!success) return;
  }

  const clientName = document.getElementById('printClientName').innerText.replace(/\s+/g, '_') || 'Client';
  const timestamp = new Date().getTime();
  const originalTitle = document.title;

  // Set title for the PDF filename in the print dialog
  document.title = `${clientName}_${timestamp}`;

  // Delay print to guarantee Chrome's UI thread has time to read the new document.title
  setTimeout(() => {
    window.print();

    // After the print command is sent, wait 2 seconds before attaching the restore listeners
    // to avoid accidental 'mousemove' events restoring the title while the dialog is opening.
    setTimeout(() => {
      const restoreTitle = () => {
        document.title = originalTitle;
        window.removeEventListener('focus', restoreTitle);
        window.removeEventListener('mousemove', restoreTitle);
        window.removeEventListener('click', restoreTitle);
      };

      window.addEventListener('focus', restoreTitle);
      window.addEventListener('mousemove', restoreTitle);
      window.addEventListener('click', restoreTitle);
    }, 2000);

  }, 800); // 400ms is a safe harbor for Chrome to commit the DOM
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
            <td data-label="Client"><span>${esc(a.clientName)}</span></td>
            <td data-label="Service"><span>${esc(a.serviceName)}</span></td>
            <td data-label="Status"><span class="status ${a.status.toLowerCase()}">${esc(a.status)}</span></td>
          </tr>`).join('');
      }
    }

    initMagneticEffect();

  // Render quick Today's Appointments card
  renderTodaysAppointments(appointmentsToday);

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

// Single source of truth for calendar UI state
const calendarState = {
  currentDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  selectedStaff: 'all',
  appointments: [],
  services: [],
  filters: {},
  mobileView: false
};

// Backwards-compatible variables (kept for existing code paths)
let currentCalendarDate = calendarState.currentDate;
let currentStaffFilter = calendarState.selectedStaff;
let _loadedAppointments = [];
let _loadedStaff = [];
let _selectedModalServices = [];

// Settings-driven operating hours (defaults)
calendarState.operatingHours = { open: '08:00', close: '23:00' };

async function loadCalendar() {
  try {
    const dateHeader = document.getElementById('calendarDateHeader');
    const picker = document.getElementById('calendarDatePicker');
    
    const d = new Date(currentCalendarDate);
    if (dateHeader) {
      dateHeader.innerText = d.toLocaleDateString('en-GB', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      });
    }
    if (picker) {
      picker.value = currentCalendarDate;
    }

    const [appointments, staff] = await Promise.all([
      api(`/appointments?date=${currentCalendarDate}`),
      api('/staff')
    ]);

    _loadedAppointments = appointments;
    _loadedStaff = staff;

    // Update centralized calendar state (single source of truth)
    calendarState.currentDate = currentCalendarDate;
    calendarState.selectedStaff = currentStaffFilter;
    calendarState.appointments = appointments;
    calendarState.services = staff.reduce((acc, s) => acc.concat(s.services || []), []);

    // No staff filter — always show active staff columns
    const filteredStaff = staff.filter(s => s.active !== false);

    const staffColumnsContainer = document.getElementById('calendarStaffColumns');
    if (staffColumnsContainer) {
      staffColumnsContainer.innerHTML = '';
      
      if (filteredStaff.length === 0) {
        staffColumnsContainer.innerHTML = `
          <div style="flex: 1; padding: 40px; text-align: center; color: #95a5a6; font-style: italic;">
            No active staff members found.
          </div>`;
      } else {
        filteredStaff.forEach(member => {
          const staffAppts = appointments.filter(a => a.staffId === member._id);
          
          const column = document.createElement('div');
          column.className = 'staff-column';
          
          const header = document.createElement('div');
          header.className = 'staff-column-header';
          header.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=6c5ce7&color=fff&size=80" alt="Staff Member">
            <span>${esc(member.name)}</span>
          `;
          column.appendChild(header);

          const grid = document.createElement('div');
          grid.className = 'staff-column-grid';

          const laidOutAppts = layoutAppointmentsForColumn(staffAppts);

          laidOutAppts.forEach(item => {
            const appt = item.appt;
            const startMin = item.start - (8 * 60);
            const duration = appt.duration || 45;
            
            const topPos = startMin * (80 / 60);
            const heightPos = duration * (80 / 60);

            const colWidth = 100 / item.totalCols;
            const leftPos = item.colIdx * colWidth;
            const widthPos = item.span * colWidth;

            const card = document.createElement('div');
            card.className = `calendar-appt-card appt-status-${appt.status.toLowerCase()}`;
            card.style.top = `${topPos}px`;
            card.style.height = `${heightPos}px`;
            card.style.left = `${leftPos}%`;
            card.style.width = `calc(${widthPos}% - 4px)`;
            
            const displayTime = format12hTime(appt.time);
            
            card.innerHTML = `
              <strong>${esc(appt.clientName)}</strong>
              <span class="service-label">${esc(appt.serviceName)}</span>
              <span class="time-label">${esc(displayTime)} (${duration}m)</span>
            `;

            card.onclick = () => openApptDetailModal(appt._id);
            grid.appendChild(card);
          });

          column.appendChild(grid);
          staffColumnsContainer.appendChild(column);
        });
        
        const todayStr = new Date().toISOString().split('T')[0];
        if (currentCalendarDate === todayStr) {
          updateTimeIndicator();
        }
      }
    }

    const mobileTimelineContainer = document.getElementById('mobileTimelineContainer');
    if (mobileTimelineContainer) {
      mobileTimelineContainer.innerHTML = '';
      
      const activeAppts = currentStaffFilter === 'all'
        ? appointments
        : appointments.filter(a => a.staffId === currentStaffFilter);

      activeAppts.sort((a, b) => {
        const timeA = parseTimeToHour(a.time);
        const timeB = parseTimeToHour(b.time);
        return (timeA.hour * 60 + timeA.mins) - (timeB.hour * 60 + timeB.mins);
      });

      if (activeAppts.length === 0) {
        mobileTimelineContainer.innerHTML = `
          <div class="mobile-empty-state">
            No appointments scheduled.
          </div>`;
      } else {
        activeAppts.forEach(appt => {
          const card = document.createElement('div');
          card.className = `mobile-appt-card appt-status-${appt.status.toLowerCase()}`;
          
          let serviceChips = '';
          let servicesList = [];
          if (appt.notes && appt.notes.trim().startsWith('{')) {
            try {
              const meta = JSON.parse(appt.notes);
              servicesList = meta.services || [];
            } catch(e){}
          }
          
          if (servicesList.length > 0) {
            serviceChips = servicesList.map(s => `
              <span class="service-chip" style="background: rgba(255,255,255,0.25); color: inherit; border: none; font-size: 0.7rem; font-weight: bold; padding: 2px 6px;">
                ${esc(s.name)}
              </span>`).join('');
          } else {
            serviceChips = `
              <span class="service-chip" style="background: rgba(255,255,255,0.25); color: inherit; border: none; font-size: 0.7rem; font-weight: bold; padding: 2px 6px;">
                ${esc(appt.serviceName)}
              </span>`;
          }

          card.innerHTML = `
            <div class="mobile-appt-time-row">
              <span class="mobile-appt-time">${esc(format12hTime(appt.time))} (${appt.duration} mins)</span>
              <span class="mobile-appt-status mobile-status-${appt.status.toLowerCase()}">${esc(appt.status)}</span>
            </div>
            <div class="mobile-appt-client">${esc(appt.clientName)}</div>
            <div class="mobile-appt-staff">Staff: ${esc(appt.staffName)}</div>
            <div class="mobile-appt-services">
              ${serviceChips}
            </div>
          `;
          card.onclick = () => openApptDetailModal(appt._id);
          mobileTimelineContainer.appendChild(card);
        });
      }
    }

  // Attach mobile swipe handlers for quick day navigation (left: next, right: prev)
+    attachSwipeHandlers();

  } catch (err) {
    showToast(err.message || 'Calendar error', 'error');
  }
}

function navigateCalendar(direction) {
  const d = new Date(calendarState.currentDate);
  if (direction === 0) {
    calendarState.currentDate = new Date().toISOString().split('T')[0];
  } else {
    d.setDate(d.getDate() + direction);
    calendarState.currentDate = d.toISOString().split('T')[0];
  }
  // Keep legacy var in sync
  currentCalendarDate = calendarState.currentDate;
  loadCalendar();
}

function onCalendarDatePicked(dateVal) {
  if (dateVal) {
    currentCalendarDate = dateVal;
    loadCalendar();
  }
}
function format12hTime(timeStr) {
  if (!timeStr) return '';
  const { hour, mins } = parseTimeToHour(timeStr);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayH = hour % 12 || 12;
  const displayM = mins.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

function timeTo24h(time12h) {
  const { hour, mins } = parseTimeToHour(time12h);
  return `${hour.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function layoutAppointmentsForColumn(appts) {
  const parsed = appts.map(appt => {
    const { hour, mins } = parseTimeToHour(appt.time);
    const start = hour * 60 + mins;
    const end = start + (appt.duration || 45);
    return { appt, start, end, colIdx: 0, totalCols: 1, span: 1 };
  });

  parsed.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const clusters = [];
  parsed.forEach(appt => {
    let placed = false;
    for (let cluster of clusters) {
      const overlaps = cluster.some(c => appt.start < c.end && appt.end > c.start);
      if (overlaps) {
        cluster.push(appt);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([appt]);
    }
  });

  clusters.forEach(cluster => {
    const columns = [];
    cluster.forEach(appt => {
      let colIdx = 0;
      while (true) {
        const col = columns[colIdx];
        if (!col) {
          columns[colIdx] = [appt];
          appt.colIdx = colIdx;
          break;
        }
        const hasOverlap = col.some(c => appt.start < c.end && appt.end > c.start);
        if (!hasOverlap) {
          col.push(appt);
          appt.colIdx = colIdx;
          break;
        }
        colIdx++;
      }
    });

    const totalCols = columns.length;
    cluster.forEach(appt => {
      appt.totalCols = totalCols;
      let span = 1;
      for (let c = appt.colIdx + 1; c < totalCols; c++) {
        const hasOverlapInCol = columns[c].some(other => appt.start < other.end && appt.end > other.start);
        if (hasOverlapInCol) {
          break;
        }
        span++;
      }
      appt.span = span;
    });
  });

  return parsed;
}

function updateTimeIndicator() {
  document.querySelectorAll('.calendar-current-time-line').forEach(el => el.remove());

  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const START_HOUR = 8;
  const END_HOUR = 23;

  if (currentHour < START_HOUR || currentHour >= END_HOUR) return;

  const startMin = (currentHour - START_HOUR) * 60 + currentMin;
  const topPos = startMin * (80 / 60);

  document.querySelectorAll('.staff-column-grid').forEach(grid => {
    const indicator = document.createElement('div');
    indicator.className = 'calendar-current-time-line';
    indicator.style.top = `${topPos}px`;
    grid.appendChild(indicator);
  });
}

function attachSwipeHandlers() {
  const container = document.querySelector('.calendar-mobile-view');
  if (!container) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  container.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    // Horizontal swipe detection
    if (Math.abs(dx) > 60 && Math.abs(dy) < 80 && dt < 600) {
      if (dx < 0) navigateCalendar(1); // swipe left -> next day
      else navigateCalendar(-1); // swipe right -> previous day
    }
  }, { passive: true });
}

// Update availability indicator inside Add Appointment modal live
function updateAvailabilityIndicator() {
  const availEl = document.getElementById('availabilityIndicator');
  const saveBtn = document.getElementById('saveApptBtn');
  if (!availEl || !saveBtn) return;

  const dateVal = document.getElementById('apptDatePicker').value;
  const startTime = document.getElementById('apptStartTime').value;
  const staffId = document.getElementById('apptStaff').value;
  const totalDuration = _selectedModalServices.reduce((s, i) => s + (i.duration || 0), 0);

  // Clear existing
  availEl.innerHTML = '';

  if (!dateVal || !startTime || !staffId || totalDuration === 0) {
    const msg = document.createElement('div');
    msg.style.color = '#7f8c8d';
    msg.style.fontSize = '0.9rem';
    msg.innerText = 'Select staff, start time and services to check availability';
    availEl.appendChild(msg);
    saveBtn.disabled = false; // allow creation but UX encourages selection first
    return;
  }

  // Ensure calendarState.operatingHours are present
  const open = calendarState.operatingHours?.open || '08:00';
  const close = calendarState.operatingHours?.close || '23:00';

  // Validate against operating hours
  const startMin = minutesFromMidnight(timeTo24h(startTime));
  const duration = totalDuration;
  const endMin = startMin + duration;
  const openMin = minutesFromMidnight(open);
  const closeMin = minutesFromMidnight(close);

  if (startMin < openMin || endMin > closeMin) {
    const err = document.createElement('div');
    err.style.color = '#c0392b';
    err.style.fontWeight = '700';
    err.innerText = `Outside operating hours (${open} - ${close}). Please choose a different time.`;
    availEl.appendChild(err);
    saveBtn.disabled = true;
    return;
  }

  // Check staff availability using our helper
  const available = isTimeSlotAvailable(dateVal, timeTo24h(startTime), duration, staffId);
  if (!available) {
    const warn = document.createElement('div');
    warn.style.color = '#d35400';
    warn.style.fontWeight = '700';
    warn.innerText = 'Selected slot conflicts with another booking.';
    availEl.appendChild(warn);

    // Suggest nearest available slot for the same staff (scan forward by 15-min increments)
    const suggestion = findNearestAvailableSlot(dateVal, timeTo24h(startTime), duration, staffId, openMin, closeMin);
    if (suggestion) {
      const sugEl = document.createElement('div');
      sugEl.style.marginTop = '8px';
      sugEl.style.color = '#2d3436';
      sugEl.style.fontWeight = '600';
      sugEl.innerHTML = `Next available: <strong>${formatSuggestedTime(suggestion)}</strong> — <button class="btn-secondary" style="margin-left:8px;" onclick="document.getElementById('apptStartTime').value='${suggestion.display}'; updateAvailabilityIndicator();">Use this</button>`;
      availEl.appendChild(sugEl);
    } else {
      const noMore = document.createElement('div');
      noMore.style.marginTop = '8px';
      noMore.style.color = '#7f8c8d';
      noMore.innerText = 'No available slots later today for this staff.';
      availEl.appendChild(noMore);
    }

    saveBtn.disabled = true;
    return;
  }

  const ok = document.createElement('div');
  ok.style.color = '#27ae60';
  ok.style.fontWeight = '700';
  ok.innerText = 'Time slot available ✅';
  availEl.appendChild(ok);
  saveBtn.disabled = false;
}

// Wire events in the Add Appointment modal to update availability live
function initAddApptAvailabilityWatchers() {
  const dateEl = document.getElementById('apptDatePicker');
  const timeEl = document.getElementById('apptStartTime');
  const staffEl = document.getElementById('apptStaff');
  const servicesSearch = document.getElementById('apptServiceSearch');
  const phoneEl = document.getElementById('apptClientPhone');

  if (dateEl) dateEl.addEventListener('change', updateAvailabilityIndicator);
  if (timeEl) timeEl.addEventListener('change', updateAvailabilityIndicator);
  if (staffEl) staffEl.addEventListener('change', () => { onApptStaffChanged(staffEl.value); updateAvailabilityIndicator(); });
  if (servicesSearch) servicesSearch.addEventListener('input', () => { filterModalServices(servicesSearch.value); updateAvailabilityIndicator(); });
  if (phoneEl) phoneEl.addEventListener('input', debounce(handleApptPhoneInput, 300));
}

// Initialize watchers lazily when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initAddApptAvailabilityWatchers();
});

// Simple debounce helper
function debounce(fn, wait) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

async function handleApptPhoneInput(e) {
  const phone = (e.target.value || '').replace(/\D/g, '').slice(0, 10);
  const msg = document.getElementById('apptClientLookupMsg');
  const nameEl = document.getElementById('apptClient');
  if (msg) msg.style.color = '#666';

  if (phone.length < 10) {
    if (msg) msg.innerText = 'Enter client\'s 10-digit phone to auto-fill name';
    return;
  }

  try {
    if (msg) msg.innerText = 'Looking up...';
    const clients = await api('/clients');
    const found = clients.find(c => c.phone && c.phone.replace(/\D/g, '').endsWith(phone));
    if (found) {
      if (nameEl) nameEl.value = found.name;
      if (msg) {
        msg.style.color = '#27ae60';
        msg.innerText = `✓ Found: ${found.name}`;
      }
    } else {
      if (msg) {
        msg.style.color = '#d35400';
        msg.innerText = 'No client found — will create a new client on save';
      }
    }
  } catch (err) {
    if (msg) { msg.style.color = '#c0392b'; msg.innerText = 'Lookup failed'; }
  }
}

function parseTimeToHour(t) {
  if (!t) return { hour: 8, mins: 0 };
  let h = 8, m = 0;
  if (t.includes(':') && !t.includes('AM') && !t.includes('PM')) {
    const p = t.split(':');
    h = parseInt(p[0]) || 8;
    m = parseInt(p[1]) || 0;
  } else {
    const parts = t.trim().split(/\s+/);
    if (parts.length >= 2) {
      const [time, period] = parts;
      const p = time.split(':');
      h = parseInt(p[0]) || 8;
      m = parseInt(p[1]) || 0;
      if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    } else {
      h = parseInt(t) || 8;
    }
  }
  return { hour: h, mins: m };
}

/**
 * Convert a time string ("HH:mm" or "h:mm AM/PM") to minutes from midnight
 * Returns integer minutes (0-1439)
 */
function minutesFromMidnight(timeStr) {
  if (!timeStr) return 0;
  // If already in HH:mm 24h
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hh, mm] = timeStr.split(':').map(n => parseInt(n, 10));
    return (hh * 60) + mm;
  }
  const { hour, mins } = parseTimeToHour(timeStr);
  return (hour * 60) + mins;
}

// Find nearest available start time (in minutes) on the same date for the staff
function findNearestAvailableSlot(date, startTime24h, duration, staffId, openMin, closeMin) {
  try {
    const step = 15; // minutes
    let cursor = minutesFromMidnight(startTime24h) + step;
    const appts = calendarState.appointments && calendarState.appointments.length ? calendarState.appointments : _loadedAppointments;

    while (cursor + duration <= closeMin) {
      // ensure within open bounds
      if (cursor < openMin) { cursor = openMin; }

      // check overlap
      const conflict = appts.some(a => a.staffId === staffId && a.date === date && (cursor < (minutesFromMidnight(a.time) + (a.duration || 0)) && (cursor + duration) > minutesFromMidnight(a.time)) && (a.status || '').toLowerCase() !== 'cancelled');
      if (!conflict) {
        // return an object with display string
        const hh = Math.floor(cursor / 60);
        const mm = cursor % 60;
        const display = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
        return { minutes: cursor, display };
      }
      cursor += step;
    }
    return null;
  } catch (e) {
    console.error('findNearestAvailableSlot error', e);
    return null;
  }
}

function formatSuggestedTime(sug) {
  // Convert 24h HH:mm to friendly 12h text
  if (!sug || !sug.display) return '';
  const [hh, mm] = sug.display.split(':').map(n => parseInt(n, 10));
  const period = hh >= 12 ? 'PM' : 'AM';
  const displayH = hh % 12 || 12;
  const displayM = String(mm).padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

/**
 * Validate whether a time slot is available for a staff member on a given date.
 * Checks overlapping appointments, staff conflicts and basic operating hours.
 * excludeId: optional appointment id to ignore (useful for updates)
 */
function isTimeSlotAvailable(date, startTime24h, durationMins, staffId, excludeId = null) {
  try {
    if (!date || !startTime24h || !staffId) return false;
    // Operating hours: 08:00 (480) to 23:00 (1380)
    const OPEN = 8 * 60;
    const CLOSE = 23 * 60;
    const start = minutesFromMidnight(startTime24h);
    const end = start + (durationMins || 0);
    if (start < OPEN || end > CLOSE) return false;

    // Check against loaded appointments (cache) and calendarState.appointments
    const allAppts = Array.isArray(calendarState.appointments) && calendarState.appointments.length ? calendarState.appointments : _loadedAppointments;
    for (let a of allAppts) {
      if (!a || a.staffId !== staffId) continue;
      if (excludeId && a._id === excludeId) continue;
      if (a.date !== date) continue;
      // Ignore cancelled appointments
      if ((a.status || '').toLowerCase() === 'cancelled') continue;
      const aStart = minutesFromMidnight(a.time);
      const aEnd = aStart + (a.duration || 0);
      // Overlap check
      if (start < aEnd && end > aStart) return false;
    }

    return true;
  } catch (e) {
    console.error('isTimeSlotAvailable error', e);
    return false;
  }
}

function renderTimePills(containerId, hiddenInputId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const times = [];
  for (let h = 8; h <= 23; h++) {
    const period = h < 12 ? 'AM' : (h === 12 ? 'PM' : 'PM');
    const displayH = h % 12 || 12;
    times.push(`${displayH}:00 ${period}`);
    if (h < 23) times.push(`${displayH}:30 ${period}`);
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

async function openApptDetailModal(apptId) {
  try {
    const appt = _loadedAppointments.find(a => a._id === apptId);
    if (!appt) return;

    const modal = document.getElementById('appointmentModal');
    modal.dataset.apptId = appt._id;
    modal.dataset.apptClient = appt.clientName;
    modal.dataset.apptService = appt.serviceName;
    modal.dataset.apptStaff = appt.staffName;

    setEl('modalClient', appt.clientName);
    setEl('modalStaff', appt.staffName);
    
    const displayTimeStr = format12hTime(appt.time);
    setEl('modalTime', `${appt.date} @ ${displayTimeStr} (${appt.duration} mins)`);

    const badge = document.getElementById('modalStatusBadge');
    if (badge) {
      badge.innerText = appt.status.toUpperCase();
      badge.style.background = statusColor(appt.status);
    }

    let phone = 'N/A';
    let notesText = appt.notes || '';
    let services = [];

    if (appt.notes && appt.notes.trim().startsWith('{')) {
      try {
        const meta = JSON.parse(appt.notes);
        notesText = meta.notesText || '';
        phone = meta.clientPhone || 'N/A';
        services = meta.services || [];
      } catch (e) {
        console.error('Error parsing JSON notes:', e);
      }
    }

    if (phone === 'N/A' && appt.clientId) {
      try {
        const client = await api(`/clients/${appt.clientId}`);
        if (client && client.phone) {
          phone = client.phone;
        }
      } catch (e) {}
    }
    setEl('modalPhone', phone);

    const notesRow = document.getElementById('modalNotesRow');
    if (notesRow) {
      if (notesText.trim()) {
        setEl('modalNotes', notesText);
        notesRow.style.display = 'flex';
      } else {
        notesRow.style.display = 'none';
      }
    }

    const servicesContainer = document.getElementById('modalServicesListContainer');
    if (servicesContainer) {
      servicesContainer.innerHTML = '';
      
      let totalAmt = 0;
      if (services.length > 0) {
        services.forEach(s => {
          totalAmt += s.price || 0;
          const chip = document.createElement('span');
          chip.className = 'service-chip';
          chip.innerText = `${s.name} (₹${s.price})`;
          servicesContainer.appendChild(chip);
        });
      } else {
        const chip = document.createElement('span');
        chip.className = 'service-chip';
        chip.innerText = appt.serviceName;
        servicesContainer.appendChild(chip);
      }
      
      setEl('modalAmount', totalAmt > 0 ? `₹${totalAmt}` : 'Based on Service');
    }

    const btnStart = document.getElementById('btnDetailStart');
    const btnComplete = document.getElementById('btnDetailComplete');
    const btnCancel = document.getElementById('btnDetailCancel');

    if (btnStart) btnStart.style.display = appt.status === 'Upcoming' ? 'block' : 'none';
    if (btnComplete) btnComplete.style.display = (appt.status === 'Upcoming' || appt.status === 'Ongoing') ? 'block' : 'none';
    if (btnCancel) btnCancel.style.display = (appt.status === 'Upcoming' || appt.status === 'Ongoing') ? 'block' : 'none';

    modal.style.display = 'block';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changeStatusFromDetail(newStatus) {
  const modal = document.getElementById('appointmentModal');
  const id = modal.dataset.apptId;
  if (!id) return;
  
  try {
    await api(`/appointments/${id}/status`, { method: 'PATCH', body: { status: newStatus } });
    showToast(`Appointment status updated to ${newStatus}`);
    closeModal();
    refreshRelated(['calendar', 'dashboard']);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteAppointmentFromDetail() {
  const modal = document.getElementById('appointmentModal');
  const id = modal.dataset.apptId;
  if (!id) return;

  if (!confirm('Are you sure you want to delete this appointment?')) return;

  try {
    await api(`/appointments/${id}`, { method: 'DELETE' });
    showToast('Appointment deleted successfully');
    closeModal();
    refreshRelated(['calendar', 'dashboard']);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openAddApptModal() {
  const modal = document.getElementById('addApptModal');
  if (!modal) return;

  document.getElementById('apptDatePicker').value = currentCalendarDate;

  document.getElementById('apptClient').value = '';
  document.getElementById('apptClientPhone').value = '';
  document.getElementById('apptNotes').value = '';
  document.getElementById('apptServiceSearch').value = '';
  
  _selectedModalServices = [];
  renderSelectedServicesChips();
  updateBookingSummary();

  const timeSelect = document.getElementById('apptStartTime');
  if (timeSelect) {
    const times = [];
    for (let h = 8; h <= 23; h++) {
      const p = h < 12 ? 'AM' : (h === 12 ? 'PM' : 'PM');
      const displayH = h % 12 || 12;
      times.push(`${displayH}:00 ${p}`);
      if (h < 23) {
        times.push(`${displayH}:30 ${p}`);
      }
    }
    timeSelect.innerHTML = times.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  try {
    const staffList = await api('/staff');
    _loadedStaff = staffList;
    const staffSelect = document.getElementById('apptStaff');
    if (staffSelect) {
      staffSelect.innerHTML = '<option value="">Select a Staff Member</option>' +
        staffList.filter(s => s.active !== false).map(s => `<option value="${s._id}">${esc(s.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Error loading staff:', err);
  }

  const checklist = document.getElementById('modalServiceChecklist');
  if (checklist) {
    checklist.innerHTML = '<div class="no-services-placeholder">Please select a staff member to see their services</div>';
  }

  modal.style.display = 'block';
}

function closeAddApptModal() { 
  document.getElementById('addApptModal').style.display = 'none'; 
}

function onApptStaffChanged(staffId) {
  const checklist = document.getElementById('modalServiceChecklist');
  if (!checklist) return;

  _selectedModalServices = [];
  renderSelectedServicesChips();
  updateBookingSummary();

  if (!staffId) {
    checklist.innerHTML = '<div class="no-services-placeholder">Please select a staff member to see their services</div>';
    return;
  }

  const staff = _loadedStaff.find(s => s._id === staffId);
  if (!staff || !staff.services || staff.services.length === 0) {
    checklist.innerHTML = '<div class="no-services-placeholder">This staff member offers no services</div>';
    return;
  }

  renderServiceChecklist(staff.services);
}

function renderServiceChecklist(services) {
  const checklist = document.getElementById('modalServiceChecklist');
  if (!checklist) return;

  const searchQuery = document.getElementById('apptServiceSearch').value.toLowerCase().trim();

  const filtered = services.filter(s => s.name.toLowerCase().includes(searchQuery));

  if (filtered.length === 0) {
    checklist.innerHTML = '<div class="no-services-placeholder">No matching services found</div>';
    return;
  }

  checklist.innerHTML = filtered.map(s => {
    const isChecked = _selectedModalServices.some(item => item.id === s._id);
    return `
      <div class="service-check-item" onclick="toggleModalServiceCheckbox('${esc(s._id)}', '${esc(s.name)}', ${s.price || 0}, ${s.durationMins || 45})">
        <div class="service-check-left">
          <input type="checkbox" id="chk_${s._id}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleModalServiceCheckbox('${esc(s._id)}', '${esc(s.name)}', ${s.price || 0}, ${s.durationMins || 45})">
          <span>${esc(s.name)}</span>
        </div>
        <div class="service-check-right">₹${s.price} (${s.durationMins || 45}m)</div>
      </div>
    `;
  }).join('');
}

function toggleModalServiceCheckbox(id, name, price, duration) {
  const checkbox = document.getElementById(`chk_${id}`);
  const idx = _selectedModalServices.findIndex(item => item.id === id);

  if (idx > -1) {
    _selectedModalServices.splice(idx, 1);
    if (checkbox) checkbox.checked = false;
  } else {
    _selectedModalServices.push({ id, name, price, duration });
    if (checkbox) checkbox.checked = true;
  }

  renderSelectedServicesChips();
  updateBookingSummary();
}

function filterModalServices(val) {
  const staffId = document.getElementById('apptStaff').value;
  if (!staffId) return;

  const staff = _loadedStaff.find(s => s._id === staffId);
  if (staff && staff.services) {
    renderServiceChecklist(staff.services);
  }
}

function renderSelectedServicesChips() {
  const container = document.getElementById('selectedServicesChips');
  if (!container) return;

  container.innerHTML = _selectedModalServices.map(s => `
    <span class="service-chip">
      ${esc(s.name)}
      <span class="chip-remove" onclick="toggleModalServiceCheckbox('${esc(s.id)}', '${esc(s.name)}', ${s.price}, ${s.duration})">&times;</span>
    </span>
  `).join('');

  const staffId = document.getElementById('apptStaff').value;
  if (staffId) {
    const staff = _loadedStaff.find(s => s._id === staffId);
    if (staff && staff.services) {
      staff.services.forEach(s => {
        const chk = document.getElementById(`chk_${s._id}`);
        if (chk) {
          chk.checked = _selectedModalServices.some(item => item.id === s._id);
        }
      });
    }
  }
}

function updateBookingSummary() {
  const totalDuration = _selectedModalServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = _selectedModalServices.reduce((sum, s) => sum + s.price, 0);
  
  setEl('summaryDuration', `${totalDuration} mins`);
  setEl('summaryPrice', `₹${totalPrice}`);

  const startTimeSelect = document.getElementById('apptStartTime');
  const endTimeSpan = document.getElementById('summaryEndTime');
  
  if (startTimeSelect && startTimeSelect.value && totalDuration > 0) {
    const startStr = startTimeSelect.value;
    const { hour, mins } = parseTimeToHour(startStr);
    
    const startTotalMins = hour * 60 + mins;
    const endTotalMins = startTotalMins + totalDuration;
    
    const endHour = Math.floor(endTotalMins / 60);
    const endMin = endTotalMins % 60;
    
    const period = endHour >= 24 ? 'AM' : (endHour >= 12 ? 'PM' : 'AM');
    const displayH = (endHour % 12 || 12);
    const displayM = endMin.toString().padStart(2, '0');
    
    endTimeSpan.innerText = `${displayH}:${displayM} ${period}`;
  } else {
    endTimeSpan.innerText = '-';
  }
}

async function saveAppointment() {
  const clientName = document.getElementById('apptClient').value.trim();
  const clientPhone = document.getElementById('apptClientPhone').value.trim();
  const dateVal = document.getElementById('apptDatePicker').value;
  const startTime = document.getElementById('apptStartTime').value;
  const staffId = document.getElementById('apptStaff').value;
  const notesText = document.getElementById('apptNotes').value.trim();
  const btn = document.getElementById('saveApptBtn');

  if (!clientName) { showToast('Please enter client name', 'error'); return; }
  if (!clientPhone || clientPhone.length < 10) { showToast('Please enter a valid 10-digit phone number', 'error'); return; }
  if (!dateVal) { showToast('Please select a date', 'error'); return; }
  if (!startTime) { showToast('Please select a start time', 'error'); return; }
  if (!staffId) { showToast('Please select a staff member', 'error'); return; }
  if (_selectedModalServices.length === 0) { showToast('Please select at least one service', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const clients = await api('/clients');
    const staffList = await api('/staff');

    let client = clients.find(c => c.phone === clientPhone || c.name.toLowerCase() === clientName.toLowerCase());
    if (!client) {
      client = await api('/clients', { 
        method: 'POST', 
        body: { name: clientName, phone: clientPhone } 
      });
    }

    const member = staffList.find(s => s._id === staffId);
    if (!member) throw new Error('Staff member not found');

    const primaryServiceId = _selectedModalServices[0].id;
    const combinedServiceName = _selectedModalServices.map(s => s.name).join(' + ');
    const totalDuration = _selectedModalServices.reduce((sum, s) => sum + s.duration, 0);

    const notesPayload = JSON.stringify({
      clientPhone,
      notesText,
      services: _selectedModalServices
    });

    const time24h = timeTo24h(startTime);

    await api('/appointments', {
      method: 'POST',
      body: {
        clientId: client._id,
        clientName: client.name,
        serviceId: primaryServiceId,
        serviceName: combinedServiceName,
        staffId: member._id,
        staffName: member.name,
        date: dateVal,
        time: time24h,
        duration: totalDuration,
        status: 'Upcoming',
        notes: notesPayload
      }
    });

    closeAddApptModal();
    showToast('Appointment Saved Successfully');
    refreshRelated(['calendar', 'dashboard']);
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Confirm Booking'; }
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
  const galleryContainer = document.getElementById('clientsGalleryContainer');
  const emptyState = document.getElementById('clientsEmptyState');

  if (filtered.length === 0) {
    if (tableContainer) tableContainer.style.display = 'none';
    if (galleryContainer) galleryContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (tableContainer) tableContainer.style.display = 'block';
    if (galleryContainer) galleryContainer.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    // 1. Render Table Rows (Desktop)
    if (tbody) {
      tbody.innerHTML = filtered.map(c => `
        <tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td><span>${esc(c.phone)}</span></td>
          <td><span>${c.dob ? new Date(c.dob).toLocaleDateString('en-IN') : '—'}</span></td>
          <td><span>${new Date(c.createdAt).toLocaleDateString()}</span></td>
          <td><span>${c.totalVisits || 0}</span></td>
          <td><span>${c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—'}</span></td>
          <td><span>₹${(c.totalSpend || 0).toLocaleString('en-IN')}</span></td>
        </tr>`).join('');
    }

    // 2. Render Cards (Mobile)
    if (galleryContainer) {
      galleryContainer.innerHTML = filtered.map(c => {
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&color=fff&size=128`;
        const dobStr = c.dob ? new Date(c.dob).toLocaleDateString('en-IN') : '—';
        const firstVisitStr = new Date(c.createdAt).toLocaleDateString();
        const lastVisitStr = c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—';
        
        return `
          <div class="client-member-card">
            <div class="client-card-header">
              <img class="client-avatar" 
                   src="${avatarUrl}" 
                   alt="${esc(c.name)}"
                   onerror="this.src='https://ui-avatars.com/api/?name=C&background=555&color=fff'">
              <div class="client-header-info">
                <div class="client-card-name">${esc(c.name)}</div>
                <div class="client-card-phone">📞 ${esc(c.phone)}</div>
              </div>
            </div>
            <div class="client-card-body">
              <div class="client-info-row">
                <span class="client-info-label">DOB</span>
                <span class="client-info-value">${dobStr}</span>
              </div>
              <div class="client-info-row">
                <span class="client-info-label">First Visit</span>
                <span class="client-info-value">${firstVisitStr}</span>
              </div>
              <div class="client-info-row">
                <span class="client-info-label">Last Visit</span>
                <span class="client-info-value">${lastVisitStr}</span>
              </div>
              <div class="client-stats-grid">
                <div class="client-stat-box">
                  <span class="client-stat-value">${c.totalVisits || 0}</span>
                  <span class="client-stat-label">Visits</span>
                </div>
                <div class="client-stat-box">
                  <span class="client-stat-value">₹${(c.totalSpend || 0).toLocaleString('en-IN')}</span>
                  <span class="client-stat-label">Spent</span>
                </div>
              </div>
            </div>
          </div>`;
      }).join('');
    }
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

    // Update the inventory summary stats shown above the gallery
    try {
      const totalProductsEl = document.getElementById('invTotalProducts');
      const lowStockEl = document.getElementById('invLowStock');
      const totalValueEl = document.getElementById('invTotalValue');

      const totalProducts = Array.isArray(items) ? items.length : 0;
      const lowCount = Array.isArray(items) ? items.filter(i => (i.stock != null && i.minStock != null) ? i.stock <= i.minStock : false).length : 0;
      const totalVal = Array.isArray(items) ? items.reduce((s, i) => s + ((Number(i.stock) || 0) * (Number(i.costPrice || i.purchasePrice) || 0)), 0) : 0;

      if (totalProductsEl) totalProductsEl.innerText = totalProducts;
      if (lowStockEl) lowStockEl.innerText = lowCount;
      if (totalValueEl) totalValueEl.innerText = '₹' + totalVal.toLocaleString('en-IN');
    } catch (e) {
      console.warn('Failed to update inventory stats', e);
    }

    if (!Array.isArray(items) || items.length === 0) {
      gallery.innerHTML = '<div class="table-empty" style="grid-column: 1/-1;">No products in inventory yet.</div>';
      return;
    }

  const placeholder = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=400&auto=format&fit=crop';

    gallery.innerHTML = items.map(item => {
      const isLow = item.stock <= item.minStock;
      const profit = item.sellPrice - item.costPrice;
      const totalVal = item.stock * item.costPrice;

      let sanitizedUrl = (item.imageUrl || '').trim();
      if (sanitizedUrl && !sanitizedUrl.startsWith('http://') && !sanitizedUrl.startsWith('https://') && !sanitizedUrl.startsWith('/') && !sanitizedUrl.startsWith('data:image/')) {
        sanitizedUrl = placeholder;
      }
      const safeImageUrl = esc(sanitizedUrl || placeholder);

      return `
        <div class="product-card ${isLow ? 'low-stock-alert' : ''}">
          <div class="product-img-wrapper">
            <img src="${safeImageUrl}" alt="${esc(item.name)}" onerror="this.src='${placeholder}'">
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
              <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn-sm" onclick="openEditInventoryModal('${item._id}')">Edit</button>
                <button class="btn-sm" onclick="location.href='tel:${esc(item.supplierPhone || '')}'" ${!item.supplierPhone ? 'disabled' : ''}>Call Supplier</button>
                <button class="btn-sm btn-danger" onclick="deleteInventoryItem('${item._id}')">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) { showToast('Inventory error', 'error'); }
}

function openInvModal() { document.getElementById('inventoryModal').style.display = 'block'; }
function openInvModal() {
  // Reset modal for creating new product
  const editing = document.getElementById('editingInvId');
  if (editing) editing.value = '';
  ['invName', 'invCategory', 'invStock', 'invMin', 'invSupplier', 'invDesc', 'invImg', 'invPurchase', 'invSelling'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Clear file input & preview
  const fileEl = document.getElementById('invImgFile'); if (fileEl) fileEl.value = '';
  removeInvImage();
  document.getElementById('inventoryModal').style.display = 'block';
}

function closeInvModal() {
  // Clear editing state when closing
  const editing = document.getElementById('editingInvId');
  if (editing) editing.value = '';
  document.getElementById('inventoryModal').style.display = 'none';
}

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
    const editingId = document.getElementById('editingInvId').value;
    const supplierPhone = document.getElementById('invSupplierPhone') ? document.getElementById('invSupplierPhone').value.trim() : '';
    if (editingId) {
      // Update existing
      await api(`/inventory/${editingId}`, { method: 'PUT', body: { name, category, stock, minStock, brand, unit: 'pcs', costPrice: purchasePrice, sellPrice: sellingPrice, description: document.getElementById('invDesc').value, imageUrl: document.getElementById('invImg').value, supplierPhone } });
      showToast('Product updated');
    } else {
      await api('/inventory', { method: 'POST', body: { name, category, stock, minStock, brand, unit: 'pcs', costPrice: purchasePrice, sellPrice: sellingPrice, description: document.getElementById('invDesc').value, imageUrl: document.getElementById('invImg').value, supplierPhone } });
      showToast('Product saved');
    }
    ['invName', 'invCategory', 'invStock', 'invMin', 'invSupplier', 'invSupplierPhone', 'invDesc', 'invImg', 'invPurchase', 'invSelling'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    closeInvModal();
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

async function openEditInventoryModal(id) {
  try {
    // Fetch the single inventory item by id (backend route added)
    const item = await api(`/inventory/${id}`);
    if (!item) { showToast('Product not found', 'error'); return; }

    // Populate modal fields
    document.getElementById('editingInvId').value = item._id || id;
    document.getElementById('invName').value = item.name || '';
    document.getElementById('invCategory').value = item.category || '';
    document.getElementById('invStock').value = item.stock != null ? item.stock : '';
    document.getElementById('invMin').value = item.minStock != null ? item.minStock : '';
    document.getElementById('invSupplier').value = item.brand || '';
  const phoneEl = document.getElementById('invSupplierPhone');
  if (phoneEl) phoneEl.value = item.supplierPhone || '';
    document.getElementById('invDesc').value = item.description || '';
    document.getElementById('invImg').value = item.imageUrl || '';
    // If imageUrl is present, show preview
    if (item.imageUrl) {
      const img = document.getElementById('invImgPreview');
      const wrapperBtn = document.getElementById('invImgRemoveBtn');
      img.src = item.imageUrl;
      img.style.display = 'block';
      if (wrapperBtn) wrapperBtn.style.display = 'inline-block';
    } else {
      removeInvImage();
    }
    document.getElementById('invPurchase').value = item.costPrice != null ? item.costPrice : '';
    document.getElementById('invSelling').value = item.sellPrice != null ? item.sellPrice : '';

    document.getElementById('inventoryModal').style.display = 'block';
  } catch (err) { showToast('Failed to load product: ' + err.message, 'error'); }
}

function handleInvImgFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return removeInvImage();
  // Resize image on client using canvas, then set preview and hidden input to compressed data URL
  const maxDim = 1000; // max width/height in px
  const quality = 0.8; // jpeg quality 0.0 - 1.0

  const imgEl = document.getElementById('invImgPreview');
  const hidden = document.getElementById('invImg');
  const removeBtn = document.getElementById('invImgRemoveBtn');

  const reader = new FileReader();
  reader.onload = function(evt) {
    const tmpImg = new Image();
    tmpImg.onload = function() {
      // compute new size
      let { width, height } = tmpImg;
      const ratio = width / height;
      if (width > maxDim || height > maxDim) {
        if (ratio > 1) { width = maxDim; height = Math.round(maxDim / ratio); }
        else { height = maxDim; width = Math.round(maxDim * ratio); }
      }

      // draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(tmpImg, 0, 0, width, height);

      // export compressed data URL
      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      if (imgEl) { imgEl.src = dataUrl; imgEl.style.display = 'block'; }
      if (hidden) hidden.value = dataUrl;
      if (removeBtn) removeBtn.style.display = 'inline-block';
    };
    tmpImg.onerror = function() { showToast('Failed to read image', 'error'); };
    tmpImg.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function removeInvImage() {
  const img = document.getElementById('invImgPreview');
  const hidden = document.getElementById('invImg');
  const fileEl = document.getElementById('invImgFile');
  const removeBtn = document.getElementById('invImgRemoveBtn');
  if (img) { img.src = ''; img.style.display = 'none'; }
  if (hidden) hidden.value = '';
  if (fileEl) fileEl.value = '';
  if (removeBtn) removeBtn.style.display = 'none';
}


/* ══════════════════════════════════════════════════════════
   7. CHECKOUT / BILLING
   ══════════════════════════════════════════════════════════ */

let billItems = [];
let currentClient = null; // Store current looked-up client object
let currentBillId = null; // Tracks saved bill id when finalized

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

  // Clear existing bill on fresh lookup
  billItems = [];
  renderBill();
  document.getElementById('billDiscountPct').value = '';
  document.getElementById('billDiscountFlat').value = '';
  currentBillId = null;

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
  currentBillId = null; // Unsaved changes
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
  currentBillId = null; // Unsaved changes
  billItems[index].qty += delta;
  if (billItems[index].qty <= 0) billItems.splice(index, 1);
  renderBill();
}
function removeItem(index) {
  currentBillId = null; // Unsaved changes
  billItems.splice(index, 1);
  renderBill();
}

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
  if (!currentBillId && billItems.length > 0) {
    // If not saved to history yet, save it first
    const success = await finalizeSale(false);
    if (!success) return;
  }

  const element = document.getElementById('bill-area');
  const clientName = currentClient ? currentClient.name : 'Client';
  const clientPhone = currentClient ? (currentClient.phone || '') : '';
  const salonName = document.getElementById('billSalonName')?.innerText || 'SalonPro';
  const filename = `Receipt_${clientName.replace(/\s+/g, '_')}.pdf`;

  const btn = document.getElementById('btnSharePDF');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⌛ Generating PDF...';

  // Apply PDF styling mode before capture
  element.classList.add('pdf-mode');

  try {
    // Small delay to ensure styles apply
    await new Promise(r => setTimeout(r, 100));

    // Calculate actual dimensions to generate a "Receipt Style" PDF
    const opt = {
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: {
        unit: 'px',
        format: [400, element.scrollHeight > 600 ? element.scrollHeight : 600],
        orientation: 'portrait'
      }
    };

    // Generate PDF and get jsPDF instance, then convert to blob
    const worker = html2pdf().set(opt).from(element).toPdf();
    const pdfObj = await worker.get('pdf');
    const blob = pdfObj.output('blob');

    // Convert blob to base64 data URL
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

    // Upload PDF to server so we can share a link via WhatsApp
    let uploadedUrl = null;
    try {
      const uploadResp = await api('/uploads/pdf', { method: 'POST', body: { filename, data: dataUrl } });
      // Prefer server-side proxy URL that sets inline headers (serveUrl), fall back to Cloudinary URL
      uploadedUrl = uploadResp.serveUrl || uploadResp.url;
    } catch (uErr) {
      console.error('Upload failed', uErr);
      showToast('Failed to upload PDF for sharing; sending message without attachment', 'error');
    }

    // Step 2: Open WhatsApp with client's number pre-filled and include link if available
    if (clientPhone) {
      let cleanPhone = clientPhone.replace(/[\s\-\(\)]/g, '');
      if (/^\d{10}$/.test(cleanPhone)) cleanPhone = '91' + cleanPhone;

      let messageText = `Hi ${clientName}! 👋\n\nThank you for visiting ${salonName}! 🙏\nPlease find your receipt`; 
      if (uploadedUrl) messageText += ` here: ${uploadedUrl}`;
      messageText += `\n\nSee you again soon! ✨`;

      const message = encodeURIComponent(messageText);
      // Open WhatsApp Web / App with message containing link to PDF
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
      showToast('WhatsApp opening with receipt link...');
    } else {
      showToast('Receipt ready. No phone number on file for WhatsApp');
    }
  } catch (err) {
    showToast('Failed to generate PDF: ' + err.message, 'error');
  } finally {
    element.classList.remove('pdf-mode');
    btn.disabled = false;
    btn.innerHTML = originalText;
  }

}

async function finalizeSale(autoPrint = true) {
  if (currentBillId) { showToast('Bill already saved in history'); return true; }
  if (billItems.length === 0) { showToast('Add items to bill', 'error'); return false; }
  const clientName = document.getElementById('billClient').value.trim();
  const paymentMethod = document.getElementById('paymentMethod').value;
  if (!clientName) { showToast('Please enter client name', 'error'); return false; }

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

    const savedBill = await api('/bills', {
      method: 'POST',
      body: {
        clientId: client._id, clientName: client.name,
        staffId: staffId, staffName: staffName,
        lineItems: items,
        subtotal, taxPct: taxPctGlobal, taxAmount: gst,
        discountAmount: discountTotal,
        grandTotal, paymentMethod
      }
    });

    currentBillId = savedBill._id; // Mark as saved

    // We intentionally DO NOT clear the bill view here so the user can see it to print/share it.
    // The view will automatically reset the next time they search a Client Mobile Number.

    document.getElementById('btnSharePDF').disabled = false;
    showToast(`Bill saved: ₹${grandTotal}`);
    refreshRelated(['checkout', 'reports', 'dashboard', 'inventory', 'clients']);

    // Auto-Print
    if (autoPrint) {
      setTimeout(() => printBill(), 500);
    }
    return true;

  } catch (err) {
    showToast(err.message, 'error');
    return false;
  }
  finally { if (btn) { btn.textContent = '✓ Saved Successfully'; } }
}

let _allBills = []; // Cache for real-time filtering

async function loadBillHistory() {
  try {
    _allBills = await api('/bills');
    renderFilteredBills();
  } catch (err) {
    showToast(err.message || 'Failed to load bill history', 'error');
  }
}

function renderFilteredBills() {
  const dateInput = document.getElementById('billHistoryDateFilter');
  const selectedDate = dateInput ? dateInput.value : '';
  const clearBtn = document.getElementById('btnClearBillDate');

  if (clearBtn) {
    clearBtn.style.display = selectedDate ? 'inline-block' : 'none';
  }

  const filteredBills = _allBills.filter(b => {
    if (!selectedDate) return true;
    const localBillDate = new Date(b.date || b.createdAt);
    const yyyy = localBillDate.getFullYear();
    const mm = String(localBillDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localBillDate.getDate()).padStart(2, '0');
    const formattedBillDate = `${yyyy}-${mm}-${dd}`;
    return formattedBillDate === selectedDate;
  });

  const tbody = document.getElementById('billHistoryBody');
  const gallery = document.getElementById('billHistoryGallery');

  if (!tbody && !gallery) return;

  const payClass = (m) => {
    const map = { Cash: 'pay-cash', UPI: 'pay-upi', Card: 'pay-card' };
    return map[m] || 'pay-other';
  };

  if (filteredBills.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">No bills found for the selected date.</td></tr>`;
    if (gallery) gallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#999;">
      <div style="font-size:48px;margin-bottom:12px;">🧾</div>
      <div style="font-size:16px;font-weight:600;">No bills found</div>
      <div style="font-size:13px;margin-top:6px;">Try selecting a different date.</div>
    </div>`;
    return;
  }

  // 1. Render Table Rows (Desktop)
  if (tbody) {
    tbody.innerHTML = filteredBills.map(b => {
      const isVoid = b.deleted;
      const dateStr = new Date(b.date || b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
      return `
      <tr style="${isVoid ? 'opacity:0.45;' : ''}">
        <td data-label="Date"><span style="color:var(--text-muted);font-size:0.82rem;">${dateStr}</span></td>
        <td data-label="Client"><span style="font-weight:600;">${esc(b.clientName)}</span></td>
        <td data-label="Items"><span style="color:var(--text-muted)">${b.lineItems.length} item${b.lineItems.length !== 1 ? 's' : ''}</span></td>
        <td data-label="Total"><span><strong style="font-weight:700;">₹${b.grandTotal.toLocaleString('en-IN')}</strong>${isVoid ? ' <span style="color:#c0392b;font-size:0.75rem;font-weight:700;margin-left:4px;">VOID</span>' : ''}</span></td>
        <td data-label="Payment"><span><span class="pay-badge ${payClass(b.paymentMethod)}">${esc(b.paymentMethod)}</span></span></td>
        <td data-label="Actions" class="no-print">
          <div class="action-btns">
            <button class="btn-act-view" onclick="viewBill('${b._id}')" ${isVoid ? 'disabled' : ''}>View</button>
            ${!isVoid ? `<button class="btn-act-void" onclick="voidBill('${b._id}')">Void</button>` : ''}
            <button class="btn-act-print" onclick="printPastBill('${b._id}')" ${isVoid ? 'disabled' : ''}>Print</button>
          </div>
        </td>
      </tr>`}).join('');
  }

  // 2. Render Cards (Mobile)
  if (gallery) {
    gallery.innerHTML = filteredBills.map(b => {
      const isVoid = b.deleted;
      const dateStr = new Date(b.date || b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = new Date(b.date || b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const itemsSummary = b.lineItems.map(i => i.name).slice(0, 3).join(', ');
      const moreItems = b.lineItems.length > 3 ? ` +${b.lineItems.length - 3} more` : '';

      return `
        <div class="bill-card ${isVoid ? 'bill-card--void' : ''}">
          <div class="bill-card-header">
            <div class="bill-card-client">
              <div class="bill-card-name">${esc(b.clientName)}</div>
              <div class="bill-card-date">📅 ${dateStr} · ${timeStr}</div>
            </div>
            <div class="bill-card-total-badge ${isVoid ? 'bill-card-total--void' : ''}">
              ₹${b.grandTotal.toLocaleString('en-IN')}
            </div>
          </div>
          <div class="bill-card-body">
            <div class="bill-card-items">
              <span class="bill-card-items-icon">🛒</span>
              <span class="bill-card-items-text">${esc(itemsSummary)}${moreItems}</span>
              <span class="bill-card-items-count">${b.lineItems.length} item${b.lineItems.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="bill-card-footer">
              <span class="pay-badge ${payClass(b.paymentMethod)}">${esc(b.paymentMethod)}</span>
              ${isVoid ? '<span class="bill-void-tag">VOID</span>' : ''}
              <div class="bill-card-actions">
                <button class="btn-act-view" onclick="viewBill('${b._id}')" ${isVoid ? 'disabled' : ''}>👁 View</button>
                ${!isVoid ? `<button class="btn-act-void" onclick="voidBill('${b._id}')">✕ Void</button>` : ''}
                <button class="btn-act-print" onclick="printPastBill('${b._id}')" ${isVoid ? 'disabled' : ''}>🖨 Print</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }
}

function filterBillHistoryByDate() {
  renderFilteredBills();
}

function clearBillHistoryDateFilter() {
  const dateInput = document.getElementById('billHistoryDateFilter');
  if (dateInput) dateInput.value = '';
  renderFilteredBills();
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
  currentBillId = id; // Flag as saved
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
    bills.forEach(b => b.lineItems.forEach(li => { if (li.staffName) staffRev[li.staffName] = (staffRev[li.staffName] || 0) + li.subtotal; }));
    _charts.staff = new Chart(ctxStaff, {
      type: 'bar',
      data: {
        labels: Object.keys(staffRev),
        datasets: [{ data: Object.values(staffRev), backgroundColor: '#6c5ce7', borderRadius: 10 }]
      },
      options: {
        indexAxis: 'y', plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { grid: { display: false } } }
      }
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
    document.getElementById('setRegisteredEmail').value = s.registeredEmail || '';
    document.getElementById('setCurrency').value = s.currency || '₹';
    document.getElementById('setTax').value = s.taxPct || 0;
    document.getElementById('setDefaultCommission').value = s.defaultCommission || 0;
    document.getElementById('setLoyalty').checked = s.loyaltyEnabled || false;
    document.getElementById('setPoints').value = s.pointsPerRupee || 0;

    taxPctGlobal = s.taxPct || 0;

  // Load operating hours if provided by backend
  if (s.openHour) calendarState.operatingHours.open = s.openHour;
  if (s.closeHour) calendarState.operatingHours.close = s.closeHour;

    // Update bill branding
    setEl('billSalonName', s.salonName || 'SalonPro');
    setEl('billSalonAddress', s.address || '');
    setEl('billSalonPhone', s.phone ? 'Ph: ' + s.phone : '');
    setEl('footerSalonName', s.salonName || 'SalonPro');

  // Reflect operating hours inputs in settings UI
  const openEl = document.getElementById('setOpenHour');
  const closeEl = document.getElementById('setCloseHour');
  if (openEl) openEl.value = calendarState.operatingHours.open;
  if (closeEl) closeEl.value = calendarState.operatingHours.close;

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
      pointsPerRupee: document.getElementById('setPoints').value,
      openHour: document.getElementById('setOpenHour') ? document.getElementById('setOpenHour').value : calendarState.operatingHours.open,
      closeHour: document.getElementById('setCloseHour') ? document.getElementById('setCloseHour').value : calendarState.operatingHours.close
    };

    await api('/settings', { method: 'PUT', body: payload });
    showToast('Settings saved successfully');
  // Refresh local copy
  loadSettings(); // update globals (will set calendarState.operatingHours)
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
      card.style.setProperty('--rx', `${(y - rect.height / 2) / -10}deg`);
      card.style.setProperty('--ry', `${(x - rect.width / 2) / 10}deg`);
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
      if (h >= 8 && h < 20) data[h - 8]++;
    });
    densityChart = new Chart(ctxD, {
      type: 'line',
      data: {
        labels: ['8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p'],
        datasets: [{ data, borderColor: '#8e44ad', backgroundColor: 'rgba(142, 68, 173, 0.05)', fill: true, tension: 0.4, pointRadius: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { display: false }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } }
      }
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

function renderTodaysAppointments(appts) {
  const container = document.getElementById('dashTodaysAppts');
  if (!container) return;
  container.innerHTML = '';

  if (!appts || appts.length === 0) {
    container.innerHTML = `<div style="color:#95a5a6; font-style:italic;">No appointments today</div>`;
    return;
  }

  const slice = appts.slice(0, 4); // show up to 4
  slice.forEach(a => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '8px 10px';
    item.style.borderRadius = '8px';
    item.style.background = 'rgba(0,0,0,0.02)';
    item.style.cursor = 'pointer';
    item.onclick = () => openApptDetailModal(a._id);

    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:700;">${esc(a.clientName)}</div><div style="font-size:12px;color:#666;">${esc(a.serviceName)}</div>`;

    const right = document.createElement('div');
    right.style.textAlign = 'right';
    right.innerHTML = `<div style="font-weight:700;color:var(--accent);">${esc(format12hTime(a.time))}</div><div style="font-size:12px;color:#888;">${esc(a.staffName || '—')}</div>`;

    item.appendChild(left);
    item.appendChild(right);
    container.appendChild(item);
  });

  if (appts.length > 4) {
    const more = document.createElement('div');
    more.style.textAlign = 'center';
    more.style.marginTop = '6px';
    more.innerHTML = `<small style="color:#777;">+${appts.length - 4} more — <a href="#" onclick="showSection('calendar')">View all</a></small>`;
    container.appendChild(more);
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