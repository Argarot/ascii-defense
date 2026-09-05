"""
Reference subjects for the comparison, drawn the way the game draws.

Two corrections over the first version, both of which were changing the answer
more than any font did:

  * THE PALETTE IS THE GAME'S. Colours come from
    packages/content/assets/palette.json, which is cool blue-grey and organised
    as lit / mid / dark per material. The earlier scene was invented warm brown,
    so every comparison was run against a picture the game will never show.

  * NO BLUR, NO SUPERSAMPLING, HARD EDGES. The earlier scene was Gaussian
    blurred and box-downsampled, which left almost every cell a smooth tone
    patch with no structure in it. A solver given a cell with no structure
    correctly reports that no glyph explains it, and the tie-break then fills
    the board with the sparsest available mark — which is why the output was
    nearly all braille dots. The fonts were not the problem; the source had
    nothing in it to find. Terrain is drawn here as flat masses with lit and
    dark edges, per ASSETS.md section 5: consistent light from the top-left,
    shading rather than geometry, ground mostly empty.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PALETTE_JSON = ROOT / "packages" / "content" / "assets" / "palette.json"

FALLBACK = {
    "terrain.ground.mid": "#3d4f61", "terrain.ground.lit": "#54687d",
    "terrain.ground.dark": "#141c25", "terrain.road.mid": "#93abc4",
    "terrain.road.lit": "#c2d6ea", "terrain.road.dark": "#333f4d",
    "terrain.rock.mid": "#5a6a7c", "terrain.rock.lit": "#8698ab",
    "terrain.rock.dark": "#1b232c", "terrain.ore.mid": "#ffd15c",
    "terrain.ore.lit": "#fff0b0", "terrain.ore.dark": "#2a2415",
    "terrain.core.mid": "#2bbfae", "terrain.core.lit": "#a8fff2",
    "terrain.core.dark": "#0d2b26", "terrain.water.mid": "#1d3550",
    "terrain.water.lit": "#2e4d6e", "terrain.water.dark": "#060d16",
    "terrain.shore.lit": "#cfc196", "terrain.shore.mid": "#8f8264",
    "terrain.shore.dark": "#1c1a12", "tower.frame": "#7286a0",
    "tower.core": "#ffffff", "tower.ground": "#0c1017",
    "enemy.fast": "#ff8484", "path.1": "#4cc9f0",
}


def _load() -> dict[str, tuple[int, int, int]]:
    raw = FALLBACK
    if PALETTE_JSON.exists():
        try:
            raw = json.loads(PALETTE_JSON.read_text())["roles"]
        except Exception:
            pass
    out = {}
    for k, v in raw.items():
        v = v.lstrip("#")
        out[k] = tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))
    for k, v in FALLBACK.items():
        out.setdefault(k, tuple(int(v.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)))
    return out


PAL = _load()
CELLS_X, CELLS_Y = 12, 7


def _mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def board(width: int, height: int) -> Image.Image:
    """A patch of battlefield, CELLS_X x CELLS_Y cells, at exactly this size."""
    W, H = width, height
    cw, ch = W / CELLS_X, H / CELLS_Y
    unit = max(1, int(round(min(cw, ch) / 5)))          # sub-cell detail step

    img = Image.new("RGB", (W, H), PAL["terrain.ground.mid"])
    d = ImageDraw.Draw(img)

    def C(x, y):
        return (x * cw, y * ch)

    # --- ground: flat blocky variation, ~9% of it marked. A mixing hash, not
    # (x*a + y*b) % n, which lays visible diagonal moire across open ground.
    step = max(2, unit * 3)
    rng = np.random.default_rng(20260820)
    for gy in range(0, H, step):
        for gx in range(0, W, step):
            r = rng.random()
            if r < 0.045:
                d.rectangle([gx, gy, gx + step - 1, gy + step - 1],
                            fill=PAL["terrain.ground.lit"])
            elif r < 0.10:                       # ASSETS.md section 5: ground is
                d.rectangle([gx, gy, gx + step - 1, gy + step - 1],
                            fill=PAL["terrain.ground.dark"])   # mostly empty

    # --- water with a shore band on the land-facing edge
    wy = 5.1
    d.rectangle([C(8.2, wy)[0], C(0, wy)[1], W, H], fill=PAL["terrain.water.mid"])
    d.rectangle([C(8.2, wy)[0], C(0, wy)[1], W, C(0, wy)[1] + unit * 2],
                fill=PAL["terrain.water.lit"])
    for i in range(3):
        yy = C(0, wy)[1] + unit * (5 + i * 4)
        d.rectangle([C(8.6 + i * 0.7, 0)[0], yy,
                     C(10.4 + i * 0.7, 0)[0], yy + unit - 1],
                    fill=PAL["terrain.water.lit"])
    d.rectangle([C(8.2, wy)[0], C(0, wy)[1] - unit * 2, W, C(0, wy)[1] - 1],
                fill=PAL["terrain.shore.mid"])
    d.rectangle([C(8.2, wy)[0], C(0, wy)[1] - unit, W, C(0, wy)[1] - 1],
                fill=PAL["terrain.shore.lit"])

    # --- road: flat band, lit on the top edge, dark on the bottom
    def road(x0, y0, x1, y1):
        half = ch * 0.30
        a, b = C(x0, y0), C(x1, y1)
        d.rectangle([a[0], a[1] - half, b[0], b[1] + half],
                    fill=PAL["terrain.road.mid"])
        d.rectangle([a[0], a[1] - half, b[0], a[1] - half + unit - 1],
                    fill=PAL["terrain.road.lit"])
        d.rectangle([a[0], b[1] + half - unit + 1, b[0], b[1] + half],
                    fill=PAL["terrain.road.dark"])

    road(0, 3.6, 5.2, 3.6)
    half = ch * 0.30
    d.rectangle([C(4.6, 0)[0], C(0, 2.1)[1] - half, C(5.2, 0)[0],
                 C(0, 3.6)[1] + half], fill=PAL["terrain.road.mid"])
    d.rectangle([C(4.6, 0)[0], C(0, 2.1)[1] - half, C(4.6, 0)[0] + unit - 1,
                 C(0, 3.6)[1] + half], fill=PAL["terrain.road.lit"])
    road(4.6, 2.1, 6.2, 2.1)

    # --- rock: blocky, lit top-left, dark bottom-right
    for cx, cy, s in ((1.1, 1.1, 0.42), (1.85, 1.45, 0.30), (0.65, 1.75, 0.24)):
        x0, y0 = C(cx - s, cy - s * 0.9)
        x1, y1 = C(cx + s, cy + s * 0.9)
        d.rectangle([x0, y0, x1, y1], fill=PAL["terrain.rock.mid"])
        d.rectangle([x0, y0, x1, y0 + unit - 1], fill=PAL["terrain.rock.lit"])
        d.rectangle([x0, y0, x0 + unit - 1, y1], fill=PAL["terrain.rock.lit"])
        d.rectangle([x0, y1 - unit + 1, x1, y1], fill=PAL["terrain.rock.dark"])
        d.rectangle([x1 - unit + 1, y0, x1, y1], fill=PAL["terrain.rock.dark"])

    # --- ore: discrete bright nuggets on a dark seam
    rng = np.random.default_rng(5)
    d.rectangle([C(8.9, 0.5), C(11.4, 1.9)], fill=PAL["terrain.ore.dark"])
    for _ in range(26):
        x = 9.0 + rng.random() * 2.3
        y = 0.6 + rng.random() * 1.2
        px, py = C(x, y)
        d.rectangle([px, py, px + unit - 1, py + unit - 1],
                    fill=PAL["terrain.ore.mid"])
        d.point((px, py), fill=PAL["terrain.ore.lit"])

    # --- the Core
    cx, cy = 6.7, 2.1
    x0, y0 = C(cx - 0.85, cy - 0.45)
    x1, y1 = C(cx + 0.85, cy + 0.45)
    d.rectangle([x0, y0, x1, y1], fill=PAL["terrain.core.dark"])
    d.rectangle([x0 + unit, y0 + unit, x1 - unit, y1 - unit],
                fill=PAL["terrain.core.mid"])
    d.rectangle([C(cx - 0.30, cy - 0.16), C(cx + 0.30, cy + 0.16)],
                fill=PAL["terrain.core.lit"])
    d.rectangle([C(cx - 0.06, cy - 1.0), C(cx + 0.06, cy - 0.4)],
                fill=PAL["tower.frame"])

    _tower(d, C, 3.4, 4.9, unit, ch)

    # --- an enemy on the road
    ex, ey = 1.5, 3.6
    d.rectangle([C(ex - 0.20, ey - 0.26), C(ex + 0.20, ey + 0.22)],
                fill=PAL["enemy.fast"])
    d.rectangle([C(ex - 0.20, ey + 0.14), C(ex + 0.20, ey + 0.22)],
                fill=PAL["terrain.ground.dark"])
    return img


def _tower(d, C, tx, ty, unit, ch) -> None:
    """A tower as an object: base, body, lit face, shadow, core, mast."""
    x0, y0 = C(tx - 0.40, ty - 0.10)
    x1, y1 = C(tx + 0.40, ty + 0.34)
    d.rectangle([C(tx - 0.46, ty + 0.30), C(tx + 0.46, ty + 0.42)],
                fill=PAL["tower.ground"])
    d.rectangle([x0, y0, x1, y1], fill=PAL["tower.frame"])
    d.rectangle([x0, y0, x1, y0 + unit - 1], fill=PAL["terrain.road.lit"])
    d.rectangle([x0, y0, x0 + unit - 1, y1], fill=PAL["terrain.road.lit"])
    d.rectangle([x1 - unit + 1, y0, x1, y1], fill=PAL["terrain.ground.dark"])
    d.rectangle([C(tx - 0.16, ty - 0.36), C(tx + 0.16, ty - 0.06)],
                fill=PAL["path.1"])
    d.rectangle([C(tx - 0.07, ty - 0.30), C(tx + 0.07, ty - 0.14)],
                fill=PAL["tower.core"])
    d.rectangle([C(tx - 0.04, ty - 0.66), C(tx + 0.04, ty - 0.30)],
                fill=PAL["tower.frame"])


def tower(width: int, height: int) -> Image.Image:
    """One tower filling one game cell — the drawing-room test."""
    W, H = width, height
    unit = max(1, int(round(min(W, H) / 12)))
    img = Image.new("RGB", (W, H), PAL["terrain.ground.mid"])
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(3)
    step = max(2, unit * 2)
    for gy in range(0, H, step):
        for gx in range(0, W, step):
            r = rng.random()
            if r < 0.06:
                d.rectangle([gx, gy, gx + step - 1, gy + step - 1],
                            fill=PAL["terrain.ground.lit"])
            elif r < 0.13:
                d.rectangle([gx, gy, gx + step - 1, gy + step - 1],
                            fill=PAL["terrain.ground.dark"])
    _tower(d, lambda x, y: (x * W, y * H), 0.5, 0.60, unit, H)
    return img


def board_soft(width: int, height: int) -> Image.Image:
    """
    The previous scene: supersampled, Gaussian blurred, box downsampled.

    Kept deliberately as a control. It is the same content as `board`, drawn
    the way the first two rounds drew it, and it is the reason those rounds
    came out as fields of braille dots: blur removes sub-cell structure, a cell
    with no structure is explained equally badly by every glyph, and the
    tie-break then picks the sparsest mark available. Run both and compare the
    braille share to see the mechanism rather than take it on trust.
    """
    from PIL import ImageFilter
    ss = 4
    big = board(width * ss, height * ss)
    return big.filter(ImageFilter.GaussianBlur(ss * 0.9)).resize(
        (width, height), Image.BOX)
