from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

import yaml

from codex_epaper.collectors.base import Collector
from codex_epaper.collectors.manual import ManualCollector
from codex_epaper.collectors.codex_status_text import CodexStatusTextCollector
from codex_epaper.collectors.codex_live import CodexLiveCollector
from codex_epaper.models import CodexQuotaStatus
from codex_epaper.preview import show_preview
from codex_epaper.renderers.layout_codex_card import LayoutCodexCard
from codex_epaper.scheduler import Scheduler
from codex_epaper.transport.ble import BLETransport

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATHS = ["config.yaml", "config.yml", "config.example.yaml"]


def load_config(path: str | None = None) -> dict:
    if path:
        p = Path(path)
        if not p.exists():
            print(f"Config file not found: {path}")
            sys.exit(1)
        return yaml.safe_load(p.read_text(encoding="utf-8"))

    for name in DEFAULT_CONFIG_PATHS:
        p = Path(name)
        if p.exists():
            return yaml.safe_load(p.read_text(encoding="utf-8"))

    return _default_config()


def _default_config() -> dict:
    return {
        "device": {"name": "Codex Epaper", "ble_name": "CodexQuota"},
        "display": {"width": 250, "height": 122, "colors": "bwr"},
        "collector": {"type": "codex_live"},
        "refresh": {"interval_minutes": 30, "refresh_on_start": True, "retry_count": 3, "retry_delay_seconds": 10},
        "ble": {"device_name": "CodexQuota", "mtu": 185, "chunk_size": 160, "connect_timeout_seconds": 15},
    }


def create_collector(config: dict) -> Collector:
    col_cfg = config.get("collector", {})
    col_type = col_cfg.get("type", "manual")

    if col_type == "manual":
        return ManualCollector(col_cfg.get("manual_file", "../examples/sample_status.json"))
    elif col_type == "codex_status_text":
        return CodexStatusTextCollector(col_cfg.get("status_text", ""))
    elif col_type == "codex_live":
        return CodexLiveCollector()
    else:
        raise ValueError(f"Unknown collector type: {col_type}")


async def do_preview(config: dict) -> None:
    collector = create_collector(config)
    status = await collector.collect()
    status.ble_status = "预览"
    display = config.get("display", {})
    show_preview(
        status,
        width=display.get("width", 250),
        height=display.get("height", 122),
    )


async def do_send(config: dict) -> None:
    collector = create_collector(config)
    status = await collector.collect()
    status.ble_status = "已连接"

    display = config.get("display", {})
    renderer = LayoutCodexCard(
        width=display.get("width", 250),
        height=display.get("height", 122),
        colors=display.get("colors", "bwr"),
    )
    black, red = renderer.render(status, output_path="preview.png")

    ble_cfg = config.get("ble", {})
    transport = BLETransport(
        device_name=ble_cfg.get("device_name", "CodexQuota"),
        chunk_size=ble_cfg.get("chunk_size", 160),
        connect_timeout=ble_cfg.get("connect_timeout_seconds", 15.0),
    )

    try:
        await transport.connect()
        result = await transport.send_frame(
            black, red,
            width=display.get("width", 250),
            height=display.get("height", 122),
        )
        logger.info(f"Send result: {result}")
    finally:
        await transport.disconnect()


async def do_daemon(config: dict) -> None:
    refresh_cfg = config.get("refresh", {})

    async def action():
        try:
            await do_send(config)
        except Exception as e:
            logger.error(f"Daemon send failed: {e}")
            raise

    scheduler = Scheduler(
        interval_minutes=refresh_cfg.get("interval_minutes", 30),
        refresh_on_start=refresh_cfg.get("refresh_on_start", True),
        retry_count=refresh_cfg.get("retry_count", 3),
        retry_delay_seconds=refresh_cfg.get("retry_delay_seconds", 10.0),
    )

    logger.info("Daemon started")
    try:
        await scheduler.run(action)
    except KeyboardInterrupt:
        scheduler.stop()
        logger.info("Daemon stopped")


def main():
    parser = argparse.ArgumentParser(prog="codex_epaper", description="Codex Epaper Quota Display")
    parser.add_argument("command", choices=["preview", "send", "daemon", "web"], help="Command to run")
    parser.add_argument("--config", "-c", default=None, help="Config file path")
    args = parser.parse_args()

    config = load_config(args.config)

    if args.command == "preview":
        asyncio.run(do_preview(config))
    elif args.command == "send":
        asyncio.run(do_send(config))
    elif args.command == "daemon":
        try:
            asyncio.run(do_daemon(config))
        except KeyboardInterrupt:
            pass
    elif args.command == "web":
        from codex_epaper.web_server import run_web_server
        run_web_server(config)


if __name__ == "__main__":
    main()