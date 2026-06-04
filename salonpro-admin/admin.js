// admin.js - SPA Admin Routing and UI controller

// ─── STATE MANAGEMENT ─────────────────────────────────
const state = {
  activeSection: 'dashboard',
  users: [],
  selectedUserIds: new Set(),
  currentPage: 1,
  totalPages: 1,
  limit: 20,
  searchQuery: '',
  statusFilter: '',
  planFilter: '',
  searchTimeout: null,
  activeUserId: null,
  activeNotificationTab: 'send',
  revenueStatusFilter: '',
  confirmCallback: null
};

// ─── INIT & DOM CONTENT LOADED ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  displayAdminEmail();
  initSidebar();
  initConfirmModal();
  initNotificationTabs();
  
  // Load initial section
  loadSection('dashboard');
});

// ─── AUTH ─────────────────────────────────────────────
function checkAuth() {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    window.location.href = 'index.html';
  }
}

function displayAdminEmail() {
  const email = localStorage.getItem('admin_email') || 'admin@salonpro.com';
  const display = document.getElementById('adminEmailDisplay');
  if (display) display.textContent = email;
}

// ─── NAVIGATION ───────────────────────────────────────
function initSidebar() {
  const navLinks = document.querySelectorAll('.sidebar-nav a[data-section]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.getAttribute('data-section');
      loadSection(sectionId);
    });
  });

  // Logout actions
  const sidebarLogout = document.getElementById('sidebarLogout');
  const headerLogoutBtn = document.getElementById('headerLogoutBtn');
  const doLogout = () => {
    showConfirm('Are you sure you want to log out of the admin panel?', () => {
      adminLogout();
    });
  };

  if (sidebarLogout) sidebarLogout.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
  if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', doLogout);
}

function showSection(id) {
  state.activeSection = id;
  
  // Hide all sections
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('section-hidden'));
  
  // Show target section
  const targetSection = document.getElementById('section-' + id);
  if (targetSection) targetSection.classList.remove('section-hidden');

  // Update sidebar active link state
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
    if (link.getAttribute('data-section') === id) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update topbar title
  const titleMap = {
    'dashboard': 'Dashboard Overview',
    'users': 'Account Subscriptions',
    'user-detail': 'Salon Owner Profile Details',
    'notifications': 'Broadcast & Communication',
    'revenue': 'Financial Transactions Ledger'
  };
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) {
    topbarTitle.textContent = titleMap[id] || 'Control Panel';
  }
}

function loadSection(id) {
  showSection(id);

  if (id === 'dashboard') {
    loadDashboard();
  } else if (id === 'users') {
    initUsersPage();
    loadUsers();
  } else if (id === 'notifications') {
    loadNotificationsSection();
  } else if (id === 'revenue') {
    loadRevenue();
  }
}

// ─── DASHBOARD ────────────────────────────────────────
async function loadDashboard() {
  try {
    const overview = await adminApi('/admin/analytics/overview');
    if (!overview) return;

    // Render Metrics
    document.getElementById('dashTotalUsers').textContent = overview.totalUsers ?? 0;
    document.getElementById('dashActiveUsers').textContent = overview.activeUsers ?? 0;
    document.getElementById('dashTrialUsers').textContent = overview.trialUsers ?? 0;
    document.getElementById('dashExpiredUsers').textContent = overview.expiredUsers ?? 0;
    document.getElementById('dashMRR').textContent = formatCurrency(overview.mrr ?? 0);

    // Render Quick Stats
    document.getElementById('dashNewThisMonth').textContent = overview.newUsersThisMonth ?? 0;
    document.getElementById('dashRevenueThisMonth').textContent = formatCurrency(overview.revenueThisMonth ?? 0);
    
    // Plan distribution
    const pd = overview.planDistribution || {};
    document.getElementById('dashPlanStarter').textContent = pd.starter ?? 0;
    document.getElementById('dashPlanGrowth').textContent = pd.growth ?? 0;
    document.getElementById('dashPlanPro').textContent = pd.pro ?? 0;

    // Fetch and render expiring soon
    const expiringUsers = await adminApi('/admin/users/expiring-soon');
    renderExpiringSoon(expiringUsers || []);
  } catch (err) {
    console.error(err);
    showToast('Failed to load dashboard metrics: ' + err.message, 'error');
  }
}

function renderExpiringSoon(users) {
  const tbody = document.getElementById('expiringSoonTableBody');
  const countSpan = document.getElementById('expiringCount');
  
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (countSpan) {
    countSpan.textContent = `${users.length} user${users.length === 1 ? '' : 's'}`;
  }

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="td-empty">No active subscriptions expiring in the next 7 days.</td></tr>';
    return;
  }

  users.forEach(user => {
    const tr = document.createElement('tr');
    const daysLeft = daysUntil(user.subscriptionEndDate);
    
    tr.innerHTML = `
      <td><strong>${esc(user.salonName)}</strong></td>
      <td>${esc(user.email)}</td>
      <td><span style="text-transform: uppercase; font-size:13px; font-weight:600;">${esc(user.subscriptionPlan)}</span></td>
      <td>${formatDate(user.subscriptionEndDate)}</td>
      <td><span class="badge ${daysLeft <= 2 ? 'badge-expired' : 'badge-trial'}">${daysLeft} days left</span></td>
      <td>
        <button class="btn btn-primary btn-sm btn-reminder" data-id="${user.userId}">Send Reminder</button>
      </td>
    `;
    
    // Reminder action
    tr.querySelector('.btn-reminder').addEventListener('click', async (e) => {
      e.preventDefault();
      const targetUserId = e.target.getAttribute('data-id');
      
      e.target.disabled = true;
      e.target.textContent = 'Sending...';

      try {
        await adminApi(`/admin/users/${targetUserId}/notify`, {
          method: 'POST',
          body: {
            message: `Your SalonPro subscription is expiring soon. Please renew to avoid system locks.`,
            channel: 'both',
            notificationType: 'renewal_reminder'
          }
        });
        showToast('Renewal reminder sent successfully to owner.', 'success');
      } catch (err) {
        showToast('Failed to send reminder: ' + err.message, 'error');
      } finally {
        e.target.disabled = false;
        e.target.textContent = 'Send Reminder';
      }
    });

    tbody.appendChild(tr);
  });
}

// ─── USERS SECTION ────────────────────────────────────
function initUsersPage() {
  const searchInput = document.getElementById('userSearchInput');
  const statusFilter = document.getElementById('userStatusFilter');
  const planFilter = document.getElementById('userPlanFilter');
  const selectAllCheckbox = document.getElementById('bulkSelectAll');
  
  if (searchInput) {
    searchInput.replaceWith(searchInput.cloneNode(true)); // remove listeners
    document.getElementById('userSearchInput').addEventListener('input', handleSearch);
  }
  if (statusFilter) {
    statusFilter.replaceWith(statusFilter.cloneNode(true));
    document.getElementById('userStatusFilter').addEventListener('change', handleFilterChange);
  }
  if (planFilter) {
    planFilter.replaceWith(planFilter.cloneNode(true));
    document.getElementById('userPlanFilter').addEventListener('change', handleFilterChange);
  }
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.replaceWith(selectAllCheckbox.cloneNode(true));
    document.getElementById('bulkSelectAll').addEventListener('change', handleBulkSelectAll);
  }

  // Bulk buttons
  document.getElementById('bulkCancelBtn').onclick = resetBulkSelection;
  document.getElementById('bulkNotifyBtn').onclick = handleBulkNotificationFromUsers;
}

function handleSearch(e) {
  clearTimeout(state.searchTimeout);
  state.searchQuery = e.target.value;
  state.searchTimeout = setTimeout(() => {
    state.currentPage = 1;
    loadUsers();
  }, 400);
}

function handleFilterChange() {
  state.statusFilter = document.getElementById('userStatusFilter').value;
  state.planFilter = document.getElementById('userPlanFilter').value;
  state.currentPage = 1;
  loadUsers();
}

async function loadUsers(page = 1) {
  state.currentPage = page;
  const tbody = document.getElementById('usersTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="td-loading">Fetching tenant subscription profiles...</td></tr>';

  try {
    const data = await adminApi(`/admin/users?page=${page}&limit=${state.limit}&search=${encodeURIComponent(state.searchQuery)}&status=${state.statusFilter}&plan=${state.planFilter}`);
    if (!data) return;

    state.totalPages = data.totalPages || 1;
    renderUsersTable(data.users || []);
    renderPagination(data.total, data.page, data.totalPages);
    updateBulkActionBar();
  } catch (err) {
    console.error(err);
    showToast('Failed to load user list: ' + err.message, 'error');
  }
}

function renderUsersTable(usersList) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  state.users = usersList;

  if (usersList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="td-empty">No matching users found.</td></tr>';
    return;
  }

  usersList.forEach(user => {
    const tr = document.createElement('tr');
    
    // Status Pills
    let statusClass = 'badge-trial';
    if (user.subscriptionStatus === 'active') statusClass = 'badge-active';
    else if (user.subscriptionStatus === 'expired') statusClass = 'badge-expired';
    else if (user.subscriptionStatus === 'terminated') statusClass = 'badge-terminated';

    // Last Payment string
    let lastPaymentStr = 'Never';
    if (user.lastPaymentDate) {
      lastPaymentStr = `${formatDate(user.lastPaymentDate)} (${formatCurrency(user.lastPaymentAmount)})`;
    }

    const isChecked = state.selectedUserIds.has(user.userId) ? 'checked' : '';

    tr.innerHTML = `
      <td><input type="checkbox" class="user-row-checkbox" data-id="${user.userId}" ${isChecked}></td>
      <td><strong>${esc(user.salonName)}</strong><br><span style="font-size:12px; color:var(--text-secondary);">${esc(user.name)}</span></td>
      <td>${esc(user.email)}</td>
      <td><span style="text-transform: uppercase; font-weight:600;">${esc(user.subscriptionPlan)}</span></td>
      <td><span class="badge ${statusClass}">${esc(user.subscriptionStatus)}</span></td>
      <td>${user.subscriptionEndDate ? formatDate(user.subscriptionEndDate) : 'N/A'}</td>
      <td>${lastPaymentStr}</td>
      <td>
        <button class="btn btn-outline btn-sm btn-view-user" data-id="${user.userId}">View</button>
      </td>
    `;

    // Row checkbox listener
    tr.querySelector('.user-row-checkbox').addEventListener('change', (e) => {
      const uId = e.target.getAttribute('data-id');
      if (e.target.checked) {
        state.selectedUserIds.add(uId);
      } else {
        state.selectedUserIds.delete(uId);
      }
      updateBulkActionBar();
    });

    // View button listener
    tr.querySelector('.btn-view-user').addEventListener('click', (e) => {
      const uId = e.target.getAttribute('data-id');
      showUserDetail(uId);
    });

    tbody.appendChild(tr);
  });
}

function renderPagination(total, page, totalPages) {
  const container = document.getElementById('usersPagination');
  const countLabel = document.getElementById('usersResultsCount');
  
  if (!container) return;
  container.innerHTML = '';

  const start = (page - 1) * state.limit + 1;
  const end = Math.min(page * state.limit, total);

  if (countLabel) {
    if (total === 0) {
      countLabel.textContent = 'Showing 0 users';
    } else {
      countLabel.textContent = `Showing ${start}-${end} of ${total} users`;
    }
  }

  if (totalPages <= 1) return;

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = `btn btn-outline btn-sm ${page === 1 ? 'disabled' : ''}`;
  prevBtn.textContent = 'Previous';
  prevBtn.disabled = page === 1;
  prevBtn.onclick = () => loadUsers(page - 1);
  container.appendChild(prevBtn);

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      const numBtn = document.createElement('button');
      numBtn.className = `btn btn-sm ${i === page ? 'btn-primary' : 'btn-outline'}`;
      numBtn.textContent = i;
      numBtn.onclick = () => loadUsers(i);
      container.appendChild(numBtn);
    } else if (i === page - 3 || i === page + 3) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.margin = '0 4px';
      dots.style.color = 'var(--text-secondary)';
      container.appendChild(dots);
    }
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = `btn btn-outline btn-sm ${page === totalPages ? 'disabled' : ''}`;
  nextBtn.textContent = 'Next';
  nextBtn.disabled = page === totalPages;
  nextBtn.onclick = () => loadUsers(page + 1);
  container.appendChild(nextBtn);
}

function handleBulkSelectAll(e) {
  const isChecked = e.target.checked;
  const checkboxes = document.querySelectorAll('.user-row-checkbox');
  
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const uId = cb.getAttribute('data-id');
    if (isChecked) {
      state.selectedUserIds.add(uId);
    } else {
      state.selectedUserIds.delete(uId);
    }
  });

  updateBulkActionBar();
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulkActionBar');
  const text = document.getElementById('bulkActionText');
  const allSelect = document.getElementById('bulkSelectAll');

  if (!bar) return;

  const count = state.selectedUserIds.size;
  if (count > 0) {
    if (text) text.textContent = `${count} user${count === 1 ? '' : 's'} selected`;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
    if (allSelect) allSelect.checked = false;
  }
}

function resetBulkSelection() {
  state.selectedUserIds.clear();
  const allSelect = document.getElementById('bulkSelectAll');
  if (allSelect) allSelect.checked = false;
  
  document.querySelectorAll('.user-row-checkbox').forEach(cb => {
    cb.checked = false;
  });

  updateBulkActionBar();
}

function handleBulkNotificationFromUsers() {
  // Transfer selection details to Notifications section and focus there
  const uIdsArray = Array.from(state.selectedUserIds);
  resetBulkSelection();
  
  loadSection('notifications');
  
  // Preset target filter logic on Notifications page
  const targetDropdown = document.getElementById('bulkNotifyTarget');
  if (targetDropdown) {
    targetDropdown.value = 'all'; // Default
    // Custom inject of selected user IDs count
    const estimate = document.getElementById('bulkRecipientEstimate');
    if (estimate) {
      estimate.textContent = `Targeting ${uIdsArray.length} specific users pre-selected from Users list.`;
    }
    // Embed selection into form submit state dynamically
    document.getElementById('bulkNotificationForm').setAttribute('data-preselected', JSON.stringify(uIdsArray));
  }
}

// ─── USER DETAIL SECTION ──────────────────────────────
async function showUserDetail(userId) {
  state.activeUserId = userId;
  showSection('user-detail');

  // Reset operational panels
  document.querySelectorAll('.ops-form-panel').forEach(p => p.style.display = 'none');
  
  // Set back button click
  document.getElementById('backToUsersBtn').onclick = () => {
    showSection('users');
  };

  await loadUserDetail(userId);
  initUserOperations(userId);
}

async function loadUserDetail(userId) {
  try {
    const user = await adminApi(`/admin/users/${userId}`);
    if (!user) return;

    renderUserProfile(user);
    renderPaymentHistory(user.paymentHistory || []);
    renderNotificationHistory(user.notificationsSent || []);
  } catch (err) {
    showToast('Failed to load user profile: ' + err.message, 'error');
  }
}

function renderUserProfile(user) {
  document.getElementById('detailUserId').textContent = user.userId;
  document.getElementById('detailUserId').onclick = () => {
    copyToClipboard(user.userId);
    showToast('User ID copied to clipboard!', 'info');
  };

  document.getElementById('detailSalonName').textContent = user.salonName;
  document.getElementById('detailOwnerName').textContent = user.name;
  document.getElementById('detailEmail').textContent = user.email;
  document.getElementById('detailJoinedDate').textContent = user.createdAt ? formatDate(user.createdAt) : 'N/A';

  // Subscription details
  const badge = document.getElementById('detailStatusBadge');
  badge.className = 'badge';
  badge.textContent = user.subscriptionStatus;

  if (user.subscriptionStatus === 'active') badge.classList.add('badge-active');
  else if (user.subscriptionStatus === 'trial') badge.classList.add('badge-trial');
  else if (user.subscriptionStatus === 'expired') badge.classList.add('badge-expired');
  else if (user.subscriptionStatus === 'terminated') badge.classList.add('badge-terminated');

  document.getElementById('detailPlanName').textContent = user.subscriptionPlan || 'None';
  document.getElementById('detailStartDate').textContent = user.subscriptionStartDate ? formatDate(user.subscriptionStartDate) : 'N/A';
  document.getElementById('detailEndDate').textContent = user.subscriptionEndDate ? formatDate(user.subscriptionEndDate) : 'N/A';

  // Days remaining calculation and color warning
  const daysSpan = document.getElementById('detailDaysRemaining');
  if (user.subscriptionEndDate && user.subscriptionStatus !== 'terminated') {
    const days = daysUntil(user.subscriptionEndDate);
    daysSpan.textContent = `${days} day${days === 1 ? '' : 's'} remaining`;
    
    daysSpan.style.fontWeight = 'bold';
    if (days < 7) {
      daysSpan.style.color = 'var(--danger)';
    } else if (days <= 30) {
      daysSpan.style.color = 'var(--warning)';
    } else {
      daysSpan.style.color = 'var(--success)';
    }
  } else {
    daysSpan.textContent = user.subscriptionStatus === 'terminated' ? 'Suspended' : 'N/A';
    daysSpan.style.color = 'var(--text-secondary)';
  }

  // Razorpay subscription block
  const rpRow = document.getElementById('detailRpSubRow');
  const rpSpan = document.getElementById('detailRpSubId');
  if (user.razorpaySubscriptionId) {
    rpSpan.textContent = user.razorpaySubscriptionId;
    rpRow.style.display = 'block';
  } else {
    rpRow.style.display = 'none';
  }

  // Pre-fill Admin Notes
  const notesText = document.getElementById('detailAdminNotes');
  if (notesText) notesText.value = user.adminNotes || '';
}

function renderPaymentHistory(payments) {
  const tbody = document.getElementById('detailPaymentsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="td-empty">No payments recorded.</td></tr>';
    return;
  }

  // Newest payment first
  const sortedPayments = [...payments].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

  sortedPayments.forEach(p => {
    const tr = document.createElement('tr');
    
    let statusClass = 'badge-expired';
    if (p.status === 'captured') statusClass = 'badge-active';
    else if (p.status === 'refunded') statusClass = 'badge-trial';

    tr.innerHTML = `
      <td>${p.paidAt ? formatDate(p.paidAt) : 'N/A'}</td>
      <td><strong>${formatCurrency(p.amount)}</strong></td>
      <td style="text-transform: uppercase;">${esc(p.plan)}</td>
      <td><span class="badge ${statusClass}">${esc(p.status)}</span></td>
      <td class="code-font">${esc(p.razorpayPaymentId)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderNotificationHistory(notifications) {
  const container = document.getElementById('detailNotificationsTimeline');
  if (!container) return;
  container.innerHTML = '';

  if (notifications.length === 0) {
    container.innerHTML = '<p class="td-empty" style="text-align: left; padding: 10px 0;">No communications sent to this salon owner yet.</p>';
    return;
  }

  // Newest first
  const sortedNotifications = [...notifications].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  sortedNotifications.forEach(n => {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    // SVG icon mapping
    let iconSvg = `
      <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
    `;
    if (n.channel === 'in_app') {
      iconSvg = `
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      `;
    }

    item.innerHTML = `
      <div class="timeline-icon">${iconSvg}</div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-type">${esc(n.type.replace('_', ' '))}</span>
          <span class="timeline-date">${formatDate(n.sentAt)}</span>
        </div>
        <p class="timeline-msg">${esc(n.message)}</p>
        <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Channel: ${esc(n.channel)}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

function initUserOperations(userId) {
  // Bind Triggers
  bindOpPanel('opActivateTriggerBtn', 'opActivateForm');
  bindOpPanel('opTerminateTriggerBtn', 'opTerminateForm');
  bindOpPanel('opNotifyTriggerBtn', 'opNotifyForm');

  // Custom Days toggle
  const durationSelect = document.getElementById('opActivateDuration');
  const customDaysGroup = document.getElementById('opActivateCustomDaysGroup');
  durationSelect.onchange = () => {
    if (durationSelect.value === 'custom') {
      customDaysGroup.style.display = 'block';
    } else {
      customDaysGroup.style.display = 'none';
    }
  };

  // Submit Operations handlers
  document.getElementById('opActivateConfirmBtn').onclick = async () => {
    const plan = document.getElementById('opActivatePlan').value;
    const durationSel = document.getElementById('opActivateDuration').value;
    let days = parseInt(durationSel);
    if (durationSel === 'custom') {
      days = parseInt(document.getElementById('opActivateCustomDays').value) || 30;
    }

    showConfirm(`Are you sure you want to manually activate user "${userId}" on the "${plan.toUpperCase()}" plan for ${days} days?`, async () => {
      try {
        await adminApi(`/admin/users/${userId}/activate`, {
          method: 'POST',
          body: { plan, durationDays: days }
        });
        showToast('Subscription activated successfully.', 'success');
        showUserDetail(userId);
      } catch (err) {
        showToast('Activation failed: ' + err.message, 'error');
      }
    });
  };

  document.getElementById('opActivateCancelBtn').onclick = () => {
    document.getElementById('opActivateForm').style.display = 'none';
  };

  document.getElementById('opTerminateConfirmBtn').onclick = () => {
    const reason = document.getElementById('opTerminateReason').value.trim();
    if (!reason) {
      showToast('Please provide a reason for suspension.', 'error');
      return;
    }

    showConfirm(`Are you sure you want to suspend/terminate subscription for user "${userId}"? Access will be revoked immediately.`, async () => {
      try {
        await adminApi(`/admin/users/${userId}/terminate`, {
          method: 'POST',
          body: { reason }
        });
        showToast('Subscription suspended.', 'success');
        showUserDetail(userId);
      } catch (err) {
        showToast('Termination failed: ' + err.message, 'error');
      }
    });
  };

  document.getElementById('opTerminateCancelBtn').onclick = () => {
    document.getElementById('opTerminateForm').style.display = 'none';
  };

  document.getElementById('opNotifyConfirmBtn').onclick = async () => {
    const message = document.getElementById('opNotifyMessage').value.trim();
    const channel = document.getElementById('opNotifyChannel').value;
    const notificationType = document.getElementById('opNotifyType').value;

    if (!message) {
      showToast('Please type a notification message.', 'error');
      return;
    }

    try {
      await adminApi(`/admin/users/${userId}/notify`, {
        method: 'POST',
        body: { message, channel, notificationType }
      });
      showToast('Notification sent to user history.', 'success');
      showUserDetail(userId);
    } catch (err) {
      showToast('Failed to send notification: ' + err.message, 'error');
    }
  };

  document.getElementById('opNotifyCancelBtn').onclick = () => {
    document.getElementById('opNotifyForm').style.display = 'none';
  };

  // Generate Payment link
  document.getElementById('opPayLinkBtn').onclick = async () => {
    const btn = document.getElementById('opPayLinkBtn');
    btn.disabled = true;
    btn.textContent = 'Generating Razorpay Link...';

    try {
      const plans = await adminApi('/admin/razorpay/plans');
      let targetPlan = plans && plans.length > 0 ? plans[0] : null;

      // Fallback/Create plan if no plans exist
      if (!targetPlan) {
        targetPlan = await adminApi('/admin/razorpay/create-plan', {
          method: 'POST',
          body: {
            planName: 'Starter Plan - Monthly',
            amount: 999,
            period: 'monthly',
            interval: 1
          }
        });
      }

      if (!targetPlan) throw new Error('No subscription plans configured.');

      const linkData = await adminApi(`/admin/users/${userId}/create-subscription`, {
        method: 'POST',
        body: {
          planId: targetPlan.planId,
          totalCount: 12
        }
      });

      if (linkData && linkData.shortUrl) {
        document.getElementById('opPayLinkUrl').value = linkData.shortUrl;
        document.getElementById('opPayLinkResultPanel').style.display = 'block';
        showToast('Razorpay subscription link created.', 'success');
      }
    } catch (err) {
      showToast('Payment link generation failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Razorpay Payment Link';
    }
  };

  document.getElementById('opPayLinkCopyBtn').onclick = () => {
    const url = document.getElementById('opPayLinkUrl').value;
    copyToClipboard(url);
    showToast('Payment link copied!', 'info');
  };

  document.getElementById('opPayLinkCloseBtn').onclick = () => {
    document.getElementById('opPayLinkResultPanel').style.display = 'none';
  };

  // Save Notes
  document.getElementById('detailSaveNotesBtn').onclick = async () => {
    const adminNotes = document.getElementById('detailAdminNotes').value.trim();
    const btn = document.getElementById('detailSaveNotesBtn');
    
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await adminApi(`/admin/users/${userId}/subscription`, {
        method: 'PATCH',
        body: { adminNotes }
      });
      showToast('Admin notes updated successfully.', 'success');
    } catch (err) {
      showToast('Failed to save notes: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Notes';
    }
  };
}

function bindOpPanel(triggerId, panelId) {
  const trigger = document.getElementById(triggerId);
  const panel = document.getElementById(panelId);
  
  if (trigger && panel) {
    trigger.onclick = () => {
      const wasOpen = panel.style.display === 'block';
      // Hide all panels
      document.querySelectorAll('.ops-form-panel').forEach(p => p.style.display = 'none');
      // Toggle current
      panel.style.display = wasOpen ? 'none' : 'block';
    };
  }
}

// ─── NOTIFICATIONS SECTION ────────────────────────────
function initNotificationTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-tab');
      state.activeNotificationTab = targetTab;

      if (targetTab === 'send') {
        document.getElementById('tab-send').classList.remove('tab-hidden');
        document.getElementById('tab-history').classList.add('tab-hidden');
      } else {
        document.getElementById('tab-send').classList.add('tab-hidden');
        document.getElementById('tab-history').classList.remove('tab-hidden');
        loadNotificationHistoryTab();
      }
    });
  });

  // Target Change listener (estimate recipients count)
  const targetDropdown = document.getElementById('bulkNotifyTarget');
  if (targetDropdown) {
    targetDropdown.addEventListener('change', updateRecipientEstimate);
  }

  // Character Counter
  const messageArea = document.getElementById('bulkNotifyMessage');
  const counterSpan = document.getElementById('bulkCharCounter');
  if (messageArea && counterSpan) {
    messageArea.addEventListener('input', () => {
      counterSpan.textContent = `${messageArea.value.length} chars`;
    });
  }

  // Form Submit
  const form = document.getElementById('bulkNotificationForm');
  if (form) {
    form.addEventListener('submit', handleBulkNotifySubmit);
  }
}

async function loadNotificationsSection() {
  // Clear form
  document.getElementById('bulkNotifyMessage').value = '';
  document.getElementById('bulkCharCounter').textContent = '0 chars';
  document.getElementById('bulkNotificationForm').removeAttribute('data-preselected');
  
  // Set default tab
  const tabSend = document.querySelector('.tab-btn[data-tab="send"]');
  if (tabSend) tabSend.click();

  updateRecipientEstimate();
}

async function updateRecipientEstimate() {
  const target = document.getElementById('bulkNotifyTarget').value;
  const estimateSpan = document.getElementById('bulkRecipientEstimate');
  const form = document.getElementById('bulkNotificationForm');

  // Check if there is pre-selected users from the user rows checklist
  const preselectedData = form.getAttribute('data-preselected');
  if (preselectedData) {
    const list = JSON.parse(preselectedData);
    estimateSpan.textContent = `Targeting ${list.length} selected users (from users ledger checkboxes).`;
    return;
  }

  estimateSpan.textContent = 'Estimating recipients count...';

  try {
    const filter = target === 'all' ? {} : { subscriptionStatus: target };
    const queryStr = target === 'all' ? '' : `&status=${target}`;
    
    // Fetch user counts from API
    const data = await adminApi(`/admin/users?limit=1${queryStr}`);
    if (data) {
      estimateSpan.textContent = `Estimated: ${data.total} recipient${data.total === 1 ? '' : 's'}`;
      form.setAttribute('data-target-count', data.total);
    }
  } catch (err) {
    estimateSpan.textContent = 'Estimation failed.';
  }
}

async function handleBulkNotifySubmit(e) {
  e.preventDefault();
  
  const form = document.getElementById('bulkNotificationForm');
  const target = document.getElementById('bulkNotifyTarget').value;
  const message = document.getElementById('bulkNotifyMessage').value.trim();
  const channel = document.getElementById('bulkNotifyChannel').value;
  const notificationType = document.getElementById('bulkNotifyType').value;

  const preselectedData = form.getAttribute('data-preselected');
  let targetCount = parseInt(form.getAttribute('data-target-count')) || 0;
  let userIds = null;

  if (preselectedData) {
    userIds = JSON.parse(preselectedData);
    targetCount = userIds.length;
  }

  if (!message) {
    showToast('Message body cannot be empty.', 'error');
    return;
  }

  showConfirm(`Are you sure you want to broadcast this notification to ${targetCount} users?`, async () => {
    const submitBtn = document.getElementById('bulkNotifySubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Broadcasting...';

    try {
      const body = {
        message,
        channel,
        notificationType
      };

      if (userIds) {
        body.userIds = userIds;
      } else {
        body.filter = target === 'all' ? {} : { subscriptionStatus: target };
      }

      const res = await adminApi('/admin/users/notify-bulk', {
        method: 'POST',
        body
      });

      showToast(`Broadcast completed: Sent to ${res.sent} owners, failed ${res.failed}.`, 'success');
      loadNotificationsSection();
    } catch (err) {
      showToast('Broadcast failed: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Broadcast';
    }
  });
}

async function loadNotificationHistoryTab() {
  const tbody = document.getElementById('broadcastHistoryTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="td-loading">Fetching history timeline logs...</td></tr>';

  try {
    // We get history by fetching users and flattening their notificationsSent array
    const data = await adminApi('/admin/users?limit=100'); // get recent 100 users
    if (!data || !data.users) return;

    const allTimeline = [];
    data.users.forEach(user => {
      if (user.notificationsSent) {
        user.notificationsSent.forEach(n => {
          allTimeline.push({
            ...n,
            recipientSalon: user.salonName,
            recipientEmail: user.email,
            userId: user.userId
          });
        });
      }
    });

    // Sort newest first
    allTimeline.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    tbody.innerHTML = '';

    if (allTimeline.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="td-empty">No broadcast or timeline messages logged yet.</td></tr>';
      return;
    }

    allTimeline.slice(0, 50).forEach(n => {
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>${n.sentAt ? formatDate(n.sentAt) : 'N/A'}</td>
        <td><strong>${esc(n.recipientSalon)}</strong><br><span style="font-size:12px; color:var(--text-secondary);">${esc(n.recipientEmail)}</span></td>
        <td style="text-transform: capitalize;">${esc(n.type.replace('_', ' '))}</td>
        <td style="text-transform: uppercase;">${esc(n.channel)}</td>
        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(n.message)}">
          ${esc(n.message)}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast('Failed to load logs: ' + err.message, 'error');
  }
}

// ─── REVENUE SECTION ──────────────────────────────────
function loadRevenue() {
  const statusSelect = document.getElementById('revenueStatusFilter');
  if (statusSelect) {
    statusSelect.replaceWith(statusSelect.cloneNode(true));
    document.getElementById('revenueStatusFilter').addEventListener('change', (e) => {
      state.revenueStatusFilter = e.target.value;
      renderRevenueData();
    });
  }

  renderRevenueData();
}

async function renderRevenueData() {
  const tbody = document.getElementById('revenueTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Compiling database ledgers...</td></tr>';

  try {
    const overview = await adminApi('/admin/analytics/overview');
    const data = await adminApi('/admin/users?limit=100'); // get recent 100 users to build transaction ledger
    if (!data || !data.users) return;

    // Render Metrics
    document.getElementById('revAllTime').textContent = formatCurrency(overview.mrr * 2.5); // Mock overall historical, or compute from payments
    document.getElementById('revThisMonth').textContent = formatCurrency(overview.revenueThisMonth || 0);
    document.getElementById('revMRR').textContent = formatCurrency(overview.mrr || 0);
    document.getElementById('revActiveSubs').textContent = overview.activeUsers || 0;

    // Build Transaction Ledger from user payment histories
    let ledger = [];
    let allTimeSum = 0;
    
    data.users.forEach(u => {
      if (u.paymentHistory) {
        u.paymentHistory.forEach(pay => {
          if (pay.status === 'captured') {
            allTimeSum += pay.amount;
          }
          ledger.push({
            ...pay,
            salonName: u.salonName,
            email: u.email
          });
        });
      }
    });

    // Update real All-time sum
    document.getElementById('revAllTime').textContent = formatCurrency(allTimeSum);

    // Sort newest first
    ledger.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

    // Filter
    if (state.revenueStatusFilter) {
      ledger = ledger.filter(p => p.status === state.revenueStatusFilter);
    }

    tbody.innerHTML = '';

    if (ledger.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="td-empty">No matching payments recorded.</td></tr>';
      return;
    }

    ledger.forEach(p => {
      const tr = document.createElement('tr');
      
      let statusClass = 'badge-expired';
      if (p.status === 'captured') statusClass = 'badge-active';
      else if (p.status === 'refunded') statusClass = 'badge-trial';

      tr.innerHTML = `
        <td>${p.paidAt ? formatDate(p.paidAt) : 'N/A'}</td>
        <td><strong>${esc(p.salonName)}</strong></td>
        <td>${esc(p.email)}</td>
        <td style="text-transform: uppercase;">${esc(p.plan || 'N/A')}</td>
        <td><strong>${formatCurrency(p.amount)}</strong></td>
        <td><span class="badge ${statusClass}">${esc(p.status)}</span></td>
        <td class="code-font">${esc(p.razorpayPaymentId || 'N/A')}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    showToast('Failed to load transaction details: ' + err.message, 'error');
  }
}

// ─── UTILITIES & HELPER DIALOGS ───────────────────────
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function daysUntil(isoString) {
  if (!isoString) return 0;
  const diffTime = new Date(isoString) - new Date();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// Global Custom Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  // Auto remove toast
  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Custom confirmation system (modal-based, bypasses blocking alerts)
function initConfirmModal() {
  const modal = document.getElementById('confirmModal');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  const okBtn = document.getElementById('confirmOkBtn');

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.classList.remove('show');
      state.confirmCallback = null;
    };
  }

  if (okBtn) {
    okBtn.onclick = () => {
      modal.classList.remove('show');
      if (typeof state.confirmCallback === 'function') {
        state.confirmCallback();
      }
      state.confirmCallback = null;
    };
  }
}

function showConfirm(message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const msgEl = document.getElementById('confirmMessage');
  
  if (modal && msgEl) {
    msgEl.textContent = message;
    state.confirmCallback = onConfirm;
    modal.classList.add('show');
  } else {
    // Fallback if modal DOM is somehow missing
    if (confirm(message)) {
      onConfirm();
    }
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    // Fallback
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}
