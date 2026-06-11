# 安装指南

## 电脑端

### 前置条件

- Python 3.10+
- Windows / macOS / Linux
- 蓝牙适配器 (send/daemon 模式需要)

### 安装

```bash
cd host
pip install -r requirements.txt
```

### 配置

```bash
cp config.example.yaml config.yaml
# 编辑 config.yaml
```

### 运行

```bash
# 预览
python main.py preview

# 下发到设备
python main.py send

# 守护进程
python main.py daemon
```

## 固件

### 前置条件

- [nRF Connect SDK](https://developer.nordicsemi.com/nRF_Connect_SDK/)
- [west](https://docs.zephyrproject.org/latest/develop/west/index.html)
- nRF52811 开发板或 Dongle

### 编译

```bash
cd firmware
west build -b nrf52811dongle_nrf52811 -p
```

### 烧录

```bash
west flash
```

### 自定义 overlay

如果引脚不同，修改 `boards/nrf52811_epaper.overlay`。

## 墨水屏接线

| SSD1680 引脚 | nRF52811 引脚 | 功能 |
|-------------|--------------|------|
| SCK | P0.17 | SPI 时钟 |
| MOSI (DIN) | P0.18 | SPI 数据 |
| CS | P0.20 | 片选 |
| DC | P0.21 | 数据/命令 |
| RST | P0.22 | 复位 |
| BUSY | P0.23 | 忙信号 |
| VCC | 3.3V | 电源 |
| GND | GND | 地 |