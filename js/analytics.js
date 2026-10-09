// منطق صفحه تحلیل‌ها - نمودارهای SVG سبک
let currentLinkId = null;
let currentPeriod = '7d';

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  initSidebar();

  const urlParams = new URLSearchParams(window.location.search);
  const linkIdFromUrl = urlParams.get('id');
  loadLinkSelect(linkIdFromUrl);
});

async function loadLinkSelect(selectedId) {
  try {
    const data = await apiCall('/links?page=1&limit=100');
    if (data.success) {
      const select = document.getElementById('linkSelect');
      select.innerHTML = '<option value="">انتخاب لینک...</option>';
      
      data.data.links.forEach(link => {
        const option = document.createElement('option');
        option.value = link.id;
        option.textContent = `/${link.slug} - ${link.click_count} کلیک`;
        if (selectedId && link.id === parseInt(selectedId)) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      
      if (selectedId) {
        currentLinkId = parseInt(selectedId);
        loadAnalytics();
      }
    }
  } catch (error) {
    showToast('خطا در بارگذاری لینک‌ها', 'error');
  }
}

function setPeriod(period) {
  currentPeriod = period;
  ['24h', '7d', '30d'].forEach(p => {
    document.getElementById(`btn-${p}`).style.background = p === period ? 'var(--primary)' : '';
    document.getElementById(`btn-${p}`).style.color = p === period ? 'white' : '';
  });
  loadAnalytics();
}

async function loadAnalytics() {
  const select = document.getElementById('linkSelect');
  currentLinkId = parseInt(select.value);
  
  if (!currentLinkId) {
    document.getElementById('analyticsContent').style.display = 'none';
    document.getElementById('noSelection').style.display = 'block';
    return;
  }
  
  document.getElementById('analyticsContent').style.display = 'block';
  document.getElementById('noSelection').style.display = 'none';
  
  try {
    const data = await apiCall(`/analytics/links/${currentLinkId}?period=${currentPeriod}`);
    if (data.success) {
      renderOverview(data.data);
      renderTimeSeries(data.data.time_series);
      renderBarChart('geoChart', data.data.geo, 'country');
      renderBarChart('deviceChart', data.data.devices, 'device_type');
      renderBarChart('osChart', data.data.os, 'os');
      renderBarChart('browserChart', data.data.browsers, 'browser');
      renderBarChart('referrerChart', data.data.referrers, 'referrer');
    }
  } catch (error) {
    showToast('خطا در بارگذاری تحلیل‌ها', 'error');
  }
}

function renderOverview(data) {
  const link = data.link;
  const countries = new Set(data.geo.map(g => g.country).filter(Boolean));
  
  document.getElementById('totalClicks').textContent = formatNumber(link.click_count);
  document.getElementById('uniqueClicks').textContent = formatNumber(link.unique_click_count);
  document.getElementById('countryCount').textContent = formatNumber(countries.size);
  
  const topDevice = data.devices.length > 0 ? data.devices[0].device_type : '-';
  const deviceNames = { mobile: 'موبایل', desktop: 'دسکتاپ', tablet: 'تبلت' };
  document.getElementById('topDevice').textContent = deviceNames[topDevice] || topDevice;
}


function renderTimeSeries(timeSeries) {
  const container = document.getElementById('timeSeriesChart');
  
  if (!timeSeries || timeSeries.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">داده‌ای برای این بازه وجود ندارد</p>';
    return;
  }
  
  const width = 800;
  const height = 250;
  const padding = 40;
  const maxClicks = Math.max(...timeSeries.map(t => t.total), 1);
  const barWidth = (width - padding * 2) / timeSeries.length;
  
  let bars = '';
  timeSeries.forEach((point, index) => {
    const barHeight = (point.total / maxClicks) * (height - padding * 2);
    const x = padding + index * barWidth;
    const y = height - padding - barHeight;
    
    bars += `<rect class="bar" x="${x + barWidth * 0.2}" y="${y}" width="${barWidth * 0.6}" height="${barHeight}" fill="url(#barGradient)" rx="4">
      <title>${point.date}: ${point.total} کلیک (${point.unique_clicks} یکتا)</title>
    </rect>`;
  });
  
  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const y = padding + (height - padding * 2) * i / 4;
    const value = Math.round(maxClicks * (1 - i / 4));
    gridLines += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="var(--border)" stroke-dasharray="4"/>
      <text x="${padding - 5}" y="${y + 4}" text-anchor="end" fill="var(--text-secondary)" font-size="10">${value}</text>`;
  }
  
  let dateLabels = '';
  timeSeries.forEach((point, index) => {
    const x = padding + index * barWidth + barWidth / 2;
    if (timeSeries.length <= 10 || index % Math.ceil(timeSeries.length / 10) === 0) {
      dateLabels += `<text x="${x}" y="${height - padding + 15}" text-anchor="middle" fill="var(--text-secondary)" font-size="9" transform="rotate(-30, ${x}, ${height - padding + 15})">${point.date}</text>`;
    }
  });
  
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%;">
      <defs>
        <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
        </linearGradient>
      </defs>
      ${gridLines}
      ${bars}
      ${dateLabels}
    </svg>
  `;
}

function renderBarChart(containerId, data, key) {
  const container = document.getElementById(containerId);
  
  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">داده‌ای موجود نیست</p>';
    return;
  }
  
  const maxValue = Math.max(...data.map(d => d.count), 1);
  
  container.innerHTML = data.map(item => {
    const percent = (item.count / maxValue) * 100;
    const label = item[key] || 'نامشخص';
    return `
      <div style="margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.875rem;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">${label}</span>
          <span style="color: var(--text-secondary);">${formatNumber(item.count)}</span>
        </div>
        <div style="background: var(--bg-secondary); border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transition: width 0.5s;"></div>
        </div>
      </div>
    `;
  }).join('');
}

async function exportData(format) {
  if (!currentLinkId) return;
  
  const token = getToken();
  const url = `${API_BASE}/analytics/links/${currentLinkId}/export?format=${format}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (format === 'json') {
      const data = await res.json();
      downloadFile(JSON.stringify(data, null, 2), `linko-analytics.json`, 'application/json');
    } else {
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `linko-analytics.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    showToast('خروجی با موفقیت دانلود شد');
  } catch (error) {
    showToast('خطا در دانلود خروجی', 'error');
  }
}

function downloadFile(content, filename, type) {
  const blob = new Blob(['\uFEFF' + content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
