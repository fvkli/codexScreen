const EPD = new EpdNrf5Client();
let autoRefreshEnabled = false;
let refreshIntervalMinutes = 30;
let autoRefreshTimer = null;
let nextRefreshAt = null;
let lastRefreshAt = null;
let customImage = null;

// 数据模型
const codexQuotaStatus = {
  five_hour_percent: 49, seven_day_percent: 71,
  refresh_5h: '19:51', refresh_7d: '06/11',
  updated_at: '18:58', next_refresh_at: '19:51',
  status_label: '状态温热', headline: '省着点用...', subheadline: '当前能量消耗较快，建议控制使用频率', 
  date_text: '6/5 周五', ble_status: '' 
};

const userDefaults = {
  title: 'Codex plus', headline: '省着点用...', subHeadline: '当前能量消耗较快，建议控制使用频率', highlightText: '省着点',
  driver: '03', screenPreset: '4.2_400_300', colorMode: 'bwr',
  refreshInterval: 30, autoRefresh: false, invertBlack: false, invertRed: false,
};

const screenPresets = {
  '2.13_122_250': { w: 250, h: 122 }, '2.13_104_212': { w: 212, h: 104 },
  '2.9_128_296': { w: 296, h: 128 }, '4.2_400_300': { w: 400, h: 300 },
};

function getEl(id) { return document.getElementById(id); }

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
  };
  localStorage.setItem('codex-epaper-settings', JSON.stringify(s));
}

function applyUserSettings(s) {
  getEl('cfg-title').value = s.title; getEl('cfg-headline').value = s.headline;
  getEl('cfg-subheadline').value = s.subHeadline || '';
  getEl('cfg-highlight').value = s.highlightText; getEl('cfg-driver').value = s.driver;
  getEl('cfg-screen').value = s.screenPreset; getEl('cfg-color-mode').value = s.colorMode;
  getEl('cfg-invert-bw').checked = s.invertBlack; getEl('cfg-invert-red').checked = s.invertRed;
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
  for (let i = 0; i < 8; i++) {
    const d = document.createElement('span');
    d.className = 'dot' + (i < Math.round(8 * q.seven_day_percent / 100) ? ' filled' : '');
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

// ----------------------------------------------------
// 核心绘画引擎 (完美还原实拍图级 UI)
// ----------------------------------------------------
function renderPreview() {
  const canvas = getEl('preview-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  
  // 以 400x300 为设计基准进行全尺寸缩放适应
  const scaleW = W / 400;
  const scaleH = H / 300;
  const S = Math.min(scaleW, scaleH); // 保持元素的完美比例
  
  const BLACK = '#000000', RED = '#FF0000', WHITE = '#FFFFFF';
  ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H);

  const q = codexQuotaStatus;
  const headline = getEl('cfg-headline').value || '';
  const subline = getEl('cfg-subheadline').value || '';
  const hlText = getEl('cfg-highlight').value || '';

  // --- 通用绘画函数 ---
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function drawRichText(text, x, y, font, align) {
    ctx.font = font; ctx.textBaseline = 'alphabetic';
    let totalW = 0, parts = [];
    if (hlText && text.includes(hlText)) {
      parts = text.split(hlText);
      parts.forEach((p, i) => { totalW += ctx.measureText(p).width; if (i < parts.length - 1) totalW += ctx.measureText(hlText).width; });
    } else { totalW = ctx.measureText(text).width; parts = [text]; }
    let cx = align === 'center' ? x - totalW / 2 : x;
    if (!hlText) { ctx.fillStyle = BLACK; ctx.fillText(text, cx, y); return; }
    parts.forEach((p, i) => {
      if (p) { ctx.fillStyle = BLACK; ctx.fillText(p, cx, y); cx += ctx.measureText(p).width; }
      if (i < parts.length - 1) { ctx.fillStyle = RED; ctx.fillText(hlText, cx, y); cx += ctx.measureText(hlText).width; }
    });
  }

  // 绘制底部带红框的楷体字
  function drawKaiTiBox(text, cx, cy, S) {
    ctx.font = `${Math.round(11 * S)}px "KaiTi", "STKaiti", "楷体", serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const tw = ctx.measureText(text).width;
    const padX = 5 * S, padY = 4 * S;
    const boxW = tw + padX * 2, boxH = 16 * S + padY * 2;
    
    ctx.strokeStyle = RED; ctx.lineWidth = Math.max(1, Math.floor(S));
    roundRect(ctx, cx - boxW/2, cy - boxH/2, boxW, boxH, 3 * S); ctx.stroke();
    
    ctx.fillStyle = BLACK; ctx.fillText(text, cx, cy + 1*S);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  // 根据剩余能量区间绘制动态表情
  function drawDynamicFace(cx, cy, r, pct) {
    ctx.lineWidth = 2 * S;
    if (pct >= 80) { 
      // 80-100: 极佳 (黑底白脸，大笑)
      ctx.fillStyle = BLACK; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = WHITE; ctx.fillStyle = WHITE;
      ctx.beginPath(); ctx.arc(cx - r*0.35, cy - r*0.1, r*0.15, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r*0.35, cy - r*0.1, r*0.15, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + r*0.1, r*0.5, 0, Math.PI, false); ctx.stroke();
    } else if (pct >= 60) { 
      // 60-80: 良好 (白底黑线，微小)
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = BLACK; ctx.stroke(); ctx.fillStyle = BLACK;
      ctx.beginPath(); ctx.arc(cx - r*0.35, cy - r*0.1, r*0.1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r*0.35, cy - r*0.1, r*0.1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + r*0.2, r*0.4, 0.2, Math.PI-0.2, false); ctx.stroke();
    } else if (pct >= 40) { 
      // 40-60: 正常 (白底红线或黑线，平淡)
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = RED; ctx.stroke(); ctx.fillStyle = BLACK; ctx.strokeStyle = BLACK;
      ctx.beginPath(); ctx.arc(cx - r*0.35, cy - r*0.1, r*0.1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r*0.35, cy - r*0.1, r*0.1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - r*0.3, cy + r*0.3); ctx.lineTo(cx + r*0.3, cy + r*0.3); ctx.stroke();
    } else if (pct >= 20) { 
      // 20-40: 警告 (红底白线，难过)
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = WHITE; ctx.fillStyle = WHITE;
      ctx.beginPath(); ctx.arc(cx - r*0.35, cy - r*0.1, r*0.12, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r*0.35, cy - r*0.1, r*0.12, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + r*0.5, r*0.3, Math.PI, 0, false); ctx.stroke();
    } else { 
      // 0-20: 枯竭 (红底白线，大哭打叉)
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = WHITE; ctx.lineWidth = 2 * S;
      ctx.beginPath(); ctx.moveTo(cx - r*0.5, cy - r*0.3); ctx.lineTo(cx - r*0.2, cy - r*0.0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - r*0.2, cy - r*0.3); ctx.lineTo(cx - r*0.5, cy - r*0.0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + r*0.5, cy - r*0.3); ctx.lineTo(cx + r*0.2, cy - r*0.0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + r*0.2, cy - r*0.3); ctx.lineTo(cx + r*0.5, cy - r*0.0); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + r*0.5, r*0.3, Math.PI, 0, false); ctx.stroke();
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(cx + r*0.5, cy + r*0.3, r*0.15, 0, Math.PI*2); ctx.fill(); // 汗水
    }
  }

  // 布局百分比锚定
  const headY = H * 0.12;
  const card1Y = headY + H * 0.04;
  const card1H = H * 0.32;
  const card2Y = card1Y + card1H + H * 0.04;
  const card2H = H * 0.38;
  const footY = H - (H * 0.08);

  // === 1. 顶部 Header ===
  ctx.font = `bold ${Math.round(26 * S)}px "Microsoft YaHei",sans-serif`;
  ctx.fillStyle = BLACK; ctx.fillText(getEl('cfg-title').value || 'Codex plus', 10 * scaleW, 28 * scaleH);
  
  const dateText = q.date_text || getWeekday();
  ctx.font = `bold ${Math.round(14 * S)}px "Microsoft YaHei",sans-serif`;
  ctx.fillText(dateText, W - 45 * S - ctx.measureText(dateText).width, 24 * scaleH);
  
  // 电池图标
  ctx.strokeStyle = BLACK; ctx.lineWidth = 1.5 * S;
  ctx.strokeRect(W - 35 * S, 12 * scaleH, 22 * S, 12 * S);
  ctx.fillStyle = RED; ctx.fillRect(W - 33 * S, 14 * scaleH, 12 * S, 8 * S); // 红电
  ctx.fillRect(W - 13 * S, 15 * scaleH, 3 * S, 6 * S); // 电池头

  // 分割红线
  ctx.fillStyle = RED; ctx.fillRect(8 * scaleW, headY, W - 16 * scaleW, 3 * S);

  // === 2. 上层卡片 (主视觉 & 表情) ===
  ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1 * S; // 淡灰色外框模拟阴影
  roundRect(ctx, 10 * scaleW, card1Y, W - 20 * scaleW, card1H, 8 * S); ctx.stroke();
  
  // 左侧大红图标框
  const iconSize = card1H * 0.75;
  const iconX = 20 * scaleW, iconY = card1Y + (card1H - iconSize) / 2;
  if (customImage) {
    const ic = getEl('hidden-icon-canvas');
    if (ic) ctx.drawImage(ic, iconX, iconY, iconSize, iconSize);
  } else {
    ctx.fillStyle = RED; roundRect(ctx, iconX, iconY, iconSize, iconSize, 12 * S); ctx.fill();
    // 画一片白色的树叶
    ctx.strokeStyle = WHITE; ctx.lineWidth = 3 * S; ctx.lineCap = 'round';
    ctx.beginPath(); 
    ctx.moveTo(iconX + iconSize*0.3, iconY + iconSize*0.7);
    ctx.quadraticCurveTo(iconX + iconSize*0.1, iconY + iconSize*0.2, iconX + iconSize*0.7, iconY + iconSize*0.2);
    ctx.quadraticCurveTo(iconX + iconSize*0.8, iconY + iconSize*0.8, iconX + iconSize*0.3, iconY + iconSize*0.7);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(iconX + iconSize*0.3, iconY + iconSize*0.7); ctx.lineTo(iconX + iconSize*0.6, iconY + iconSize*0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(iconX + iconSize*0.45, iconY + iconSize*0.55); ctx.lineTo(iconX + iconSize*0.55, iconY + iconSize*0.65); ctx.stroke();
  }

  // 中间文字
  const textX = iconX + iconSize + 15 * scaleW;
  drawRichText(headline, textX, card1Y + card1H * 0.45, `bold ${Math.round(24 * S)}px "Microsoft YaHei",sans-serif`, 'left');
  ctx.font = `${Math.round(12 * S)}px "Microsoft YaHei",sans-serif`; ctx.fillStyle = '#333333';
  ctx.fillText(subline, textX, card1Y + card1H * 0.75);

  // 右侧动态表情
  const faceX = W - 50 * scaleW, faceY = card1Y + card1H * 0.4, faceR = 18 * S;
  drawDynamicFace(faceX, faceY, faceR, q.five_hour_percent);
  
  // 状态胶囊
  ctx.fillStyle = RED; roundRect(ctx, faceX - 32*S, faceY + 24*S, 64*S, 18*S, 9*S); ctx.fill();
  ctx.fillStyle = WHITE; ctx.font = `bold ${Math.round(10 * S)}px "Microsoft YaHei",sans-serif`;
  ctx.fillText("状态: " + (q.status_label.replace('状态','').trim() || '正常'), faceX - 25*S, faceY + 36*S);

  // === 3. 下层卡片 (能量监测 & 楷体时间) ===
  ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1 * S;
  roundRect(ctx, 10 * scaleW, card2Y, W - 20 * scaleW, card2H, 8 * S); ctx.stroke();

  // 红色标签
  ctx.fillStyle = RED; 
  ctx.beginPath(); ctx.moveTo(10 * scaleW, card2Y); ctx.lineTo(105 * scaleW, card2Y);
  ctx.lineTo(90 * scaleW, card2Y + 28 * S); ctx.lineTo(10 * scaleW, card2Y + 28 * S); ctx.fill();
  ctx.fillStyle = WHITE; ctx.font = `bold ${Math.round(12 * S)}px "Microsoft YaHei",sans-serif`;
  ctx.fillText("能量监测", 35 * scaleW, card2Y + 19 * S);
  // 画个心电小图标
  ctx.strokeStyle = WHITE; ctx.lineWidth = 1.5 * S; ctx.beginPath();
  ctx.arc(22 * scaleW, card2Y + 14 * S, 7 * S, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(17*scaleW, card2Y+14*S); ctx.lineTo(20*scaleW, card2Y+14*S); ctx.lineTo(22*scaleW, card2Y+9*S); ctx.lineTo(24*scaleW, card2Y+18*S); ctx.lineTo(26*scaleW, card2Y+14*S); ctx.lineTo(28*scaleW, card2Y+14*S); ctx.stroke();

  // Row 1: 5小时能量
  const r1Y = card2Y + card2H * 0.4;
  ctx.fillStyle = BLACK; ctx.font = `bold ${Math.round(13 * S)}px "Microsoft YaHei",sans-serif`;
  ctx.fillText("5小时能量", 45 * scaleW, r1Y + 5*S);
  
  // 画格子进度条
  const barX = 115 * scaleW, barW = 120 * scaleW, barH = 14 * S;
  const gridW = barW / 10; const filled5h = Math.max(0, Math.round(10 * q.five_hour_percent / 100));
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = '#666666'; ctx.lineWidth = 1;
    ctx.strokeRect(barX + i * gridW, r1Y - barH/2, gridW, barH);
    if (i < filled5h) { ctx.fillStyle = RED; ctx.fillRect(barX + i * gridW + 1, r1Y - barH/2 + 1, gridW - 2, barH - 2); }
  }
  
  ctx.fillStyle = RED; ctx.font = `bold ${Math.round(18 * S)}px "Microsoft YaHei",sans-serif`;
  ctx.fillText(q.five_hour_percent + "%", barX + barW + 12 * scaleW, r1Y + 6*S);
  
  // 楷体红框时间
  const ref1 = (q.refresh_5h || '19:51') + ' 恢复';
  drawKaiTiBox(ref1, W - 50 * scaleW, r1Y, S);

  // 分割虚线
  ctx.strokeStyle = '#dddddd'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(20 * scaleW, card2Y + card2H * 0.6); ctx.lineTo(W - 20 * scaleW, card2Y + card2H * 0.6); ctx.stroke();
  ctx.setLineDash([]); // 恢复实线

  // Row 2: 7天轨道
  const r2Y = card2Y + card2H * 0.85;
  ctx.fillStyle = BLACK; ctx.font = `bold ${Math.round(13 * S)}px "Microsoft YaHei",sans-serif`;
  ctx.fillText("7天轨道", 45 * scaleW, r2Y + 5*S);

  // 画圆点进度条
  const dotCount = 8, dotW = (barW - 3*S * 7) / 8, rDot = dotW / 2;
  const filled7d = Math.max(0, Math.round(8 * q.seven_day_percent / 100));
  for (let i = 0; i < dotCount; i++) {
    ctx.beginPath(); ctx.arc(barX + i * (dotW + 3*S) + rDot, r2Y, rDot, 0, Math.PI * 2);
    ctx.fillStyle = i < filled7d ? RED : WHITE; ctx.fill(); 
    ctx.strokeStyle = i < filled7d ? RED : '#666666'; ctx.stroke();
  }

  ctx.fillStyle = RED; ctx.font = `bold ${Math.round(18 * S)}px "Microsoft YaHei",sans-serif`;
  ctx.fillText(q.seven_day_percent + "%", barX + barW + 12 * scaleW, r2Y + 6*S);
  
  // 楷体红框时间
  const ref2 = (q.refresh_7d || '06/11') + ' 重置';
  drawKaiTiBox(ref2, W - 50 * scaleW, r2Y, S);

  // === 4. 底部信息栏 ===
  const fY = footY + 12*S;
  
  // 背景圆角框
  ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1 * S;
  roundRect(ctx, 10 * scaleW, footY, W - 20 * scaleW, 26 * S, 6 * S); ctx.stroke();
  ctx.fillStyle = '#f9f9f9'; ctx.fill();

  ctx.font = `bold ${Math.round(12 * S)}px "Microsoft YaHei",sans-serif`;
  
  // Left: 更新时间
  const timeStr = String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0');
  ctx.fillStyle = BLACK; ctx.fillText((q.updated_at || timeStr) + ' 更新', 40 * scaleW, fY + 6*S);

  // Middle: BLE
  const bleConnected = EPD.isConnected();
  const displayBleStatus = bleConnected ? '已连接' : '未连接';
  ctx.fillStyle = bleConnected ? RED : BLACK;
  ctx.fillText('BLE ' + displayBleStatus, W/2 - ctx.measureText('BLE ' + displayBleStatus).width/2 + 10*S, fY + 6*S);

  // Right: 下次刷新
  ctx.fillStyle = BLACK; 
  const nrText = '下次 ' + (q.next_refresh_at || '--:--'); 
  ctx.fillText(nrText, W - 40 * scaleW - ctx.measureText(nrText).width, fY + 6*S);

  // 竖向分割线
  ctx.fillStyle = '#dddddd';
  ctx.fillRect(W * 0.33, footY + 4*S, 1, 18*S);
  ctx.fillRect(W * 0.66, footY + 4*S, 1, 18*S);
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
    codexQuotaStatus.updated_at = data.updated_at || '';
    codexQuotaStatus.next_refresh_at = data.next_refresh_at || '';
    codexQuotaStatus.status_label = data.status_label || '';
    codexQuotaStatus.date_text = data.date_text || '';
    codexQuotaStatus.ble_status = EPD.isConnected() ? '已连接' : '未连接';
    
    if (data.title !== undefined) getEl('cfg-title').value = data.title;
    if (data.headline !== undefined) getEl('cfg-headline').value = data.headline;
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
  if (!EPD.isConnected()) { addLog('请先连接设备'); return; }
  try {
    const canvas = getEl('preview-canvas'), { w, h } = getScreenSize();
    const colorMode = getEl('cfg-color-mode').value;
    const planes = canvasToEpaperPlanes(canvas, { width: w, height: h, colorMode, invertBlack: getEl('cfg-invert-bw').checked, invertRed: getEl('cfg-invert-red').checked });
    await EPD.sendImage({ blackPlane: planes.blackPlane, redPlane: planes.redPlane, driver: getEl('cfg-driver').value, mtu: 20, interleaved: 50 });
    lastRefreshAt = new Date(); addLog('发送成功'); updateCountdown();
  } catch (e) { addLog('发送失败: ' + e.message); }
}

function toggleAutoRefresh() { autoRefreshEnabled = getEl('cfg-auto-refresh').checked; if (autoRefreshEnabled) startAutoRefresh(); else stopAutoRefresh(); saveUserSettings(); }
function startAutoRefresh() { stopAutoRefresh(); const interval = refreshIntervalMinutes * 60 * 1000; nextRefreshAt = new Date(Date.now() + interval); autoRefreshTimer = setInterval(async () => { await refreshData(); if (EPD.isConnected()) await sendToDevice(); nextRefreshAt = new Date(Date.now() + interval); updateCountdown(); }, interval); updateCountdown(); addLog('自动刷新: 每' + refreshIntervalMinutes + '分钟'); }
function stopAutoRefresh() { if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; } nextRefreshAt = null; updateCountdown(); }
function onRefreshIntervalChange() { const val = getEl('cfg-refresh-interval').value; if (val === 'custom') { getEl('cfg-custom-min').style.display = 'inline'; refreshIntervalMinutes = parseInt(getEl('cfg-custom-min').value) || 30; } else { getEl('cfg-custom-min').style.display = 'none'; refreshIntervalMinutes = parseInt(val); } if (autoRefreshEnabled) startAutoRefresh(); saveUserSettings(); }
function updateCountdown() { const el = getEl('countdown'), lastEl = getEl('last-refresh-time'), nextEl = getEl('next-refresh-time'); if (lastRefreshAt) lastEl.textContent = formatTime(lastRefreshAt); if (nextRefreshAt && autoRefreshEnabled) { nextEl.textContent = formatTime(nextRefreshAt); const diff = Math.max(0, Math.floor((nextRefreshAt - Date.now()) / 1000)); el.textContent = `${Math.floor(diff / 60)}分${diff % 60}秒`; } else { nextEl.textContent = '-'; el.textContent = '-'; } }
function formatTime(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function addLog(msg) { const log = getEl('log'), now = new Date(); const ts = [now.getHours(), now.getMinutes(), now.getSeconds()].map(v => String(v).padStart(2, '0')).join(':'); const div = document.createElement('div'); div.textContent = `[${ts}] ${msg}`; log.appendChild(div); log.scrollTop = log.scrollHeight; while (log.children.length > 50) log.removeChild(log.firstChild); }

function handleImageUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) { const img = new Image(); img.onload = function() { const ic = getEl('hidden-icon-canvas'); ic.width = 32; ic.height = 32; const ictx = ic.getContext('2d'); ictx.fillStyle = '#FFFFFF'; ictx.fillRect(0, 0, 32, 32); ictx.drawImage(img, 0, 0, 32, 32); customImage = true; renderPreview(); addLog('图标已加载'); }; img.src = ev.target.result; };
  reader.readAsDataURL(file);
}
function resetIcon() { customImage = null; const ic = getEl('hidden-icon-canvas'); ic.width = 0; ic.height = 0; renderPreview(); addLog('图标已重置'); }

document.addEventListener('DOMContentLoaded', () => {
  applyUserSettings(loadUserSettings());
  EPD.onLog(addLog); EPD.onStatus((msg) => {});
  ['cfg-title', 'cfg-headline', 'cfg-subheadline', 'cfg-highlight'].forEach(id => getEl(id).addEventListener('input', () => { renderPreview(); saveUserSettings(); }));
  ['cfg-screen', 'cfg-color-mode', 'cfg-invert-bw', 'cfg-invert-red'].forEach(id => getEl(id).addEventListener('change', () => { updateScreenSize(); renderPreview(); saveUserSettings(); }));
  getEl('cfg-driver').addEventListener('change', () => { saveUserSettings(); });
  getEl('cfg-auto-refresh').addEventListener('change', toggleAutoRefresh);
  getEl('cfg-refresh-interval').addEventListener('change', onRefreshIntervalChange);
  getEl('cfg-custom-min').addEventListener('input', () => { refreshIntervalMinutes = parseInt(getEl('cfg-custom-min').value) || 30; if (autoRefreshEnabled) startAutoRefresh(); saveUserSettings(); });
  getEl('icon-upload').addEventListener('change', handleImageUpload);
  setInterval(updateCountdown, 1000);
  refreshData();
});