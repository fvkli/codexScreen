# 故障排除

## BLE 连接问题

### 找不到设备

- 确认固件已烧录且设备已上电
- 确认设备广播名称为 `CodexQuota`
- 检查电脑蓝牙是否开启
- 尝试缩短距离

### 连接后断开

- 检查供电是否稳定
- nRF52811 RAM 不足可能导致重启，检查 framebuffer 大小
- 查看固件日志

## 渲染问题

### 中文显示为方框

- 确认系统安装了中文字体
- Windows: 确认 `C:/Windows/Fonts/msyh.ttc` 存在
- Linux: 安装 `fonts-wqy-zenhei` 或 `fonts-noto-cjk`

### 预览图尺寸不对

- 检查 `config.yaml` 中 `display.width` 和 `display.height`
- 默认 250x122，与 2.13 寸屏匹配

## 固件问题

### 编译失败

- 确认 nRF Connect SDK 已正确安装
- 确认 `west update` 已执行
- 检查 Zephyr 版本兼容性

### 屏幕不刷新

- 检查 SPI 接线
- 确认 BUSY 引脚正常
- SSD1680 LUT 可能需要根据实际屏幕调整

### CRC 校验失败

- 检查 chunk_size 配置是否一致
- 确认 BLE 传输未丢包
- 查看固件日志中的 CRC 值对比