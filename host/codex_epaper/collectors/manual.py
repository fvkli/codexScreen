from __future__ import annotations

import json
from pathlib import Path

from codex_epaper.collectors.base import Collector
from codex_epaper.models import CodexQuotaStatus


class ManualCollector(Collector):
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)

    async def collect(self) -> CodexQuotaStatus:
        text = self.file_path.read_text(encoding="utf-8")
        if self.file_path.suffix in (".yaml", ".yml"):
            try:
                import yaml
                data = yaml.safe_load(text)
            except ImportError:
                raise RuntimeError("PyYAML is required for YAML files: pip install pyyaml")
        else:
            data = json.loads(text)
        return CodexQuotaStatus.from_dict(data)