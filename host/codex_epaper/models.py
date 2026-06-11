from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class CodexQuotaStatus:
    title: str = "Codex"
    date_text: str = ""
    headline: str = ""
    status_label: str = ""
    five_hour_percent: int = 0
    seven_day_percent: int = 0
    context_tokens: int = 0
    context_percent: int = 0
    dialog_count: int = 0
    updated_at: str = ""
    next_refresh_at: str = ""
    refresh_5h: str = ""
    refresh_7d: str = ""
    ble_status: str = "未连接"
    daily_input_tokens: int = 0
    daily_output_tokens: int = 0
    daily_total_tokens: int = 0

    def __post_init__(self):
        if not self.date_text:
            now = datetime.now()
            weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
            self.date_text = f"{now.month}/{now.day} {weekdays[now.weekday()]}"
        if not self.updated_at:
            now = datetime.now()
            self.updated_at = f"{now.hour:02d}:{now.minute:02d}"

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "date_text": self.date_text,
            "headline": self.headline,
            "status_label": self.status_label,
            "five_hour_percent": self.five_hour_percent,
            "seven_day_percent": self.seven_day_percent,
            "context_tokens": self.context_tokens,
            "context_percent": self.context_percent,
            "dialog_count": self.dialog_count,
            "updated_at": self.updated_at,
            "next_refresh_at": self.next_refresh_at,
            "refresh_5h": self.refresh_5h,
            "refresh_7d": self.refresh_7d,
            "ble_status": self.ble_status,
            "daily_input_tokens": self.daily_input_tokens,
            "daily_output_tokens": self.daily_output_tokens,
            "daily_total_tokens": self.daily_total_tokens,
        }

    @classmethod
    def from_dict(cls, data: dict) -> CodexQuotaStatus:
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})