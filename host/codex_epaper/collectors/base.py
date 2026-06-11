from __future__ import annotations

from abc import ABC, abstractmethod

from codex_epaper.models import CodexQuotaStatus


class Collector(ABC):
    @abstractmethod
    async def collect(self) -> CodexQuotaStatus:
        ...