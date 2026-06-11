from __future__ import annotations

import math
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from codex_epaper.models import CodexQuotaStatus


FONT_CANDIDATES = [
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
]

_font_cache: dict[tuple, ImageFont.FreeTypeFont] = {}


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    key = (size, bold)
    if key in _font_cache:
        return _font_cache[key]
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                index = 1 if bold and path.endswith(".ttc") else 0
                font = ImageFont.truetype(path, size, index=index)
                _font_cache[key] = font
                return font
            except Exception:
                continue
    print("[WARN] No CJK font found, using default. Chinese may not render correctly.")
    font = ImageFont.load_default()
    _font_cache[key] = font
    return font


def _format_tokens(tokens: int) -> str:
    if tokens >= 1_000_000:
        return f"{tokens / 1_000_000:.1f}M"
    if tokens >= 1_000:
        return f"{tokens / 1_000:.0f}K"
    return str(tokens)


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def _draw_progress_bar(
    draw: ImageDraw.ImageDraw,
    x: int, y: int, width: int, height: int,
    percent: int, fill_color: int, bg_color: int = 0,
) -> None:
    draw.rectangle([x, y, x + width - 1, y + height - 1], fill=bg_color, outline=fill_color)
    fill_width = max(0, int(width * percent / 100))
    if fill_width > 0:
        draw.rectangle([x + 1, y + 1, x + fill_width - 1, y + height - 2], fill=fill_color)


def _draw_dotted_bar(
    draw: ImageDraw.ImageDraw,
    x: int, y: int, width: int, height: int,
    percent: int, fill_color: int, bg_color: int = 0,
    dot_count: int = 8,
) -> None:
    gap = 3
    dot_w = (width - gap * (dot_count - 1)) // dot_count
    filled = max(0, int(dot_count * percent / 100))
    for i in range(dot_count):
        dx = x + i * (dot_w + gap)
        color = fill_color if i < filled else bg_color
        draw.ellipse([dx, y, dx + dot_w - 1, y + height - 1], fill=color, outline=fill_color)


class LayoutCodexCard:
    def __init__(self, width: int = 250, height: int = 122, colors: str = "bwr"):
        self.width = width
        self.height = height
        self.colors = colors

    def render(
        self,
        status: CodexQuotaStatus,
        output_path: Optional[str] = None,
    ) -> Tuple[bytes, bytes]:
        img = Image.new("P", (self.width, self.height), 1)
        palette = [0] * 768
        palette[0:3] = [0, 0, 0]
        palette[3:6] = [255, 255, 255]
        palette[6:9] = [255, 0, 0]
        img.putpalette(palette)
        draw = ImageDraw.Draw(img)

        BLACK = 0
        WHITE = 1
        RED = 2

        MARGIN_L = 6
        MARGIN_R = 6
        right_x = self.width - MARGIN_R

        font_title = _load_font(15, bold=True)
        font_headline = _load_font(12, bold=True)
        font_section = _load_font(9)
        font_label = _load_font(9)
        font_value = _load_font(9, bold=True)
        font_bar_val = _load_font(9)
        font_footer = _load_font(8)

        y = 3

        # === Row 1: Title + Date ===
        draw.text((MARGIN_L, y), status.title, fill=BLACK, font=font_title)
        if status.date_text:
            dt_w = _text_width(draw, status.date_text, font_section)
            draw.text((right_x - dt_w, y + 2), status.date_text, fill=BLACK, font=font_section)
        y += 19

        # === Separator ===
        draw.line([(0, y), (self.width - 1, y)], fill=BLACK)
        y += 4

        # === Row 2: Headline ===
        if status.headline:
            draw.text((MARGIN_L, y), status.headline, fill=BLACK, font=font_headline)
            y += 16

        # === Separator ===
        draw.line([(0, y), (self.width - 1, y)], fill=BLACK)
        y += 5

        # === Row 3: Section header "能量监测" + status label ===
        draw.text((MARGIN_L, y), "能量监测", fill=BLACK, font=font_section)
        if status.status_label:
            sl_w = _text_width(draw, status.status_label, font_value)
            status_color = RED if "停热" in status.status_label else BLACK
            draw.text((right_x - sl_w, y), status.status_label, fill=status_color, font=font_value)
        y += 14

        # === Progress bars ===
        bar_label_x = MARGIN_L
        bar_x = 58
        bar_width = 120
        bar_height = 8
        bar_val_x = bar_x + bar_width + 6
        bar_row_h = 15

        # 5h能量
        draw.text((bar_label_x, y + 1), "5h能量", fill=BLACK, font=font_label)
        _draw_progress_bar(draw, bar_x, y, bar_width, bar_height, status.five_hour_percent, BLACK, WHITE)
        pct_text = f"{status.five_hour_percent}%"
        pct_color = RED if status.five_hour_percent < 30 else BLACK
        draw.text((bar_val_x, y), pct_text, fill=pct_color, font=font_bar_val)
        y += bar_row_h

        # 7d轨道
        draw.text((bar_label_x, y + 1), "7d轨道", fill=BLACK, font=font_label)
        _draw_dotted_bar(draw, bar_x, y, bar_width, bar_height, status.seven_day_percent, BLACK, WHITE)
        pct_text = f"{status.seven_day_percent}%"
        pct_color = RED if status.seven_day_percent < 20 else BLACK
        draw.text((bar_val_x, y), pct_text, fill=pct_color, font=font_bar_val)
        y += bar_row_h

        # 上下文
        draw.text((bar_label_x, y + 1), "上下文", fill=BLACK, font=font_label)
        _draw_progress_bar(draw, bar_x, y, bar_width, bar_height, status.context_percent, BLACK, WHITE)
        ctx_text = _format_tokens(status.context_tokens)
        draw.text((bar_val_x, y), ctx_text, fill=BLACK, font=font_bar_val)
        y += bar_row_h

        # === Separator ===
        draw.line([(0, y), (self.width - 1, y)], fill=BLACK)
        y += 4

        # === Footer ===
        footer_left = f"{status.updated_at} 更新"
        draw.text((MARGIN_L, y), footer_left, fill=BLACK, font=font_footer)

        if status.next_refresh_at:
            nr_text = f"下次 {status.next_refresh_at}"
            nr_w = _text_width(draw, nr_text, font_footer)
            draw.text((right_x - nr_w, y), nr_text, fill=BLACK, font=font_footer)

        ble_color = BLACK if status.ble_status == "已连接" else RED
        ble_text = f"BLE {status.ble_status}"
        ble_w = _text_width(draw, ble_text, font_footer)
        ble_x = (self.width - ble_w) // 2
        draw.text((ble_x, y), ble_text, fill=ble_color, font=font_footer)

        black_plane, red_plane = self._image_to_planes(img)

        if output_path:
            preview = img.convert("RGB")
            preview_scaled = preview.resize((self.width * 3, self.height * 3), Image.NEAREST)
            preview_scaled.save(output_path)

        return black_plane, red_plane

    def _image_to_planes(self, img: Image.Image) -> Tuple[bytes, bytes]:
        pixels = img.load()
        row_bytes = math.ceil(self.width / 8)
        black_plane = bytearray(row_bytes * self.height)
        red_plane = bytearray(row_bytes * self.height)

        for y in range(self.height):
            for x in range(self.width):
                pixel = pixels[x, y]
                bit_index = y * row_bytes * 8 + x
                byte_idx = bit_index // 8
                bit_pos = 7 - (bit_index % 8)
                if pixel == 0:
                    black_plane[byte_idx] |= (1 << bit_pos)
                elif pixel == 2:
                    red_plane[byte_idx] |= (1 << bit_pos)

        return bytes(black_plane), bytes(red_plane)
