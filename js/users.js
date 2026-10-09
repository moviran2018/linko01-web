// منطق صفحه مدیریت کاربران (فقط مدیر اصلی)
// مدیر می‌تواند پنل کاربری بسازد، سهمیه تعیین کند و کاربران را مسدود/فعال کند.
// حذف یک کاربر هرگز لینک‌های او را پاک نمی‌کند — لینک‌ها به مدیر اصلی منتقل می‌شوند.
let usersList = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  // فقط مدیر اصلی به این صفحه دسترسی دارد
  if (!isAdmin()) {
    document.querySelector('.main-content').innerHTML =
      '<div class="card" style="text-align: center; padding: 3rem;">' +
      '<p style="color: var(--text-secondary);">این صفحه فقط برای مدیر اصلی سایت قابل دسترسی است.</p>' +
      '<a href="dashboard.html" class="btn" style="display: inline-block; margin-top: 1rem; text-decoration: none;">بازگشت به داشبورد</a>' +
      '</div>';
    return; // کاربر عادی نباید لیست کاربران را درخواست کند (۴۰۳ برمی‌گرداند)
  }
  initSidebar();
  loadUsers();
});

async function loadUsers() {
  try {
    const data = await apiCall('/users');
    const tbody = document.getElementById('usersBody');
    if (data.success && data.data) {
      usersList = data.data.users || [];
      renderUsers();
    } else if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;">' +
        (data.message || 'خطا در دریافت لیست کاربران') + '</td></tr>';
    }
  } catch (e) {
    console.error('loadUsers error:', e);
  }
}

function quotaLabel(quota) {
  if (quota === -1) return 'نامحدود';
  if (quota === null || quota === undefined) return 'پیش‌فرض سامانه';
  return formatNumber(quota);
}

function renderUsers() {
  const tbody = document.getElementById('usersBody');
  if (!tbody) return;

  if (!usersList.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;">' +
      'هنوز کاربری ساخته نشده است.</td></tr>';
    return;
  }

  tbody.innerHTML = usersList.map(u => {
    const isAdminRow = u.role === 'admin';
    const statusBadge = isAdminRow
      ? '<span style="padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; background: rgba(59,130,246,0.15); color: var(--primary);">مدیر اصلی</span>'
      : (u.is_active === 1
        ? '<span style="padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; background: rgba(16,185,129,0.15); color: #10b981;">فعال</span>'
        : '<span style="padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; background: rgba(239,68,68,0.15); color: #ef4444;">مسدود</span>');

    // مدیر اصلی قابل مسدود یا حذف نیست
    const actions = isAdminRow
      ? '<span style="color: var(--text-secondary); font-size: 0.8rem;">—</span>'
      : `<button onclick="openEditUserModal(${u.id})" class="btn btn-sm" style="margin-left: 0.35rem;">ویرایش</button>
         <button onclick="toggleBlock(${u.id})" class="btn btn-sm btn-outline">${u.is_active === 1 ? 'مسدود کردن' : 'فعال کردن'}</button>
         <button onclick="deleteUser(${u.id})" class="btn btn-sm" style="background: rgba(239,68,68,0.12); color: #ef4444; border: none;">حذف</button>`;

    return `<tr>
      <td style="font-weight: 600;">${escapeHtml(u.username)}</td>
      <td>${isAdminRow ? 'مدیر' : 'کاربر'}</td>
      <td>${statusBadge}</td>
      <td>${formatNumber(u.link_count || 0)}</td>
      <td>${quotaLabel(u.link_quota)}</td>
      <td>${formatDate(u.created_at)}</td>
      <td style="white-space: nowrap;">${actions}</td>
    </tr>`;
  }).join('');
}


// ===== ساخت کاربر جدید =====
function openCreateUserModal() {
  document.getElementById('createUserForm').reset();
  document.getElementById('createUserModal').style.display = 'flex';
}

function closeCreateUserModal() {
  document.getElementById('createUserModal').style.display = 'none';
}

async function createUser(event) {
  event.preventDefault();
  const username = document.getElementById('new_username_input').value.trim();
  const password = document.getElementById('new_password_input').value;
  const quotaRaw = document.getElementById('new_quota_input').value.trim();

  const payload = { username, password };
  if (quotaRaw !== '') payload.link_quota = parseInt(quotaRaw, 10);

  const data = await apiCall('/users', 'POST', payload);
  if (data.success) {
    showToast('پنل کاربری ساخته شد');
    closeCreateUserModal();
    document.getElementById('createUserForm').reset();
    await loadUsers();
    initSidebar();
  } else {
    showToast(data.message || 'خطا در ساخت کاربر', 'error');
  }
  return false;
}

// ===== ویرایش کاربر =====
function openEditUserModal(id) {
  const u = usersList.find(x => x.id === id);
  if (!u) return;

  document.getElementById('edit_user_id').value = u.id;
  document.getElementById('editUserTitle').textContent = u.username;
  document.getElementById('edit_quota').value = (u.link_quota === null || u.link_quota === undefined) ? '' : u.link_quota;
  document.getElementById('edit_password').value = '';
  setActiveState(u.is_active === 1);
  document.getElementById('editUserModal').style.display = 'flex';
}

function closeEditUserModal() {
  document.getElementById('editUserModal').style.display = 'none';
}

function setActiveState(active) {
  document.getElementById('edit_is_active').value = active ? '1' : '0';
  const activeBtn = document.getElementById('activeBtn');
  const blockedBtn = document.getElementById('blockedBtn');
  activeBtn.style.background = active ? 'var(--primary)' : '';
  activeBtn.style.color = active ? 'white' : '';
  blockedBtn.style.background = !active ? 'var(--primary)' : '';
  blockedBtn.style.color = !active ? 'white' : '';
}

async function updateUser(event) {
  event.preventDefault();
  const id = document.getElementById('edit_user_id').value;
  const isActive = document.getElementById('edit_is_active').value === '1';
  const quotaRaw = document.getElementById('edit_quota').value.trim();
  const password = document.getElementById('edit_password').value;

  const payload = { is_active: isActive };
  if (quotaRaw !== '') payload.link_quota = parseInt(quotaRaw, 10);
  if (password) payload.password = password;

  const data = await apiCall(`/users/${id}`, 'PUT', payload);
  if (data.success) {
    showToast('اطلاعات کاربر به‌روزرسانی شد');
    closeEditUserModal();
    await loadUsers();
  } else {
    showToast(data.message || 'خطا در به‌روزرسانی کاربر', 'error');
  }
  return false;
}

// ===== مسدود/فعال کردن سریع =====
async function toggleBlock(id) {
  const u = usersList.find(x => x.id === id);
  if (!u) return;

  const newActive = u.is_active === 1 ? 0 : 1;
  const data = await apiCall(`/users/${id}`, 'PUT', { is_active: newActive });
  if (data.success) {
    showToast(newActive === 1 ? `حساب «${u.username}» فعال شد` : `حساب «${u.username}» مسدود شد`);
    await loadUsers();
  } else {
    showToast(data.message || 'خطا در تغییر وضعیت کاربر', 'error');
  }
}

// ===== حذف کاربر (لینک‌ها به مدیر اصلی منتقل می‌شوند) =====
async function deleteUser(id) {
  const u = usersList.find(x => x.id === id);
  if (!u) return;

  const linkCount = u.link_count || 0;
  const confirmMsg = linkCount > 0
    ? `آیا از حذف کاربر «${u.username}» مطمئن هستید؟\n\n${formatNumber(linkCount)} لینکِ این کاربر به مدیر اصلی منتقل می‌شود و حذف نخواهد شد.`
    : `آیا از حذف کاربر «${u.username}» مطمئن هستید؟`;

  if (!confirm(confirmMsg)) return;

  const data = await apiCall(`/users/${id}`, 'DELETE');
  if (data.success) {
    showToast(data.message || 'کاربر حذف شد');
    await loadUsers();
  } else {
    showToast(data.message || 'خطا در حذف کاربر', 'error');
  }
}
