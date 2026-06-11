# Codex 墨水屏额度状态牌 — 新线程交接文档

> 更新时间：2026-06-09  
> 当前真实项目目录：`D:\Code\python\codex+_+`  
> 重要说明：历史对话里曾使用过 `D:\Code\nRF52811\codex-epaper-quota` 和 `D:\Code\python\codex-epaper-quota`，但当前环境实际项目目录已经变为 `D:\Code\python\codex+_+`。新线程必须以当前真实目录为准。  
> 进入项目后必须先读取并遵守根目录 `AGENTS.md`。

---

## 1. 项目目标

项目目标是做一个 **Codex 墨水屏额度状态牌**：

1. Python 后端采集当前 Codex/ChatGPT 额度状态。
2. 后端用 FastAPI 提供 `/api/status` JSON 和静态前端页面。
3. 前端用 Canvas 把状态渲染成黑/白/红三色墨水屏画面。
4. 前端通过 Web Bluetooth 直接把 Canvas 图像发送给预刷 EPD-nRF5 固件的 nRF52811 墨水屏设备。

核心架构：

```text
Python Host
  ├─ CodexLiveCollector：读取 auth.json，请求 ChatGPT usage 接口
  ├─ token_usage.py：读取本地 logs_2.sqlite，统计今日 token
  ├─ FastAPI：/api/status /api/config /api/health
  └─ 静态文件托管：web/index.html app.js style.css

Web Console
  ├─ Canvas 模板系统：handdraw_card / token_daily_card / image_transfer_card
  ├─ canvasToEpaperPlanes：Canvas 转黑/红平面
  └─ EpdNrf5Client：Web Bluetooth 发送到 EPD-nRF5 固件
```

第一阶段路线仍然是：**复用 EPD-nRF5 固件，蓝牙发送放前端，后端不负责蓝牙发送。**

---

## 2. 必须遵守的项目约束

新线程开始必须先读 `AGENTS.md`。关键约束如下：

- 不允许破坏现有前端效果。默认模板 `handdraw_card` 必须保持当前视觉。
- 不允许重写前端，不引入 React/Vue/Vite/Webpack，继续使用原生 HTML/CSS/JS。
- 不允许改动 `web/renderer.js` 的 `canvasToEpaperPlanes()` 行为。
- 不允许改动 `web/epd-nrf5-protocol.js` 的 BLE 协议行为，除非明确在修 BLE 问题。
- 不允许改变 `/api/status` 字段结构。已有字段可以消费，但不要随意删改。
- 所有模板都必须输出到同一个 `#preview-canvas`。
- Canvas 最终仍只用黑、红、白三色，避免墨水屏转换失真。
- 修改前端 JS 后必须运行：

```powershell
node --check web\app.js
node --check web\renderer.js
node --check web\epd-nrf5-protocol.js
```

如修改 Python 后端，至少运行：

```powershell
python -m compileall host\codex_epaper
```

---

## 3. 启动与刷新方式

### 3.1 安装依赖

```powershell
cd D:\Code\python\codex+_+\host
pip install -r requirements.txt
```

### 3.2 启动 Web 控制台

```powershell
cd D:\Code\python\codex+_+\host
python main.py web
```

访问：

```text
http://localhost:8765/
```

### 3.3 修改后如何刷新

- 修改 `host/` Python 后端代码：需要重启 `python main.py web`。
- 修改 `web/` 前端静态文件：不需要重启后端，浏览器 `Ctrl + F5` 强刷即可。
- 后端和前端在同一个命令里启动，是因为 FastAPI 同时提供 API 和托管静态页面。

---

## 4. 当前目录结构

```text
codex+_+/
├── AGENTS.md
├── README.md
├── HANDOFF.md
├── preview.png
├── docs/
│   ├── ble-protocol.md
│   ├── hardware.md
│   ├── setup.md
│   ├── troubleshooting.md
│   ├── quota-icon-options.svg
│   └── quota-icon-options.png
├── examples/
│   ├── sample_status.json
│   └── preview.png
├── firmware/
│   ├── CMakeLists.txt
│   ├── prj.conf
│   ├── boards/nrf52811_epaper.overlay
│   └── src/
│       ├── main.c
│       ├── ble_service.c / .h
│       ├── epaper.c / .h
│       ├── epaper_driver_ssd1680.c / .h
│       ├── framebuffer.c / .h
│       ├── power.c / .h
│       └── protocol.h
├── host/
│   ├── main.py
│   ├── requirements.txt
│   ├── config.example.yaml
│   └── codex_epaper/
│       ├── models.py
│       ├── web_server.py
│       ├── token_usage.py
│       ├── collectors/
│       │   ├── base.py
│       │   ├── manual.py
│       │   ├── codex_status_text.py
│       │   └── codex_live.py
│       ├── renderers/
│       │   └── layout_codex_card.py
│       └── transport/
│           ├── protocol.py
│           └── ble.py
└── web/
    ├── index.html
    ├── app.js
    ├── style.css
    ├── renderer.js
    └── epd-nrf5-protocol.js
```

`web/1/` 是早期备份/快照目录，不是当前主入口。

---

## 5. 后端 API 当前状态

### 5.1 `/api/status`

由 `host/codex_epaper/web_server.py` 提供。

返回字段当前包括：

```json
{
  "title": "Codex",
  "date_text": "6/6 周六",
  "headline": "省着点用...",
  "status_label": "脑袋温热",
  "five_hour_percent": 49,
  "seven_day_percent": 71,
  "context_tokens": 0,
  "context_percent": 0,
  "dialog_count": 0,
  "updated_at": "18:58",
  "next_refresh_at": "19:51",
  "refresh_5h": "19:51",
  "refresh_7d": "06/11",
  "ble_status": "未连接",
  "daily_input_tokens": 0,
  "daily_output_tokens": 0,
  "daily_total_tokens": 8523043
}
```

注意：

- `daily_*_tokens` 已经实际存在于 `models.py`，虽然 `AGENTS.md` 的字段示例还没更新。
- 不要删除这些字段；前端 `token_daily_card` 模板依赖 `daily_total_tokens`。

### 5.2 额度采集器 `codex_live.py`

位置：

```text
host/codex_epaper/collectors/codex_live.py
```

逻辑：

1. 从 `~/.codex/auth.json` 或 `~/AppData/Local/codex/auth.json` 读取 access token。
2. 解 JWT，提取 `chatgpt_account_id`。
3. 请求：

```text
GET https://chatgpt.com/backend-api/wham/usage
```

4. 解析：

```text
rate_limit.primary_window   -> 5小时额度
rate_limit.secondary_window -> 7天额度
```

5. 百分比规则：

```text
剩余百分比 = 100 - used_percent
```

### 5.3 额度文案映射

后端和前端当前都使用同一套 5 小时额度映射：

| 5小时剩余额度 | 状态名称 | 主文案 |
|---:|---|---|
| 81-100 | 满血复活 | 随便造！！ |
| 61-80 | 电量健康 | 还能打！！ |
| 41-60 | 脑袋温热 | 省着点用... |
| 21-40 | 脑袋发烫 | 别猛冲了！！ |
| 0-20 | 人都麻了 | 快歇会儿！！ |

前端函数：

```js
getQuotaCopy(percent)
```

后端函数：

```python
CodexLiveCollector._build_headline()
CodexLiveCollector._compute_status_label()
```

### 5.4 每日 Token 统计

位置：

```text
host/codex_epaper/token_usage.py
```

逻辑：

1. 找 Codex 本地目录：

```text
~/.codex
~/AppData/Local/codex
~/Library/Application Support/codex
```

2. 读取：

```text
logs_2.sqlite
```

3. 查询当天 `feedback_log_body LIKE '%token_usage%'` 的日志。
4. 用正则累计：

```text
input_tokens=(\d+)
output_tokens=(\d+)
```

5. 返回：

```python
{
  "input_tokens": int,
  "output_tokens": int,
  "total_tokens": int
}
```

重要限制：

- 当前实现 **不区分 Codex 账号**。
- 如果用户有两个 Codex 账号，并且都写入同一个 `logs_2.sqlite`，每日 Token 会把两个账号的用量加在一起。
- `daily_total_tokens` 是本地日志统计，和远端 5h/7d 额度接口不是同一个来源。

---

## 6. 前端当前状态

### 6.1 页面入口

```text
web/index.html
web/app.js
web/style.css
```

脚本加载顺序：

```html
<script src="epd-nrf5-protocol.js"></script>
<script src="renderer.js"></script>
<script src="app.js"></script>
```

### 6.2 当前模板系统

`web/app.js` 已经有模板注册表：

```js
const previewTemplates = {
  handdraw_card: {
    label: '手绘卡片',
    render(ctx, state, helpers) { ... }
  },
  token_daily_card: {
    label: '今日 Token',
    render(ctx, state, helpers) {
      previewTemplates.handdraw_card.render(ctx, { ...state, useDailyTokenRow: true }, helpers);
    }
  },
  image_transfer_card: {
    label: '图片传输',
    render(ctx, state) { ... }
  }
};
```

默认模板：

```text
handdraw_card
```

其他模板：

```text
token_daily_card
image_transfer_card
```

可通过页面左侧“画面模板”下拉选择，也可直接用 URL 预览：

```text
http://localhost:8765/?template=token_daily_card
http://localhost:8765/?template=image_transfer_card
```

### 6.3 `handdraw_card` 模板

当前默认视觉，必须保留。

布局基准：

```text
400 x 300
```

主要内容：

- Header：标题 `Codex` + 日期。
- 主文案区：左侧动态图标 + 额度文案。
- 状态区：`脑量监测` + 状态名称。
- 三行指标：
  - `5小时能量`：红色斜线填充进度条 + 百分比。
  - `7天轨迹`：手绘红色小圆点 + 百分比。
  - `轨迹刷新`：手绘爱心 + `N天`。
- Footer：更新时间、BLE 状态、下次刷新。

### 6.4 `token_daily_card` 模板

该模板复用 `handdraw_card` 的所有布局，只替换第三行：

```text
轨迹刷新 + 爱心 + N天
```

替换为：

```text
今日Token + 红色粒子装饰 + xxx万
```

格式化函数：

```js
formatDailyTokens(tokens)
```

示例：

```text
8523043 -> 852.3万
9160921 -> 916.1万
11204000 -> 1120.4万
```

视觉注意：

- 右侧数值区域已经保留缓冲，避免 `1120.4万` 这种四位万数被红点遮挡。
- 已按用户要求移除 Token 行中靠近小红点的黑色短线。
- 已增加中间区域的小红点、小红圈和红色星形粒子。

### 6.5 `image_transfer_card` 模板

该模板只用于图片传输，不渲染额度文案。页面左侧会隐藏额度文案设置，只显示“传输图片”上传控件。

行为：

- 必须先选择图片，未选图时 `sendToDevice()` 会阻止发送空白画面。
- 选择图片后，`#preview-canvas` 显示即将发送到墨水屏的最终三色画面。
- 图片按当前屏幕尺寸等比缩放并居中，背景补白。
- 前端会先把图片降到低分辨率网格，再按每个像素块的平均颜色、暗度和边缘强度映射为纯黑 `#000000`、纯红 `#FF0000`、纯白 `#FFFFFF`，形成稳定的像素风画面。
- 该模板仍然复用同一个 `#preview-canvas`、同一个 `canvasToEpaperPlanes()` 和同一个 `EpdNrf5Client` 发送流程，不改 BLE 协议。

URL 预览：

```text
http://localhost:8765/?template=image_transfer_card
```

### 6.6 左侧动态图标

函数：

```js
drawBrainIcon(cx, cy, size, percent)
```

根据 5 小时额度自动变化：

| 区间 | 图案 |
|---:|---|
| 81-100 | 闪光能量团 |
| 61-80 | 旋涡小闪电 |
| 41-60 | 普通椭圆乱线团 |
| 21-40 | 冒汗焦虑团 |
| 0-20 | 宕机麻了团 |

注意：这些都是 Canvas 手绘图案，不是外部图片。

### 6.7 前端本地设置

使用 `localStorage` key：

```text
codex-epaper-settings
```

保存项包括：

- title
- headline
- subHeadline
- highlightText
- driver
- screenPreset
- colorMode
- refreshInterval
- autoRefresh
- invertBlack
- invertRed
- templateId

---

## 7. BLE / 发送逻辑当前状态

### 7.1 Web Bluetooth 客户端

位置：

```text
web/epd-nrf5-protocol.js
```

使用 EPD-nRF5 固件 UUID：

```text
Service UUID: 62750001-d828-918d-fb46-b6c11c675aec
Write Char:   62750002-d828-918d-fb46-b6c11c675aec
Version Char: 62750003-d828-918d-fb46-b6c11c675aec
```

发送流程：

```text
INIT    -> 0x01 + driver
WRITE   -> 0x30 + image chunks
REFRESH -> 0x05
```

三色屏：

1. 先发 black plane。
2. 再发 red plane。
3. 最后发 refresh。

### 7.2 Canvas 转位图

位置：

```text
web/renderer.js
```

函数：

```js
canvasToEpaperPlanes(canvas, { width, height, colorMode, invertBlack, invertRed })
```

像素判断：

```text
红色: R > 150 && G < 80 && B < 80
黑色: (R + G + B) / 3 < 80
其他: 白色
```

### 7.3 当前发送按钮逻辑

位置：

```text
web/app.js -> sendToDevice()
```

当前逻辑：

1. 防止重复发送：`isSending`。
2. 检查 Web Bluetooth 支持。
3. 检查 `EPD.isConnected()`。
4. 调用 `canvasToEpaperPlanes()`。
5. 根据驱动和设置判断是否反转黑/红平面：

```js
shouldInvertBlackPlaneForSend()
shouldInvertRedPlaneForSend()
```

6. 调用：

```js
EPD.sendImage({ blackPlane, redPlane, driver, mtu: 20, interleaved: 50 })
```

7. 发送过程中会更新按钮状态和日志。

### 7.4 已知发送问题

用户曾反馈：

> 设备已连接，但点击发送没反应。官方/第三方 EPD 页面和本项目页面都类似。

现场截图显示第三方页面日志里已经出现：

```text
发送完成！耗时：4.682s
屏幕刷新完成前请不要操作。
```

这说明浏览器到设备的 BLE 写入可能已经完成，但屏幕没有明显刷新。可能方向：

- 设备固件/屏幕驱动选择不匹配。
- 前端 driver 下拉值和真实屏幕型号不匹配。
- 黑/红平面是否需要反转还未最终确认。
- EPD-nRF5 固件刷新命令收到但屏幕硬件未响应。
- 设备仍在上一轮刷新或 busy 状态。

当前项目已经增强了发送日志，但真机刷新效果仍需要用户用实物验证。

---

## 8. 后端远端额度接口问题

近期排查过一次 `/api/status` 返回：

```json
{
  "headline": "获取失败",
  "status_label": "错误",
  "five_hour_percent": 0,
  "seven_day_percent": 0,
  "daily_total_tokens": 9160921
}
```

结论：

- `daily_total_tokens` 成功，是因为它来自本地 `logs_2.sqlite`。
- 5h/7d 额度失败，是因为远端接口请求失败。

当时直接测试同一套认证请求：

```text
https://chatgpt.com/backend-api/wham/usage
```

结果：

```text
httpx ConnectError
fallback 后 TimeoutError
```

环境里还看到：

```text
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
```

curl 也出现 TLS 握手失败。下一轮如果继续排查，应先确认代理/网络链路是否能访问 `chatgpt.com`，而不是优先怀疑前端模板。

已做稳健性改动：

- `codex_live.py`：`httpx` 失败后尝试 `aiohttp/urllib` fallback，并打印异常类型。
- `web_server.py`：如果采集器返回错误且有 `_last_status`，不会用错误状态覆盖最后成功状态。

注意：如果服务进程未重启，后端改动不会生效。

---

## 9. 多账号 Token 统计说明

用户有两个 Codex 账号，并且会频繁切换。

当前每日 token 统计逻辑：

```text
读取同一个 logs_2.sqlite
按日期筛选所有 token_usage 日志
直接累加 input/output tokens
```

当前没有按账号过滤。

因此：

- 如果两个账号都写入同一个 Codex 日志库，当天 token 会加在一起。
- 如果两个账号分别使用不同系统用户或不同 `.codex` 目录，才可能分开。
- 5h/7d 额度来自当前登录账号的远端接口，和本地每日 token 统计不是同一个口径。

如果后续要支持分账号每日 token，需要在 `token_usage.py` 里从日志或会话中解析 account id，并按当前 `auth.json` 的 account id 过滤。

---

## 10. 固件与自定义 BLE 路线

仓库里有 `firmware/` 和 `host/codex_epaper/transport/ble.py`，这是自定义 Zephyr 固件和后端 bleak 发送路线。

但当前产品路线是：

```text
Web 前端 + Web Bluetooth + EPD-nRF5 固件
```

注意：

- `firmware/` 未确认已编译烧录验证。
- `host/codex_epaper/transport/ble.py` 使用自定义 UUID，与前端 EPD-nRF5 UUID 不同。
- 两套协议不兼容。
- 第一阶段不要优先投入自定义 Zephyr 固件，除非用户明确切换路线。

历史上发现过 `transport/protocol.py` 状态解析长度问题：

```python
struct.unpack(">BHHBB", data[:8])
```

格式实际是 7 字节，但固件发送 8 字节带 padding。这个自定义路线未作为当前主线使用，下一轮如要启用需重新审查。

---

## 11. 配置不一致问题

`host/config.example.yaml` 当前仍是：

```yaml
display:
  width: 250
  height: 122
```

但前端默认最佳尺寸是：

```text
4.2_400_300 -> 400x300
```

这会影响 CLI `preview/send/daemon` 路线。Web 控制台本身默认用 400x300。

建议后续同步 `config.example.yaml` 为 400x300，或者在文档里明确 CLI 和 Web 默认尺寸不同。

---

## 12. 当前建议下一步

优先级建议：

1. **确认真实项目目录**：使用 `D:\Code\python\codex+_+`。
2. **启动服务并验证页面**：

```powershell
cd D:\Code\python\codex+_+\host
python main.py web
```

3. **验证默认模板不变**：

```text
http://localhost:8765/
```

4. **验证 Token 模板**：

```text
http://localhost:8765/?template=token_daily_card
```

5. **验证图片传输模板**：

```text
http://localhost:8765/?template=image_transfer_card
```

6. **排查远端额度获取失败**：先查代理 `127.0.0.1:7890` 和 `chatgpt.com` TLS 连接。
7. **真机发送排查**：重点确认 driver、屏幕型号、黑/红平面反转、设备 busy 状态。
8. **如果用户要多账号 token 分开统计**：改 `token_usage.py`，引入 account id 过滤。
9. **如果继续扩展模板系统**：保持 `handdraw_card` 默认不变，新增模板只通过 `previewTemplates` 注册。

---

## 13. 新线程快速提示词

可以直接把下面这段发给新线程：

```text
你在 D:\Code\python\codex+_+ 项目工作。开始前必须读取 AGENTS.md 和 HANDOFF.md。

当前项目是 Codex 墨水屏额度状态牌：
- 后端 Python/FastAPI，启动命令：cd host; python main.py web
- 前端原生 HTML/CSS/JS，入口 web/index.html + web/app.js
- Web Bluetooth 发送使用 web/epd-nrf5-protocol.js，不要随意改 BLE 协议
- Canvas 转墨水屏平面使用 web/renderer.js，不要随意改
- 默认模板 handdraw_card 必须保持现有效果
- 第二模板 token_daily_card 把第三行替换为 今日Token + 红色粒子 + xxx万
- 第三模板 image_transfer_card 只用于上传图片传输，预览会先做低分辨率像素风处理，再量化为黑/红/白三色
- 每日 token 来自 host/codex_epaper/token_usage.py 读取 logs_2.sqlite，当前不区分多账号
- 5h/7d 额度来自 codex_live.py 请求 https://chatgpt.com/backend-api/wham/usage，可能受代理/TLS 影响
- 修改前端后运行 node --check web\app.js
- 修改后端后运行 python -m compileall host\codex_epaper

请先复述你理解的当前状态，再继续执行具体任务。
```
