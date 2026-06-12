const EPD = new EpdNrf5Client();
let autoRefreshEnabled = false;
let refreshIntervalMinutes = 30;
let autoRefreshTimer = null;
let nextRefreshAt = null;
let lastRefreshAt = null;
let customImage = null;
let isSending = false;
let lastTransferStatusAt = 0;
let templateFromUrl = false;
let storedTemplateIdBeforeUrlPreview = 'handdraw_card';
const disabledSubheadlineText = '此模版不可用副文案~.~';

// 数据模型
const codexQuotaStatus = {
  five_hour_percent: 49, seven_day_percent: 71,
  daily_total_tokens: 8523043,
  refresh_5h: '19:51', refresh_7d: '06/11',
  updated_at: '18:58', next_refresh_at: '19:51',
  status_label: '状态温热', headline: '省着点用...', subheadline: '当前能量消耗较快，建议控制使用频率', 
  date_text: '6/5 周五', ble_status: '' 
};

const weatherStatus = {
  ok: false,
  updated_at: '--:--',
  interval_hours: 1,
  location_name: '夏良',
  summary: '未来天气',
  now: { temp: '--', text: '待刷新', icon: '' },
  hours: [
    { time: '--时', text: '--', temp: '--', is_rain: false },
    { time: '--时', text: '--', temp: '--', is_rain: false },
    { time: '--时', text: '--', temp: '--', is_rain: false },
    { time: '--时', text: '--', temp: '--', is_rain: false },
  ],
  error: '',
};

const userDefaults = {
  title: 'Codex plus', headline: '省着点用...', subHeadline: '当前能量消耗较快，建议控制使用频率', highlightText: '省着点',
  driver: '03', screenPreset: '4.2_400_300', colorMode: 'bwr',
  refreshInterval: 30, autoRefresh: false, invertBlack: false, invertRed: false,
  templateId: 'handdraw_card', autoIconThemeId: 'brain', weatherInterval: '1',
};

const screenPresets = {
  '2.13_122_250': { w: 250, h: 122 }, '2.13_104_212': { w: 212, h: 104 },
  '2.9_128_296': { w: 296, h: 128 }, '4.2_400_300': { w: 400, h: 300 },
};

const autoIconThemes = [
  { id: 'brain', label: '脑量涂鸦' },
  { id: 'cat', label: '元气小猫' },
  { id: 'bunny', label: '打气兔兔' },
  { id: 'robot', label: '乖巧机器人' },
  { id: 'coffee', label: '咖啡小杯' },
  { id: 'cloud', label: '软软小云' },
];

const quotaBands = [
  { id: 'high', label: '81-100', min: 81, max: 100 },
  { id: 'healthy', label: '61-80', min: 61, max: 80 },
  { id: 'warm', label: '41-60', min: 41, max: 60 },
  { id: 'hot', label: '21-40', min: 21, max: 40 },
  { id: 'low', label: '0-20', min: 0, max: 20 },
];

const defaultStatusThemes = [
  { id: 'status_default', name: '满血复活主题', bands: { high: '满血复活', healthy: '电量健康', warm: '脑袋温热', hot: '脑袋发烫', low: '人都麻了' } },
  { id: 'status_xiuxian', name: '灵气充盈主题', bands: { high: '灵气充盈', healthy: '道心稳定', warm: '丹田微热', hot: '经脉冒烟', low: '原地渡劫' } },
  { id: 'status_work', name: '工位满电主题', bands: { high: '工位满电', healthy: '还能加班', warm: '开始摸鱼', hot: '快到极限', low: '下班保命' } },
  { id: 'status_mecha', name: '核心满载主题', bands: { high: '核心满载', healthy: '推进稳定', warm: '装甲升温', hot: '警报闪烁', low: '紧急停机' } },
  { id: 'status_coffee', name: '咖力爆棚主题', bands: { high: '咖力爆棚', healthy: '杯中有劲', warm: '苦味上头', hot: '手有点抖', low: '杯底见光' } },
];

const defaultHeadlineThemes = [
  { id: 'headline_default', name: '随便造主题', bands: { high: { headline: '随便造！！', highlight: '随便造' }, healthy: { headline: '还能打！！', highlight: '还能打' }, warm: { headline: '省着点用...', highlight: '省着点' }, hot: { headline: '别猛冲了！！', highlight: '别猛冲' }, low: { headline: '快歇会儿！！', highlight: '快歇会儿' } } },
  { id: 'headline_boss', name: '放开干主题', bands: { high: { headline: '放开干！！', highlight: '放开干' }, healthy: { headline: '继续推进！！', highlight: '继续' }, warm: { headline: '稳一点来...', highlight: '稳一点' }, hot: { headline: '先别硬刚！！', highlight: '别硬刚' }, low: { headline: '这锅别接！！', highlight: '别接' } } },
  { id: 'headline_daoist', name: '灵感爆棚主题', bands: { high: { headline: '灵感爆棚！！', highlight: '灵感' }, healthy: { headline: '代码有光！！', highlight: '有光' }, warm: { headline: '道心别乱...', highlight: '别乱' }, hot: { headline: '天机快漏了！！', highlight: '快漏' }, low: { headline: '速速收手！！', highlight: '收手' } } },
  { id: 'headline_power', name: '火力全开主题', bands: { high: { headline: '火力全开！！', highlight: '火力' }, healthy: { headline: '稳定供能！！', highlight: '稳定' }, warm: { headline: '降低负载...', highlight: '降低' }, hot: { headline: '机组过热！！', highlight: '过热' }, low: { headline: '马上断电！！', highlight: '断电' } } },
  { id: 'headline_partner', name: '今天很勇主题', bands: { high: { headline: '今天很勇！！', highlight: '很勇' }, healthy: { headline: '状态不错！！', highlight: '不错' }, warm: { headline: '慢慢来吧...', highlight: '慢慢来' }, hot: { headline: '先喝口水！！', highlight: '喝口水' }, low: { headline: '别卷了！！', highlight: '别卷' } } },
];

let quotaThemeSettings = normalizeThemeSettings();

function getEl(id) { return document.getElementById(id); }

function setDisabledSubheadlineText() {
  const el = getEl('cfg-subheadline');
  if (!el) return;
  el.value = disabledSubheadlineText;
  el.disabled = true;
}

function getQuotaCopy(percent) {
  const band = getQuotaBand(percent);
  const statusTheme = getCurrentStatusTheme();
  const headlineTheme = getCurrentHeadlineTheme();
  const headlineCopy = headlineTheme.bands[band.id] || {};
  return {
    status: statusTheme.bands[band.id] || defaultStatusThemes[0].bands[band.id],
    headline: headlineCopy.headline || defaultHeadlineThemes[0].bands[band.id].headline,
    highlight: headlineCopy.highlight || defaultHeadlineThemes[0].bands[band.id].highlight,
  };
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeThemeSettings(raw = {}) {
  const statusThemes = Array.isArray(raw.statusThemes) && raw.statusThemes.length ? raw.statusThemes : cloneData(defaultStatusThemes);
  const headlineThemes = Array.isArray(raw.headlineThemes) && raw.headlineThemes.length ? raw.headlineThemes : cloneData(defaultHeadlineThemes);
  const selectedStatusThemeId = statusThemes.some(t => t.id === raw.selectedStatusThemeId) ? raw.selectedStatusThemeId : statusThemes[0].id;
  const selectedHeadlineThemeId = headlineThemes.some(t => t.id === raw.selectedHeadlineThemeId) ? raw.selectedHeadlineThemeId : headlineThemes[0].id;

  return {
    statusThemes: statusThemes.map(normalizeStatusTheme),
    headlineThemes: headlineThemes.map(normalizeHeadlineTheme),
    selectedStatusThemeId,
    selectedHeadlineThemeId,
  };
}

function normalizeStatusTheme(theme) {
  const fallback = defaultStatusThemes[0];
  const bands = {};
  quotaBands.forEach((band) => {
    bands[band.id] = String(theme?.bands?.[band.id] || fallback.bands[band.id] || '');
  });
  return { id: theme.id || `status_${Date.now()}`, name: theme.name || buildThemeNameFromStatusBands(bands), bands };
}

function normalizeHeadlineTheme(theme) {
  const fallback = defaultHeadlineThemes[0];
  const bands = {};
  quotaBands.forEach((band) => {
    const copy = theme?.bands?.[band.id] || {};
    bands[band.id] = {
      headline: String(copy.headline || fallback.bands[band.id].headline || ''),
      highlight: String(copy.highlight || fallback.bands[band.id].highlight || ''),
    };
  });
  return { id: theme.id || `headline_${Date.now()}`, name: theme.name || buildThemeNameFromHeadlineBands(bands), bands };
}

function loadThemeSettings() {
  const saved = localStorage.getItem('codex-epaper-theme-settings');
  if (!saved) return;
  try {
    quotaThemeSettings = normalizeThemeSettings(JSON.parse(saved));
  } catch {
    quotaThemeSettings = normalizeThemeSettings();
  }
}

function saveThemeSettings() {
  localStorage.setItem('codex-epaper-theme-settings', JSON.stringify(quotaThemeSettings));
}

function getQuotaBand(percent) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  return quotaBands.find(band => pct >= band.min && pct <= band.max) || quotaBands[quotaBands.length - 1];
}

function getCurrentStatusTheme() {
  return quotaThemeSettings.statusThemes.find(t => t.id === quotaThemeSettings.selectedStatusThemeId) || quotaThemeSettings.statusThemes[0] || defaultStatusThemes[0];
}

function getCurrentHeadlineTheme() {
  return quotaThemeSettings.headlineThemes.find(t => t.id === quotaThemeSettings.selectedHeadlineThemeId) || quotaThemeSettings.headlineThemes[0] || defaultHeadlineThemes[0];
}

function stripThemePunctuation(text) {
  return String(text || '').replace(/[!！.。…?？\s]/g, '') || '新主题';
}

function uniqueThemeName(baseName, themes) {
  const existing = new Set(themes.map(t => t.name));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName}${index}`)) index++;
  return `${baseName}${index}`;
}

function buildThemeNameFromStatusBands(bands) {
  return `${stripThemePunctuation(bands.high)}主题`;
}

function buildThemeNameFromHeadlineBands(bands) {
  const high = bands.high || {};
  return `${stripThemePunctuation(high.highlight || high.headline)}主题`;
}

function formatDailyTokens(tokens) {
  const n = Math.max(0, Number(tokens) || 0);
  const wan = n / 10000;
  return `${wan.toFixed(1).replace(/\.0$/, '')}万`;
}

function loadUserSettings() {
  const saved = localStorage.getItem('codex-epaper-settings');
  if (saved) { try { return { ...userDefaults, ...JSON.parse(saved) }; } catch {} }
  return { ...userDefaults };
}

function saveUserSettings() {
  const s = {
    title: getEl('cfg-title').value, headline: getEl('cfg-headline').value,
    subHeadline: getEl('cfg-subheadline').value, highlightText: getEl('cfg-highlight').value, 
    driver: getEl('cfg-driver').value, screenPreset: getEl('cfg-screen').value, 
    colorMode: getEl('cfg-color-mode').value, refreshInterval: refreshIntervalMinutes, 
    autoRefresh: autoRefreshEnabled, invertBlack: getEl('cfg-invert-bw').checked, 
    invertRed: getEl('cfg-invert-red').checked,
    templateId: templateFromUrl ? storedTemplateIdBeforeUrlPreview : (getEl('cfg-template')?.value || 'handdraw_card'),
    autoIconThemeId: getEl('cfg-auto-icon-theme')?.value || 'brain',
    weatherInterval: getEl('cfg-weather-interval')?.value || '1',
  };
  localStorage.setItem('codex-epaper-settings', JSON.stringify(s));
}

function applyUserSettings(s) {
  getEl('cfg-title').value = s.title; getEl('cfg-headline').value = s.headline;
  setDisabledSubheadlineText();
  getEl('cfg-highlight').value = s.highlightText; getEl('cfg-driver').value = s.driver;
  getEl('cfg-screen').value = s.screenPreset; getEl('cfg-color-mode').value = s.colorMode;
  getEl('cfg-invert-bw').checked = s.invertBlack; getEl('cfg-invert-red').checked = s.invertRed;
  if (getEl('cfg-auto-icon-theme')) getEl('cfg-auto-icon-theme').value = autoIconThemes.some(t => t.id === s.autoIconThemeId) ? s.autoIconThemeId : 'brain';
  if (getEl('cfg-weather-interval')) getEl('cfg-weather-interval').value = String(s.weatherInterval || '1') === '2' ? '2' : '1';
  const urlTemplate = new URLSearchParams(window.location.search).get('template');
  storedTemplateIdBeforeUrlPreview = s.templateId || 'handdraw_card';
  templateFromUrl = Boolean(urlTemplate && previewTemplates[urlTemplate]);
  storedTemplateIdBeforeUrlPreview = previewTemplates[storedTemplateIdBeforeUrlPreview] ? storedTemplateIdBeforeUrlPreview : 'handdraw_card';
  const templateId = templateFromUrl ? urlTemplate : storedTemplateIdBeforeUrlPreview;
  if (getEl('cfg-template')) getEl('cfg-template').value = templateId;
  refreshIntervalMinutes = s.refreshInterval; autoRefreshEnabled = s.autoRefresh;
  getEl('cfg-refresh-interval').value = String(s.refreshInterval);
  getEl('cfg-auto-refresh').checked = s.autoRefresh;
  updateScreenSize();
}

function getScreenSize() {
  const preset = getEl('cfg-screen').value;
  return screenPresets[preset] || { w: 400, h: 300 };
}

function updateScreenSize() {
  const { w, h } = getScreenSize();
  const canvas = getEl('preview-canvas');
  canvas.width = w; canvas.height = h;
  renderPreview();
}

function updateQuotaDisplay() {
  const q = codexQuotaStatus;
  getEl('q-5h-bar').style.width = q.five_hour_percent + '%';
  getEl('q-5h-val').textContent = q.five_hour_percent + '%';
  getEl('q-7d-val').textContent = q.seven_day_percent + '%';
  getEl('q-5h-ref').textContent = q.refresh_5h || '--:--';
  getEl('q-7d-ref').textContent = q.refresh_7d || '--/--';
  
  const dotsEl = getEl('q-7d-dots'); dotsEl.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = document.createElement('span');
    d.className = 'dot' + (i < Math.round(7 * q.seven_day_percent / 100) ? ' filled' : '');
    dotsEl.appendChild(d);
  }
  const pill = getEl('q-status-pill'); const sl = q.status_label || '--'; pill.textContent = sl;
  if (sl.includes('正常')) pill.className = 'status-pill ok';
  else if (sl.includes('温热') || sl.includes('偏热')) pill.className = 'status-pill warn';
  else pill.className = 'status-pill bad';
}

function getWeekday() {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()} ${days[now.getDay()]}`;
}

function clampNumber(v, min, max) {
  v = Number(v);
  if (Number.isNaN(v)) v = 0;
  return Math.min(max, Math.max(min, v));
}

function getSevenDayRemainingDays(q, sevenDayPercent) {
  const candidates = [q.refresh_7d_days_left, q.refresh_7d_remaining_days, q.seven_day_days_left, q.remaining_7d_days, q.days_left_7d];
  for (const v of candidates) {
    const n = Number(v);
    if (!Number.isNaN(n)) return Math.min(7, Math.max(0, Math.round(n)));
  }
  return Math.min(7, Math.max(0, Math.ceil((sevenDayPercent || 0) / 100 * 7)));
}

// ----------------------------------------------------
// 模板注册表
// ----------------------------------------------------
const previewTemplates = {
  handdraw_card: {
    label: '手绘卡片',
    render(ctx, state, helpers) {
      const { W, H, SX, SY, S, X, Y, SS, BLACK, RED, WHITE, SOFT, q, fiveHourPercent, quotaCopy,
        title, headline, subline, hlText, sevenDayPercent, remainingDays,
        dateText, updatedAt, nextAt, bleConnected, bleText } = state;
      const { setFont, drawWobbleLine, drawBox, drawRichText, drawAutoIcon,
        drawProgressBar, drawDots, drawHeart, drawDailyTokenRow, drawWeatherHeader, drawBottomCentered, clampNumber, getSevenDayRemainingDays } = helpers;

      // 只用黑/红/白，保证 canvasToEpaperPlanes 能稳定转成黑白红三色位图。
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Header
      setFont(34, '', '"Comic Sans MS", "KaiTi", "Microsoft YaHei", cursive');
      ctx.fillStyle = BLACK;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(title.replace(/ plus$/i, ''), X(22), Y(40));

      setFont(17, 'bold');
      ctx.textAlign = 'right';
      ctx.fillText(dateText, X(372), Y(37));
      ctx.textAlign = 'left';
      drawWobbleLine(18, 53, 382, 53, BLACK, 1.4);

      // 主文案区域
      if (state.useWeatherHeader) {
        drawWeatherHeader(state.weather);
      } else if (state.useCustomIcon) {
        // 自定义模板模式：仅在用户上传图标时绘制，否则留空
        if (customImage) {
          const ic = document.getElementById('hidden-icon-canvas');
          if (ic && ic.width > 0) {
            ctx.drawImage(ic, X(40), Y(68), X(64), Y(64));
          }
        }
      } else {
        drawAutoIcon(state.autoIconThemeId, 73, 93, 70, fiveHourPercent);
      }
      if (!state.useWeatherHeader) {
        drawRichText(headline, 238, 104, headline.length > 8 ? 30 : 34, 'bold', hlText);
        ctx.strokeStyle = RED;
        ctx.lineWidth = SS(1.4);
        ctx.beginPath();
        ctx.moveTo(X(190), Y(114));
        ctx.quadraticCurveTo(X(236), Y(118), X(289), Y(113));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(X(202), Y(121));
        ctx.quadraticCurveTo(X(240), Y(124), X(281), Y(120));
        ctx.stroke();
      }
      drawWobbleLine(18, 130, 382, 130, BLACK, 0.9);

      // 区域标题
      setFont(22, 'bold');
      ctx.fillStyle = BLACK;
      ctx.fillText('脑量监测', X(28), Y(158));
      setFont(16, 'bold');
      ctx.fillStyle = RED;
      ctx.textAlign = 'right';
      ctx.fillText(quotaCopy.status, X(360), Y(158));
      ctx.textAlign = 'left';

      // 指标几何布局：所有视觉轨道起始x相同，爱心与进度条对齐
      const labelX = 28;
      const trackX = 138;
      const trackW = 158;
      const valueColX = 362;
      const row1Y = 183;
      const row2Y = 218;
      const row3Y = 251;

      setFont(18, 'bold');
      ctx.fillStyle = BLACK;
      ctx.fillText('5小时能量', X(labelX), Y(row1Y + 6));
      drawProgressBar(trackX, row1Y - 11, trackW, 22, fiveHourPercent);
      setFont(22, 'bold');
      ctx.fillStyle = BLACK;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(fiveHourPercent)}%`, X(valueColX), Y(row1Y + 8));
      ctx.textAlign = 'left';
      drawWobbleLine(22, 202, 378, 202, BLACK, 0.4);

      setFont(18, 'bold');
      ctx.fillStyle = BLACK;
      ctx.fillText('7天轨迹', X(labelX), Y(row2Y + 6));
      const sevenFilled = Math.round(7 * sevenDayPercent / 100);
      drawDots(trackX + 8, row2Y, 7, sevenFilled, 6.5, trackW / 6);
      setFont(22, 'bold');
      ctx.fillStyle = BLACK;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(sevenDayPercent)}%`, X(valueColX), Y(row2Y + 8));
      ctx.textAlign = 'left';
      drawWobbleLine(22, 236, 378, 236, BLACK, 0.4);

      if (state.useDailyTokenRow) {
        drawDailyTokenRow(labelX, row3Y, trackX, trackW, valueColX, state.dailyTokenText);
      } else {
        setFont(18, 'bold');
        ctx.fillStyle = BLACK;
        ctx.fillText('轨迹刷新', X(labelX), Y(row3Y + 6));
        for (let i = 0; i < 7; i++) {
          drawHeart(trackX + 7 + i * (trackW / 6), row3Y, i < remainingDays, 0.78);
        }
        setFont(22, 'bold');
        ctx.fillStyle = BLACK;
        ctx.textAlign = 'right';
        ctx.fillText(`${remainingDays}天`, X(valueColX), Y(row3Y + 8));
        ctx.textAlign = 'left';
      }

      // Footer
      drawWobbleLine(18, 270, 382, 270, BLACK, 1.1);
      setFont(16, 'bold');
      ctx.fillStyle = BLACK;
      ctx.textBaseline = 'middle';
      ctx.fillText(`${updatedAt} 更新`, X(28), Y(286));
      drawBottomCentered(`BLE ${bleText}`, 200, 286, bleConnected ? RED : BLACK, 16);
      ctx.textAlign = 'right';
      ctx.fillStyle = BLACK;
      ctx.fillText(`下次 ${nextAt}`, X(372), Y(286));
      ctx.textAlign = 'left';
    }
  },
  token_daily_card: {
    label: '今日 Token',
    render(ctx, state, helpers) {
      previewTemplates.handdraw_card.render(ctx, { ...state, useDailyTokenRow: true }, helpers);
    }
  },
  custom_token_daily_card: {
    label: '自定义今日token',
    render(ctx, state, helpers) {
      previewTemplates.handdraw_card.render(ctx, { ...state, useDailyTokenRow: true, useCustomIcon: true }, helpers);
    }
  },
  weather_token_card: {
    label: '天气 Token',
    render(ctx, state, helpers) {
      previewTemplates.handdraw_card.render(ctx, { ...state, useDailyTokenRow: true, useWeatherHeader: true }, helpers);
    }
  }
};

// ----------------------------------------------------
// 渲染状态构建 & 辅助函数工厂
// ----------------------------------------------------
function buildRenderState() {
  const canvas = getEl('preview-canvas');
  const W = canvas.width, H = canvas.height;
  const SX = W / 400;
  const SY = H / 300;
  const S = Math.min(SX, SY);
  const X = (v) => v * SX;
  const Y = (v) => v * SY;
  const SS = (v) => Math.max(1, v * S);

  const BLACK = '#000000';
  const RED = '#FF0000';
  const WHITE = '#FFFFFF';
  const SOFT = '#111111';

  const q = codexQuotaStatus;
  const fiveHourPercent = clampNumber(q.five_hour_percent, 0, 100);
  const quotaCopy = getQuotaCopy(fiveHourPercent);
  const title = getEl('cfg-title').value || q.title || 'Codex';
  const currentTemplateId = getEl('cfg-template')?.value || 'handdraw_card';
  const isCustomTemplate = currentTemplateId === 'custom_token_daily_card';
  const autoIconThemeId = getEl('cfg-auto-icon-theme')?.value || 'brain';
  const headline = isCustomTemplate
    ? (getEl('cfg-headline').value || '这里是主文案')
    : quotaCopy.headline;
  const subline = getEl('cfg-subheadline').value || q.subheadline || q.subHeadline || '';
  const inputHighlight = (getEl('cfg-highlight').value || '').trim();
  const autoHighlight = quotaCopy.highlight || ['麻', '过载', '温热', '危险', '枯竭'].find(t => headline.includes(t)) || '';
  const hlText = isCustomTemplate
    ? inputHighlight
    : (headline.includes(inputHighlight) ? inputHighlight : (q.highlight_text || q.highlightText || autoHighlight));

  const sevenDayPercent = clampNumber(q.seven_day_percent, 0, 100);
  const remainingDays = getSevenDayRemainingDays(q, sevenDayPercent);
  const dateText = q.date_text || getWeekday();
  const updatedAt = q.updated_at || formatTime(new Date());
  const nextAt = q.next_refresh_at || q.refresh_5h || '--:--';
  const bleConnected = EPD.isConnected();
  const bleText = q.ble_status || (bleConnected ? '已连接' : '未连接');
  const dailyTokenText = formatDailyTokens(q.daily_total_tokens);

  return { W, H, SX, SY, S, X, Y, SS, BLACK, RED, WHITE, SOFT, q, fiveHourPercent, quotaCopy,
    title, headline, subline, hlText, sevenDayPercent, remainingDays,
    dateText, updatedAt, nextAt, bleConnected, bleText, dailyTokenText, autoIconThemeId, weather: weatherStatus };
}

function createRenderHelpers(canvas) {
  const W = canvas.width, H = canvas.height;
  const SX = W / 400;
  const SY = H / 300;
  const S = Math.min(SX, SY);
  const X = (v) => v * SX;
  const Y = (v) => v * SY;
  const SS = (v) => Math.max(1, v * S);
  const BLACK = '#000000';
  const RED = '#FF0000';
  const WHITE = '#FFFFFF';

  function setFont(size, weight = '', family = '"KaiTi", "STKaiti", "Microsoft YaHei", sans-serif') {
    const ctx = canvas.getContext('2d');
    ctx.font = `${weight ? weight + ' ' : ''}${Math.round(SS(size))}px ${family}`;
  }

  function drawWobbleLine(x1, y1, x2, y2, color = BLACK, width = 1.3) {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = SS(width);
    ctx.beginPath();
    ctx.moveTo(X(x1), Y(y1));
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    ctx.quadraticCurveTo(X(midX + 1.2), Y(midY - 0.8), X(x2), Y(y2));
    ctx.stroke();
  }

  function drawBox(x, y, w, h, color = BLACK, width = 1.3) {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = SS(width);
    ctx.strokeRect(X(x), Y(y), X(w), Y(h));
    // 多描一条轻微偏移线，模拟手绘边缘
    ctx.strokeRect(X(x + 0.8), Y(y + 0.6), X(w - 1.5), Y(h - 1.2));
  }

  function drawRichText(text, cx, y, size, weight = 'bold', currentHlText) {
    const ctx = canvas.getContext('2d');
    const hl = currentHlText;
    setFont(size, weight);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const parts = [];
    if (hl && text.includes(hl)) {
      const split = text.split(hl);
      split.forEach((p, i) => {
        if (p) parts.push({ text: p, color: BLACK });
        if (i < split.length - 1) parts.push({ text: hl, color: RED });
      });
    } else {
      parts.push({ text, color: BLACK });
    }

    const total = parts.reduce((sum, p) => sum + ctx.measureText(p.text).width, 0);
    let x = X(cx) - total / 2;
    for (const p of parts) {
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, Y(y));
      x += ctx.measureText(p.text).width;
    }
  }

  function drawBrainIcon(cx, cy, size, percent) {
    const ctx = canvas.getContext('2d');
    const k = size / 80;
    const pct = clampNumber(percent, 0, 100);

    function px(v) { return X(cx + v * k); }
    function py(v) { return Y(cy + v * k); }
    function sw(v) { return SS(v * k); }

    function looseEllipse(rx, ry, count, density = 1, color = BLACK, width = 1.7, startShift = 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = sw(width);
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        const ox = Math.sin(i * 1.7 + startShift) * 3.2 * density;
        const oy = Math.cos(i * 1.3 + startShift) * 2.2 * density;
        const rrX = rx * (0.88 + (i % 3) * 0.08);
        const rrY = ry * (0.86 + (i % 4) * 0.06);
        const start = i * 0.6 + startShift;
        ctx.ellipse(px(ox), py(oy), sw(rrX), sw(rrY), i * 0.33, start, start + Math.PI * (1.38 + (i % 3) * 0.18));
        ctx.stroke();
      }
    }

    function looseSpiral(turns, maxR, color = BLACK, width = 1.9) {
      ctx.strokeStyle = color;
      ctx.lineWidth = sw(width);
      ctx.beginPath();
      const steps = 96;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps * Math.PI * 2 * turns;
        const r = maxR * i / steps;
        const wobble = Math.sin(i * 0.7) * 1.3;
        const x = Math.cos(t) * (r + wobble);
        const y = Math.sin(t) * (r * 0.72 + wobble * 0.4);
        if (i === 0) ctx.moveTo(px(x), py(y));
        else ctx.lineTo(px(x), py(y));
      }
      ctx.stroke();
    }

    function shortLine(x1, y1, x2, y2, color = BLACK, width = 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = sw(width);
      ctx.beginPath();
      ctx.moveTo(px(x1), py(y1));
      ctx.lineTo(px(x2), py(y2));
      ctx.stroke();
    }

    function star(x, y, r, color = RED) {
      ctx.strokeStyle = color;
      ctx.lineWidth = sw(2);
      ctx.beginPath();
      ctx.moveTo(px(x), py(y - r));
      ctx.lineTo(px(x), py(y + r));
      ctx.moveTo(px(x - r), py(y));
      ctx.lineTo(px(x + r), py(y));
      ctx.moveTo(px(x - r * 0.65), py(y - r * 0.65));
      ctx.lineTo(px(x + r * 0.65), py(y + r * 0.65));
      ctx.moveTo(px(x + r * 0.65), py(y - r * 0.65));
      ctx.lineTo(px(x - r * 0.65), py(y + r * 0.65));
      ctx.stroke();
    }

    function lightning(x, y, color = RED) {
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = sw(2.4);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(px(x + 1), py(y - 20));
      ctx.lineTo(px(x - 10), py(y + 1));
      ctx.lineTo(px(x - 1), py(y + 1));
      ctx.lineTo(px(x - 8), py(y + 20));
      ctx.lineTo(px(x + 12), py(y - 5));
      ctx.lineTo(px(x + 2), py(y - 5));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    function sweat(x, y, color = BLACK) {
      ctx.strokeStyle = color;
      ctx.lineWidth = sw(1.8);
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.moveTo(px(x), py(y - 8));
      ctx.quadraticCurveTo(px(x - 7), py(y + 1), px(x), py(y + 9));
      ctx.quadraticCurveTo(px(x + 7), py(y + 1), px(x), py(y - 8));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    function face(kind) {
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = sw(2);
      ctx.lineCap = 'round';
      if (kind === 'hot') {
        shortLine(-12, -4, -5, 3, BLACK, 2);
        shortLine(12, -4, 5, 3, BLACK, 2);
        ctx.beginPath();
        ctx.moveTo(px(-12), py(12));
        ctx.quadraticCurveTo(px(0), py(4), px(12), py(12));
        ctx.stroke();
      } else if (kind === 'danger') {
        shortLine(-15, -8, -7, 0, BLACK, 2);
        shortLine(-7, -8, -15, 0, BLACK, 2);
        shortLine(7, -8, 15, 0, BLACK, 2);
        shortLine(15, -8, 7, 0, BLACK, 2);
        ctx.beginPath();
        ctx.ellipse(px(0), py(14), sw(7), sw(5), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (pct >= 81) {
      looseEllipse(25, 21, 6, 0.75, BLACK, 1.8);
      looseEllipse(30, 25, 2, 0.55, BLACK, 1.2, 1.2);
      shortLine(-35, -28, -48, -42, BLACK, 2);
      shortLine(-27, -33, -31, -50, BLACK, 2);
      shortLine(-41, -18, -56, -22, BLACK, 2);
      star(38, -27, 8, RED);
      star(-31, 28, 5, RED);
      return;
    }

    if (pct >= 61) {
      looseSpiral(3.7, 27, BLACK, 1.9);
      looseEllipse(28, 21, 4, 0.65, BLACK, 1.2, 0.8);
      lightning(41, 4, RED);
      star(27, -27, 3.5, RED);
      shortLine(35, 27, 45, 34, BLACK, 1.5);
      return;
    }

    if (pct >= 41) {
      looseEllipse(31, 21, 11, 1.05, BLACK, 1.45);
      looseEllipse(24, 15, 4, 0.8, BLACK, 1.1, 1.4);
      shortLine(29, 16, 41, 24, BLACK, 1.5);
      return;
    }

    if (pct >= 21) {
      looseEllipse(28, 25, 15, 1.08, BLACK, 1.65);
      looseEllipse(20, 16, 5, 0.82, BLACK, 1.25, 1.1);
      face('hot');
      ctx.strokeStyle = RED;
      ctx.lineWidth = sw(2);
      ctx.beginPath();
      ctx.moveTo(px(-18), py(-40));
      ctx.quadraticCurveTo(px(-9), py(-50), px(1), py(-40));
      ctx.moveTo(px(8), py(-38));
      ctx.quadraticCurveTo(px(18), py(-49), px(29), py(-39));
      ctx.stroke();
      sweat(-42, -1, BLACK);
      sweat(40, 10, RED);
      return;
    }

    looseEllipse(30, 28, 20, 1.25, BLACK, 1.8);
    looseEllipse(22, 20, 7, 1, BLACK, 1.45, 1.3);
    face('danger');
    looseSpiral(1.5, 12, BLACK, 1.5);
    shortLine(-44, -4, -56, -11, RED, 2);
    shortLine(45, -5, 56, -12, RED, 2);
    shortLine(-40, 18, -54, 23, BLACK, 1.8);
    shortLine(40, 19, 54, 25, BLACK, 1.8);
    shortLine(-13, 35, -18, 45, BLACK, 1.8);
    shortLine(12, 35, 17, 45, BLACK, 1.8);
  }

  function drawAutoIcon(themeId, cx, cy, size, percent) {
    if (!themeId || themeId === 'brain') {
      drawBrainIcon(cx, cy, size, percent);
      return;
    }

    const ctx = canvas.getContext('2d');
    const k = size / 80;
    const pct = clampNumber(percent, 0, 100);
    function px(v) { return X(cx + v * k); }
    function py(v) { return Y(cy + v * k); }
    function sw(v) { return SS(v * k); }
    function line(x1, y1, x2, y2, color = BLACK, width = 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = sw(width);
      ctx.beginPath();
      ctx.moveTo(px(x1), py(y1));
      ctx.lineTo(px(x2), py(y2));
      ctx.stroke();
    }
    function sparkle(x, y, r = 6, color = RED) {
      ctx.strokeStyle = color;
      ctx.lineWidth = sw(2);
      ctx.beginPath();
      ctx.moveTo(px(x), py(y - r));
      ctx.lineTo(px(x), py(y + r));
      ctx.moveTo(px(x - r), py(y));
      ctx.lineTo(px(x + r), py(y));
      ctx.moveTo(px(x - r * 0.6), py(y - r * 0.6));
      ctx.lineTo(px(x + r * 0.6), py(y + r * 0.6));
      ctx.moveTo(px(x + r * 0.6), py(y - r * 0.6));
      ctx.lineTo(px(x - r * 0.6), py(y + r * 0.6));
      ctx.stroke();
    }
    function heart(x, y, scale = 1) {
      ctx.strokeStyle = RED;
      ctx.fillStyle = WHITE;
      ctx.lineWidth = sw(2);
      ctx.beginPath();
      ctx.moveTo(px(x), py(y + 8 * scale));
      ctx.bezierCurveTo(px(x - 18 * scale), py(y - 4 * scale), px(x - 8 * scale), py(y - 18 * scale), px(x), py(y - 7 * scale));
      ctx.bezierCurveTo(px(x + 8 * scale), py(y - 18 * scale), px(x + 18 * scale), py(y - 4 * scale), px(x), py(y + 8 * scale));
      ctx.fill();
      ctx.stroke();
    }
    function smile(y = 14) {
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = sw(2);
      ctx.beginPath();
      ctx.moveTo(px(-10), py(y));
      ctx.quadraticCurveTo(px(0), py(y + 8), px(10), py(y));
      ctx.stroke();
    }
    function moodMark() {
      if (pct >= 61) sparkle(36, -30, 7, RED);
      else if (pct >= 21) {
        line(35, -28, 47, -38, RED, 2);
        line(41, -23, 54, -26, RED, 2);
      } else {
        sparkle(37, -26, 5, RED);
        line(-42, 35, -54, 42, BLACK, 1.8);
      }
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = WHITE;
    ctx.strokeStyle = BLACK;

    if (themeId === 'cat') {
      ctx.lineWidth = sw(2.4);
      ctx.beginPath();
      ctx.moveTo(px(-30), py(-9));
      ctx.lineTo(px(-20), py(-34));
      ctx.lineTo(px(-5), py(-18));
      ctx.lineTo(px(17), py(-19));
      ctx.lineTo(px(31), py(-34));
      ctx.lineTo(px(35), py(-8));
      ctx.quadraticCurveTo(px(36), py(28), px(0), py(35));
      ctx.quadraticCurveTo(px(-37), py(28), px(-30), py(-9));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = BLACK;
      ctx.beginPath(); ctx.ellipse(px(-13), py(0), sw(2.8), sw(4), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px(13), py(0), sw(2.8), sw(4), 0, 0, Math.PI * 2); ctx.fill();
      line(-5, 9, 0, 13, BLACK, 1.7);
      line(5, 9, 0, 13, BLACK, 1.7);
      line(-42, 8, -22, 12, BLACK, 1.5);
      line(-42, 20, -22, 18, BLACK, 1.5);
      line(22, 12, 42, 8, BLACK, 1.5);
      line(22, 18, 42, 20, BLACK, 1.5);
      heart(31, 28, 0.45);
      moodMark();
    } else if (themeId === 'bunny') {
      ctx.lineWidth = sw(2.4);
      ctx.beginPath();
      ctx.ellipse(px(-14), py(-27), sw(9), sw(24), -0.24, 0, Math.PI * 2);
      ctx.ellipse(px(14), py(-27), sw(9), sw(24), 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(px(0), py(8), sw(32), sw(29), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = BLACK;
      ctx.beginPath(); ctx.ellipse(px(-11), py(1), sw(2.7), sw(3.8), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px(11), py(1), sw(2.7), sw(3.8), 0, 0, Math.PI * 2); ctx.fill();
      sparkle(-27, 18, 4, RED);
      sparkle(27, 18, 4, RED);
      smile(12);
      line(-38, 34, -50, 43, BLACK, 1.8);
      line(38, 34, 50, 43, BLACK, 1.8);
      moodMark();
    } else if (themeId === 'robot') {
      ctx.lineWidth = sw(2.3);
      ctx.strokeRect(px(-29), py(-18), sw(58), sw(48));
      ctx.beginPath();
      ctx.moveTo(px(-20), py(-18));
      ctx.quadraticCurveTo(px(0), py(-38), px(20), py(-18));
      ctx.stroke();
      line(0, -38, 0, -48, BLACK, 2);
      sparkle(0, -54, 4, RED);
      ctx.fillStyle = WHITE;
      ctx.strokeStyle = RED;
      ctx.lineWidth = sw(2);
      ctx.beginPath(); ctx.ellipse(px(-13), py(0), sw(7), sw(7), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(px(13), py(0), sw(7), sw(7), 0, 0, Math.PI * 2); ctx.stroke();
      line(-11, 19, 11, 19, BLACK, 2);
      line(-40, -2, -29, 5, BLACK, 2);
      line(29, 5, 40, -2, BLACK, 2);
      moodMark();
    } else if (themeId === 'coffee') {
      ctx.lineWidth = sw(2.4);
      ctx.beginPath();
      ctx.moveTo(px(-25), py(-8));
      ctx.lineTo(px(20), py(-8));
      ctx.quadraticCurveTo(px(16), py(31), px(-18), py(31));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(px(26), py(5), sw(12), sw(13), 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      line(-37, 40, 38, 40, BLACK, 2);
      line(-14, -22, -19, -39, RED, 2);
      line(0, -20, -2, -40, BLACK, 2);
      line(14, -22, 20, -38, RED, 2);
      ctx.fillStyle = BLACK;
      ctx.beginPath(); ctx.ellipse(px(-9), py(6), sw(2.5), sw(3.5), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px(7), py(6), sw(2.5), sw(3.5), 0, 0, Math.PI * 2); ctx.fill();
      smile(15);
      heart(37, -24, 0.42);
    } else if (themeId === 'cloud') {
      ctx.lineWidth = sw(2.5);
      ctx.beginPath();
      ctx.moveTo(px(-38), py(15));
      ctx.quadraticCurveTo(px(-38), py(-4), px(-19), py(-3));
      ctx.quadraticCurveTo(px(-13), py(-27), px(9), py(-22));
      ctx.quadraticCurveTo(px(21), py(-34), px(36), py(-18));
      ctx.quadraticCurveTo(px(54), py(-13), px(46), py(14));
      ctx.quadraticCurveTo(px(16), py(25), px(-38), py(15));
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = BLACK;
      ctx.beginPath(); ctx.ellipse(px(-9), py(4), sw(2.6), sw(3.5), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px(14), py(4), sw(2.6), sw(3.5), 0, 0, Math.PI * 2); ctx.fill();
      smile(12);
      sparkle(-42, -22, 6, RED);
      sparkle(42, 30, 4, RED);
      if (pct < 41) {
        line(-18, 36, -25, 48, RED, 2);
        line(2, 36, -5, 48, BLACK, 2);
        line(22, 34, 15, 46, RED, 2);
      }
    } else {
      drawBrainIcon(cx, cy, size, percent);
    }

    ctx.restore();
  }

  function drawProgressBar(x, y, w, h, pct) {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = SS(1.4);
    ctx.strokeRect(X(x), Y(y), X(w), Y(h));
    const fillW = Math.max(0, Math.min(w, w * pct / 100));
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(x + 2), Y(y + 2), X(Math.max(0, fillW - 4)), Y(Math.max(0, h - 4)));
    ctx.clip();
    ctx.strokeStyle = RED;
    ctx.lineWidth = SS(1.2);
    for (let i = -h; i < fillW + h; i += 7) {
      ctx.beginPath();
      ctx.moveTo(X(x + i), Y(y + h - 2));
      ctx.lineTo(X(x + i + h), Y(y + 2));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDots(x, y, count, filled, r = 7, gap = 25) {
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < count; i++) {
      const cx = x + i * gap;

      function dotPath(dx = 0, dy = 0, rr = r) {
        ctx.beginPath();
        ctx.ellipse(X(cx + dx), Y(y + dy), SS(rr * 1.02), SS(rr * 0.94), -0.18, 0, Math.PI * 2);
      }

      dotPath();
      ctx.fillStyle = WHITE;
      ctx.fill();

      if (i < filled) {
        ctx.save();
        dotPath();
        ctx.clip();
        ctx.strokeStyle = RED;
        ctx.lineWidth = SS(1.5);
        ctx.lineCap = 'round';
        for (let s = -r * 1.6; s <= r * 1.4; s += 3.5) {
          ctx.beginPath();
          ctx.moveTo(X(cx + s), Y(y + r * 0.9));
          ctx.lineTo(X(cx + s + r * 1.65), Y(y - r * 0.75));
          ctx.stroke();
        }
        ctx.restore();
      }

      dotPath(-0.35, 0.2, r);
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = SS(1.25);
      ctx.stroke();
      dotPath(0.45, -0.25, r * 0.96);
      ctx.strokeStyle = i < filled ? RED : BLACK;
      ctx.lineWidth = SS(0.95);
      ctx.stroke();
    }
  }

  function drawHeart(cx, cy, filled, size = 0.78) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(X(cx), Y(cy));
    ctx.scale(S * size, S * size);

    function heartPath(offsetX = 0, offsetY = 0) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + 8);
      ctx.bezierCurveTo(offsetX - 16, offsetY - 3, offsetX - 8, offsetY - 18, offsetX, offsetY - 9);
      ctx.bezierCurveTo(offsetX + 8, offsetY - 18, offsetX + 16, offsetY - 3, offsetX, offsetY + 8);
      ctx.closePath();
    }

    heartPath();
    ctx.fillStyle = WHITE;
    ctx.fill();

    if (filled) {
      ctx.save();
      heartPath();
      ctx.clip();
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = -19; i <= 14; i += 5) {
        ctx.beginPath();
        ctx.moveTo(i, 9);
        ctx.lineTo(i + 23, -14);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 两层轻微错位的描边，模拟手绘墨线
    heartPath(-0.6, 0.2);
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    heartPath(0.7, -0.4);
    ctx.strokeStyle = filled ? RED : BLACK;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  }

  function drawBottomCentered(text, cx, y, color = BLACK, size = 15) {
    const ctx = canvas.getContext('2d');
    setFont(size, 'bold');
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, X(cx), Y(y));
    ctx.textAlign = 'left';
  }

  function getWeatherKind(item) {
    const text = String(item?.text || '');
    if (item?.is_rain || /雨|雷|阵雨|暴雨|雪|雹/.test(text)) return 'rain';
    if (/晴/.test(text)) return 'sun';
    if (/云/.test(text)) return 'cloud';
    if (/阴|雾|霾/.test(text)) return 'overcast';
    return 'cloud';
  }

  function drawMiniWeatherIcon(cx, cy, kind, scale = 1, accent = BLACK) {
    const ctx = canvas.getContext('2d');
    const r = 8 * scale;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = accent;
    ctx.fillStyle = WHITE;
    ctx.lineWidth = SS(1.7 * scale);

    if (kind === 'sun') {
      ctx.beginPath();
      ctx.ellipse(X(cx), Y(cy), SS(r), SS(r), 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(X(cx + Math.cos(a) * r * 1.35), Y(cy + Math.sin(a) * r * 1.35));
        ctx.lineTo(X(cx + Math.cos(a) * r * 1.85), Y(cy + Math.sin(a) * r * 1.85));
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(X(cx - 16 * scale), Y(cy + 5 * scale));
      ctx.quadraticCurveTo(X(cx - 17 * scale), Y(cy - 5 * scale), X(cx - 7 * scale), Y(cy - 6 * scale));
      ctx.quadraticCurveTo(X(cx - 3 * scale), Y(cy - 18 * scale), X(cx + 9 * scale), Y(cy - 12 * scale));
      ctx.quadraticCurveTo(X(cx + 16 * scale), Y(cy - 16 * scale), X(cx + 23 * scale), Y(cy - 6 * scale));
      ctx.quadraticCurveTo(X(cx + 30 * scale), Y(cy + 6 * scale), X(cx + 15 * scale), Y(cy + 10 * scale));
      ctx.quadraticCurveTo(X(cx - 2 * scale), Y(cy + 13 * scale), X(cx - 16 * scale), Y(cy + 5 * scale));
      ctx.fill();
      ctx.stroke();
      if (scale >= 0.9) {
        ctx.fillStyle = BLACK;
        ctx.beginPath(); ctx.ellipse(X(cx - 4 * scale), Y(cy - 1 * scale), SS(1.6 * scale), SS(2.1 * scale), 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(X(cx + 9 * scale), Y(cy - 1 * scale), SS(1.6 * scale), SS(2.1 * scale), 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = SS(1.2 * scale);
        ctx.beginPath();
        ctx.moveTo(X(cx - 1 * scale), Y(cy + 5 * scale));
        ctx.quadraticCurveTo(X(cx + 3 * scale), Y(cy + 8 * scale), X(cx + 7 * scale), Y(cy + 5 * scale));
        ctx.stroke();
        ctx.strokeStyle = RED;
        ctx.lineWidth = SS(1 * scale);
        ctx.beginPath();
        ctx.moveTo(X(cx - 12 * scale), Y(cy + 3 * scale));
        ctx.lineTo(X(cx - 8 * scale), Y(cy + 3 * scale));
        ctx.moveTo(X(cx + 15 * scale), Y(cy + 3 * scale));
        ctx.lineTo(X(cx + 19 * scale), Y(cy + 3 * scale));
        ctx.stroke();
      }
      if (kind === 'rain') {
        ctx.strokeStyle = RED;
        ctx.fillStyle = WHITE;
        for (let i = -1; i <= 1; i++) {
          const dx = i * 8 * scale;
          ctx.beginPath();
          ctx.moveTo(X(cx + dx), Y(cy + 16 * scale));
          ctx.quadraticCurveTo(X(cx + dx - 5 * scale), Y(cy + 22 * scale), X(cx + dx), Y(cy + 27 * scale));
          ctx.quadraticCurveTo(X(cx + dx + 5 * scale), Y(cy + 22 * scale), X(cx + dx), Y(cy + 16 * scale));
          ctx.fill();
          ctx.stroke();
        }
      } else if (kind === 'overcast') {
        ctx.strokeStyle = BLACK;
        ctx.beginPath();
        ctx.moveTo(X(cx - 17 * scale), Y(cy + 17 * scale));
        ctx.lineTo(X(cx + 19 * scale), Y(cy + 17 * scale));
        ctx.moveTo(X(cx - 11 * scale), Y(cy + 24 * scale));
        ctx.lineTo(X(cx + 13 * scale), Y(cy + 24 * scale));
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawUmbrellaIcon(cx, cy, scale = 1) {
    const ctx = canvas.getContext('2d');
    const px = (v) => X(cx + v * scale);
    const py = (v) => Y(cy + v * scale);
    const sw = (v) => SS(v * scale);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = BLACK;
    ctx.fillStyle = WHITE;
    ctx.lineWidth = sw(2);

    ctx.beginPath();
    ctx.moveTo(px(-32), py(4));
    ctx.quadraticCurveTo(px(-18), py(-28), px(18), py(-27));
    ctx.quadraticCurveTo(px(35), py(-18), px(38), py(4));
    ctx.quadraticCurveTo(px(25), py(-3), px(15), py(8));
    ctx.quadraticCurveTo(px(2), py(-4), px(-9), py(8));
    ctx.quadraticCurveTo(px(-20), py(-2), px(-32), py(4));
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px(0), py(-34));
    ctx.lineTo(px(0), py(31));
    ctx.quadraticCurveTo(px(4), py(45), px(16), py(35));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px(-17), py(-17));
    ctx.quadraticCurveTo(px(-6), py(-27), px(0), py(8));
    ctx.moveTo(px(18), py(-15));
    ctx.quadraticCurveTo(px(7), py(-26), px(0), py(8));
    ctx.stroke();

    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.ellipse(px(-8), py(-5), sw(1.6), sw(2.2), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px(8), py(-5), sw(1.6), sw(2.2), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px(-4), py(4));
    ctx.quadraticCurveTo(px(0), py(7), px(5), py(4));
    ctx.stroke();

    ctx.strokeStyle = RED;
    ctx.lineWidth = sw(1.8);
    ctx.beginPath();
    ctx.moveTo(px(35), py(-17));
    ctx.lineTo(px(44), py(-27));
    ctx.moveTo(px(39), py(-12));
    ctx.lineTo(px(51), py(-16));
    ctx.stroke();
    ctx.restore();
  }

  function drawWeatherHeader(weather) {
    const ctx = canvas.getContext('2d');
    const data = weather || weatherStatus;
    const now = data.now || {};
    const hours = Array.isArray(data.hours) ? data.hours.slice(0, 4) : [];
    while (hours.length < 4) {
      hours.push({ time: '--时', text: '--', temp: '--', is_rain: false });
    }

    const rainy = hours.some(item => item.is_rain || /雨|雷|雪/.test(String(item.text || '')));
    const title = data.ok ? (rainy ? '后几小时有雨' : '后几小时平稳') : '天气待配置';
    const nowText = now.text || '天气';
    const nowTemp = now.temp || '--';
    const nowKind = getWeatherKind(now);

    if (rainy || nowKind === 'rain') {
      drawUmbrellaIcon(58, 88, 0.72);
    } else {
      drawMiniWeatherIcon(56, 90, nowKind, 0.95, BLACK);
    }
    setFont(31, 'bold');
    ctx.fillStyle = BLACK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${nowTemp}°`, X(104), Y(116));

    ctx.strokeStyle = BLACK;
    ctx.lineWidth = SS(1.2);
    ctx.beginPath();
    ctx.moveTo(X(128), Y(66));
    ctx.lineTo(X(128), Y(123));
    ctx.stroke();

    drawMiniWeatherIcon(215, 64, 'cloud', 0.26, RED);
    ctx.textAlign = 'center';
    setFont(17, 'bold');
    ctx.fillStyle = BLACK;
    ctx.fillText('天气小报', X(258), Y(70));
    ctx.strokeStyle = RED;
    ctx.lineWidth = SS(1);
    ctx.beginPath();
    ctx.moveTo(X(234), Y(75));
    ctx.quadraticCurveTo(X(258), Y(78), X(282), Y(75));
    ctx.stroke();
    setFont(10, 'bold');
    ctx.textAlign = 'right';
    ctx.fillStyle = BLACK;
    ctx.fillText(data.updated_at ? `${data.updated_at} 更新` : '--:-- 更新', X(368), Y(66));
    ctx.textAlign = 'left';

    const startX = 158;
    const gap = 50;
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = SS(0.75);
    for (let i = 1; i < 4; i++) {
      const sepX = startX + gap * (i - 0.5);
      for (let y = 79; y < 121; y += 10) {
        ctx.beginPath();
        ctx.moveTo(X(sepX), Y(y));
        ctx.lineTo(X(sepX), Y(y + 5));
        ctx.stroke();
      }
    }

    hours.forEach((item, index) => {
      const x = startX + index * gap;
      const itemRain = item.is_rain || /雨|雷|雪/.test(String(item.text || ''));
      const color = itemRain ? RED : BLACK;
      setFont(13, 'bold');
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(String(item.time || '--时'), X(x), Y(88));
      drawMiniWeatherIcon(x - 4, 101, getWeatherKind(item), 0.39, color);
      setFont(16, 'bold');
      ctx.fillStyle = BLACK;
      const temp = item.temp === undefined || item.temp === null || item.temp === '' ? '--' : item.temp;
      ctx.fillText(`${temp}°`, X(x), Y(124));
    });
    ctx.textAlign = 'left';
  }

  function drawDailyTokenRow(labelX, rowY, trackX, trackW, valueColX, tokenText) {
    const ctx = canvas.getContext('2d');

    setFont(18, 'bold');
    ctx.fillStyle = BLACK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('今日Token', X(labelX), Y(rowY + 6));

    const startX = trackX + 6;
    const valueGap = tokenText.length >= 6 ? 76 : 62;
    const endX = Math.min(trackX + trackW - 8, valueColX - valueGap);
    const marks = [
      [0.02, -12, 'ring'], [0.08, 6, 'dot'], [0.14, 1, 'dot'], [0.20, -8, 'dot'],
      [0.27, 7, 'ring'], [0.34, -3, 'dot'], [0.40, -10, 'star'], [0.47, 4, 'ring'],
      [0.54, -8, 'dot'], [0.61, 2, 'dot'], [0.68, -12, 'ring'], [0.75, 6, 'star'],
      [0.83, -4, 'dot'], [0.91, -10, 'ring']
    ];

    function particleX(t) { return startX + (endX - startX) * t; }

    for (let i = 0; i < marks.length; i++) {
      const [t, dy, type] = marks[i];
      const x = particleX(t);
      const y = rowY + dy;
      ctx.strokeStyle = RED;
      ctx.lineWidth = SS(type === 'dot' ? 1.8 : 1.4);
      ctx.fillStyle = RED;

      if (type === 'ring') {
        ctx.beginPath();
        ctx.arc(X(x), Y(y), SS(5.2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(X(x + 0.9), Y(y - 0.6), SS(2.7), 0, Math.PI * 2);
        ctx.stroke();
      } else if (type === 'star') {
        ctx.beginPath();
        ctx.moveTo(X(x), Y(y - 7));
        ctx.lineTo(X(x), Y(y + 7));
        ctx.moveTo(X(x - 7), Y(y));
        ctx.lineTo(X(x + 7), Y(y));
        ctx.moveTo(X(x - 4.8), Y(y - 4.8));
        ctx.lineTo(X(x + 4.8), Y(y + 4.8));
        ctx.moveTo(X(x + 4.8), Y(y - 4.8));
        ctx.lineTo(X(x - 4.8), Y(y + 4.8));
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(X(x), Y(y), SS(2.8), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    setFont(tokenText.length >= 6 ? 21 : 24, 'bold');
    ctx.fillStyle = BLACK;
    ctx.textAlign = 'right';
    ctx.fillText(tokenText, X(valueColX), Y(rowY + 6));
    ctx.strokeStyle = RED;
    ctx.lineWidth = SS(1.4);
    ctx.beginPath();
    ctx.moveTo(X(valueColX - 52), Y(rowY + 12));
    ctx.quadraticCurveTo(X(valueColX - 28), Y(rowY + 16), X(valueColX), Y(rowY + 12));
    ctx.stroke();
    ctx.textAlign = 'left';
  }

  return { setFont, drawWobbleLine, drawBox, drawRichText, drawBrainIcon, drawAutoIcon,
    drawProgressBar, drawDots, drawHeart, drawDailyTokenRow, drawWeatherHeader, drawBottomCentered, clampNumber, getSevenDayRemainingDays };
}

// ----------------------------------------------------
// 核心绘画引擎调度器
// ----------------------------------------------------
function renderPreview() {
  const canvas = getEl('preview-canvas');
  const ctx = canvas.getContext('2d');
  const templateId = getEl('cfg-template')?.value || 'handdraw_card';
  const template = previewTemplates[templateId] || previewTemplates.handdraw_card;
  template.render(ctx, buildRenderState(), createRenderHelpers(canvas));
}

// ----------------------------------------------------
// 数据刷新与蓝牙交互
// ----------------------------------------------------
async function refreshData() {
  try {
    const resp = await fetch('/api/status'); const data = await resp.json();
    codexQuotaStatus.five_hour_percent = data.five_hour_percent ?? 0;
    codexQuotaStatus.seven_day_percent = data.seven_day_percent ?? 0;
    codexQuotaStatus.refresh_5h = data.refresh_5h || '';
    codexQuotaStatus.refresh_7d = data.refresh_7d || '';
    codexQuotaStatus.daily_total_tokens = data.daily_total_tokens ?? codexQuotaStatus.daily_total_tokens ?? 0;
    codexQuotaStatus.updated_at = data.updated_at || '';
    codexQuotaStatus.next_refresh_at = data.next_refresh_at || '';
    codexQuotaStatus.date_text = data.date_text || '';
    codexQuotaStatus.subheadline = data.subheadline || data.subHeadline || codexQuotaStatus.subheadline || '';
    codexQuotaStatus.ble_status = EPD.isConnected() ? '已连接' : '未连接';
    const quotaCopy = getQuotaCopy(codexQuotaStatus.five_hour_percent);
    codexQuotaStatus.status_label = quotaCopy.status;
    codexQuotaStatus.headline = quotaCopy.headline;
    codexQuotaStatus.highlight_text = quotaCopy.highlight;
    
    if (data.title !== undefined) getEl('cfg-title').value = data.title;
    const currentTemplateId = getEl('cfg-template')?.value || 'handdraw_card';
    if (currentTemplateId !== 'custom_token_daily_card') {
      getEl('cfg-headline').value = quotaCopy.headline;
      getEl('cfg-highlight').value = quotaCopy.highlight;
    }
    setDisabledSubheadlineText();
    
    updateQuotaDisplay(); addLog('额度数据已从后端刷新');
  } catch (e) { addLog('刷新失败: ' + e.message); }
  await refreshWeatherData();
  
  renderPreview(); saveUserSettings();
}

async function refreshWeatherData() {
  const interval = getEl('cfg-weather-interval')?.value || '1';
  try {
    const resp = await fetch(`/api/weather?interval=${encodeURIComponent(interval)}`);
    const data = await resp.json();
    weatherStatus.ok = Boolean(data.ok);
    weatherStatus.updated_at = data.updated_at || '--:--';
    weatherStatus.interval_hours = data.interval_hours || Number(interval) || 1;
    weatherStatus.location_name = data.location_name || weatherStatus.location_name || '';
    weatherStatus.summary = data.summary || weatherStatus.summary || '未来天气';
    weatherStatus.now = data.now || weatherStatus.now;
    weatherStatus.hours = Array.isArray(data.hours) && data.hours.length ? data.hours.slice(0, 4) : weatherStatus.hours;
    weatherStatus.error = data.error || '';
    addLog(weatherStatus.ok ? '天气数据已从后端刷新' : ('天气数据不可用: ' + (weatherStatus.error || '未配置')));
  } catch (e) {
    weatherStatus.ok = false;
    weatherStatus.error = e.message;
    addLog('天气刷新失败: ' + e.message);
  }
}

async function connectDevice() {
  const btn = getEl('btn-connect');
  if (EPD.isConnected()) { await EPD.disconnect(); btn.innerHTML = '连接设备'; getEl('ble-status').textContent = '未连接'; getEl('ble-status').className = 'color-warn'; codexQuotaStatus.ble_status = '未连接'; renderPreview(); return; }
  const ok = await EPD.connect();
  if (ok) { btn.innerHTML = '断开设备'; getEl('ble-status').textContent = '已连接: ' + (EPD._device ? EPD._device.name : ''); getEl('ble-status').className = 'color-primary'; codexQuotaStatus.ble_status = '已连接'; }
  renderPreview();
}

async function sendToDevice() {
  if (isSending) { addLog('正在发送中，请等待当前传输完成'); return; }
  if (!navigator.bluetooth) { addLog('当前浏览器不支持 Web Bluetooth，请使用 Chrome 或 Edge，并通过 localhost/HTTPS 打开页面'); return; }
  if (!EPD.isConnected()) { setBleStatus('未连接', 'color-warn'); addLog('请先点击“连接设备”，选择墨水屏后再发送'); return; }
  try {
    setSendBusy(true);
    setBleStatus('发送中...', 'color-primary');
    addLog('开始发送当前预览到墨水屏');
    const canvas = getEl('preview-canvas'), { w, h } = getScreenSize();
    const colorMode = getEl('cfg-color-mode').value;
    const planes = canvasToEpaperPlanes(canvas, { width: w, height: h, colorMode, invertBlack: false, invertRed: false });
    if (shouldInvertBlackPlaneForSend()) {
      planes.blackPlane = invertPlaneBytes(planes.blackPlane);
      addLog('已按当前驱动反转黑色通道');
    }
    if (shouldInvertRedPlaneForSend()) {
      planes.redPlane = invertPlaneBytes(planes.redPlane);
      addLog('已按当前驱动反转红色通道');
    }
    await EPD.sendImage({ blackPlane: planes.blackPlane, redPlane: planes.redPlane, driver: getEl('cfg-driver').value, mtu: 20, interleaved: 50 });
    lastRefreshAt = new Date(); setBleStatus('已连接', 'color-primary'); addLog('发送成功，墨水屏应开始刷新'); updateCountdown();
  } catch (e) { setBleStatus(EPD.isConnected() ? '发送失败' : '未连接', 'color-warn'); addLog('发送失败: ' + e.message); }
  finally { setSendBusy(false); renderPreview(); }
}

function toggleAutoRefresh() { autoRefreshEnabled = getEl('cfg-auto-refresh').checked; if (autoRefreshEnabled) startAutoRefresh(); else stopAutoRefresh(); saveUserSettings(); }
function startAutoRefresh() { stopAutoRefresh(); const interval = refreshIntervalMinutes * 60 * 1000; nextRefreshAt = new Date(Date.now() + interval); autoRefreshTimer = setInterval(async () => { await refreshData(); if (EPD.isConnected()) await sendToDevice(); nextRefreshAt = new Date(Date.now() + interval); updateCountdown(); }, interval); updateCountdown(); addLog('自动刷新: 每' + refreshIntervalMinutes + '分钟'); }
function stopAutoRefresh() { if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; } nextRefreshAt = null; updateCountdown(); }
function onRefreshIntervalChange() { const val = getEl('cfg-refresh-interval').value; if (val === 'custom') { getEl('cfg-custom-min').style.display = 'inline'; refreshIntervalMinutes = parseInt(getEl('cfg-custom-min').value) || 30; } else { getEl('cfg-custom-min').style.display = 'none'; refreshIntervalMinutes = parseInt(val); } if (autoRefreshEnabled) startAutoRefresh(); saveUserSettings(); }
function updateCountdown() { const el = getEl('countdown'), lastEl = getEl('last-refresh-time'), nextEl = getEl('next-refresh-time'); if (lastRefreshAt) lastEl.textContent = formatTime(lastRefreshAt); if (nextRefreshAt && autoRefreshEnabled) { nextEl.textContent = formatTime(nextRefreshAt); const diff = Math.max(0, Math.floor((nextRefreshAt - Date.now()) / 1000)); el.textContent = `${Math.floor(diff / 60)}分${diff % 60}秒`; } else { nextEl.textContent = '-'; el.textContent = '-'; } }
function formatTime(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function addLog(msg) { const log = getEl('log'), now = new Date(); const ts = [now.getHours(), now.getMinutes(), now.getSeconds()].map(v => String(v).padStart(2, '0')).join(':'); const div = document.createElement('div'); div.textContent = `[${ts}] ${msg}`; log.appendChild(div); log.scrollTop = log.scrollHeight; while (log.children.length > 50) log.removeChild(log.firstChild); }
function setSendBusy(busy) { isSending = busy; const btn = getEl('btn-send'); if (!btn) return; btn.disabled = busy; btn.textContent = busy ? '正在发送...' : '发送至屏幕'; }
function setBleStatus(text, className = 'color-primary') { const el = getEl('ble-status'); if (!el) return; el.textContent = text; el.className = className; }
function invertPlaneBytes(plane) { const out = new Uint8Array(plane.length); for (let i = 0; i < plane.length; i++) out[i] = plane[i] ^ 0xFF; return out; }
function shouldInvertBlackPlaneForSend() { return getEl('cfg-invert-bw').checked || getEl('cfg-driver').value === '02'; }
function shouldInvertRedPlaneForSend() { return getEl('cfg-invert-red').checked || getEl('cfg-driver').value === '02'; }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function fillThemeSelect(selectId, themes, selectedId) {
  const select = getEl(selectId);
  if (!select) return;
  select.innerHTML = themes.map(theme => `<option value="${escapeHtml(theme.id)}">${escapeHtml(theme.name)}</option>`).join('');
  select.value = selectedId;
}

function populateAutoIconThemeSelect(selectedId = 'brain') {
  const select = getEl('cfg-auto-icon-theme');
  if (!select) return;
  select.innerHTML = autoIconThemes.map(theme => `<option value="${escapeHtml(theme.id)}">${escapeHtml(theme.label)}</option>`).join('');
  select.value = autoIconThemes.some(theme => theme.id === selectedId) ? selectedId : 'brain';
}

function populateThemeControls() {
  fillThemeSelect('cfg-status-theme', quotaThemeSettings.statusThemes, quotaThemeSettings.selectedStatusThemeId);
  fillThemeSelect('cfg-headline-theme', quotaThemeSettings.headlineThemes, quotaThemeSettings.selectedHeadlineThemeId);
  renderStatusThemeEditor();
  renderHeadlineThemeEditor();
}

function syncThemeSelectLabels() {
  fillThemeSelect('cfg-status-theme', quotaThemeSettings.statusThemes, quotaThemeSettings.selectedStatusThemeId);
  fillThemeSelect('cfg-headline-theme', quotaThemeSettings.headlineThemes, quotaThemeSettings.selectedHeadlineThemeId);
}

function renderStatusThemeEditor() {
  const editor = getEl('status-theme-editor');
  if (!editor) return;
  const theme = getCurrentStatusTheme();
  editor.innerHTML = [
    `<div class="theme-row"><label>名称</label><input type="text" id="cfg-status-theme-name" value="${escapeHtml(theme.name)}"></div>`,
    ...quotaBands.map(band => `<div class="theme-row"><label>${band.label}</label><input type="text" class="status-band-input" data-band="${band.id}" value="${escapeHtml(theme.bands[band.id])}"></div>`)
  ].join('');

  getEl('cfg-status-theme-name')?.addEventListener('input', (ev) => {
    theme.name = ev.target.value || buildThemeNameFromStatusBands(theme.bands);
    syncThemeSelectLabels();
    saveThemeSettings();
  });
  editor.querySelectorAll('.status-band-input').forEach(input => {
    input.addEventListener('input', (ev) => {
      theme.bands[ev.target.dataset.band] = ev.target.value;
      saveThemeSettings();
      applyThemeCopyToRuntime();
    });
  });
}

function renderHeadlineThemeEditor() {
  const editor = getEl('headline-theme-editor');
  if (!editor) return;
  const theme = getCurrentHeadlineTheme();
  editor.innerHTML = [
    `<div class="theme-row"><label>名称</label><input type="text" id="cfg-headline-theme-name" value="${escapeHtml(theme.name)}"></div>`,
    ...quotaBands.map((band) => {
      const copy = theme.bands[band.id] || {};
      return `<div class="theme-row"><label>${band.label}</label><div class="theme-duo"><input type="text" class="headline-band-input" data-band="${band.id}" data-field="headline" value="${escapeHtml(copy.headline)}"><input type="text" class="headline-band-input" data-band="${band.id}" data-field="highlight" value="${escapeHtml(copy.highlight)}"></div></div>`;
    })
  ].join('');

  getEl('cfg-headline-theme-name')?.addEventListener('input', (ev) => {
    theme.name = ev.target.value || buildThemeNameFromHeadlineBands(theme.bands);
    syncThemeSelectLabels();
    saveThemeSettings();
  });
  editor.querySelectorAll('.headline-band-input').forEach(input => {
    input.addEventListener('input', (ev) => {
      const bandId = ev.target.dataset.band;
      const field = ev.target.dataset.field;
      theme.bands[bandId][field] = ev.target.value;
      saveThemeSettings();
      applyThemeCopyToRuntime();
    });
  });
  setHeadlineThemeControlsDisabled(isWeatherTemplateSelected());
}

function createStatusTheme() {
  const bands = cloneData(getCurrentStatusTheme().bands);
  const theme = {
    id: `status_custom_${Date.now()}`,
    name: uniqueThemeName(buildThemeNameFromStatusBands(bands), quotaThemeSettings.statusThemes),
    bands,
  };
  quotaThemeSettings.statusThemes.push(theme);
  quotaThemeSettings.selectedStatusThemeId = theme.id;
  saveThemeSettings();
  populateThemeControls();
  openThemeDetail('status-theme-detail');
  applyThemeCopyToRuntime();
}

function createHeadlineTheme() {
  const bands = cloneData(getCurrentHeadlineTheme().bands);
  const theme = {
    id: `headline_custom_${Date.now()}`,
    name: uniqueThemeName(buildThemeNameFromHeadlineBands(bands), quotaThemeSettings.headlineThemes),
    bands,
  };
  quotaThemeSettings.headlineThemes.push(theme);
  quotaThemeSettings.selectedHeadlineThemeId = theme.id;
  saveThemeSettings();
  populateThemeControls();
  openThemeDetail('headline-theme-detail');
  applyThemeCopyToRuntime();
}

function isCustomTemplateSelected() {
  return (getEl('cfg-template')?.value || 'handdraw_card') === 'custom_token_daily_card';
}

function isWeatherTemplateSelected() {
  return (getEl('cfg-template')?.value || 'handdraw_card') === 'weather_token_card';
}

function setHeadlineThemeControlsDisabled(disabled) {
  const headlineThemeSelect = getEl('cfg-headline-theme');
  const addHeadlineThemeButton = getEl('btn-add-headline-theme');
  const headlineThemeEditor = getEl('headline-theme-editor');
  const headlineThemeDetail = getEl('headline-theme-detail');
  if (headlineThemeSelect) headlineThemeSelect.disabled = disabled;
  if (addHeadlineThemeButton) addHeadlineThemeButton.disabled = disabled;
  headlineThemeEditor?.querySelectorAll('input').forEach(input => {
    input.disabled = disabled;
  });
  if (headlineThemeDetail) {
    headlineThemeDetail.classList.toggle('is-disabled', disabled);
    if (disabled) headlineThemeDetail.open = false;
  }
  headlineThemeEditor?.closest('.theme-block')?.classList.toggle('is-disabled', disabled);
}

function setTemplateFieldsCompact(disabled) {
  const detail = getEl('template-fields-detail');
  if (!detail) return;
  detail.classList.toggle('is-disabled', disabled);
  detail.open = !disabled;
}

function openThemeDetail(id) {
  const detail = getEl(id);
  if (detail && !detail.classList.contains('is-disabled')) detail.open = true;
}

function applyThemeCopyToRuntime() {
  const quotaCopy = getQuotaCopy(codexQuotaStatus.five_hour_percent);
  codexQuotaStatus.status_label = quotaCopy.status;
  codexQuotaStatus.headline = quotaCopy.headline;
  codexQuotaStatus.highlight_text = quotaCopy.highlight;
  if (!isCustomTemplateSelected()) {
    getEl('cfg-headline').value = quotaCopy.headline;
    getEl('cfg-highlight').value = quotaCopy.highlight;
  }
  updateQuotaDisplay();
  renderPreview();
}

function setupThemeControls() {
  getEl('headline-theme-detail')?.addEventListener('toggle', (ev) => {
    if (isWeatherTemplateSelected() && ev.target.open) ev.target.open = false;
  });
  getEl('template-fields-detail')?.addEventListener('toggle', (ev) => {
    if (isWeatherTemplateSelected() && ev.target.open) ev.target.open = false;
  });
  getEl('cfg-status-theme')?.addEventListener('change', (ev) => {
    quotaThemeSettings.selectedStatusThemeId = ev.target.value;
    saveThemeSettings();
    renderStatusThemeEditor();
    applyThemeCopyToRuntime();
  });
  getEl('cfg-headline-theme')?.addEventListener('change', (ev) => {
    quotaThemeSettings.selectedHeadlineThemeId = ev.target.value;
    saveThemeSettings();
    renderHeadlineThemeEditor();
    applyThemeCopyToRuntime();
  });
  getEl('btn-add-status-theme')?.addEventListener('click', createStatusTheme);
  getEl('btn-add-headline-theme')?.addEventListener('click', createHeadlineTheme);
}

/** 根据当前模板类型更新控件的禁用/启用状态 */
function updateControlStates(templateId) {
  const isCustom = templateId === 'custom_token_daily_card';
  const isWeather = templateId === 'weather_token_card';
  getEl('cfg-headline').disabled = !isCustom;
  getEl('cfg-highlight').disabled = !isCustom;
  setHeadlineThemeControlsDisabled(isWeather);
  setTemplateFieldsCompact(isWeather);
  setDisabledSubheadlineText();
  getEl('icon-upload').disabled = !isCustom;
  if (getEl('cfg-auto-icon-theme')) getEl('cfg-auto-icon-theme').disabled = isCustom || isWeather;
  if (getEl('cfg-weather-interval')) getEl('cfg-weather-interval').disabled = !isWeather;
  const resetBtn = document.querySelector('button[onclick="resetIcon()"]');
  if (resetBtn) resetBtn.disabled = !isCustom;
}

function handleImageUpload(e) {
  const currentTemplateId = getEl('cfg-template')?.value || 'handdraw_card';
  if (currentTemplateId !== 'custom_token_daily_card') return;
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) { const img = new Image(); img.onload = function() { const ic = getEl('hidden-icon-canvas'); ic.width = 32; ic.height = 32; const ictx = ic.getContext('2d'); ictx.fillStyle = '#FFFFFF'; ictx.fillRect(0, 0, 32, 32); ictx.drawImage(img, 0, 0, 32, 32); customImage = true; renderPreview(); addLog('图标已加载'); }; img.src = ev.target.result; };
  reader.readAsDataURL(file);
}
function resetIcon() {
  const currentTemplateId = getEl('cfg-template')?.value || 'handdraw_card';
  if (currentTemplateId !== 'custom_token_daily_card') return;
  customImage = null; const ic = getEl('hidden-icon-canvas'); ic.width = 0; ic.height = 0; renderPreview(); addLog('图标已重置'); }

document.addEventListener('DOMContentLoaded', () => {
  loadThemeSettings();
  populateAutoIconThemeSelect(loadUserSettings().autoIconThemeId || 'brain');
  applyUserSettings(loadUserSettings());
  setupThemeControls();
  populateThemeControls();
  updateControlStates(getEl('cfg-template')?.value || 'handdraw_card');
  applyThemeCopyToRuntime();
  EPD.onLog(addLog);
  EPD.onStatus((msg) => {
    setBleStatus('发送中 ' + msg, 'color-primary');
    const now = Date.now();
    if (now - lastTransferStatusAt > 800) {
      addLog('传输进度: ' + msg);
      lastTransferStatusAt = now;
    }
  });
  window.addEventListener('error', (ev) => addLog('页面错误: ' + ev.message));
  window.addEventListener('unhandledrejection', (ev) => addLog('异步错误: ' + (ev.reason?.message || ev.reason)));
  ['cfg-title', 'cfg-headline', 'cfg-subheadline', 'cfg-highlight'].forEach(id => getEl(id).addEventListener('input', () => { renderPreview(); saveUserSettings(); }));
  ['cfg-screen', 'cfg-color-mode', 'cfg-invert-bw', 'cfg-invert-red'].forEach(id => getEl(id).addEventListener('change', () => { updateScreenSize(); renderPreview(); saveUserSettings(); }));
  getEl('cfg-driver').addEventListener('change', () => { saveUserSettings(); });
  if (getEl('cfg-template')) getEl('cfg-template').addEventListener('change', () => {
    templateFromUrl = false;
    const newTemplateId = getEl('cfg-template').value;
    storedTemplateIdBeforeUrlPreview = newTemplateId;
    updateControlStates(newTemplateId);
    const isCustom = newTemplateId === 'custom_token_daily_card';
    if (isCustom) {
      getEl('cfg-headline').value = '这里是主文案';
      getEl('cfg-highlight').value = '';
    } else {
      applyThemeCopyToRuntime();
    }
    if (newTemplateId === 'weather_token_card') refreshWeatherData().finally(renderPreview);
    renderPreview(); saveUserSettings();
  });
  getEl('cfg-auto-refresh').addEventListener('change', toggleAutoRefresh);
  getEl('cfg-refresh-interval').addEventListener('change', onRefreshIntervalChange);
  getEl('cfg-custom-min').addEventListener('input', () => { refreshIntervalMinutes = parseInt(getEl('cfg-custom-min').value) || 30; if (autoRefreshEnabled) startAutoRefresh(); saveUserSettings(); });
  getEl('cfg-auto-icon-theme')?.addEventListener('change', () => { renderPreview(); saveUserSettings(); });
  getEl('cfg-weather-interval')?.addEventListener('change', async () => { await refreshWeatherData(); renderPreview(); saveUserSettings(); });
  getEl('icon-upload').addEventListener('change', handleImageUpload);
  setInterval(updateCountdown, 1000);
  refreshData();
});
