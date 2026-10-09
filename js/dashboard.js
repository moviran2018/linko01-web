// منطق صفحه داشبورد
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  initSidebar();
  loadDashboard();
});

async function loadDashboard() {
  try {
    const data = await apiCall('/analytics/overview');
    if (data.success) {
      document.getElementById('totalLinks').textContent = formatNumber(data.data.total_links);
      document.getElementById('totalClicks').textContent = formatNumber(data.data.total_clicks);
      document.getElementById('activeLinks').textContent = formatNumber(data.data.active_links);
      document.getElementById('clicks7d').textContent = formatNumber(data.data.clicks_last_7_days);
      
      const tbody = document.getElementById('topLinksBody');
      if (!data.data.top_links || data.data.top_links.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">هنوز لینکی ساخته نشده است</td></tr>';
      } else {
        tbody.innerHTML = data.data.top_links.map(link => `
          <tr>
            <td style="display: flex; align-items: center; gap: 0.5rem;">
              <a href="${getShortOrigin()}/${link.slug}" target="_blank" style="color: var(--primary); font-weight: 600;">/${link.slug}</a>
              <button onclick="copyLink('${link.slug}')" class="btn-outline btn btn-sm" title="کپی لینک کوتاه">📋</button>
            </td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${link.original_url}</td>
            <td>${formatNumber(link.click_count)}</td>
            <td>${formatNumber(link.unique_click_count)}</td>
          </tr>
        `).join('');
      }
    }
  } catch (error) {
    showToast('خطا در بارگذاری داده‌ها', 'error');
  }
}

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
    loadDashboard();
  } else {
    showToast(data.message || 'خطا در ساخت لینک', 'error');
  }
});
