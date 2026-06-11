from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from codex_epaper.collectors.base import Collector
from codex_epaper.collectors.manual import ManualCollector
from codex_epaper.collectors.codex_live import CodexLiveCollector
from codex_epaper.models import CodexQuotaStatus
from codex_epaper.token_usage import get_daily_token_usage

logger = logging.getLogger(__name__)

WEB_DIR = Path(__file__).resolve().parent.parent.parent / "web"

app = FastAPI()

_collector: Optional[Collector] = None
_config: dict = {}
_last_status: Optional[CodexQuotaStatus] = None


def _create_collector(config: dict) -> Collector:
    col_cfg = config.get("collector", {})
    col_type = col_cfg.get("type", "codex_live")
    if col_type == "codex_live":
        return CodexLiveCollector()
    elif col_type == "manual":
        return ManualCollector(col_cfg.get("manual_file", "../examples/sample_status.json"))
    else:
        return CodexLiveCollector()


@app.get("/api/status")
async def api_status():
    global _last_status, _collector
    if _collector is None:
        _collector = CodexLiveCollector()
    try:
        status = await _collector.collect()
        if status.status_label == "错误" and _last_status:
            status = _last_status
        elif status.status_label != "错误":
            _last_status = status
    except Exception as e:
        logger.error(f"Status fetch failed: {e}")
        if _last_status:
            status = _last_status
        else:
            status = CodexQuotaStatus()
            status.headline = "获取失败"
            status.status_label = "错误"

    # 填充每日 token 用量
    try:
        usage = get_daily_token_usage()
        status.daily_input_tokens = usage["input_tokens"]
        status.daily_output_tokens = usage["output_tokens"]
        status.daily_total_tokens = usage["total_tokens"]
    except Exception as e:
        logger.error(f"获取每日token用量失败: {e}")

    return JSONResponse(content=status.to_dict())


@app.get("/api/config")
async def api_config():
    display = _config.get("display", {})
    refresh = _config.get("refresh", {})
    return JSONResponse(content={
        "display": display,
        "refresh": refresh,
        "ble_name": _config.get("device", {}).get("ble_name", "CodexQuota"),
    })


@app.get("/api/health")
async def api_health():
    return JSONResponse(content={"ok": True})


_static_app = StaticFiles(directory=str(WEB_DIR), html=True)
app.mount("/_static", _static_app, name="web_static")


@app.get("/{path:path}")
async def serve_static(path: str):
    file_path = WEB_DIR / path
    if file_path.is_file():
        return FileResponse(str(file_path))
    if (WEB_DIR / "index.html").is_file():
        return FileResponse(str(WEB_DIR / "index.html"))
    return JSONResponse(status_code=404, content={"detail": "Not found"})


def run_web_server(config: dict) -> None:
    global _collector, _config
    _config = config
    _collector = _create_collector(config)

    import uvicorn
    port = config.get("web", {}).get("port", 8765)
    host = config.get("web", {}).get("host", "0.0.0.0")

    logger.info(f"Web server starting at http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")
