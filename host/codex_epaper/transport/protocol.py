from __future__ import annotations

import struct
import zlib


def crc32(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def pack_begin_frame(
    width: int,
    height: int,
    fmt: int,
    frame_size: int,
    crc: int,
    chunk_size: int,
) -> bytes:
    return struct.pack(">BHHBIIH", 0x01, width, height, fmt, frame_size, crc, chunk_size)


def pack_data_chunk(seq: int, payload: bytes) -> bytes:
    return struct.pack(">HH", seq, len(payload)) + payload


def pack_command(cmd: int) -> bytes:
    return struct.pack(">B", cmd)


CMD_BEGIN_FRAME = 0x01
CMD_END_FRAME = 0x02
CMD_REFRESH = 0x03
CMD_ABORT = 0x04
CMD_PING = 0x05

FORMAT_1BPP = 1
FORMAT_2PLANE = 2

STATE_IDLE = 0
STATE_RECEIVING = 1
STATE_VERIFYING = 2
STATE_REFRESHING = 3
STATE_DONE = 4
STATE_ERROR = 5


def parse_status_notify(data: bytes) -> dict:
    if len(data) < 8:
        return {}
    state, received, expected, battery, error = struct.unpack(">BHHBB", data[:8])
    return {
        "state": state,
        "received_chunks": received,
        "expected_chunks": expected,
        "battery_percent": battery,
        "error_code": error,
    }