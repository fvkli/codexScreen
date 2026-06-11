# 硬件说明

## 主控

- **芯片**: Nordic nRF52811
- **Flash**: 192 KB
- **RAM**: 24 KB
- **协议**: BLE 5.0 Peripheral

## 墨水屏

- **默认屏幕**: 2.13 寸三色墨水屏
- **分辨率**: 250 x 122
- **控制器**: SSD1680 (或兼容)
- **颜色**: 黑白红 (BWR)
- **接口**: SPI (单向 MOSI，无 MISO)

## 引脚映射

| 功能 | nRF52811 引脚 |
|------|--------------|
| SPI SCK | P0.17 |
| SPI MOSI | P0.18 |
| EPAPER CS | P0.20 |
| EPAPER DC | P0.21 |
| EPAPER RST | P0.22 |
| EPAPER BUSY | P0.23 |

## 内存预算

250x122 三色 framebuffer:

- Black plane: 250 × 122 / 8 = 3813 bytes
- Red plane: 3813 bytes
- Total: 7626 bytes

nRF52811 24KB RAM 可容纳，但需注意 BLE 栈和系统开销。

## 替换屏幕

如果使用不同控制器：

1. 实现 `epaper_driver_xxx.c`，遵循 `epaper.h` 接口
2. 修改 `epaper.c` 中的驱动调用
3. 更新 `display` 配置中的 `controller` 字段
4. 调整 overlay 中的引脚和 SPI 参数