"""
Stand-in sources until Retro Diffusion is wired up.

`card` exercises the solver deliberately: flat fields (does space win?), smooth
ramps (does the braille ladder engage?), hard edges (does structure survive?),
and saturated hues (does the fg/bg split hold colour?).

`splash` is a placeholder title scene in the game's own register — a Core, roads
to the edges, layered dusk. It is scaffolding for the pipeline, not art.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

DUSK = [(14, 16, 30), (28, 30, 54), (52, 44, 78), (96, 62, 88),
        (150, 92, 92), (206, 138, 92), (240, 190, 120)]


def _lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def card(w: int = 320, h: int = 200) -> Image.Image:
    img = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(img)
    q = h // 4
    d.rectangle([0, 0, w // 2, q], fill=(38, 42, 60))                # flat field
    d.rectangle([w // 2, 0, w, q], fill=(190, 92, 60))
    for x in range(w):                                                # grey ramp
        v = int(255 * x / (w - 1))
        d.line([(x, q), (x, 2 * q)], fill=(v, v, v))
    for x in range(w):                                                # hue ramp
        t = x / (w - 1)
        i = min(int(t * (len(DUSK) - 1)), len(DUSK) - 2)
        d.line([(x, 2 * q), (x, 3 * q)], fill=_lerp(DUSK[i], DUSK[i + 1],
                                                    t * (len(DUSK) - 1) - i))
    for i in range(8):                                                # hard edges
        x0 = i * w // 8
        d.rectangle([x0, 3 * q, x0 + w // 16, h], fill=(230, 230, 210))
    d.ellipse([w // 2 - 30, 3 * q + 4, w // 2 + 30, h - 4], fill=(60, 190, 170))
    return img


def splash(w: int = 320, h: int = 200) -> Image.Image:
    px = np.zeros((h, w, 3), dtype=np.float64)
    for y in range(h):                                                # sky
        t = y / (h - 1)
        i = min(int(t * (len(DUSK) - 1)), len(DUSK) - 2)
        px[y, :] = _lerp(DUSK[i], DUSK[i + 1], t * (len(DUSK) - 1) - i)

    rng = np.random.default_rng(7)
    for _ in range(90):                                               # stars
        y, x = rng.integers(0, h // 2), rng.integers(0, w)
        px[y, x] = np.minimum(px[y, x] + rng.integers(60, 170), 255)

    img = Image.fromarray(px.astype(np.uint8), "RGB")
    d = ImageDraw.Draw(img)

    horizon = int(h * 0.62)
    for band, (col, amp, off) in enumerate([((36, 34, 58), 14, 0),
                                            ((26, 26, 44), 22, 16),
                                            ((16, 18, 32), 30, 34)]):
        pts = [(x, horizon + off - int(amp * np.sin(x / (22 + band * 9) + band)))
               for x in range(w)]
        d.polygon(pts + [(w, h), (0, h)], fill=col)

    ground = (22, 24, 34)
    d.rectangle([0, horizon + 46, w, h], fill=ground)

    cx, cy = w // 2, horizon + 34
    for x0, y0 in ((0, h), (w, h), (-40, horizon + 60), (w + 40, horizon + 60)):
        d.line([(cx, cy), (x0, y0)], fill=(74, 66, 58), width=5)
        d.line([(cx, cy), (x0, y0)], fill=(96, 86, 72), width=1)

    for r, col in ((26, (58, 52, 74)), (18, (86, 76, 100)), (10, (150, 200, 220))):
        d.ellipse([cx - r, cy - r // 2, cx + r, cy + r // 2], fill=col)
    d.rectangle([cx - 5, cy - 40, cx + 5, cy], fill=(120, 128, 150))
    d.rectangle([cx - 8, cy - 48, cx + 8, cy - 38], fill=(190, 214, 232))
    d.rectangle([cx - 3, cy - 56, cx + 3, cy - 46], fill=(240, 250, 255))
    return img
