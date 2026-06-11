from __future__ import annotations

import re

from codex_epaper.collectors.base import Collector
from codex_epaper.models import CodexQuotaStatus


class CodexStatusTextCollector(Collector):
    def __init__(self, status_text: str = ""):
        self.status_text = status_text

    async def collect(self) -> CodexQuotaStatus:
        text = self.status_text
        status = CodexQuotaStatus()

        context_match = re.search(r"Context usage:\s*(\d+)%", text)
        if context_match:
            status.context_percent = int(context_match.group(1))

        five_hour_match = re.search(r"5h remaining:\s*(\d+)%", text)
        if five_hour_match:
            status.five_hour_percent = int(five_hour_match.group(1))

        seven_day_match = re.search(r"7d remaining:\s*(\d+)%", text)
        if seven_day_match:
            status.seven_day_percent = int(seven_day_match.group(1))

        if status.five_hour_percent > 50:
            status.status_label = "状态正常"
        elif status.five_hour_percent > 20:
            status.status_label = "状态温热"
        else:
            status.status_label = "状态停热"

        return status