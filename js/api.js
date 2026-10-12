// Linkma API Client - لایه ارتباط با سرور
// API_BASE به‌صورت خودکار تنظیم می‌شود:
//  - روی Worker (همان origin): "/api"
//  - روی GitHub Pages (origin متفاوت): آدرس کامل Worker
// در صورت تنظیم manual، از window.LINKMA_API_BASE استفاده می‌شود.
function resolveApiBase() {
  if (window.LINKMA_API_BASE) return window.LINKMA_API_BASE;
  // هرجا که برنامه سرو شود، مسیر "/api" همان origin است؛ مگر اینکه origin دیگری صریحاً داده شود
  return '/api';
}
const API_BASE = resolveApiBase();

// توکن را از localStorage می‌گیرد
function getToken() {
  return localStorage.getItem('linkma_token');
}

// پیشوند مسیر فایل‌های استاتیک:
//  - روی Worker: "/" (ریشه)
//  - روی GitHub Pages: "/linko01-web/" (زیرمسیر پروژه)
// با تنظیم window.LINKMA_BASE_PATH می‌توان آن را override کرد.
function resolveBasePath() {
  if (window.LINKMA_BASE_PATH) return window.LINKMA_BASE_PATH;
  return '/';
}
const BASE_PATH = resolveBasePath();

// مهاجرت یک‌بارهٔ کلیدهای localStorage (تغییر برند Linko → Linkma)
// نشست کاربران فعلی حفظ می‌شود: اگر کلید جدید خالی است، مقدار کلید قدیمی منتقل می‌شود.
(function migrateOldStorageKeys() {
  const KEY_MAP = {
    linko_token: 'linkma_token',
    linko_username: 'linkma_username',
    linko_role: 'linkma_role',
    linko_user: 'linkma_user',
    linko_theme: 'linkma_theme',
    linko_dir: 'linkma_dir',
    linko_lang: 'linkma_lang',
  };
  try {
    for (const oldKey in KEY_MAP) {
      const newKey = KEY_MAP[oldKey];
      if (localStorage.getItem(newKey) === null) {
        const value = localStorage.getItem(oldKey);
        if (value !== null) localStorage.setItem(newKey, value);
      }
      localStorage.removeItem(oldKey);
    }
  } catch (e) {
    // localStorage ممکن است در برخی محیط‌ها در دسترس نباشد؛ نادیده می‌گیریم
  }
})();

// ساخت یک مسیر نسبی به صفحه ادمین با توجه به پیشوند مسیر
function adminPath(path) {
  return BASE_PATH.replace(/\/$/, '') + path;
}

// بررسی احراز هویت - اگر توکن نبود به صفحه ورود هدایت می‌کند
function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = adminPath('/admin/login.html');
    return false;
  }
  return true;
}

// خروج از حساب
function logout() {
  localStorage.removeItem('linkma_token');
  localStorage.removeItem('linkma_username');
  localStorage.removeItem('linkma_role');
  localStorage.removeItem('linkma_user');
  window.location.href = adminPath('/admin/login.html');
}

// اطلاعات کاربر جاری را از سرور می‌گیرد و در localStorage ذخیره می‌کند
// (نقش کاربر برای نمایش/پنهان کردن بخش‌های مدیریتی لازم است)
let _currentUserPromise = null;
function getCurrentUser() {
  if (_currentUserPromise) return _currentUserPromise;
  _currentUserPromise = apiCall('/auth/me').then(data => {
    if (data.success && data.data) {
      localStorage.setItem('linkma_username', data.data.username);
      localStorage.setItem('linkma_role', data.data.role);
      localStorage.setItem('linkma_user', JSON.stringify(data.data));
    }
    return data;
  }).catch(() => null);
  return _currentUserPromise;
}

// آیا کاربر جاری مدیر اصلی است؟ (از کش localStorage)
function isAdmin() {
  return localStorage.getItem('linkma_role') === 'admin';
}

// راه‌اندازی نوار کناری:
//  - لینک‌های مربوط به مدیر فقط برای ادمین نمایش داده می‌شوند
//  - نام کاربری و میزان استفاده از سهمیه در پایین نوار کناری نشان داده می‌شود
async function initSidebar() {
  // لینک‌های ادمین پیش از تایید نقش مخفی می‌مانند
  document.querySelectorAll('.nav-admin-only').forEach(el => {
    el.style.display = 'none';
  });

  try {
    const data = await getCurrentUser();
    if (!data || !data.success || !data.data) return;
    const me = data.data;

    if (me.role === 'admin') {
      document.querySelectorAll('.nav-admin-only').forEach(el => {
        el.style.display = '';
      });
    }

    // افزودن کارت حساب کاربری و نوار سهمیه به انتهای نوار کناری
    const existing = document.getElementById('accountWidget');
    if (existing) existing.remove();

    let quotaHtml = '';
    if (me.role !== 'admin') {
      const used = me.links_used || 0;
      const quota = me.link_quota; // null یعنی سهمیهٔ پیش‌فرض سامانه
      let quotaText, percent;
      if (quota === -1) {
        quotaText = 'نامحدود';
        percent = 4;
      } else if (quota === null || quota === undefined) {
        quotaText = `${formatNumber(used)} لینک ساخته‌اید`;
        percent = 8;
      } else {
        quotaText = `${formatNumber(used)} از ${formatNumber(quota)} لینک`;
        percent = Math.min(100, Math.round((used / quota) * 100));
        if (used >= quota) quotaText = `سهمیه تمام شده — ${quotaText}`;
      }
      quotaHtml = `
        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
            <span>سهمیهٔ ساخت لینک</span>
            <span>${quotaText}</span>
          </div>
          <div style="height: 6px; background: var(--secondary); border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; width: ${percent}%; background: ${used >= (quota || Infinity) ? '#ef4444' : 'var(--primary)'}; border-radius: 3px; transition: width 0.3s;"></div>
          </div>
        </div>`;
    }

    const widget = document.createElement('div');
    widget.id = 'accountWidget';
    widget.style.cssText = 'margin-top: auto; padding: 1rem; background: var(--secondary); border-radius: 0.75rem; font-size: 0.85rem;';
    widget.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">${escapeHtml(me.username.charAt(0).toUpperCase())}</span>
        <div style="overflow: hidden;">
          <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(me.username)}</div>
          <div style="color: var(--text-secondary); font-size: 0.75rem;">${me.role === 'admin' ? 'مدیر اصلی' : 'کاربر'}</div>
        </div>
      </div>
      ${quotaHtml}
      <a href="${adminPath('/admin/settings.html')}" style="display: block; margin-top: 0.75rem; text-align: center; color: var(--primary); text-decoration: none; font-size: 0.8rem;">مدیریت حساب</a>
    `;

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.appendChild(widget);
  } catch (e) {
    console.error('initSidebar error:', e);
  }
}

// فراخوانی API با هدر احراز هویت
// نکته: endpoint باید بدون "/api" شروع شود، چون API_BASE آن را اضافه می‌کند.
// مثال: apiCall('/links?page=1')
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const res = await fetch(API_BASE + endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    
    // اگر توکن منقضی شده بود
    if (res.status === 401) {
      localStorage.removeItem('linkma_token');
      window.location.href = adminPath('/admin/login.html');
      return { success: false, message: 'نشست شما منقضی شده است' };
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'خطا در ارتباط با سرور' };
  }
}

// نمایش پیام موقت (Toast)
function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.borderInlineStart = type === 'error' ? '4px solid #ef4444' : '4px solid #10b981';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// کپی لینک کوتاه در کلیپ‌بورد
// نکته: لینک کوتاه باید از origin ورکر ساخته شود، نه origin صفحه.
// روی Worker این دو یکی است؛ روی GitHub Pages، LINKMA_SHORT_ORIGIN تنظیم می‌شود.
function getShortOrigin() {
  if (window.LINKMA_SHORT_ORIGIN) return window.LINKMA_SHORT_ORIGIN;
  return window.location.origin;
}

async function copyLink(slug) {
  const shortUrl = `${getShortOrigin()}/${slug}`;
  try {
    await navigator.clipboard.writeText(shortUrl);
    showToast(`لینک کپی شد: ${shortUrl}`);
  } catch (error) {
    // روش جایگزین برای مرورگرهای قدیمی یا ارتباطات ناامن (HTTP)
    const textarea = document.createElement('textarea');
    textarea.value = shortUrl;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(`لینک کپی شد: ${shortUrl}`);
    } catch (err) {
      showToast('کپی نشد - این آدرس را دستی کپی کنید: ' + shortUrl, 'error');
    }
    textarea.remove();
  }
}

// قالب‌بندی اعداد به فارسی
function formatNumber(num) {
  return (num || 0).toLocaleString('fa-IR');
}

// قالب‌بندی تاریخ
function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString('fa-IR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// جلوگیری از اجرای کدهای مخرب (XSS) هنگام نمایش متن کاربر در HTML
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}
