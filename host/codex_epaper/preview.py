from __future__ import annotations

from codex_epaper.models import CodexQuotaStatus
from codex_epaper.renderers.layout_codex_card import LayoutCodexCard


def show_preview(
    status: CodexQuotaStatus,
    width: int = 250,
    height: int = 122,
    output_path: str = "preview.png",
) -> None:
    renderer = LayoutCodexCard(width, height)
    black, red = renderer.render(status, output_path=output_path)
    print(f"Preview saved to {output_path}")
    print(f"  Black plane: {len(black)} bytes")
    print(f"  Red plane:   {len(red)} bytes")
    print(f"  Total:       {len(black) + len(red)} bytes")