from __future__ import annotations

import zlib


def crc32(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF