"""
REXPaint .xp reader/writer — Appendix B of the 1.70 manual.

    int32   format version (negative; REXPaint ignores the value)
    int32   layer count
      per layer: int32 width, int32 height
        per cell: int32 glyph index, uint8 fg rgb, uint8 bg rgb

Cells are COLUMN-MAJOR: index = x*height + y. Getting that wrong produces a
transposed image that looks like noise, which is the failure this comment
exists to prevent.

Glyph indices written here are ATLAS indices: runtime index + atlas.ART_BASE.
"""
from __future__ import annotations

import gzip
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from atlas import ART_BASE

VERSION = -1


def write(path: str | Path, grid: np.ndarray, fg: np.ndarray, bg: np.ndarray,
          base: int = ART_BASE) -> None:
    rows, cols = grid.shape
    buf = bytearray(struct.pack("<ii", VERSION, 1))
    buf += struct.pack("<ii", cols, rows)
    for x in range(cols):
        for y in range(rows):
            buf += struct.pack("<i", int(grid[y, x]) + base)
            buf += bytes(fg[y, x]) + bytes(bg[y, x])
    with gzip.open(path, "wb") as fh:
        fh.write(bytes(buf))


@dataclass
class Layer:
    grid: np.ndarray                 # atlas indices
    fg: np.ndarray
    bg: np.ndarray


def read(path: str | Path) -> tuple[int, list[Layer]]:
    raw = gzip.open(path, "rb").read()
    version, layer_count = struct.unpack_from("<ii", raw, 0)
    off = 8
    layers = []
    for _ in range(layer_count):
        cols, rows = struct.unpack_from("<ii", raw, off)
        off += 8
        need = cols * rows * 10
        cells = np.frombuffer(raw, dtype=np.uint8, count=need, offset=off)
        off += need
        cells = cells.reshape(cols, rows, 10)            # column-major
        idx = cells[:, :, :4].copy().view("<i4")[:, :, 0].T
        fg = cells[:, :, 4:7].transpose(1, 0, 2)
        bg = cells[:, :, 7:10].transpose(1, 0, 2)
        layers.append(Layer(idx, fg, bg))
    if off != len(raw):
        raise ValueError(f"{off} bytes consumed, file is {len(raw)}")
    return version, layers
