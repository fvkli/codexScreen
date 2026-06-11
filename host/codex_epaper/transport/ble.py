from __future__ import annotations

import asyncio
import logging
import struct
from typing import Optional

from bleak import BleakClient, BleakScanner

from codex_epaper.transport.protocol import (
    CMD_BEGIN_FRAME,
    CMD_END_FRAME,
    CMD_PING,
    CMD_REFRESH,
    FORMAT_2PLANE,
    pack_begin_frame,
    pack_command,
    pack_data_chunk,
    parse_status_notify,
    crc32,
)

logger = logging.getLogger(__name__)

SERVICE_UUID = "7b7d0001-8c5f-4e87-9f8e-codexquota01"
CHAR_CONTROL = "7b7d0002-8c5f-4e87-9f8e-codexquota01"
CHAR_DATA = "7b7d0003-8c5f-4e87-9f8e-codexquota01"
CHAR_STATUS = "7b7d0004-8c5f-4e87-9f8e-codexquota01"


class BLETransport:
    def __init__(
        self,
        device_name: str = "CodexQuota",
        chunk_size: int = 160,
        connect_timeout: float = 15.0,
    ):
        self.device_name = device_name
        self.chunk_size = chunk_size
        self.connect_timeout = connect_timeout
        self._client: Optional[BleakClient] = None
        self._status_event = asyncio.Event()
        self._last_status: dict = {}

    async def scan(self, timeout: float = 5.0) -> Optional[str]:
        logger.info(f"Scanning for BLE device: {self.device_name}")
        devices = await BleakScanner.discover(timeout=timeout)
        for d in devices:
            if d.name == self.device_name:
                logger.info(f"Found device: {d.address} ({d.name})")
                return d.address
        logger.warning(f"Device '{self.device_name}' not found")
        return None

    async def connect(self) -> None:
        address = await self.scan(timeout=self.connect_timeout)
        if not address:
            raise ConnectionError(f"Cannot find BLE device: {self.device_name}")

        self._client = BleakClient(address, timeout=self.connect_timeout)
        await self._client.connect()
        logger.info(f"Connected to {address}")

        await self._client.start_notify(CHAR_STATUS, self._on_status)

    async def disconnect(self) -> None:
        if self._client and self._client.is_connected:
            await self._client.stop_notify(CHAR_STATUS)
            await self._client.disconnect()
            logger.info("Disconnected")

    async def ping(self) -> dict:
        await self._write_control(pack_command(CMD_PING))
        await asyncio.wait_for(self._status_event.wait(), timeout=5.0)
        self._status_event.clear()
        return self._last_status

    async def send_frame(
        self,
        black: bytes,
        red: bytes,
        width: int,
        height: int,
    ) -> dict:
        frame_data = black + red
        frame_size = len(frame_data)
        frame_crc = crc32(frame_data)
        fmt = FORMAT_2PLANE

        begin_payload = pack_begin_frame(
            width, height, fmt, frame_size, frame_crc, self.chunk_size
        )
        await self._write_control(begin_payload)
        logger.info(f"BEGIN_FRAME: {width}x{height} fmt={fmt} size={frame_size} crc=0x{frame_crc:08X}")

        chunks = self._split_chunks(frame_data)
        total = len(chunks)
        for seq, chunk in enumerate(chunks):
            packet = pack_data_chunk(seq, chunk)
            await self._client.write_gatt_char(CHAR_DATA, packet, response=False)
            if (seq + 1) % 20 == 0 or seq == total - 1:
                logger.debug(f"Sent chunk {seq + 1}/{total}")

        await self._write_control(pack_command(CMD_END_FRAME))
        logger.info("END_FRAME sent, waiting for verification...")

        await asyncio.wait_for(self._status_event.wait(), timeout=10.0)
        self._status_event.clear()
        status = self._last_status

        if status.get("state") == 4:
            logger.info("Frame verified, sending REFRESH")
            await self._write_control(pack_command(CMD_REFRESH))
            await asyncio.wait_for(self._status_event.wait(), timeout=30.0)
            self._status_event.clear()
            return self._last_status

        return status

    def _split_chunks(self, data: bytes) -> list[bytes]:
        return [data[i:i + self.chunk_size] for i in range(0, len(data), self.chunk_size)]

    async def _write_control(self, data: bytes) -> None:
        if self._client and self._client.is_connected:
            await self._client.write_gatt_char(CHAR_CONTROL, data, response=True)

    def _on_status(self, sender, data: bytearray) -> None:
        self._last_status = parse_status_notify(bytes(data))
        state_names = {0: "idle", 1: "receiving", 2: "verifying", 3: "refreshing", 4: "done", 5: "error"}
        state = self._last_status.get("state", -1)
        logger.info(f"Status: {state_names.get(state, 'unknown')} {self._last_status}")
        self._status_event.set()