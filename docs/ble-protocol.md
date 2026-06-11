# BLE 协议

## 设备信息

- **设备名**: `CodexQuota`
- **Service UUID**: `7b7d0001-8c5f-4e87-9f8e-codexquota01`

## Characteristics

| 名称 | UUID | 属性 | 说明 |
|------|------|------|------|
| Control | `7b7d0002-...` | Write | 控制命令 |
| Data | `7b7d0003-...` | Write Without Response | 数据分包 |
| Status | `7b7d0004-...` | Notify | 设备状态通知 |

## 控制命令 (Control)

| 命令 | 值 | 说明 |
|------|---|------|
| BEGIN_FRAME | 0x01 | 开始传输新帧 |
| END_FRAME | 0x02 | 帧传输结束 |
| REFRESH | 0x03 | 刷新墨水屏 |
| ABORT | 0x04 | 中止当前传输 |
| PING | 0x05 | 心跳检测 |

### BEGIN_FRAME payload

```
uint8  cmd = 0x01
uint16 width
uint16 height
uint8  format        (1=1bpp BW, 2=2-plane BWR)
uint32 frame_size
uint32 crc32
uint16 chunk_size
```

### Data chunk

```
uint16 seq
uint16 payload_len
bytes  payload
```

## 状态通知 (Status)

```
uint8  state
uint16 received_chunks
uint16 expected_chunks
uint8  battery_percent
uint8  error_code
```

### State 值

| 值 | 名称 | 说明 |
|---|------|------|
| 0 | IDLE | 空闲 |
| 1 | RECEIVING | 正在接收数据 |
| 2 | VERIFYING | 校验中 |
| 3 | REFRESHING | 屏幕刷新中 |
| 4 | DONE | 完成 |
| 5 | ERROR | 错误 |

### Error 值

| 值 | 名称 |
|---|------|
| 0 | NONE |
| 1 | CRC 校验失败 |
| 2 | 大小不匹配 |
| 3 | 溢出 |
| 4 | 序列号错误 |

## 传输流程

```
Host                          Device
  |-- BEGIN_FRAME ---------->|
  |                          | (state: receiving)
  |-- data chunk 0 --------->|
  |-- data chunk 1 --------->|
  |-- ... ------------------>|
  |-- data chunk N --------->|
  |-- END_FRAME ------------>|
  |                          | (state: verifying)
  |<-- status notify --------| (state: done/error)
  |-- REFRESH -------------->|
  |                          | (state: refreshing)
  |<-- status notify --------| (state: done)
```