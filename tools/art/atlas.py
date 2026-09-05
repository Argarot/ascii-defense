"""
REXPaint font assets, generated from the same GlyphSet the solver uses.

Layout — this is the load-bearing decision in the file:

    slots   0..255   a CP437 compatibility page
    slots 256..N+255 the runtime glyph set, in runtime index order

Why the 256-slot prefix rather than starting the art at 0:

  * REXPaint's manual, Fonts section: "custom fonts always treat index 32 as a
    space, regardless of what the font bitmap contains there." In runtime order
    index 32 is '@', so a zero-based atlas would render every '@' as a hole and
    make the glyph undrawable by hand.
  * REXPaint requires the GUI font and the art font to share glyph dimensions,
    so at 5x8 the editor's own interface must be drawn from this same bitmap,
    and the interface indexes it as CP437.

So the art range begins at ART_BASE and the importer subtracts it. A `.xp`
glyph index therefore means: runtime glyph index = xp_index - ART_BASE.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from glyphs import CELL_H, CELL_W, GlyphSet

ART_BASE = 256
COLUMNS = 16

HERE = Path(__file__).parent

# CP437 index -> (up, right, down, left) stroke weight; 0 none, 1 single, 2 double.
_BOX = {
    179: (1, 0, 1, 0), 180: (1, 0, 1, 1), 181: (1, 0, 1, 2), 182: (2, 0, 2, 1),
    183: (0, 0, 2, 1), 184: (0, 0, 1, 2), 185: (2, 0, 2, 2), 186: (2, 0, 2, 0),
    187: (0, 0, 2, 2), 188: (2, 0, 0, 2), 189: (2, 0, 0, 1), 190: (1, 0, 0, 2),
    191: (0, 0, 1, 1), 192: (1, 1, 0, 0), 193: (1, 1, 0, 1), 194: (0, 1, 1, 1),
    195: (1, 1, 1, 0), 196: (0, 1, 0, 1), 197: (1, 1, 1, 1), 198: (1, 2, 1, 0),
    199: (2, 1, 2, 0), 200: (2, 2, 0, 0), 201: (0, 2, 2, 0), 202: (2, 2, 0, 2),
    203: (0, 2, 2, 2), 204: (2, 2, 2, 0), 205: (0, 2, 0, 2), 206: (2, 2, 2, 2),
    207: (1, 2, 0, 2), 208: (2, 1, 0, 1), 209: (0, 2, 1, 2), 210: (0, 1, 2, 1),
    211: (2, 1, 0, 0), 212: (1, 2, 0, 0), 213: (0, 2, 1, 0), 214: (0, 1, 2, 0),
    215: (2, 1, 2, 1), 216: (1, 2, 1, 2), 217: (1, 0, 0, 1), 218: (0, 1, 1, 0),
}

_VCOLS = {1: (2,), 2: (1, 3)}
_HROWS = {1: (3,), 2: (2, 4)}


def _box_glyph(w: tuple[int, int, int, int]) -> np.ndarray:
    up, right, down, left = w
    m = np.zeros((CELL_H, CELL_W))
    for weight, rows in ((up, range(0, 4)), (down, range(3, CELL_H))):
        for col in _VCOLS.get(weight, ()):
            for r in rows:
                m[r, col] = 1
    for weight, cols in ((left, range(0, 3)), (right, range(2, CELL_W))):
        for row in _HROWS.get(weight, ()):
            for c in cols:
                m[row, c] = 1
    if 2 in (up, down) and 2 in (left, right):        # close double junctions
        for r in _HROWS[2]:
            for c in _VCOLS[2]:
                m[r, c] = 1
    return m


def _shade(fraction: float) -> np.ndarray:
    m = np.zeros((CELL_H, CELL_W))
    for y in range(CELL_H):
        for x in range(CELL_W):
            if ((x + y) % 2 == 0 and fraction >= 0.5) or \
               ((x % 2 == 0) and (y % 2 == 0) and fraction < 0.5) or \
               (fraction > 0.7 and (x + y) % 2 == 1 and y % 2 == 0):
                m[y, x] = 1
    return m


def _synthetic() -> dict[int, np.ndarray]:
    """CP437 slots spleen has no codepoint for, but the editor chrome needs."""
    out: dict[int, np.ndarray] = {}
    full = np.ones((CELL_H, CELL_W))
    out[219] = full
    out[220] = np.vstack([np.zeros((4, CELL_W)), np.ones((4, CELL_W))])
    out[223] = np.vstack([np.ones((4, CELL_W)), np.zeros((4, CELL_W))])
    out[221] = np.hstack([np.ones((CELL_H, 2)), np.zeros((CELL_H, 3))])
    out[222] = np.hstack([np.zeros((CELL_H, 2)), np.ones((CELL_H, 3))])
    out[176], out[177], out[178] = _shade(0.25), _shade(0.5), _shade(0.75)
    sq = np.zeros((CELL_H, CELL_W)); sq[2:6, 1:4] = 1
    out[254] = sq
    hollow = sq.copy(); hollow[3:5, 2:3] = 0
    out[255] = hollow
    for idx, weight in _BOX.items():
        out[idx] = _box_glyph(weight)
    return out


def cp437_codepoints() -> dict[int, int]:
    """REXPaint's stock CP437 index -> codepoint table."""
    table: dict[int, int] = {}
    for line in (HERE / "cp437_utf8.txt").read_text().splitlines():
        parts = line.split("//")[0].split()
        if len(parts) == 2:
            table[int(parts[0])] = int(parts[1])
    return table


def build(gs: GlyphSet) -> tuple[Image.Image, dict[int, int]]:
    """Returns the atlas image and the atlas index -> codepoint charset table."""
    by_cp = {cp: gs.masks[i].reshape(CELL_H, CELL_W)
             for i, cp in enumerate(gs.codepoints)}
    cp437 = cp437_codepoints()
    synth = _synthetic()

    slots: dict[int, np.ndarray] = {}
    charset: dict[int, int] = {}
    for idx, cp in cp437.items():
        if cp in by_cp:
            slots[idx] = by_cp[cp]
        elif idx in synth:
            slots[idx] = synth[idx]
        else:
            continue                                    # left blank on purpose
        charset[idx] = cp
    # index 32 is a space to REXPaint no matter what we draw; keep it blank.
    slots.pop(32, None)
    charset[32] = 0x20

    for i, cp in enumerate(gs.codepoints):
        slots[ART_BASE + i] = by_cp[cp]
        charset[ART_BASE + i] = cp

    total = ART_BASE + gs.n
    rows = -(-total // COLUMNS)
    img = np.zeros((rows * CELL_H, COLUMNS * CELL_W, 4), dtype=np.uint8)
    img[..., 3] = 255                                   # 32-bit png, opaque
    for idx, mask in slots.items():
        r, c = divmod(idx, COLUMNS)
        tile = (mask * 255).astype(np.uint8)
        img[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W, 0] = tile
        img[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W, 1] = tile
        img[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W, 2] = tile

    if img[0, 0, :3].any():
        raise SystemExit("atlas pixel (0,0) is not the colour key — "
                         "REXPaint would misdetect the background")
    return Image.fromarray(img, "RGBA"), charset


def charset_file(charset: dict[int, int]) -> str:
    lines = ["// generated by tools/art — atlas index -> unicode codepoint",
             f"// indices {ART_BASE}+ are the runtime glyph set "
             f"(runtime index = atlas index - {ART_BASE})"]
    lines += [f"{idx} {cp}" for idx, cp in sorted(charset.items())]
    return "\n".join(lines) + "\n"


def config_rows(name: str, png_stem: str, rows: int, charset_stem: str) -> str:
    """Rows to append to REXPaint's data/fonts/_config.xt (tab-separated)."""
    art = f'"{name}"\t{png_stem}\t{COLUMNS}\t{rows}\t{png_stem}\t{COLUMNS}\t{rows}\t{charset_stem}\t-\t1'
    up2 = f'"{name} x2"\t["{name}"*2]'
    up3 = f'"{name} x3"\t["{name}"*3]'
    return "\n".join([
        "",
        f"// --- ASCII Defense art font ({CELL_W}x{CELL_H} spleen, "
        f"{COLUMNS} cols x {rows} rows) ---",
        art, up2, up3, "",
    ])
