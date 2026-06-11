from __future__ import annotations

import logging
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

CODEX_DIR_CANDIDATES = [
    Path.home() / ".codex",
    Path.home() / "AppData" / "Local" / "codex",
    Path.home() / "Library" / "Application Support" / "codex",
]

LOGS_DB_NAME = "logs_2.sqlite"

# 匹配 log body 中的 token 用量
RE_INPUT_TOKENS = re.compile(r"input_tokens=(\d+)")
RE_OUTPUT_TOKENS = re.compile(r"output_tokens=(\d+)")


def _find_codex_dir() -> Optional[Path]:
    for d in CODEX_DIR_CANDIDATES:
        if d.is_dir():
            return d
    return None


def _find_logs_db() -> Optional[Path]:
    codex_dir = _find_codex_dir()
    if not codex_dir:
        return None
    db_path = codex_dir / LOGS_DB_NAME
    if db_path.exists():
        return db_path
    return None


def get_daily_token_usage(date: Optional[datetime] = None) -> dict:
    """从 codex 本地 sqlite 读取指定日期的逐轮 token 用量。

    返回 {"input_tokens": int, "output_tokens": int, "total_tokens": int}
    """
    if date is None:
        date = datetime.now()

    db_path = _find_logs_db()
    if not db_path:
        logger.debug("未找到 codex logs 数据库")
        return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

    day_start = int(datetime(date.year, date.month, date.day, 0, 0, 0).timestamp())
    day_end = int(
        datetime(
            date.year, date.month, date.day, 23, 59, 59
        ).timestamp()
        + 1
    )

    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT feedback_log_body
            FROM logs
            WHERE ts >= ? AND ts < ?
              AND feedback_log_body LIKE '%token_usage%'
            """,
            (day_start, day_end),
        )
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        logger.error(f"读取 codex logs 数据库失败: {e}")
        return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

    input_total = 0
    output_total = 0
    for (body,) in rows:
        m_in = RE_INPUT_TOKENS.search(body)
        m_out = RE_OUTPUT_TOKENS.search(body)
        if m_in:
            input_total += int(m_in.group(1))
        if m_out:
            output_total += int(m_out.group(1))

    total = input_total + output_total
    logger.info(f"每日token用量: input={input_total:,} output={output_total:,} total={total:,}")
    return {
        "input_tokens": input_total,
        "output_tokens": output_total,
        "total_tokens": total,
    }