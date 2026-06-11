from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class Scheduler:
    def __init__(
        self,
        interval_minutes: int = 30,
        refresh_on_start: bool = True,
        retry_count: int = 3,
        retry_delay_seconds: float = 10.0,
    ):
        self.interval = interval_minutes * 60
        self.refresh_on_start = refresh_on_start
        self.retry_count = retry_count
        self.retry_delay = retry_delay_seconds
        self._running = False

    async def run(self, action: Callable[[], asyncio.coroutine]) -> None:
        self._running = True
        if self.refresh_on_start:
            await self._run_with_retry(action)

        while self._running:
            try:
                await asyncio.sleep(self.interval)
            except asyncio.CancelledError:
                break
            await self._run_with_retry(action)

    def stop(self) -> None:
        self._running = False

    async def _run_with_retry(self, action: Callable) -> None:
        for attempt in range(1, self.retry_count + 1):
            try:
                await action()
                return
            except Exception as e:
                logger.error(f"Attempt {attempt}/{self.retry_count} failed: {e}")
                if attempt < self.retry_count:
                    await asyncio.sleep(self.retry_delay)
                else:
                    logger.error("All retries exhausted")