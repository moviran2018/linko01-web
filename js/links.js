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
});

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
    expires_at: document.getElementById('expires_at').value || null
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
    is_active: document.getElementById('edit_is_active').checked
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
