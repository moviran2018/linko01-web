// منطق صفحه مدیریت لینک‌ها
let currentPage = 1;
let totalPages = 1;
let searchQuery = '';
let searchTimeout = null;
// آخرین لیست بارگذاری‌شده برای پر کردن مودال ویرایش
let loadedLinks = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  initSidebar();
  loadLinks();

  // نمایش/پنهان‌کردن فیلدهای وابسته به چکباکس‌ها در فرم ساخت
  const cloakingBox = document.getElementById('cloaking_enabled');
  const deepLinkBox = document.getElementById('enable_deep_linking');
  const rotatorBox = document.getElementById('enable_rotator');

  if (cloakingBox) {
    cloakingBox.addEventListener('change', () => {
      document.getElementById('safeUrlGroup').style.display = cloakingBox.checked ? 'block' : 'none';
    });
  }
  if (deepLinkBox) {
    deepLinkBox.addEventListener('change', () => {
      const show = deepLinkBox.checked ? 'block' : 'none';
      document.getElementById('iosDeepLinkGroup').style.display = show;
      document.getElementById('androidDeepLinkGroup').style.display = show;
    });
  }
  if (rotatorBox) {
    rotatorBox.addEventListener('change', () => {
      document.getElementById('destinationsGroup').style.display = rotatorBox.checked ? 'block' : 'none';
      if (rotatorBox.checked && document.querySelectorAll('#destinationsList .dest-row').length === 0) {
        addDestination();
      }
    });
  }

  // همین رفتار برای فرم ویرایش
  const editCloakingBox = document.getElementById('edit_cloaking_enabled');
  const editDeepLinkBox = document.getElementById('edit_enable_deep_linking');
  const editRotatorBox = document.getElementById('edit_enable_rotator');

  if (editCloakingBox) {
    editCloakingBox.addEventListener('change', () => {
      document.getElementById('editSafeUrlGroup').style.display = editCloakingBox.checked ? 'block' : 'none';
    });
  }
  if (editDeepLinkBox) {
    editDeepLinkBox.addEventListener('change', () => {
      const show = editDeepLinkBox.checked ? 'block' : 'none';
      document.getElementById('editIosDeepLinkGroup').style.display = show;
      document.getElementById('editAndroidDeepLinkGroup').style.display = show;
    });
  }
  if (editRotatorBox) {
    editRotatorBox.addEventListener('change', () => {
      document.getElementById('editDestinationsGroup').style.display = editRotatorBox.checked ? 'block' : 'none';
      if (editRotatorBox.checked && document.querySelectorAll('#editDestinationsList .dest-row').length === 0) {
        addDestination('edit');
      }
    });
  }
});

// ---------- مقاصد چرخش لینک (روتور) ----------

// افزودن یک ردیف مقصد جدید به فرم
// prefix: '' برای فرم ساخت، 'edit_' برای فرم ویرایش
function addDestination(prefix = '') {
  const listId = prefix ? 'editDestinationsList' : 'destinationsList';
  const list = document.getElementById(listId);
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'dest-row';
  row.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';
  row.innerHTML = `
    <input type="url" class="input dest-url" placeholder="https://example.com/landing" style="flex: 3;">
    <input type="number" class="input dest-weight" placeholder="وزن" min="1" max="10000" value="100" style="flex: 1;">
    <button type="button" onclick="this.parentElement.remove()" class="btn-danger btn btn-sm" title="حذف">✕</button>
  `;
  list.appendChild(row);
}

// جمع‌آوری مقاصد از فرم
function collectDestinations(prefix = '') {
  const listId = prefix ? 'editDestinationsList' : 'destinationsList';
  const list = document.getElementById(listId);
  if (!list) return [];

  const rows = list.querySelectorAll('.dest-row');
  const destinations = [];
  rows.forEach((row) => {
    const url = row.querySelector('.dest-url').value.trim();
    const weight = parseInt(row.querySelector('.dest-weight').value) || 100;
    if (url) {
      destinations.push({ url, weight, is_active: true });
    }
  });
  return destinations;
}

async function loadLinks() {
  try {
    const data = await apiCall(`/links?page=${currentPage}&limit=10&search=${encodeURIComponent(searchQuery)}`);
    if (data.success) {
      const tbody = document.getElementById('linksTableBody');
      
      if (!data.data.links || data.data.links.length === 0) {
        loadedLinks = [];
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;">لینکی یافت نشد</td></tr>';
      } else {
        loadedLinks = data.data.links;
        tbody.innerHTML = data.data.links.map(link => `
          <tr>
            <td><a href="${getShortOrigin()}/${link.slug}" target="_blank" style="color: var(--primary); font-weight: 600;">/${link.slug}</a></td>
            <td style="font-weight: 600;">${link.title ? escapeHtml(link.title) : '<span style="color: var(--text-secondary); font-weight: 400;">بدون عنوان</span>'}</td>
            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${link.original_url}</td>
            <td>${formatNumber(link.click_count)}</td>
            <td>${link.is_active ? '<span style="color: #10b981; font-weight: 600;">فعال</span>' : '<span style="color: #ef4444; font-weight: 600;">غیرفعال</span>'}</td>
            <td>${formatDate(link.created_at)}</td>
            <td>
              <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                <button onclick="openEditModal(${link.id})" class="btn-outline btn btn-sm" title="ویرایش">✏️</button>
                <button onclick="copyLink('${link.slug}')" class="btn-outline btn btn-sm" title="کپی لینک کوتاه">📋</button>
                <a href="analytics.html?id=${link.id}" class="btn-outline btn btn-sm" title="تحلیل">📈</a>
                <button onclick="toggleStatus(${link.id}, ${link.is_active})" class="btn-outline btn btn-sm" title="فعال/غیرفعال">${link.is_active ? '⏸️' : '▶️'}</button>
                <button onclick="deleteLink(${link.id})" class="btn-danger btn btn-sm" title="حذف">🗑️</button>
              </div>
            </td>
          </tr>
        `).join('');
      }
      
      totalPages = Math.ceil(data.data.total / 10) || 1;
      document.getElementById('paginationInfo').textContent = `صفحه ${formatNumber(currentPage)} از ${formatNumber(totalPages)} - ${formatNumber(data.data.total)} لینک`;
      document.getElementById('prevBtn').disabled = currentPage <= 1;
      document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    }
  } catch (error) {
    showToast('خطا در بارگذاری لینک‌ها', 'error');
  }
}

function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = document.getElementById('searchInput').value;
    currentPage = 1;
    loadLinks();
  }, 300);
}

function changePage(delta) {
  currentPage += delta;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  loadLinks();
}

async function toggleStatus(id, currentStatus) {
  const data = await apiCall(`/links/${id}`, 'PUT', { is_active: !currentStatus });
  if (data.success) {
    showToast(currentStatus ? 'لینک غیرفعال شد' : 'لینک فعال شد');
    loadLinks();
  } else {
    showToast('خطا در تغییر وضعیت', 'error');
  }
}

async function deleteLink(id) {
  if (!confirm('آیا از حذف این لینک مطمئن هستید؟')) return;
  const data = await apiCall(`/links/${id}`, 'DELETE');
  if (data.success) {
    showToast('لینک حذف شد');
    loadLinks();
  } else {
    showToast('خطا در حذف لینک', 'error');
  }
}

// کپی لینک کوتاه: تابع copyLink در api.js تعریف شده است
// (در همه صفحات مشترک است تا داشبورد و صفحه لینک‌ها هر دو از آن استفاده کنند)

function openCreateModal() {
  document.getElementById('createModal').style.display = 'flex';
}

function closeCreateModal() {
  document.getElementById('createModal').style.display = 'none';
  document.getElementById('createForm').reset();
  document.getElementById('createForm').style.display = 'block';
  document.getElementById('createResult').style.display = 'none';
}

// کپی لینکی که تازه ساخته شده
async function copyCreatedLink() {
  const url = document.getElementById('createdUrl').textContent;
  try {
    await navigator.clipboard.writeText(url);
    showToast('لینک کپی شد');
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); showToast('لینک کپی شد'); }
    catch (err) { showToast('کپی نشد - آدرس را دستی کپی کنید', 'error'); }
    textarea.remove();
  }
}

document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    original_url: document.getElementById('original_url').value,
    slug: document.getElementById('slug').value || null,
    title: document.getElementById('title').value || null,
    max_clicks: document.getElementById('max_clicks').value ? parseInt(document.getElementById('max_clicks').value) : null,
    expires_at: document.getElementById('expires_at').value || null,
    cloaking_enabled: document.getElementById('cloaking_enabled').checked,
    safe_url: document.getElementById('safe_url').value || null,
    enable_deep_linking: document.getElementById('enable_deep_linking').checked,
    ios_deep_link: document.getElementById('ios_deep_link').value || null,
    android_deep_link: document.getElementById('android_deep_link').value || null,
    destinations: document.getElementById('enable_rotator').checked ? collectDestinations() : []
  };
  
  const data = await apiCall('/links', 'POST', payload);
  if (data.success) {
    // لینک کوتاه ساخته‌شده را با دکمه کپی نمایش می‌دهیم تا کاربر بلافاصله آن را کپی کند
    const shortUrl = `${getShortOrigin()}/${data.data.slug}`;
    document.getElementById('createdUrl').textContent = shortUrl;
    const hint = document.getElementById('slugHint');
    if (payload.slug && data.data.slug !== payload.slug) {
      hint.textContent = `اسلاگ درخواستی «${payload.slug}» در دسترس نبود، این اسلاگ جایگزین اختصاص داده شد.`;
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }
    document.getElementById('createForm').style.display = 'none';
    document.getElementById('createResult').style.display = 'block';
    showToast('لینک با موفقیت ساخته شد');
    loadLinks();
  } else {
    showToast(data.message || 'خطا در ساخت لینک', 'error');
  }
});

// ---------- ویرایش لینک ----------

// تبدیل تایم‌استمپ یونیکس به فرمت قابل استفاده در input[type=datetime-local]
function toDateTimeLocal(unix) {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openEditModal(id) {
  // ابتدا در لیست بارگذاری‌شده می‌گردیم (سریع و بدون درخواست اضافه)
  const link = loadedLinks.find(l => String(l.id) === String(id));
  if (!link) {
    showToast('اطلاعات لینک یافت نشد، دوباره تلاش کنید', 'error');
    return;
  }
  document.getElementById('editLinkId').value = link.id;
  document.getElementById('edit_original_url').value = link.original_url || '';
  document.getElementById('edit_slug').value = link.slug || '';
  document.getElementById('edit_title').value = link.title || '';
  document.getElementById('edit_max_clicks').value = link.max_clicks || '';
  document.getElementById('edit_expires_at').value = toDateTimeLocal(link.expires_at);
  document.getElementById('edit_is_active').checked = !!link.is_active;

  // کلاکینگ
  document.getElementById('edit_cloaking_enabled').checked = !!link.cloaking_enabled;
  document.getElementById('edit_safe_url').value = link.safe_url || '';
  document.getElementById('editSafeUrlGroup').style.display = link.cloaking_enabled ? 'block' : 'none';

  // دیپ‌لینک
  document.getElementById('edit_enable_deep_linking').checked = !!link.enable_deep_linking;
  document.getElementById('edit_ios_deep_link').value = link.ios_deep_link || '';
  document.getElementById('edit_android_deep_link').value = link.android_deep_link || '';
  const deepShow = link.enable_deep_linking ? 'block' : 'none';
  document.getElementById('editIosDeepLinkGroup').style.display = deepShow;
  document.getElementById('editAndroidDeepLinkGroup').style.display = deepShow;

  // روتور: مقاصد موجود را نمایش می‌دهیم
  const editList = document.getElementById('editDestinationsList');
  editList.innerHTML = '';
  const hasDestinations = link.destinations && link.destinations.length > 0;
  document.getElementById('edit_enable_rotator').checked = hasDestinations;
  document.getElementById('editDestinationsGroup').style.display = hasDestinations ? 'block' : 'none';
  if (hasDestinations) {
    link.destinations.forEach((d) => {
      addDestination('edit');
      const rows = editList.querySelectorAll('.dest-row');
      const lastRow = rows[rows.length - 1];
      lastRow.querySelector('.dest-url').value = d.url;
      lastRow.querySelector('.dest-weight').value = d.weight;
    });
  }

  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  document.getElementById('editForm').reset();
}

document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('editLinkId').value;
  const payload = {
    original_url: document.getElementById('edit_original_url').value,
    slug: document.getElementById('edit_slug').value || null,
    title: document.getElementById('edit_title').value || null,
    max_clicks: document.getElementById('edit_max_clicks').value ? parseInt(document.getElementById('edit_max_clicks').value) : null,
    expires_at: document.getElementById('edit_expires_at').value || null,
    is_active: document.getElementById('edit_is_active').checked,
    cloaking_enabled: document.getElementById('edit_cloaking_enabled').checked,
    safe_url: document.getElementById('edit_safe_url').value || null,
    enable_deep_linking: document.getElementById('edit_enable_deep_linking').checked,
    ios_deep_link: document.getElementById('edit_ios_deep_link').value || null,
    android_deep_link: document.getElementById('edit_android_deep_link').value || null,
    destinations: document.getElementById('edit_enable_rotator').checked ? collectDestinations('edit') : []
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';

  const data = await apiCall(`/links/${id}`, 'PUT', payload);
  btn.disabled = false;
  btn.textContent = 'ذخیره تغییرات';

  if (data.success) {
    showToast('تغییرات ذخیره شد');
    closeEditModal();
    loadLinks();
  } else {
    showToast(data.message || 'خطا در ذخیره تغییرات', 'error');
  }
});
