#!/usr/bin/env python3
"""ASCII Defense Refinery: Screw Auger complete animated upgrade tree."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
BASE_PATH = HERE.parent / "design_pass_19/generate_ascii_defense_refinery_drill_smelter_concepts_19.py"
spec = importlib.util.spec_from_file_location("refinery19", BASE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load {BASE_PATH}")
base19 = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = base19
spec.loader.exec_module(base19)
base = base19.base

OUT_PNG = HERE / "ascii-defense-refinery-upgrade-tree-20.png"
OUT_GIF = HERE / "ascii-defense-refinery-upgrade-tree-animated-20.gif"
OUT_JSON = HERE / "ascii-defense-refinery-upgrade-tree-20.json"

SHEET_W = 2400
SHEET_H = 3520
PANEL = "#15100b"
PANEL_2 = "#1b140d"
BORDER = "#493620"
INK = "#f0e8dc"
MUTED = "#ad9e89"
DIM = "#796a57"
ACCENT = "#e8ad38"
GOLD = "#f5cf68"

REFINERY = {
    "steel_high": "#efe7da",
    "steel_mid": "#b3a28a",
    "steel_low": "#6d5b47",
    "steel_shadow": "#20170f",
    "brown_deep": "#2a1708",
    "brown_mid": "#6f3e13",
    "brown_edge": "#a96620",
    "brass_mid": "#c48822",
    "brass_edge": "#e4ad38",
    "brass_high": "#f7d36d",
    "ore": "#ffe898",
    "ore_dim": "#aa7320",
    "legendary": "#fff6c8",
}

T1 = {"W": "Wide Bore", "C": "Fast Cycle"}
T2 = {"S": "Survey", "A": "Automation"}
T3 = {"M": "Mother Lode", "P": "Perpetual"}
SEQS = [""] + list(T1) + [a + b for a in T1 for b in T2] + [a + b + c for a in T1 for b in T2 for c in T3]


def parent_seq(seq: str) -> str | None:
    return seq[:-1] if seq else None


def state_name(seq: str) -> str:
    if not seq:
        return "BASE · SCREW AUGER"
    names = [T1[seq[0]]]
    if len(seq) >= 2:
        names.append(T2[seq[1]])
    if len(seq) >= 3:
        names.append(T3[seq[2]])
    return " · ".join(names)


def refinery_blueprint(seq: str, frame: int = 0) -> list[str]:
    if seq not in SEQS:
        raise ValueError(f"Unknown Refinery path {seq!r}")
    rows = [
        "  [R]   ",
        " /===\\  ",
        "  |#|   ",
        "[__|__] ",
        "   V    ",
    ]

    if len(seq) >= 1:
        if seq[0] == "W":
            rows[0] = " [=R=]  "
        else:
            rows[2] = " =|#|=  "

    if len(seq) >= 2:
        if seq[1] == "S":
            rows[1] = "^/===\\^ "
        else:
            rows[2] = " +|#|+  " if seq[0] == "W" else "=[|#|]= "

    if len(seq) >= 3:
        if seq[2] == "M":
            rows[0] = "[==R==] "
            rows[1] = "^/|=|\\^ " if seq[1] == "S" else " /|=|\\  "
            rows[3] = "[_|_|_] "
            rows[4] = "  V V   "
            if frame == 1:
                rows[4] = "  v V   "
        else:
            rows[0] = ".-=R=-. " if seq[0] == "W" else " .-R-.  "
            rows[1] = "^(===)^ " if seq[1] == "S" else " (===)  "
            if seq[0] == "C":
                rows[2] = "=[|#|]= " if seq[1] == "A" else " =|#|=  "
            elif seq[1] == "A":
                rows[2] = " +|#|+  "
            rows[3] = "[==|==] "
            rows[4] = "  \\V/   "
            if frame == 1:
                rows[1] = rows[1].replace("===", "=-=")
    elif frame == 1:
        rows[2] = rows[2].replace("#", "*")

    return rows


def occupancy(seq: str) -> int:
    return sum(ch != " " for row in refinery_blueprint(seq, 0) for ch in row)


def process_cells(seq: str) -> set[tuple[int, int]]:
    rows = refinery_blueprint(seq, 0)
    cells = {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch in "R#Vv*"}
    if seq.startswith("W"):
        cells.update((x, 0) for x, ch in enumerate(rows[0]) if ch == "=")
    if seq.startswith("C"):
        cells.update((x, 2) for x, ch in enumerate(rows[2]) if ch == "=")
    if len(seq) >= 2 and seq[1] == "S":
        cells.update((x, 1) for x, ch in enumerate(rows[1]) if ch == "^")
    if len(seq) >= 2 and seq[1] == "A":
        cells.update((x, 2) for x, ch in enumerate(rows[2]) if ch in "+[]")
    return cells


def tower_tile(seq: str, frame: int, seed: int):
    rows = refinery_blueprint(seq, frame)
    active = process_cells(seq)
    out = base.grass(seed)
    wide = seq.startswith("W")
    fast = seq.startswith("C")
    survey = len(seq) >= 2 and seq[1] == "S"
    auto = len(seq) >= 2 and seq[1] == "A"
    mother = len(seq) >= 3 and seq[2] == "M"
    perpetual = len(seq) >= 3 and seq[2] == "P"

    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == " ":
                continue
            bg = out[y][x].bg
            hot = (x, y) in active
            enclosed = ch in "[](){}" or (y <= 2 and ch in "#*=+")
            bg = base.mix(bg, REFINERY["brown_deep"] if enclosed else REFINERY["steel_shadow"], 0.55 if enclosed else 0.23)
            if ch == "R":
                fg = REFINERY["ore"] if frame == 0 else REFINERY["legendary"]
            elif ch in "Vv" or (mother and y == 4):
                fg = REFINERY["brass_mid"] if frame == 0 else REFINERY["brass_high"]
            elif hot or ch in "#*^+":
                fg = REFINERY["ore_dim"] if frame == 0 else REFINERY["brass_high"]
            elif (wide and y == 0) or (perpetual and y in (0, 1, 3)):
                fg = REFINERY["brass_edge"] if ch in ".-=" else REFINERY["steel_high"]
            elif fast and y == 2 and ch == "=":
                fg = REFINERY["brass_mid"] if frame == 0 else REFINERY["brass_high"]
            elif survey and y == 1 and ch == "^":
                fg = REFINERY["brass_high"]
            elif auto and y == 2 and ch in "[]+":
                fg = REFINERY["brown_edge"]
            else:
                fg = REFINERY["steel_high"] if y <= 2 else REFINERY["steel_mid"]
            out[y][x] = base.CellGlyph(ch, base.ensure_contrast(fg, bg), bg)
    return out


SHORT_CUES = {
    "W": "wider drive head",
    "C": "twin cycling flywheels",
    "S": "ore-sensing prongs",
    "A": "shaft control pods",
    "M": "Twin Auger gantry + two bits",
    "P": "powered Rotary Table",
}


def draw_frame(frame: int) -> Image.Image:
    canvas = base.Canvas(SHEET_W, SHEET_H)
    canvas.text((55, 34), "REFINERY 01 · SCREW AUGER UPGRADE TREE", 45, INK, True)
    canvas.text((57, 94), "Base + 14 cumulative upgrades · warm steel / brown / gold · 650 ms mechanical idle", 21, MUTED)

    canvas.draw.rounded_rectangle((55, 145, 2345, 570), radius=16, fill=PANEL_2, outline=BORDER, width=2)
    canvas.tile(tower_tile("", frame, 20100), 95, 180, 9)
    canvas.text((520, 185), "BASE · SCREW AUGER", 31, INK, True)
    canvas.text((520, 240), "Gearbox head · visible auger shaft · split foundation · ground-penetrating bit", 20, MUTED)
    canvas.text((520, 307), "19/40 occupied", 20, ACCENT, True)
    canvas.text((520, 350), "T1 expands the drive. T2 adds prospecting or autonomous control hardware.", 19, INK)
    canvas.text((520, 390), "T3 becomes the Twin Auger or the continuous powered Rotary Table.", 19, INK)
    canvas.text((520, 458), "W / C  →  S / A  →  M / P", 23, GOLD, True)
    canvas.text((520, 505), "Wide Bore / Fast Cycle  →  Survey / Automation  →  Mother Lode / Perpetual", 18, MUTED)

    card_w, card_h = 1125, 390
    start_y, row_gap = 595, 405
    for i, seq in enumerate(SEQS[1:]):
        col, row = i % 2, i // 2
        x = 55 + col * 1170
        y = start_y + row * row_gap
        canvas.draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=14, fill=PANEL, outline=BORDER, width=2)
        canvas.tile(tower_tile(seq, frame, 20200 + i * 37), x + 28, y + 55, 7)
        tx = x + 355
        canvas.text((tx, y + 25), f"{seq} · {state_name(seq)}", 24, INK, True)
        parent = parent_seq(seq) or ""
        canvas.text((tx, y + 73), f"T{len(seq)} · growth {occupancy(parent)} → {occupancy(seq)}/40", 18, ACCENT, True)
        for j, code in enumerate(seq):
            canvas.text((tx, y + 122 + j * 41), f"T{j + 1} {code}", 17, GOLD, True)
            canvas.text((tx + 72, y + 122 + j * 41), SHORT_CUES[code], 17, INK)
        changes = sum(a != b for ra, rb in zip(refinery_blueprint(seq, 0), refinery_blueprint(seq, 1)) for a, b in zip(ra, rb))
        canvas.text((tx, y + 286), f"idle: {changes} glyph change + local gold pulse", 17, MUTED)
        canvas.text((tx, y + 328), "fixed footprint · inherited branch cues retained", 16, DIM)

    canvas.text((55, 3450), "Mother Lode evolves into concept 02 Twin Auger; Perpetual evolves into concept 04 Rotary Table.", 19, ACCENT)
    return canvas.image


def colour_change_cells(seq: str) -> list[list[int]]:
    a = tower_tile(seq, 0, 22000)
    b = tower_tile(seq, 1, 22000)
    return [
        [x, y]
        for y in range(base.CELL_H)
        for x in range(base.CELL_W)
        if a[y][x].ch != " " and (a[y][x].fg != b[y][x].fg or a[y][x].bg != b[y][x].bg)
    ]


def save_blueprints() -> None:
    payload = {
        "meta": {
            "study": 20,
            "font": "Spleen 5x8",
            "canvasGlyphs": [8, 5],
            "nativePixels": [40, 40],
            "selectedConcept": "01 Screw Auger",
            "absorbedConcepts": {"Mother Lode": "02 Twin Auger", "Perpetual": "04 Rotary Table"},
            "tree": "base + 2 T1 + 4 T2 + 8 T3 = 15 states / 14 upgrades",
            "animation": "two-frame 650ms mechanical idle; fixed footprint; exactly one glyph change plus local gold pulse",
        },
        "palette": REFINERY,
        "choices": {"T1": T1, "T2": T2, "T3": T3},
        "visualCues": SHORT_CUES,
        "states": [
            {
                "path": seq or "BASE",
                "name": state_name(seq),
                "tier": len(seq),
                "parent": parent_seq(seq),
                "occupied": occupancy(seq),
                "idleA": refinery_blueprint(seq, 0),
                "idleB": refinery_blueprint(seq, 1),
                "glyphChangeCells": [
                    [x, y]
                    for y, (ra, rb) in enumerate(zip(refinery_blueprint(seq, 0), refinery_blueprint(seq, 1)))
                    for x, (a, b) in enumerate(zip(ra, rb))
                    if a != b
                ],
                "colourChangeCells": colour_change_cells(seq),
            }
            for seq in SEQS
        ],
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def validate() -> None:
    structures: set[tuple[str, ...]] = set()
    used: set[str] = set()
    for seq in SEQS:
        occupied_sets = []
        for frame in (0, 1):
            rows = refinery_blueprint(seq, frame)
            if len(rows) != 5 or any(len(row) != 8 for row in rows):
                raise ValueError((seq or "BASE", frame, [len(row) for row in rows]))
            if sum(ch == "R" for row in rows for ch in row) != 1:
                raise ValueError(f"{seq or 'BASE'} must contain exactly one R")
            if any(ch in "FfMmOo" for row in rows for ch in row):
                raise ValueError(f"{seq or 'BASE'} leaks another tower identity glyph")
            occ = {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch != " "}
            occupied_sets.append(occ)
            tile = tower_tile(seq, frame, 23000 + len(seq))
            low = min(base.contrast(tile[y][x].fg, tile[y][x].bg) for x, y in occ)
            if low < 4.65:
                raise ValueError(f"{seq or 'BASE'} contrast {low:.2f}")
            used.update("".join(rows))
        if occupied_sets[0] != occupied_sets[1]:
            raise ValueError(f"{seq or 'BASE'} idle footprint moves")
        changes = sum(a != b for ra, rb in zip(refinery_blueprint(seq, 0), refinery_blueprint(seq, 1)) for a, b in zip(ra, rb))
        if changes != 1:
            raise ValueError(f"{seq or 'BASE'} requires exactly one idle glyph change, got {changes}")
        structure = tuple(refinery_blueprint(seq, 0))
        if structure in structures:
            raise ValueError(f"Duplicate state {seq or 'BASE'}")
        structures.add(structure)
        parent = parent_seq(seq)
        if parent is not None and occupancy(seq) <= occupancy(parent):
            raise ValueError(f"{seq} does not grow over {parent or 'BASE'}: {occupancy(parent)} → {occupancy(seq)}")
    if len(structures) != 15:
        raise ValueError("Expected fifteen unique Refinery states")
    missing = sorted(ch for ch in used if ch not in base.FONT)
    if missing:
        raise ValueError(f"Missing Spleen glyphs: {missing}")
    forbidden = [ch for ch in used if 0x2580 <= ord(ch) <= 0x259F or 0x2800 <= ord(ch) <= 0x28FF]
    if forbidden:
        raise ValueError(f"Block/Braille forbidden: {forbidden}")


def save_outputs() -> None:
    frames = [draw_frame(0), draw_frame(1)]
    frames[0].save(OUT_PNG, optimize=True)
    palette = frames[0].convert("P", palette=Image.Palette.ADAPTIVE, colors=256, dither=Image.Dither.NONE)
    quantized = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    quantized[0].save(
        OUT_GIF,
        save_all=True,
        append_images=quantized[1:],
        duration=[650, 650],
        loop=0,
        disposal=1,
        optimize=False,
    )


if __name__ == "__main__":
    validate()
    save_blueprints()
    save_outputs()
    print("wrote Refinery Screw Auger tree; 15 states / 14 upgrades / 30 animated frames")
