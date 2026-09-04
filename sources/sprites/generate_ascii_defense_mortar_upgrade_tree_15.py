#!/usr/bin/env python3
"""ASCII Defense 60MM Commando Mortar: complete binary upgrade tree 15.

Builds selected Mortar concept 02 as base + 14 cumulative upgrade states.
Every child grows and retains prior branch cues. The two-frame idle uses a
fixed footprint, zero-to-two glyph changes and small local colour shifts.
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


def find_repo() -> Path:
    candidates = [
        HERE.parent / "ascii-defense",
        HERE.parent / "bolt05-import-worktree",
        Path.cwd(),
    ]
    for candidate in candidates:
        if (candidate / "vendor/spleen/spleen-5x8.bdf").is_file():
            return candidate
    raise FileNotFoundError("Could not locate vendor/spleen/spleen-5x8.bdf")


REPO = find_repo()
FONT_BDF = REPO / "vendor/spleen/spleen-5x8.bdf"
OUT_PNG = HERE / "ascii-defense-mortar-upgrade-tree-15.png"
OUT_SVG = HERE / "ascii-defense-mortar-upgrade-tree-15.svg"
OUT_GIF = HERE / "ascii-defense-mortar-upgrade-tree-animated-15.gif"
OUT_JSON = HERE / "ascii-defense-mortar-upgrade-tree-15.json"

GLYPH_W = 5
GLYPH_H = 8
CELL_W = 8
CELL_H = 5
NATIVE_W = GLYPH_W * CELL_W
NATIVE_H = GLYPH_H * CELL_H

SHEET_W = 2400
SHEET_H = 3480

INK = "#e7edf2"
MUTED = "#9aa9b6"
DIM = "#647482"
PANEL = "#0d161e"
PANEL_2 = "#111d26"
BORDER = "#243440"
PAGE = "#050a0e"
ACCENT = "#ee805b"
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


MORTAR = {
    "gun_high": "#e2edf0",
    "gun_mid": "#8fa5ad",
    "gun_low": "#435b65",
    "shadow": "#17151b",
    "armour_deep": "#321317",
    "armour_mid": "#8c342b",
    "armour_edge": "#e87551",
    "armour_high": "#ffc0a3",
    "muzzle": "#fff2d2",
    "muzzle_faded": "#cdbda8",
    "shell": "#ffd078",
    "brass": "#d89a4f",
    "wide": "#e99b68",
    "legendary": "#fff0ad",
}


T1 = {"H": "Heavy Shells", "W": "Wide Burst"}
T2 = {"S": "Siege Load", "D": "Drum Feed"}
T3 = {"B": "Bunker Buster", "C": "Carpet Fire"}
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


def mortar_blueprint(seq: str = "", frame: int = 0) -> list[str]:
    if seq not in SEQS:
        raise ValueError(f"Unknown path {seq!r}")
    rows = [
        list("    M   "),
        list("   //   "),
        list("  '//   "),
        list("  //    "),
        list(" /__\\   "),
    ]

    if len(seq) >= 1:
        if seq[0] == "H":
            rows[2] = list("  [//]  ")
            rows[4] = list("/___\\   ")
        else:
            rows[4] = list("/____\\  ")

    if len(seq) >= 2:
        if seq[1] == "S":
            shell = "!" if frame == 0 else "|"
            rows[3] = list(f"  //[{shell}] ")
        else:
            drum = "=" if frame == 0 else "-"
            rows[3] = list(f"  //({drum}) ")

    if len(seq) >= 3:
        if seq[2] == "B":
            rows[0] = list("   [M]  ")
            rows[1] = list("  |//|  ")
        else:
            ready = "!" if frame == 0 else "|"
            rows[1] = list(f"!{ready} //   ")
            if seq[0] == "H":
                rows[2] = list("^ [//] ^")
            else:
                rows[2] = list("^ '//  ^")
    return ["".join(row) for row in rows]


def tower_tile(seq: str, frame: int, seed: int = 0) -> Tile:
    blueprint = mortar_blueprint(seq, frame)
    out = grass(3600 + seed)
    heavy = len(seq) >= 1 and seq[0] == "H"
    wide = len(seq) >= 1 and seq[0] == "W"
    siege = len(seq) >= 2 and seq[1] == "S"
    drum = len(seq) >= 2 and seq[1] == "D"
    bunker = len(seq) >= 3 and seq[2] == "B"
    carpet = len(seq) >= 3 and seq[2] == "C"
    for y, row in enumerate(blueprint):
        for x, ch in enumerate(row):
            if ch == " ":
                continue
            bg = out[y][x].bg
            if ch == "M":
                bg = mix(MORTAR["armour_deep"], MORTAR["shadow"], .42)
                fg = MORTAR["muzzle"] if frame == 0 else MORTAR["muzzle_faded"]
            elif bunker and y <= 1 and ch in "[]|":
                bg = mix(bg, MORTAR["armour_deep"], .70)
                fg = mix(MORTAR["legendary"], MORTAR["armour_high"], .18)
            elif carpet and ((y == 1 and x <= 1) or (y == 2 and x in (0, 7))):
                bg = mix(bg, MORTAR["armour_deep"], .50)
                pulse = (y, x) in ((1, 1), (2, 7))
                fg = MORTAR["brass"] if pulse and frame == 1 else MORTAR["shell"]
            elif siege and y == 3 and x >= 4:
                bg = mix(bg, MORTAR["shadow"], .45)
                fg = MORTAR["shell"] if ch in "!|" else MORTAR["armour_high"]
            elif drum and y == 3 and x >= 4:
                bg = mix(bg, MORTAR["armour_deep"], .54)
                fg = MORTAR["brass"] if ch in "=-" else MORTAR["armour_high"]
            elif heavy and ((y == 2 and ch in "[]") or y == 4):
                bg = mix(bg, MORTAR["shadow"], .28)
                fg = MORTAR["armour_edge"] if ch in "/\\[]" else MORTAR["gun_low"]
            elif wide and y == 4:
                bg = mix(bg, MORTAR["armour_deep"], .22)
                fg = MORTAR["wide"] if ch in "/\\" else MORTAR["gun_low"]
            elif y <= 2:
                bg = mix(bg, MORTAR["shadow"], .18)
                fg = MORTAR["gun_high"] if ch in "/\\|" else MORTAR["brass"]
            elif y == 3:
                bg = mix(bg, MORTAR["shadow"], .16)
                fg = MORTAR["gun_mid"]
            else:
                bg = mix(bg, MORTAR["shadow"], .20)
                fg = MORTAR["armour_edge"] if ch in "/\\" else MORTAR["gun_low"]
            out[y][x] = CellGlyph(ch, ensure_contrast(fg, bg, 4.7), bg)
    return out


def occupancy(seq: str) -> int:
    return sum(ch != " " for row in mortar_blueprint(seq, 0) for ch in row)


def glyph_change_cells(seq: str) -> list[list[int]]:
    a, b = mortar_blueprint(seq, 0), mortar_blueprint(seq, 1)
    return [[x, y] for y, (ra, rb) in enumerate(zip(a, b)) for x, (ca, cb) in enumerate(zip(ra, rb)) if ca != cb]


def colour_change_cells(seq: str) -> list[list[int]]:
    a, b = tower_tile(seq, 0, 777), tower_tile(seq, 1, 777)
    out: list[list[int]] = []
    for y in range(CELL_H):
        for x in range(CELL_W):
            if a[y][x].ch != " " and (a[y][x].fg != b[y][x].fg or a[y][x].bg != b[y][x].bg):
                out.append([x, y])
    return out


def save_blueprints():
    payload = {
        "meta": {
            "study": 15,
            "font": "Spleen 5x8",
            "canvasGlyphs": [8, 5],
            "nativePixels": [40, 40],
            "selectedConcept": "02 60MM Commando Mortar",
            "tree": "base + 2 T1 + 4 T2 + 8 T3 = 15 states / 14 upgrades",
            "animation": "two-frame 820ms micro-idle; fixed footprint; zero-to-two glyph changes plus local colour fading",
        },
        "palette": MORTAR,
        "choices": {"T1": T1, "T2": T2, "T3": T3},
        "visualCues": {
            "H": "reinforced tube collar and recoil plate",
            "W": "wider stabilising baseplate",
            "S": "ready-shell siege tray",
            "D": "side-mounted rotating drum",
            "B": "armoured muzzle and twin recoil rails",
            "C": "ready-round pair and outer stabiliser fins",
        },
        "states": [
            {
                "path": seq or "BASE",
                "name": state_name(seq),
                "tier": len(seq),
                "parent": parent_seq(seq),
                "occupied": occupancy(seq),
                "idleA": mortar_blueprint(seq, 0),
                "idleB": mortar_blueprint(seq, 1),
                "glyphChangeCells": glyph_change_cells(seq),
                "colourChangeCells": colour_change_cells(seq),
            }
            for seq in SEQS
        ],
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


SHORT_CUES = {
    "H": "reinforced collar + recoil plate",
    "W": "wide stabilising baseplate",
    "S": "ready-shell siege tray",
    "D": "side rotating drum",
    "B": "armoured muzzle + recoil rails",
    "C": "ready rounds + outer fins",
}


def draw_tree_frame(frame: int, save: bool = False) -> Image.Image:
    c = Canvas(SHEET_W, SHEET_H)
    c.text(50, 34, "MORTAR 02 · COMPLETE ANIMATED UPGRADE TREE", 46, INK, True)
    c.text(52, 94, "60MM Commando · base + 14 upgrades · 820 ms micro-idle · one M, zero O/o", 22, MUTED)

    card(c, 50, 145, 2300, 365, "BASE · 60MM COMMANDO", "handheld drop-fire tube · compact baseplate · colour-led idle")
    c.tile(tower_tile("", frame, 2400), 95, 226, 7)
    c.text(440, 215, "12/40 occupied", 24, ACCENT, True)
    c.text(440, 260, "The M muzzle mark fades locally; the tube and footprint do not move.", 21, INK)
    c.text(440, 305, "T1 grows the recoil foundation. T2 adds ammunition handling. T3 changes the weapon only where function demands it.", 19, MUTED)
    c.text(440, 360, "H / W  →  S / D  →  B / C", 22, GOLD, True)
    c.text(440, 405, "Heavy Shells / Wide Burst  →  Siege Load / Drum Feed  →  Bunker Buster / Carpet Fire", 18, MUTED)

    start_y = 545
    card_h = 390
    row_gap = 405
    card_w = 1130
    for i, seq in enumerate(SEQS[1:]):
        col, row = i % 2, i // 2
        x = 50 + col * 1170
        y = start_y + row * row_gap
        parent = parent_seq(seq) or ""
        card(c, x, y, card_w, card_h, f"{seq} · {state_name(seq)}", f"T{len(seq)} · parent {parent or 'BASE'}")
        c.tile(tower_tile(seq, frame, 2500 + i), x + 35, y + 90, 6)
        tx = x + 320
        c.text(tx, y + 94, f"growth  {occupancy(parent)} → {occupancy(seq)}/40", 21, ACCENT, True)
        for j, code in enumerate(seq):
            c.text(tx, y + 142 + j * 42, f"T{j + 1} {code}", 18, GOLD, True)
            c.text(tx + 72, y + 142 + j * 42, SHORT_CUES[code], 18, INK)
        gc = len(glyph_change_cells(seq))
        cc = len(colour_change_cells(seq))
        c.text(tx, y + 285, f"idle: {gc} glyph change{'s' if gc != 1 else ''} · {cc} local colour cell{'s' if cc != 1 else ''}", 17, MUTED)
        c.text(tx, y + 323, "fixed footprint · inherited cues retained", 17, DIM)

    c.text(50, 3405, "All fifteen states animate in sync here for comparison; game instances may remain phase-offset.", 18, ACCENT)
    c.text(2350, 3405, "Mortar upgrade tree 15 · 2026-08-31", 15, DIM, anchor="ra")
    if save:
        c.save()
    return c.image


def draw_sheet():
    draw_tree_frame(0, True)


def draw_gif_frame(frame: int) -> Image.Image:
    return draw_tree_frame(frame, False)


def save_gif():
    rgb_frames = [draw_gif_frame(i) for i in range(2)]
    shared_palette = rgb_frames[0].convert(
        "P", palette=Image.Palette.ADAPTIVE, colors=256, dither=Image.Dither.NONE
    )
    frames = [
        image.quantize(palette=shared_palette, dither=Image.Dither.NONE)
        for image in rgb_frames
    ]
    frames[0].save(
        OUT_GIF,
        save_all=True,
        append_images=frames[1:],
        duration=[820, 820],
        loop=0,
        disposal=1,
        optimize=False,
    )


def validate():
    used: set[str] = set()
    structures: set[tuple[str, ...]] = set()
    for seq in SEQS:
        occupied_sets = []
        for frame in (0, 1):
            bp = mortar_blueprint(seq, frame)
            if len(bp) != CELL_H or any(len(row) != CELL_W for row in bp):
                raise ValueError((seq, frame, bp, [len(row) for row in bp]))
            if sum(ch == "M" for row in bp for ch in row) != 1:
                raise ValueError(f"{seq or 'BASE'} frame {frame} must contain exactly one M")
            if any(ch in "mOo" for row in bp for ch in row):
                raise ValueError(f"{seq or 'BASE'} frame {frame} uses a forbidden identity glyph")
            occupied = {(x, y) for y, row in enumerate(bp) for x, ch in enumerate(row) if ch != " "}
            occupied_sets.append(occupied)
            if len(occupied) > 30:
                raise ValueError(f"{seq or 'BASE'} overfills the canvas: {len(occupied)}")
            used.update("".join(bp))
            tile = tower_tile(seq, frame, 1700 + len(seq))
            low = min(contrast(tile[y][x].fg, tile[y][x].bg) for x, y in occupied)
            if low < 4.65:
                raise ValueError(f"{seq or 'BASE'} frame {frame} contrast too low: {low:.2f}")
        if occupied_sets[0] != occupied_sets[1]:
            raise ValueError(f"{seq or 'BASE'} footprint jumps during idle")
        changed = sum(a != b for ra, rb in zip(mortar_blueprint(seq, 0), mortar_blueprint(seq, 1)) for a, b in zip(ra, rb))
        if not 0 <= changed <= 2:
            raise ValueError(f"{seq or 'BASE'} idle changes are not subtle: {changed}")
        colour_changed = len(colour_change_cells(seq))
        if not 1 <= colour_changed <= 3:
            raise ValueError(f"{seq or 'BASE'} colour idle is not local: {colour_changed}")
        structure = tuple(mortar_blueprint(seq, 0))
        if structure in structures:
            raise ValueError(f"Duplicate state structure: {seq}")
        structures.add(structure)
        parent = parent_seq(seq)
        if parent is not None and occupancy(seq) <= occupancy(parent):
            raise ValueError(f"{seq} does not grow over {parent or 'BASE'}: {occupancy(parent)} → {occupancy(seq)}")

        bp0 = mortar_blueprint(seq, 0)
        if seq.startswith("H") and bp0[2][2:6] != "[//]":
            raise ValueError(f"{seq} lost Heavy Shells' reinforced collar")
        if seq.startswith("W") and bp0[4] != "/____\\  ":
            raise ValueError(f"{seq} lost Wide Burst's stabilising baseplate")
        if len(seq) >= 2 and seq[1] == "S" and "[!]" not in bp0[3]:
            raise ValueError(f"{seq} lost Siege Load's ready-shell tray")
        if len(seq) >= 2 and seq[1] == "D" and "(=)" not in bp0[3]:
            raise ValueError(f"{seq} lost Drum Feed's side drum")
        if len(seq) >= 3 and seq[2] == "B" and not ("[M]" in bp0[0] and "|//|" in bp0[1]):
            raise ValueError(f"{seq} lost Bunker Buster's muzzle and recoil rails")
        if len(seq) >= 3 and seq[2] == "C" and not (bp0[1].startswith("!!") and bp0[2].startswith("^")):
            raise ValueError(f"{seq} lost Carpet Fire's ready rounds and fins")

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
