# Codex 墨水屏额度状态牌

电脑端采集 Codex 额度/状态数据，通过 BLE 下发给 nRF52811 主控，驱动墨水屏显示。

## 架构

```
Host (Python)                    Web Console
┌──────────────┐                ┌──────────────────┐
│ Collector    │                │ Canvas Renderer  │
│ Web Server   │──HTTP/JSON──> │ EPD-nRF5 Client  │
│ Scheduler    │                │ Auto Refresh     │
└──────────────┘                └──────────────────┘
                                       │
                                    Web Bluetooth
                                       │
                                ┌──────────────┐
                                │ EPD-nRF5 固件 │
                                │ nRF52811      │
                                └──────────────┘
```

## 快速开始

### 安装

```bash
cd host
pip install -r requirements.txt
```

### Web 控制台（推荐）

```bash
python main.py web
```

浏览器打开 http://localhost:8765

功能：
- 连接墨水屏蓝牙设备（Web Bluetooth）
- 实时预览 Codex 墨水屏画面
- 自定义标题、文案、图标、状态
- 设置自动刷新（10/20/30/60分钟或自定义）
- 一键发送到墨水屏

**注意**：Web Bluetooth 需要 Chrome 或 Edge，页面必须在 localhost 或 HTTPS 下运行。

### 命令行模式

```bash
# 预览渲染效果
python main.py preview

# 连接设备并下发
python main.py send

# 守护进程定时刷新
python main.py daemon
```

### 固件

Web 模式复用 [EPD-nRF5](https://github.com/tsl0922/EPD-nRF5) 固件，无需自定义固件。

如需自定义固件：

```bash
cd firmware
west build -b nrf52811dongle_nrf52811 -p
west flash
```

## 命令

| 命令 | 说明 |
|------|------|
| `web` | 启动 Web 控制台 (http://localhost:8765) |
| `preview` | 采集数据、渲染预览图，不连接设备 |
| `send` | 采集数据、渲染、连接 BLE 设备并下发刷新 |
| `daemon` | 按配置间隔定时执行 send |

## 配置

复制 `config.example.yaml` 为 `config.yaml` 并修改：

```yaml
collector:
  type: codex_live
  # type: manual
  # manual_file: ../examples/sample_status.json

refresh:
  interval_minutes: 30

web:
  host: "0.0.0.0"
  port: 8765
```

## 已知限制

- **`codex_live` 使用 ChatGPT 非公开接口获取额度，不保证长期可用。** `manual` collector 是 fallback。
- 如果后续 Codex CLI 或 App 暴露稳定状态接口，只需要新增 collector，不需要改固件。
- nRF52811 不负责联网、不保存 OpenAI 登录态、不直接请求 OpenAI 服务。
- Web Bluetooth 需要 Chrome/Edge，且必须在 localhost 或 HTTPS 下运行。
- Web 模式复用 EPD-nRF5 固件，设备需预刷该固件。
- SSD1680 驱动的 LUT 序列需要根据实际屏幕数据手册验证。

## 项目结构

```
codex-epaper-quota/
  web/               # Web 控制台前端
  host/              # Python 后端
  firmware/          # nRF52811 固件 (Zephyr)
  docs/              # 文档
  assets/            # 字体和图标
  examples/          # 示例数据
```

## License

MIT
