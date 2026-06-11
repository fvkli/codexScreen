# AGENTS.md — 项目执行约束

## 项目概述
Codex 墨水屏额度状态牌：Python 后端采集 Codex API 额度 → FastAPI 提供 JSON → 前端 Canvas 渲染 → Web Bluetooth 发送到 nRF52811 墨水屏。

## 必须遵守

1. **不允许破坏现有前端效果。** 当前 `web/app.js` 渲染出的 400x300 手绘风墨水屏效果，必须作为默认模板 `handdraw_card` 完整保留。
2. **不允许重写整个前端**，不引入 React/Vue/Vite/Webpack 等构建体系。继续使用原生 HTML/CSS/JS。
3. **不允许改动 BLE 发送协议、`canvasToEpaperPlanes`、`EpdNrf5Client` 的行为。**
4. **不允许改变 `/api/status` 数据结构。** 模板系统只能消费现有字段。
5. **默认打开页面时，看到的效果必须和当前效果一致**，除非用户手动选择其他模板。
6. **所有模板都必须输出到同一个 `#preview-canvas`**，最终仍然只使用黑/红/白三色，避免墨水屏转换失真。
7. **每一步改动后必须运行 `node --check web\app.js`**；如拆分文件，也要检查新增 JS 文件。
8. **代码注释和日志需用中文。**

## 技术栈
- 后端：Python + FastAPI（端口 8765）
- 前端：原生 HTML/CSS/JS，无框架
- BLE：Web Bluetooth API（前端直连设备，后端不参与蓝牙）
- 墨水屏：nRF52811 + SSD1680，EPD-nRF5 固件协议

## 关键文件
| 文件 | 职责 | 修改约束 |
|------|------|----------|
| `web/app.js` | 主逻辑 + Canvas 渲染引擎 | 可重构渲染部分为模板系统 |
| `web/renderer.js` | canvas → epaper 平面数据转换 | 不修改 |
| `web/epd-nrf5-protocol.js` | BLE 客户端 | 不修改 |
| `web/index.html` | 控制台页面 | 可新增 UI 元素 |
| `web/style.css` | 样式 | 可扩展 |
| `host/codex_epaper/web_server.py` | FastAPI 服务器 | 不修改 API 结构 |
| `host/codex_epaper/models.py` | 数据模型 | 不修改字段 |

## API 端点
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/status` | GET | 返回 Codex 额度 JSON |
| `/api/config` | GET | 返回显示/刷新配置 |
| `/api/health` | GET | 健康检查 |

## `/api/status` 字段（snake_case）
```json
{
  "title": "Codex plus",
  "date_text": "6/5 周五",
  "headline": "省着点用...",
  "status_label": "状态温热",
  "five_hour_percent": 49,
  "seven_day_percent": 71,
  "context_tokens": 0,
  "context_percent": 0,
  "dialog_count": 0,
  "updated_at": "18:43",
  "next_refresh_at": "19:51",
  "refresh_5h": "19:51",
  "refresh_7d": "06/11",
  "ble_status": "未连接"
}
```

## BLE 状态规则
- `ble_status` 由前端 Web Bluetooth 实时判断（`EPD.isConnected()`），后端不硬编码。
- 后端默认返回 `"未连接"`，前端根据实际连接状态覆盖显示。

## 设计约束
- UI 要像桌面工具控制台，不要 HTML 默认表单，不要营销页
- 墨水屏预览必须是页面视觉中心
- 前端额度字段只读，只能从 `/api/status` 更新
- 前端只能修改显示样式和文案（标题、主文案、副文案、标红文字、图标、屏幕尺寸等）
- 自动刷新支持 10/20/30/60 分钟和自定义
- Web Bluetooth 需要 Chrome/Edge，页面必须在 localhost 或 HTTPS 下运行

## 模板系统架构（第一阶段）
当前 `renderPreview()` 重构为可扩展模板系统：

```js
const previewTemplates = {
  handdraw_card: {
    label: '手绘卡片',
    render(ctx, state, helpers) { /* 当前 renderPreview 的绘制逻辑 */ }
  }
};
```

调度器：
```js
function renderPreview() {
  const canvas = getEl('preview-canvas');
  const ctx = canvas.getContext('2d');
  const templateId = getEl('cfg-template')?.value || 'handdraw_card';
  const template = previewTemplates[templateId] || previewTemplates.handdraw_card;
  template.render(ctx, buildRenderState(), createRenderHelpers(canvas));
}
```

## 验证命令
```bash
node --check web/app.js
node --check web/renderer.js
node --check web/epd-nrf5-protocol.js
```