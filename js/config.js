// تنظیمات استقرار Linkma روی GitHub Pages
//
// این فایل برای زمانی است که فرانت‌اند روی GitHub Pages سرو می‌شود،
// در حالی که API روی Cloudflare Worker است (origin متفاوت).
//
// تشخیص خودکار: فقط وقتی فعال می‌شود که صفحه از origin گیت‌هاب سرو شده باشد.
// روی Worker خودش هیچ اثری ندارد (چون LINKMA_API_BASE از قبل "/api" است).
(function () {
  const host = window.location.hostname;
  if (host.indexOf('github.io') === -1) return; // روی Worker بدون تغییر می‌ماند
  // آدرس ورکر (API + ریدایرکت لینک‌های کوتاه)
  const WORKER_ORIGIN = 'https://linkma.ir';
  window.LINKMA_API_BASE = WORKER_ORIGIN + '/api';
  window.LINKMA_SHORT_ORIGIN = WORKER_ORIGIN;
  // پیشوند مسیر پروژه در GitHub Pages: /<repo-name>/
  // از اولین بخش مسیر استفاده می‌شود.
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  window.LINKMA_BASE_PATH = parts.length > 0 ? '/' + parts[0] + '/' : '/';
})();
