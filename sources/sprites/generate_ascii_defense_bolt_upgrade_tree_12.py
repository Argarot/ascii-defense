#!/usr/bin/env python3
"""ASCII Defense option-05 Bolt turret: complete binary upgrade tree 12.

Builds the selected drum-loaded physical Bolt turret as base + 14 cumulative
upgrade states. Every child grows, retains prior branch cues, and has two
restrained mechanical idle frames on the Spleen 5x8 / 8x5 canvas.
"""

from __future__ import annotations

import colorsys
import html
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
REPO = HERE.parent / "ascii-defense"
FONT_BDF = REPO / "vendor/spleen/spleen-5x8.bdf"
OUT_PNG = HERE / "ascii-defense-bolt-upgrade-tree-12.png"
OUT_SVG = HERE / "ascii-defense-bolt-upgrade-tree-12.svg"
OUT_GIF = HERE / "ascii-defense-bolt-upgrade-tree-idle-12.gif"
OUT_JSON = HERE / "ascii-defense-bolt-upgrade-tree-12.json"

GLYPH_W = 5
GLYPH_H = 8
CELL_W = 8
CELL_H = 5
NATIVE_W = GLYPH_W * CELL_W
NATIVE_H = GLYPH_H * CELL_H

SHEET_W = 2600
SHEET_H = 4240

INK = "#e7edf2"
MUTED = "#9aa9b6"
DIM = "#647482"
PANEL = "#0d161e"
PANEL_2 = "#111d26"
BORDER = "#243440"
PAGE = "#050a0e"
GREEN = "#73e2ad"
GOLD = "#f1c75b"


def parse_bdf(path: Path) -> dict[str, tuple[int, ...]]:
    glyphs: dict[str, tuple[int, ...]] = {}
    enc: int | None = None
    rows: list[int] | None = None
    in_bitmap = False
    for raw in path.read_text(encoding="utf-8").splitlines():
        if raw.startswith("ENCODING "):
            enc = int(raw.split()[1])
        elif raw == "BITMAP":
            rows = []
            in_bitmap = True
        elif raw == "ENDCHAR":
            if enc is not None and rows is not None and enc >= 0:
                rows = (rows + [0] * GLYPH_H)[:GLYPH_H]
                glyphs[chr(enc)] = tuple(rows)
            enc = None
            rows = None
            in_bitmap = False
        elif in_bitmap and rows is not None:
            rows.append(int(raw, 16) >> 3)
    return glyphs


FONT = parse_bdf(FONT_BDF)


def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hx(c: Iterable[float]) -> str:
    return "#" + "".join(f"{max(0, min(255, round(v))):02x}" for v in c)


def mix(a: str, b: str, t: float) -> str:
    aa, bb = rgb(a), rgb(b)
    return hx(aa[i] * (1 - t) + bb[i] * t for i in range(3))


def shift(h: str, dh: float = 0.0, ds: float = 0.0, dl: float = 0.0) -> str:
    r, g, b = (v / 255 for v in rgb(h))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    rr, gg, bb = colorsys.hls_to_rgb((hh + dh) % 1, max(0, min(1, ll + dl)), max(0, min(1, ss + ds)))
    return hx((rr * 255, gg * 255, bb * 255))


def lum(h: str) -> float:
    vals = []
    for v in rgb(h):
        q = v / 255
        vals.append(q / 12.92 if q <= 0.04045 else ((q + 0.055) / 1.055) ** 2.4)
    return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2]


def contrast(a: str, b: str) -> float:
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def ensure_contrast(fg: str, bg: str, minimum: float = 5.0) -> str:
    if contrast(fg, bg) >= minimum:
        return fg
    white = mix(fg, "#ffffff", 0.22)
    for _ in range(6):
        if contrast(white, bg) >= minimum:
            return white
        white = mix(white, "#ffffff", 0.22)
    return white


def hash01(x: int, y: int, seed: int) -> float:
    n = (x * 374761393 + y * 668265263 + seed * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) / 0x100000000


@dataclass
class CellGlyph:
    ch: str
    fg: str
    bg: str


Tile = list[list[CellGlyph]]


class Canvas:
    def __init__(self, w: int, h: int):
        self.w = w
        self.h = h
        self.image = Image.new("RGB", (w, h), PAGE)
        self.draw = ImageDraw.Draw(self.image)
        self.svg: list[str] = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
            f'<rect width="{w}" height="{h}" fill="{PAGE}"/>',
        ]
        self.fonts = {
            (20, False): ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20),
            (22, False): ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22),
            (24, False): ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24),
            (26, True): ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26),
            (30, True): ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30),
            (38, True): ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 38),
            (58, True): ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 58),
        }

    def rect(self, box, fill: str, stroke: str | None = None, width: int = 1, radius: int = 0):
        x0, y0, x1, y1 = [round(v) for v in box]
        pil_fill = None if fill == "none" else fill
        if radius:
            self.draw.rounded_rectangle((x0, y0, x1, y1), radius=radius, fill=pil_fill, outline=stroke, width=width)
            self.svg.append(
                f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="{radius}" fill="{fill}"'
                + (f' stroke="{stroke}" stroke-width="{width}"' if stroke else '') + '/>'
            )
        else:
            self.draw.rectangle((x0, y0, x1, y1), fill=pil_fill, outline=stroke, width=width)
            self.svg.append(
                f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="{fill}"'
                + (f' stroke="{stroke}" stroke-width="{width}"' if stroke else '') + '/>'
            )

    def line(self, pts, fill: str, width: int = 1):
        pts2 = [(round(x), round(y)) for x, y in pts]
        self.draw.line(pts2, fill=fill, width=width)
        p = " ".join(f"{x},{y}" for x, y in pts2)
        self.svg.append(f'<polyline points="{p}" fill="none" stroke="{fill}" stroke-width="{width}"/>')

    def text(self, x: float, y: float, value: str, size: int = 22, fill: str = INK,
             bold: bool = False, anchor: str = "la"):
        key = (size, bold)
        if key not in self.fonts:
            face = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
            self.fonts[key] = ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{face}", size)
        font = self.fonts[key]
        self.draw.text((x, y), value, font=font, fill=fill, anchor=anchor)
        weight = "700" if bold else "400"
        family = "DejaVu Sans"
        svg_anchor = {"la": "start", "ma": "middle", "ra": "end", "mm": "middle", "mt": "middle"}.get(anchor, "start")
        baseline = "middle" if anchor in ("ma", "mm", "ra") else "hanging"
        self.svg.append(
            f'<text x="{x}" y="{y}" fill="{fill}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" text-anchor="{svg_anchor}" dominant-baseline="{baseline}">{html.escape(value)}</text>'
        )

    def glyph(self, ch: str, x: float, y: float, scale: float, fg: str, bg: str):
        gw, gh = GLYPH_W * scale, GLYPH_H * scale
        self.rect((x, y, x + gw, y + gh), bg)
        rows = FONT.get(ch)
        if rows is None:
            raise ValueError(f"Missing Spleen glyph: {ch!r} U+{ord(ch):04X}")
        path: list[str] = []
        for py, bits in enumerate(rows):
            for px in range(GLYPH_W):
                if bits & (1 << (GLYPH_W - 1 - px)):
                    x0, y0 = x + px * scale, y + py * scale
                    self.draw.rectangle((round(x0), round(y0), round(x0 + scale), round(y0 + scale)), fill=fg)
                    path.append(f"M{x0:g},{y0:g}h{scale:g}v{scale:g}h-{scale:g}z")
        if path:
            self.svg.append(f'<path d="{"".join(path)}" fill="{fg}"/>')

    def tile(self, tile: Tile, x: float, y: float, scale: float = 4, border: bool = True):
        for gy, row in enumerate(tile):
            for gx, g in enumerate(row):
                self.glyph(g.ch, x + gx * GLYPH_W * scale, y + gy * GLYPH_H * scale, scale, g.fg, g.bg)
        if border:
            self.rect((x, y, x + NATIVE_W * scale, y + NATIVE_H * scale), "none", BORDER, max(1, round(scale / 2)))

    def save(self):
        self.svg.append("</svg>")
        OUT_SVG.write_text("\n".join(self.svg), encoding="utf-8")
        self.image.save(OUT_PNG, optimize=True)


def grass(seed: int = 0, warmer: bool = False) -> Tile:
    rng = random.Random(seed)
    if warmer:
        dark, mid, tint, ink = "#102116", "#28452a", "#5a5630", "#78945b"
    else:
        dark, mid, tint, ink = "#071c17", "#18392b", "#23394b", "#5b8f76"
    out: Tile = []
    marks = [".", ".", "'", ",", "`", "v", "\"", "^"]
    for y in range(CELL_H):
        row: list[CellGlyph] = []
        for x in range(CELL_W):
            wave = 0.34 + 0.18 * math.sin((x + seed * .3) * .8) + 0.14 * math.cos((y - seed * .2) * 1.2)
            bg = mix(dark, mid, max(0.05, min(.82, wave + rng.uniform(-.08, .08))))
            bg = mix(bg, tint, max(0, (x + y - 7) / 18))
            if rng.random() < (0.21 if warmer else 0.17):
                ch = rng.choice(marks)
                fg = mix(bg, ink, rng.uniform(.34, .58))
            else:
                ch, fg = " ", bg
            row.append(CellGlyph(ch, fg, bg))
        out.append(row)
    return out


def clone(tile: Tile) -> Tile:
    return [[CellGlyph(g.ch, g.fg, g.bg) for g in row] for row in tile]


def spans(blueprint: list[str]) -> set[tuple[int, int]]:
    occ: set[tuple[int, int]] = set()
    for y, row in enumerate(blueprint):
        xs = [x for x, ch in enumerate(row) if ch != " "]
        if xs:
            for x in range(min(xs), max(xs) + 1):
                occ.add((x, y))
    return occ


def section(canvas: Canvas, y: int, title: str, subtitle: str):
    canvas.text(60, y, title, 38, INK, True)
    canvas.text(60, y + 54, subtitle, 22, MUTED)


def card(canvas: Canvas, x: int, y: int, w: int, h: int, title: str, subtitle: str | None = None):
    canvas.rect((x, y, x + w, y + h), PANEL, BORDER, 2, 14)
    canvas.text(x + 20, y + 18, title, 26, INK, True)
    if subtitle:
        canvas.text(x + 20, y + 55, subtitle, 20, MUTED)


def mini_palette(canvas: Canvas, colours: list[str], x: int, y: int, w: int):
    sw = w / len(colours)
    for i, c in enumerate(colours):
        canvas.rect((x + i * sw, y, x + (i + 1) * sw + 1, y + 16), c)


BOLT = {
    "steel_high": "#eef3ef",
    "steel_mid": "#a7b2ad",
    "steel_low": "#5d6d66",
    "steel_shadow": "#18231f",
    "turret_deep": "#10261c",
    "turret_mid": "#285b40",
    "turret_edge": "#86c79f",
    "turret_high": "#c9ecd2",
    "breech": "#c7e7b1",
    "bolt_shaft": "#d6b56b",
    "bolt_tip": "#ffe19a",
    "scope": "#9fd9da",
    "loader": "#d39b62",
    "seal": "#74bca0",
}


T1 = {"R": "Rifled", "G": "Gas Seals"}
T2 = {"S": "Long Scope", "L": "Autoloader"}
T3 = {"B": "Railbore", "H": "Hailstorm"}
SEQS = [""] + list(T1) + [a + b for a in T1 for b in T2] + [a + b + c for a in T1 for b in T2 for c in T3]


def state_name(seq: str) -> str:
    if not seq:
        return "BASE"
    names = [T1[seq[0]]]
    if len(seq) >= 2:
        names.append(T2[seq[1]])
    if len(seq) >= 3:
        names.append(T3[seq[2]])
    return " · ".join(names)


def parent_seq(seq: str) -> str | None:
    return seq[:-1] if seq else None


def bolt_blueprint(seq: str = "", frame: int = 0) -> list[str]:
    if seq not in SEQS:
        raise ValueError(f"Unknown path {seq!r}")
    core = "o" if frame == 0 else "O"
    pipe = ")" if frame == 0 else "}"
    cycle = "=" if frame == 0 else "-"
    rows = [
        list(" .-#-.  " if frame == 0 else " .-=-.  "),
        list(f"|[{core}]|={cycle}>"),
        list(f"   ||{pipe}  "),
        list("   ||   "),
        list(" /_||_\\ "),
    ]

    if len(seq) >= 1:
        if seq[0] == "R":
            rows[0] = list(" .-#-.  ")
            rows[1][1], rows[1][3] = "{", "}"
            rows[4] = list("|/_||_\\|")
        else:
            rows[0] = list(" .-=-.  ")
            rows[1][1], rows[1][3] = "(", ")"
            rows[2] = list(f" : ||{pipe}: ")

    if len(seq) >= 2:
        crown = "#" if seq[0] == "R" else "="
        rows[4] = list("|/_||_\\|")
        if seq[1] == "S":
            sight = "+" if frame == 0 else "x"
            rows[0] = list(f"-{sight}.-{crown}-. ")
            rows[3] = list("  /||\\  ")
        else:
            loader_mark = "#" if frame == 0 else "="
            rows[2] = list(f"[{loader_mark}]||{pipe}  ")

    if len(seq) >= 3:
        crown = "#" if seq[0] == "R" else "="
        if seq[2] == "B":
            rail = "H" if frame == 0 else "#"
            rows[1][5:8] = list(f"{rail}=>")
            rows[3] = list("/ [||] \\")
            if seq[1] == "S":
                sight = "+" if frame == 0 else "x"
                rows[0] = list(f"-{sight}.-{crown}-.]")
            else:
                rows[0] = list(f"[.-{crown}-.] ")
        else:
            upper_cycle = "=" if frame == 0 else "-"
            if seq[1] == "S":
                sight = "^" if frame == 0 else "+"
                rows[0] = list(f"{sight}.-{crown}-={upper_cycle}>")
            else:
                rows[0] = list(f" .-{crown}-={upper_cycle}>")
            rows[3] = list("|\\/||\\/|")
    return ["".join(row) for row in rows]


def tower_tile(seq: str, frame: int, seed: int = 0) -> Tile:
    blueprint = bolt_blueprint(seq, frame)
    out = grass(3600 + seed)
    recess_chars = "[]{}()<>:;"
    hail_upper = len(seq) >= 3 and seq[2] == "H"
    for y, row in enumerate(blueprint):
        for x, ch in enumerate(row):
            if ch == " ":
                continue
            bg = out[y][x].bg
            if ch in "oO":
                bg = mix(BOLT["turret_deep"], BOLT["turret_mid"], .24 + frame * .08)
                fg = mix(BOLT["breech"], "#ffffff", frame * .10)
            elif (y == 1 and x >= 5) or (hail_upper and y == 0 and x >= 5):
                bg = mix(bg, BOLT["steel_shadow"], .16)
                fg = BOLT["bolt_tip"] if ch == ">" else mix(BOLT["bolt_shaft"], BOLT["bolt_tip"], frame * .10)
            elif len(seq) >= 2 and seq[1] == "S" and y == 0 and x <= 1:
                bg = mix(bg, BOLT["turret_deep"], .25)
                fg = BOLT["scope"]
            elif len(seq) >= 2 and seq[1] == "L" and y == 2 and x <= 2:
                bg = mix(bg, BOLT["steel_shadow"], .62)
                fg = BOLT["loader"]
            elif len(seq) >= 1 and seq[0] == "G" and ch in "():":
                bg = mix(bg, BOLT["turret_deep"], .48)
                fg = BOLT["seal"]
            elif y <= 1:
                if ch in recess_chars:
                    bg = mix(bg, BOLT["turret_deep"], .68)
                elif ch in "^+#=Hx":
                    bg = mix(bg, BOLT["turret_deep"], .22)
                base = BOLT["turret_high"] if y == 0 or ch in "/\\.-" else BOLT["turret_edge"]
                fg = mix(base, "#ffffff", frame * .025)
            elif y in (2, 3):
                if ch in "[]H!|:;)(}{":
                    bg = mix(bg, BOLT["steel_shadow"], .28)
                fg = BOLT["steel_high"] if y == 2 else BOLT["steel_mid"]
            else:
                bg = mix(bg, BOLT["steel_shadow"], .20)
                fg = BOLT["steel_low"] if ch in "_'" else BOLT["steel_mid"]
            out[y][x] = CellGlyph(ch, ensure_contrast(fg, bg, 4.7), bg)
    return out


def occupancy(seq: str) -> int:
    return sum(ch != " " for row in bolt_blueprint(seq, 0) for ch in row)


def save_blueprints():
    payload = {
        "meta": {
            "study": 12,
            "font": "Spleen 5x8",
            "canvasGlyphs": [8, 5],
            "nativePixels": [40, 40],
            "selectedConcept": "05 Drum-loaded Gun",
            "tree": "base + 2 T1 + 4 T2 + 8 T3 = 15 states / 14 upgrades",
            "animation": "two-frame mechanical idle with fixed footprint",
        },
        "palette": BOLT,
        "choices": {"T1": T1, "T2": T2, "T3": T3},
        "states": [
            {
                "path": seq or "BASE",
                "name": state_name(seq),
                "tier": len(seq),
                "parent": parent_seq(seq),
                "occupied": occupancy(seq),
                "idleA": bolt_blueprint(seq, 0),
                "idleB": bolt_blueprint(seq, 1),
            }
            for seq in SEQS
        ],
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def draw_pair(c: Canvas, seq: str, x: float, y: float, scale: float, label: bool = True):
    tw = NATIVE_W * scale
    gap = 16
    c.tile(tower_tile(seq, 0, 500 + len(seq) * 50 + sum(map(ord, seq))), x, y, scale)
    c.tile(tower_tile(seq, 1, 500 + len(seq) * 50 + sum(map(ord, seq))), x + tw + gap, y, scale)
    if label:
        c.text(x + tw + gap / 2, y + NATIVE_H * scale + 20, seq or "BASE", 17, INK, True, "ma")
    return tw * 2 + gap


def draw_sheet():
    c = Canvas(SHEET_W, SHEET_H)
    c.text(60, 46, "ASCII DEFENSE — BOLT 05 / COMPLETE UPGRADE TREE", 54, INK, True)
    c.text(62, 118, "Base + 14 upgrades · cumulative branch cues · every child grows · two mechanical idle frames per state", 24, MUTED)

    section(c, 180, "1 · SELECTED BASE", "Option 05 retained: separate gun head, feed conduit, narrow column and flared steel foundation.")
    card(c, 60, 275, 1210, 535, "BASE · DRUM-LOADED BOLT GUN", "idle A / idle B · warm-metal physical bolt · no elemental language")
    draw_pair(c, "", 245, 390, 5, False)
    c.text(665, 665, f"{occupancy('')}/40 occupied · foundation / neck / turret preserved", 18, GREEN, True, "ma")

    card(c, 1330, 275, 1210, 535, "UPGRADE HARDPOINTS", "each choice owns a functional zone and remains visible in every descendant")
    legends = [
        ("T1 · R / G", "Rifled: braced chamber + recoil anchors", "Gas Seals: round housing + pressure collars"),
        ("T2 · S / L", "Long Scope: sight rail + steadier support", "Autoloader: feed box through the neck"),
        ("T3 · B / H", "Railbore: single heavy barrel + recoil cage", "Hailstorm: twin bolt paths + cooling frame"),
    ]
    for i, (head, a, b) in enumerate(legends):
        yy = 370 + i * 125
        c.text(1370, yy, head, 22, GREEN, True)
        c.text(1585, yy, a, 20, INK)
        c.text(1585, yy + 38, b, 20, MUTED)
    c.text(1370, 735, "A/B below every sprite are animation frames, not upgrade alternatives.", 18, GOLD)

    section(c, 880, "2 · ALL 14 UPGRADES", "Spatial position follows the binary tree. Codes are R/G → S/L → B/H; prior choices remain legible at every leaf.")
    c.rect((60, 975, 2540, 3500), PANEL, BORDER, 2, 16)

    levels = [
        (0, [""], 3.0, 1040),
        (1, ["R", "G"], 2.55, 1370),
        (2, ["RS", "RL", "GS", "GL"], 2.15, 1750),
        (3, [a + b + d for a in T1 for b in T2 for d in T3], 1.65, 2200),
    ]
    for tier, seqs, sc, y in levels:
        pair_w = NATIVE_W * sc * 2 + 16
        usable = 2290
        gap = (usable - len(seqs) * pair_w) / max(1, len(seqs) - 1) if len(seqs) > 1 else 0
        start = 165 if len(seqs) > 1 else (SHEET_W - pair_w) / 2
        c.text(88, y + 10, f"T{tier}", 22, DIM, True)
        for i, seq in enumerate(seqs):
            x = start + i * (pair_w + gap)
            draw_pair(c, seq, x, y, sc)
            c.text(x + pair_w / 2, y + NATIVE_H * sc + 48, f"{occupancy(seq)}/40", 15, GREEN, True, "ma")

    c.text(105, 2470, "T3 PATHS", 19, GREEN, True)
    final_seqs = [a + b + d for a in T1 for b in T2 for d in T3]
    for i, seq in enumerate(final_seqs):
        col, row = i % 4, i // 4
        x = 105 + col * 610
        y = 2520 + row * 95
        c.text(x, y, seq, 18, INK, True)
        c.text(x + 60, y, state_name(seq), 17, MUTED)

    c.text(105, 2750, "GROWTH BY PATH", 19, GREEN, True)
    growth_lines = []
    for leaf in final_seqs:
        growth_lines.append(" → ".join(f"{s or 'BASE'} {occupancy(s)}" for s in ("", leaf[:1], leaf[:2], leaf)))
    for i, line in enumerate(growth_lines):
        col, row = i % 2, i // 2
        c.text(105 + col * 1180, 2800 + row * 48, line, 17, MUTED)

    c.text(105, 3075, "NATIVE 1× · IDLE B", 19, GREEN, True)
    nx = 420
    for i, seq in enumerate(SEQS):
        x = nx + (i % 8) * 215
        y = 3045 + (i // 8) * 105
        c.tile(tower_tile(seq, 1, 900 + i), x, y, 1, False)
        c.text(x + 20, y + 60, seq or "0", 14, MUTED, True, "ma")

    section(c, 3585, "3 · VISUAL GRAMMAR RESULT", "Growth comes mainly from foundation, support and machinery. The turret changes only when the selected upgrade function demands it.")
    c.rect((60, 3680, 2540, 4060), PANEL_2, BORDER, 2, 16)
    result_lines = [
        ("T0", "24-ish positions: selected compact gun on a real foundation."),
        ("T1", "Breech choice appears; recoil anchors or pressure infrastructure enlarge the structure."),
        ("T2", "Scope or loader creates an unmistakable functional silhouette and widens the support system."),
        ("T3", "Railbore becomes one reinforced heavy axis; Hailstorm gains a genuine second physical bolt path."),
    ]
    for i, (head, body) in enumerate(result_lines):
        yy = 3730 + i * 72
        c.text(105, yy, head, 20, GREEN, True)
        c.text(185, yy, body, 20, INK)
    c.text(60, 4155, "All 15 states are structurally unique; every upgraded state occupies more glyph positions than its direct parent.", 20, GREEN)
    c.text(2540, 4155, "Bolt upgrade tree 12 · 2026-08-31", 16, DIM, anchor="ra")
    c.save()


def draw_gif_frame(frame: int) -> Image.Image:
    c = Canvas(1700, 1900)
    c.text(45, 34, "BOLT 05 · COMPLETE UPGRADE TREE", 38, INK, True)
    c.text(45, 86, "All fifteen states share one two-frame mechanical idle loop.", 20, MUTED)
    levels = [
        ([""], 4.0, 150),
        (["R", "G"], 3.3, 430),
        (["RS", "RL", "GS", "GL"], 2.6, 770),
        ([a + b + d for a in T1 for b in T2 for d in T3], 2.0, 1170),
    ]
    for tier, (seqs, sc, y) in enumerate(levels):
        tile_w = NATIVE_W * sc
        usable = 1500
        gap = (usable - len(seqs) * tile_w) / max(1, len(seqs) - 1) if len(seqs) > 1 else 0
        start = 100 if len(seqs) > 1 else (1700 - tile_w) / 2
        c.text(45, y + 10, f"T{tier}", 19, DIM, True)
        for i, seq in enumerate(seqs):
            x = start + i * (tile_w + gap)
            c.tile(tower_tile(seq, frame, 1300 + tier * 40 + i), x, y, sc)
            c.text(x + tile_w / 2, y + NATIVE_H * sc + 22, seq or "BASE", 16, INK, True, "ma")
    c.text(850, 1795, "720 ms loop · fixed footprint per state", 18, GREEN, True, "ma")
    return c.image


def save_gif():
    frames = [draw_gif_frame(i).convert("P", palette=Image.Palette.ADAPTIVE, colors=256) for i in range(2)]
    frames[0].save(OUT_GIF, save_all=True, append_images=frames[1:], duration=[720, 720], loop=0, disposal=2, optimize=True)


def validate():
    used: set[str] = set(" .'`,v\"^,:;-|~/*+oOx()#<>=[]{}\\!_H")
    structures: set[tuple[str, ...]] = set()
    for seq in SEQS:
        occupied_sets = []
        for frame in (0, 1):
            bp = bolt_blueprint(seq, frame)
            if len(bp) != CELL_H or any(len(row) != CELL_W for row in bp):
                raise ValueError((seq, frame, bp, [len(row) for row in bp]))
            if sum(ch in "oO" for row in bp for ch in row) != 1:
                raise ValueError(f"{seq or 'BASE'} frame {frame} must contain exactly one o/O")
            if bp[1][-1] != ">":
                raise ValueError(f"{seq or 'BASE'} frame {frame} lost its physical bolt")
            occupied = {(x, y) for y, row in enumerate(bp) for x, ch in enumerate(row) if ch != " "}
            occupied_sets.append(occupied)
            if len(occupied) > 38:
                raise ValueError(f"{seq or 'BASE'} overfills the canvas: {len(occupied)}")
            used.update("".join(bp))
            tile = tower_tile(seq, frame, 1700 + len(seq))
            low = min(contrast(tile[y][x].fg, tile[y][x].bg) for x, y in occupied)
            if low < 4.65:
                raise ValueError(f"{seq or 'BASE'} frame {frame} contrast too low: {low:.2f}")
        if occupied_sets[0] != occupied_sets[1]:
            raise ValueError(f"{seq or 'BASE'} footprint jumps during idle")
        changed = sum(a != b for ra, rb in zip(bolt_blueprint(seq, 0), bolt_blueprint(seq, 1)) for a, b in zip(ra, rb))
        if not 2 <= changed <= 7:
            raise ValueError(f"{seq or 'BASE'} idle changes are not subtle: {changed}")
        structure = tuple(bolt_blueprint(seq, 0))
        if structure in structures:
            raise ValueError(f"Duplicate state structure: {seq}")
        structures.add(structure)
        parent = parent_seq(seq)
        if parent is not None and occupancy(seq) <= occupancy(parent):
            raise ValueError(f"{seq} does not grow over {parent or 'BASE'}: {occupancy(parent)} → {occupancy(seq)}")

        if seq.startswith("R") and "{" not in bolt_blueprint(seq, 0)[1]:
            raise ValueError(f"{seq} lost Rifled housing")
        if seq.startswith("G") and "(" not in bolt_blueprint(seq, 0)[1]:
            raise ValueError(f"{seq} lost Gas Seals housing")
        if len(seq) >= 2 and seq[1] == "S" and bolt_blueprint(seq, 0)[0][0] not in "-^":
            raise ValueError(f"{seq} lost scope cue")
        if len(seq) >= 2 and seq[1] == "L" and not bolt_blueprint(seq, 0)[2].startswith("[#]"):
            raise ValueError(f"{seq} lost loader cue")
        if len(seq) >= 3 and seq[2] == "B" and "H" not in bolt_blueprint(seq, 0)[1]:
            raise ValueError(f"{seq} lost Railbore")
        if len(seq) >= 3 and seq[2] == "H" and bolt_blueprint(seq, 0)[0][-1] != ">":
            raise ValueError(f"{seq} lost Hailstorm's second bolt")

    missing = sorted(ch for ch in used if ch not in FONT)
    if missing:
        raise ValueError(f"Missing Spleen glyphs: {missing}")
    forbidden = [ch for ch in used if 0x2580 <= ord(ch) <= 0x259F or 0x2800 <= ord(ch) <= 0x28FF]
    if forbidden:
        raise ValueError(f"Block/Braille glyphs forbidden: {forbidden}")
    if len(structures) != 15:
        raise ValueError(f"Expected 15 unique states, got {len(structures)}")
    return len(used)


if __name__ == "__main__":
    count = validate()
    save_blueprints()
    draw_sheet()
    save_gif()
    print(f"wrote PNG, SVG, GIF and JSON; {count} glyphs; 15 states; 14 growing upgrades; 30 idle frames")
