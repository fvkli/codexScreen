from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from codex_epaper.collectors.base import Collector
from codex_epaper.models import CodexQuotaStatus

logger = logging.getLogger(__name__)

USAGE_URL = "https://chatgpt.com/backend-api/wham/usage"

CHATGPT_REFERER = "https://chatgpt.com/"
CHATGPT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/147.0.0.0 Safari/537.36"
)


def _find_codex_auth_dir() -> Optional[Path]:
    candidates = [
        Path.home() / ".codex",
        Path.home() / "AppData" / "Local" / "codex",
        Path.home() / "Library" / "Application Support" / "codex",
    ]
    for d in candidates:
        if d.is_dir():
            return d
    return None


def _find_auth_json() -> Optional[dict]:
    auth_dir = _find_codex_auth_dir()
    if not auth_dir:
        return None
    for name in ["auth.json", "tokens.json"]:
        p = auth_dir / name
        if p.exists():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if data.get("access_token"):
                    return data
                tokens = data.get("tokens", {})
                if isinstance(tokens, dict) and tokens.get("access_token"):
                    return tokens
            except Exception:
                continue
    return None


def _decode_jwt_payload(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        payload = parts[1]
        padded = payload + "=" * (4 - len(payload) % 4)
        decoded = base64.urlsafe_b64decode(padded)
        return json.loads(decoded)
    except Exception:
        return None


def _extract_account_id(access_token: str) -> Optional[str]:
    payload = _decode_jwt_payload(access_token)
    if not payload:
        return None
    auth_data = payload.get("https://api.openai.com/auth")
    if isinstance(auth_data, dict):
        aid = auth_data.get("chatgpt_account_id") or auth_data.get("account_id")
        if aid:
            return str(aid)
    return None


def _extract_plan_type(access_token: str) -> Optional[str]:
    payload = _decode_jwt_payload(access_token)
    if not payload:
        return None
    auth_data = payload.get("https://api.openai.com/auth")
    if isinstance(auth_data, dict):
        return auth_data.get("subscription_plan")
    return None


class CodexLiveCollector(Collector):
    def __init__(
        self,
        access_token: Optional[str] = None,
        account_id: Optional[str] = None,
    ):
        self._access_token = access_token
        self._account_id = account_id

    async def collect(self) -> CodexQuotaStatus:
        status = CodexQuotaStatus()


        try:
            token = self._resolve_token()
            if not token:
                status.headline = "未登录 Codex"
                status.status_label = "未登录"
                logger.warning("No Codex access token found")
                return status

            account_id = self._account_id or _extract_account_id(token)
            plan = _extract_plan_type(token)
            if plan:
                status.title = f"Codex {plan}"

            usage = await self._fetch_usage(token, account_id)
            self._parse_usage(status, usage)

        except Exception as e:
            logger.error("Codex quota fetch failed: %s: %s", type(e).__name__, e)
            status.headline = "获取失败"
            status.status_label = "错误"

        self._compute_status_label(status)
        return status

    def _resolve_token(self) -> Optional[str]:
        if self._access_token:
            return self._access_token
        auth_data = _find_auth_json()
        if auth_data:
            return auth_data.get("access_token")
        return None

    async def _fetch_usage(
        self, access_token: str, account_id: Optional[str]
    ) -> dict:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Referer": CHATGPT_REFERER,
            "User-Agent": CHATGPT_USER_AGENT,
        }
        if account_id:
            headers["ChatGPT-Account-Id"] = account_id

        logger.info(f"Fetching Codex quota from {USAGE_URL}")

        try:
            import httpx
        except ImportError:
            return await self._fetch_with_aiohttp(headers)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(USAGE_URL, headers=headers)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.warning("httpx 获取 Codex 额度失败，尝试备用请求方式: %s: %s", type(e).__name__, e)
            return await self._fetch_with_aiohttp(headers)

    async def _fetch_with_aiohttp(self, headers: dict) -> dict:
        try:
            import aiohttp
        except ImportError:
            logger.warning("Neither httpx nor aiohttp available, trying urllib")
            return await self._fetch_with_urllib(headers)

        async with aiohttp.ClientSession() as session:
            async with session.get(USAGE_URL, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                resp.raise_for_status()
                return await resp.json()

    async def _fetch_with_urllib(self, headers: dict) -> dict:
        import urllib.request
        import urllib.error

        req = urllib.request.Request(USAGE_URL, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:500]}")

    def _parse_usage(self, status: CodexQuotaStatus, data: dict) -> None:
        rate_limit = data.get("rate_limit", {})
        primary = rate_limit.get("primary_window", {})
        secondary = rate_limit.get("secondary_window", {})

        if primary:
            used_pct = primary.get("used_percent", 0)
            status.five_hour_percent = max(0, min(100, 100 - used_pct))
            reset_at = primary.get("reset_at")
            reset_after = primary.get("reset_after_seconds")
            if reset_at and reset_at > 0:
                from datetime import datetime
                dt = datetime.fromtimestamp(reset_at)
                status.refresh_5h = dt.strftime("%H:%M")
                status.next_refresh_at = dt.strftime("%H:%M")
            elif reset_after and reset_after > 0:
                reset_min = reset_after // 60
                status.refresh_5h = f"{reset_min}m"
                status.next_refresh_at = f"{reset_min}m"

        if secondary:
            used_pct = secondary.get("used_percent", 0)
            status.seven_day_percent = max(0, min(100, 100 - used_pct))
            reset_at = secondary.get("reset_at")
            reset_after = secondary.get("reset_after_seconds")
            if reset_at and reset_at > 0:
                from datetime import datetime
                dt = datetime.fromtimestamp(reset_at)
                status.refresh_7d = dt.strftime("%m/%d")
            elif reset_after and reset_after > 0:
                days = reset_after // 86400
                status.refresh_7d = f"{days}d"

        code_review = data.get("code_review_rate_limit", {})
        if code_review:
            cr_primary = code_review.get("primary_window", {})
            if cr_primary:
                cr_used = cr_primary.get("used_percent", 0)
                cr_remain = max(0, min(100, 100 - cr_used))
                logger.info(f"Code review quota: {cr_remain}%")

        status.daily_input_tokens = int(data.get("daily_input_tokens") or 0)
        status.daily_output_tokens = int(data.get("daily_output_tokens") or 0)
        status.daily_total_tokens = int(data.get("daily_total_tokens") or 0)

        plan_type = data.get("plan_type", "")
        if plan_type and not status.title.endswith(plan_type):
            status.title = f"Codex {plan_type}"

        status.headline = self._build_headline(status)

    def _build_headline(self, status: CodexQuotaStatus) -> str:
        if status.five_hour_percent >= 81:
            return "随便造！！"
        if status.five_hour_percent >= 61:
            return "还能打！！"
        if status.five_hour_percent >= 41:
            return "省着点用..."
        if status.five_hour_percent >= 21:
            return "别猛冲了！！"
        return "快歇会儿！！"

    def _compute_status_label(self, status: CodexQuotaStatus) -> None:
        if status.status_label:
            return
        if status.five_hour_percent >= 81:
            status.status_label = "满血复活"
        elif status.five_hour_percent >= 61:
            status.status_label = "电量健康"
        elif status.five_hour_percent >= 41:
            status.status_label = "脑袋温热"
        elif status.five_hour_percent >= 21:
            status.status_label = "脑袋发烫"
        else:
            status.status_label = "人都麻了"
