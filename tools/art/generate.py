"""
Stage 1 — prompt -> source.png via Retro Diffusion.

NOT YET EXERCISED: no RD_API_KEY has been through this code path. It is written
against the documented API and will raise loudly rather than half-succeed.
Everything downstream takes a PNG, so the pipeline runs without it.

Notes carried from the spec:
  * Describe the SUBJECT only. `prompt_style` supplies the pixel-art look;
    saying "pixel art" in the prompt fights it.
  * Keep the seed — re-running on a fixed seed is how downstream parameters
    get A/B'd.
  * A hosted MCP server exists at https://mcp.retrodiffusion.ai/mcp
    (Authorization: Bearer rdpk-...) with style browsing and free cost
    estimation; prefer it when running interactively.
"""
from __future__ import annotations

import base64
import os
from pathlib import Path

ENDPOINT = "https://api.retrodiffusion.ai/v1/inferences"
DEFAULT_STYLE = "rd_plus__default"


def generate(prompt: str, out: str | Path, *, width: int = 256, height: int = 256,
             style: str = DEFAULT_STYLE, seed: int | None = None) -> Path:
    import requests                                   # imported late: optional dep

    key = os.environ.get("RD_API_KEY")
    if not key:
        raise SystemExit(
            "RD_API_KEY is not set. Stage 1 is the only stage that needs it — "
            "point --source at an existing PNG to run the rest of the pipeline.")

    body = {"prompt": prompt, "prompt_style": style,
            "width": width, "height": height, "num_images": 1}
    if seed is not None:
        body["seed"] = seed

    r = requests.post(ENDPOINT, headers={"X-RD-Token": key}, json=body, timeout=120)
    r.raise_for_status()
    payload = r.json()
    if "base64_images" not in payload:
        raise SystemExit(f"unexpected Retro Diffusion response: {payload}")

    out = Path(out)
    out.write_bytes(base64.b64decode(payload["base64_images"][0]))
    return out
