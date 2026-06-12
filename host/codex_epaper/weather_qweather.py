from __future__ import annotations

import json
import logging
import os
import gzip
from datetime import datetime
from typing import Any
from urllib import error, parse, request

logger = logging.getLogger(__name__)

DEFAULT_LOCATION = "113.31333,23.28472"
DEFAULT_LOCATION_NAME = "夏良地铁站"
DEFAULT_LOCATION_ADM = "广州"
RAIN_KEYWORDS = ("雨", "雷", "雪", "雹")


def get_weather_summary(interval_hours: int = 1) -> dict[str, Any]:
    """获取适合墨水屏天气模板展示的简化逐小时天气。"""
    interval = 2 if int(interval_hours or 1) == 2 else 1
    if not _get_api_key() or not _get_api_host():
        return _fallback_weather(interval, "未配置 QWEATHER_API_HOST 或 QWEATHER_API_KEY")

    try:
        location = _get_location_id()
        forecast = _fetch_json(
            "/v7/weather/24h",
            {"location": location["id"], "lang": "zh", "unit": "m"},
        )
        if forecast.get("code") != "200":
            return _fallback_weather(interval, f"逐小时天气接口返回 {forecast.get('code', '未知错误')}")

        hourly = forecast.get("hourly") or []
        selected = _select_hours(hourly, interval)
        now = selected[0] if selected else {}
        now_text = str(now.get("text", "--"))
        now_temp = str(now.get("temp", "--"))
        updated_at = _format_api_time(forecast.get("updateTime")) or datetime.now().strftime("%H:%M")

        return {
            "ok": True,
            "location_name": location.get("name") or DEFAULT_LOCATION,
            "updated_at": updated_at,
            "interval_hours": interval,
            "summary": "未来天气",
            "rain_text": "有雨" if any(_is_rain(item) for item in selected) else "无雨",
            "now": {
                "temp": now_temp,
                "text": now_text,
                "icon": str(now.get("icon", "")),
                "is_rain": _is_rain(now),
            },
            "hours": [_format_hour(item) for item in selected],
        }
    except Exception as exc:
        logger.error("获取和风天气失败: %s", exc)
        return _fallback_weather(interval, str(exc))


def _get_api_host() -> str:
    host = os.getenv("QWEATHER_API_HOST", "").strip().rstrip("/")
    if host and not host.startswith(("http://", "https://")):
        host = f"https://{host}"
    return host


def _get_api_key() -> str:
    return os.getenv("QWEATHER_API_KEY", "").strip()


def _get_location_id() -> dict[str, str]:
    env_location_id = os.getenv("QWEATHER_LOCATION_ID", "").strip()
    if env_location_id:
        return {"id": env_location_id, "name": os.getenv("QWEATHER_LOCATION_NAME", DEFAULT_LOCATION_NAME)}

    location_text = os.getenv("QWEATHER_LOCATION", DEFAULT_LOCATION).strip() or DEFAULT_LOCATION
    location_name = os.getenv("QWEATHER_LOCATION_NAME", DEFAULT_LOCATION_NAME).strip() or DEFAULT_LOCATION_NAME
    adm = os.getenv("QWEATHER_LOCATION_ADM", DEFAULT_LOCATION_ADM).strip()
    params = {"location": location_text, "range": "cn", "number": "1", "lang": "zh"}
    if adm:
        params["adm"] = adm

    data = _fetch_json("/geo/v2/city/lookup", params)
    if data.get("code") != "200" or not data.get("location"):
        raise RuntimeError(f"城市查询接口返回 {data.get('code', '未知错误')}")

    first = data["location"][0]
    return {"id": str(first.get("id", "")), "name": location_name or str(first.get("name", location_text))}


def _fetch_json(path: str, params: dict[str, str]) -> dict[str, Any]:
    host = _get_api_host()
    url = f"{host}{path}?{parse.urlencode(params)}"
    req = request.Request(url, headers={"X-QW-Api-Key": _get_api_key()})
    try:
        with request.urlopen(req, timeout=12) as resp:
            return _decode_json_response(resp.read(), resp.headers.get("Content-Encoding"))
    except error.HTTPError as exc:
        return _decode_json_response(exc.read(), exc.headers.get("Content-Encoding"))


def _decode_json_response(body: bytes, encoding: str | None) -> dict[str, Any]:
    if encoding == "gzip":
        body = gzip.decompress(body)
    return json.loads(body.decode("utf-8"))


def _select_hours(hourly: list[dict[str, Any]], interval: int) -> list[dict[str, Any]]:
    if not hourly:
        return []
    step = 2 if interval == 2 else 1
    selected = hourly[0::step][:4]
    return selected or hourly[:4]


def _format_hour(item: dict[str, Any]) -> dict[str, Any]:
    text = str(item.get("text", "--"))
    return {
        "time": _format_hour_time(item.get("fxTime")),
        "text": text,
        "temp": str(item.get("temp", "--")),
        "icon": str(item.get("icon", "")),
        "is_rain": _is_rain(item),
    }


def _format_hour_time(value: Any) -> str:
    text = str(value or "")
    parsed = _parse_api_time(text)
    if parsed:
        return f"{parsed.hour:02d}时"
    return "--时"


def _format_api_time(value: Any) -> str:
    parsed = _parse_api_time(str(value or ""))
    if not parsed:
        return ""
    return f"{parsed.hour:02d}:{parsed.minute:02d}"


def _parse_api_time(value: str) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _is_rain(item: dict[str, Any]) -> bool:
    text = str(item.get("text", ""))
    return any(keyword in text for keyword in RAIN_KEYWORDS)


def _fallback_weather(interval: int, error: str) -> dict[str, Any]:
    return {
        "ok": False,
        "location_name": os.getenv("QWEATHER_LOCATION_NAME", DEFAULT_LOCATION_NAME),
        "updated_at": datetime.now().strftime("%H:%M"),
        "interval_hours": interval,
        "summary": "未来天气",
        "rain_text": "未知",
        "now": {"temp": "--", "text": "待配置", "icon": "", "is_rain": False},
        "hours": [
            {"time": "--时", "text": "--", "temp": "--", "icon": "", "is_rain": False},
            {"time": "--时", "text": "--", "temp": "--", "icon": "", "is_rain": False},
            {"time": "--时", "text": "--", "temp": "--", "icon": "", "is_rain": False},
            {"time": "--时", "text": "--", "temp": "--", "icon": "", "is_rain": False},
        ],
        "error": error,
    }
