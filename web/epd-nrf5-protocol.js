class EpdNrf5Client {
  constructor() {
    this._device = null;
    this._server = null;
    this._characteristic = null;
    this._version = 0;
    this._connected = false;
    this._logCallback = null;
    this._statusCallback = null;
  }

  onLog(cb) { this._logCallback = cb; }
  onStatus(cb) { this._statusCallback = cb; }

  _log(msg) { if (this._logCallback) this._logCallback(msg); }
  _setStatus(msg) { if (this._statusCallback) this._statusCallback(msg); }

  isConnected() { return this._connected && this._server && this._server.connected; }

  async connect() {
    if (this.isConnected()) {
      this._device.gatt.disconnect();
      this._connected = false;
      return;
    }

    try {
      this._device = await navigator.bluetooth.requestDevice({
        optionalServices: ['62750001-d828-918d-fb46-b6c11c675aec'],
        acceptAllDevices: true
      });
    } catch (e) {
      this._log('选择设备取消或失败: ' + e.message);
      return false;
    }

    this._device.addEventListener('gattserverdisconnected', () => {
      this._connected = false;
      this._log('设备已断开');
      if (typeof codexQuotaStatus !== 'undefined') codexQuotaStatus.ble_status = '未连接';
    });

    await new Promise(r => setTimeout(r, 300));

    try {
      this._log('连接: ' + this._device.name);
      this._server = await this._device.gatt.connect();
      const service = await this._server.getPrimaryService('62750001-d828-918d-fb46-b6c11c675aec');
      this._characteristic = await service.getCharacteristic('62750002-d828-918d-fb46-b6c11c675aec');

      try {
        const vc = await service.getCharacteristic('62750003-d828-918d-fb46-b6c11c675aec');
        const vd = await vc.readValue();
        this._version = vd.getUint8(0);
        this._log('固件版本: 0x' + this._version.toString(16));
      } catch { this._version = 0x16; }

      try {
        await this._characteristic.startNotifications();
      } catch {}

      this._connected = true;
      this._log('连接成功');
      return true;
    } catch (e) {
      this._log('连接失败: ' + e.message);
      this._connected = false;
      return false;
    }
  }

  async disconnect() {
    if (this._device && this._device.gatt.connected) {
      this._device.gatt.disconnect();
    }
    this._connected = false;
    this._server = null;
    this._characteristic = null;
  }

  async _write(cmd, data, withResponse = true) {
    if (!this._characteristic) throw new Error('未连接');
    const payload = [cmd];
    if (data) {
      if (data instanceof Uint8Array) payload.push(...data);
      else if (typeof data === 'string') {
        for (let c = 0; c < data.length; c += 2)
          payload.push(parseInt(data.substr(c, 2), 16));
      }
    }
    const arr = Uint8Array.from(payload);
    if (withResponse)
      await this._characteristic.writeValueWithResponse(arr);
    else
      await this._characteristic.writeValueWithoutResponse(arr);
    return true;
  }

  async init(driver = '01') {
    await this._write(0x01, driver);
  }

  async sendImage({ blackPlane, redPlane, driver = '01', mtu = 20, interleaved = 50 }) {
    if (!this.isConnected()) throw new Error('未连接设备');

    await this.init(driver);

    const chunkSize = mtu - 2;
    const hasRed = redPlane && redPlane.length > 0;

    await this._writeImageChunks(blackPlane, chunkSize, interleaved, 'bw');
    if (hasRed) {
      await this._writeImageChunks(redPlane, chunkSize, interleaved, 'red');
    }

    await this._write(0x05);
    this._log('发送完成');
  }

  async _writeImageChunks(data, chunkSize, interleaved, step) {
    const count = Math.ceil(data.length / chunkSize);
    let noReplyCount = interleaved;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunkIdx = Math.floor(i / chunkSize);
      this._setStatus(`${step === 'bw' ? '黑白' : '颜色'}: ${chunkIdx + 1}/${count}`);

      const first = i === 0;
      const flag = (step === 'bw' ? 0x0F : 0x00) | (first ? 0x00 : 0xF0);
      const payload = [flag, ...data.slice(i, i + chunkSize)];

      if (noReplyCount > 0) {
        await this._write(0x30, Uint8Array.from(payload), false);
        noReplyCount--;
      } else {
        await this._write(0x30, Uint8Array.from(payload), true);
        noReplyCount = interleaved;
      }
    }
  }

  async clear() {
    await this._write(0x02);
  }

  async syncTime() {
    const ts = Math.floor(Date.now() / 1000);
    const data = new Uint8Array([
      (ts >> 24) & 0xFF, (ts >> 16) & 0xFF, (ts >> 8) & 0xFF, ts & 0xFF,
      -(new Date().getTimezoneOffset() / 60), 1
    ]);
    await this._write(0x20, data);
  }
}

window.EpdNrf5Client = EpdNrf5Client;