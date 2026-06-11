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

// 数据模型
const codexQuotaStatus = {
  five_hour_percent: 49, seven_day_percent: 71,
  daily_total_tokens: 8523043,
  refresh_5h: '19:51', refresh_7d: '06/11',
  updated_at: '18:58', next_refresh_at: '19:51',
  status_label: '状态温热', headline: '省着点用...', subheadline: '当前能量消耗较快，建议控制使用频率', 
  date_text: '6/5 周五', ble_status: '' 
};

const userDefaults = {
  title: 'Codex plus', headline: '省着点用...', subHeadline: '当前能量消耗较快，建议控制使用频率', highlightText: '省着点',
  driver: '03', screenPreset: '4.2_400_300', colorMode: 'bwr',
  refreshInterval: 30, autoRefresh: false, invertBlack: false, invertRed: false,
  templateId: 'handdraw_card',
};

const screenPresets = {
  '2.13_122_250': { w: 250, h: 122 }, '2.13_104_212': { w: 212, h: 104 },
  '2.9_128_296': { w: 296, h: 128 }, '4.2_400_300': { w: 400, h: 300 },
};

function getEl(id) { return document.getElementById(id); }

function getQuotaCopy(percent) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  if (pct >= 81) return { status: '满血复活', headline: '随便造！！', highlight: '随便造' };
  if (pct >= 61) return { status: '电量健康', headline: '还能打！！', highlight: '还能打' };
  if (pct >= 41) return { status: '脑袋温热', headline: '省着点用...', highlight: '省着点' };
  if (pct >= 21) return { status: '脑袋发烫', headline: '别猛冲了！！', highlight: '别猛冲' };
  return { status: '人都麻了', headline: '快歇会儿！！', highlight: '快歇会儿' };
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
  };
  localStorage.setItem('codex-epaper-settings', JSON.stringify(s));
}

function applyUserSettings(s) {
  getEl('cfg-title').value = s.title; getEl('cfg-headline').value = s.headline;
  getEl('cfg-subheadline').value = s.subHeadline || '';
  getEl('cfg-highlight').value = s.highlightText; getEl('cfg-driver').value = s.driver;
  getEl('cfg-screen').value = s.screenPreset; getEl('cfg-color-mode').value = s.colorMode;
  getEl('cfg-invert-bw').checked = s.invertBlack; getEl('cfg-invert-red').checked = s.invertRed;
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
      const { setFont, drawWobbleLine, drawBox, drawRichText, drawBrainIcon,
        drawProgressBar, drawDots, drawHeart, drawDailyTokenRow, drawBottomCentered, clampNumber, getSevenDayRemainingDays } = helpers;

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
      drawBrainIcon(73, 93, 70, fiveHourPercent);
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
  const headline = quotaCopy.headline;
  const subline = getEl('cfg-subheadline').value || q.subheadline || q.subHeadline || '';
  const inputHighlight = (getEl('cfg-highlight').value || '').trim();
  const autoHighlight = quotaCopy.highlight || ['麻', '过载', '温热', '危险', '枯竭'].find(t => headline.includes(t)) || '';
  const hlText = headline.includes(inputHighlight) ? inputHighlight : (q.highlight_text || q.highlightText || autoHighlight);

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
    dateText, updatedAt, nextAt, bleConnected, bleText, dailyTokenText };
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

  return { setFont, drawWobbleLine, drawBox, drawRichText, drawBrainIcon,
    drawProgressBar, drawDots, drawHeart, drawDailyTokenRow, drawBottomCentered, clampNumber, getSevenDayRemainingDays };
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
    getEl('cfg-headline').value = quotaCopy.headline;
    getEl('cfg-highlight').value = quotaCopy.highlight;
    getEl('cfg-subheadline').value = data.subheadline || data.subHeadline || '';
    
    updateQuotaDisplay(); addLog('额度数据已从后端刷新');
  } catch (e) { addLog('刷新失败: ' + e.message); }
  
  renderPreview(); saveUserSettings();
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

function handleImageUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) { const img = new Image(); img.onload = function() { const ic = getEl('hidden-icon-canvas'); ic.width = 32; ic.height = 32; const ictx = ic.getContext('2d'); ictx.fillStyle = '#FFFFFF'; ictx.fillRect(0, 0, 32, 32); ictx.drawImage(img, 0, 0, 32, 32); customImage = true; renderPreview(); addLog('图标已加载'); }; img.src = ev.target.result; };
  reader.readAsDataURL(file);
}
function resetIcon() { customImage = null; const ic = getEl('hidden-icon-canvas'); ic.width = 0; ic.height = 0; renderPreview(); addLog('图标已重置'); }

document.addEventListener('DOMContentLoaded', () => {
  applyUserSettings(loadUserSettings());
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
  if (getEl('cfg-template')) getEl('cfg-template').addEventListener('change', () => { templateFromUrl = false; storedTemplateIdBeforeUrlPreview = getEl('cfg-template').value; renderPreview(); saveUserSettings(); });
  getEl('cfg-auto-refresh').addEventListener('change', toggleAutoRefresh);
  getEl('cfg-refresh-interval').addEventListener('change', onRefreshIntervalChange);
  getEl('cfg-custom-min').addEventListener('input', () => { refreshIntervalMinutes = parseInt(getEl('cfg-custom-min').value) || 30; if (autoRefreshEnabled) startAutoRefresh(); saveUserSettings(); });
  getEl('icon-upload').addEventListener('change', handleImageUpload);
  setInterval(updateCountdown, 1000);
  refreshData();
});
