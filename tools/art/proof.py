"""
Render a PNG from the SOLVED grid — never from the source.

This is the regression test for every parameter change: if the proof looks
right, the .xp will look right, because both are generated from the same
arrays and the same masks the solver measured.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from glyphs import GlyphSet


def render(gs: GlyphSet, grid: np.ndarray, fg: np.ndarray, bg: np.ndarray,
           scale: int = 1) -> Image.Image:
    rows, cols = grid.shape
    masks = gs.masks.reshape(-1, gs.ch, gs.cw)[grid]             # (r,c,H,W)
    a = masks[..., None]
    px = bg[:, :, None, None, :] * (1 - a) + fg[:, :, None, None, :] * a
    px = (px.transpose(0, 2, 1, 3, 4)
            .reshape(rows * gs.ch, cols * gs.cw, 3))
    img = Image.fromarray(np.rint(px).astype(np.uint8), "RGB")
    if scale > 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    return img


def as_text(gs: GlyphSet, grid: np.ndarray) -> str:
    return "\n".join("".join(chr(gs.codepoints[i]) for i in row) for row in grid)
