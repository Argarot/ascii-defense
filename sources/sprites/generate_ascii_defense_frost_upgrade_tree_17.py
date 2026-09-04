#!/usr/bin/env python3
"""ASCII Defense Frost Emitter: Crystal Cage complete animated upgrade tree."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
BASE_PATH = HERE.parent / "design_pass_16/generate_ascii_defense_frost_concepts_16.py"
spec = importlib.util.spec_from_file_location("frost16", BASE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load {BASE_PATH}")
base = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = base
spec.loader.exec_module(base)

OUT_PNG = HERE / "ascii-defense-frost-upgrade-tree-aligned-17.png"
OUT_GIF = HERE / "ascii-defense-frost-upgrade-tree-animated-aligned-17.gif"
OUT_JSON = HERE / "ascii-defense-frost-upgrade-tree-aligned-17.json"

SHEET_W = 2400
SHEET_H = 3520
PANEL = "#0c1620"
PANEL_2 = "#101e29"
BORDER = "#273b4a"
INK = "#e8f0f5"
MUTED = "#91a4b3"
DIM = "#607685"
ACCENT = "#70dcff"
ICE = "#c8f4ff"

T1 = {"D": "Deep Chill", "I": "Ice Shards"}
T2 = {"W": "Wide Field", "R": "Rapid Cycle"}
T3 = {"A": "Absolute Zero", "S": "Shatterfield"}
SEQS = [""] + list(T1) + [a + b for a in T1 for b in T2] + [a + b + c for a in T1 for b in T2 for c in T3]


def parent_seq(seq: str) -> str | None:
    return seq[:-1] if seq else None


def state_name(seq: str) -> str:
    if not seq:
        return "BASE · CRYSTAL CAGE"
    names = [T1[seq[0]]]
    if len(seq) >= 2:
        names.append(T2[seq[1]])
    if len(seq) >= 3:
        names.append(T3[seq[2]])
    return " · ".join(names)


def frost_blueprint(seq: str, frame: int = 0) -> list[str]:
    if seq not in SEQS:
        raise ValueError(f"Unknown Frost path {seq!r}")
    rows = [
        "  /F\\   ",
        " <^+^>  ",
        "  \\|/   ",
        "   |    ",
        " /_=_\\  ",
    ]

    if len(seq) >= 1:
        if seq[0] == "D":
            rows[3] = "  [|]   "
        else:
            rows[0] = " ^/F\\^  "

    if len(seq) >= 2:
        if seq[1] == "W":
            rows[1] = "-<^+^>- "
        else:
            rows[3] = " =[|]=  " if seq[0] == "D" else "  =|=   "

    if len(seq) >= 3:
        if seq[2] == "A":
            rows[0] = " ^{F}^  " if seq[0] == "I" else "  {F}   "
            rows[1] = "</:*:\\> " if seq[1] == "W" else " /:*:\\  "
            rows[2] = " \\:+:/  "
            if frame == 1:
                rows[1] = rows[1].replace("*", "+")
        else:
            rows[2] = " /\\|/\\  "
            if frame == 1:
                rows[1] = rows[1].replace("+", "x")
    elif frame == 1:
        rows[1] = rows[1].replace("+", "*")

    return rows


def occupancy(seq: str) -> int:
    return sum(ch != " " for row in frost_blueprint(seq, 0) for ch in row)


def emitter_cell(rows: list[str]) -> tuple[int, int]:
    for y, row in enumerate(rows[:3]):
        for x, ch in enumerate(row):
            if ch in "+*x":
                return x, y
    raise ValueError("No emitter cell")


def pulse_cells(seq: str) -> set[tuple[int, int]]:
    rows = frost_blueprint(seq, 0)
    cells = {(3, 0), emitter_cell(rows)}
    if seq.startswith("I"):
        cells.update((x, 0) for x, ch in enumerate(rows[0]) if ch == "^")
    if len(seq) >= 2 and seq[1] == "W":
        cells.update((x, 1) for x in (0, 6))
    if len(seq) >= 2 and seq[1] == "R":
        cells.update((x, 3) for x, ch in enumerate(rows[3]) if ch == "=")
    if len(seq) >= 3:
        cells.update((x, 2) for x, ch in enumerate(rows[2]) if ch in ":+^/\\")
    return cells


def tower_tile(seq: str, frame: int, seed: int):
    rows = frost_blueprint(seq, frame)
    out = base.grass(seed)
    pulse = pulse_cells(seq)
    deep = seq.startswith("D")
    shards = seq.startswith("I")
    wide = len(seq) >= 2 and seq[1] == "W"
    rapid = len(seq) >= 2 and seq[1] == "R"
    absolute = len(seq) >= 3 and seq[2] == "A"
    shatter = len(seq) >= 3 and seq[2] == "S"

    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == " ":
                continue
            bg = out[y][x].bg
            active = (x, y) in pulse
            if y <= 2:
                enclosure = ch in "[]{}()<>" or absolute or (y == 1 and ch in "/\\")
                bg = base.mix(bg, base.FROST["ice_deep"], 0.57 if enclosure else 0.22)
                if ch == "F":
                    fg = base.FROST["core"] if frame == 0 else base.FROST["legendary"]
                elif active or ch in "+*x:^":
                    fg = base.FROST["pulse_dim"] if frame == 0 else base.FROST["pulse"]
                elif shatter and y == 2:
                    fg = base.FROST["ice_high"]
                elif shards and y == 0 and ch in "^/\\":
                    fg = base.FROST["ice_high"]
                elif wide and y == 1 and x in (1, 7):
                    fg = base.FROST["ice_edge"]
                else:
                    fg = base.FROST["steel_high"] if ch in "/\\|_=" else base.FROST["ice_edge"]
            elif y == 3:
                bg = base.mix(bg, base.FROST["steel_shadow"], 0.25)
                if deep and ch in "[]":
                    fg = base.FROST["ice_high"]
                elif rapid and ch == "=":
                    fg = base.FROST["pulse_dim"] if frame == 0 else base.FROST["pulse"]
                else:
                    fg = base.FROST["steel_high"]
            else:
                bg = base.mix(bg, base.FROST["steel_shadow"], 0.22)
                fg = base.FROST["ice_edge"] if ch in "^=" else base.FROST["steel_mid"]
            out[y][x] = base.CellGlyph(ch, base.ensure_contrast(fg, bg), bg)
    return out


SHORT_CUES = {
    "D": "insulated cold reservoir",
    "I": "faceted crown tips",
    "W": "extended radial vanes",
    "R": "cycling support coils",
    "A": "closed Snow Lantern chamber",
    "S": "lower fragmentation crown",
}


def draw_frame(frame: int) -> Image.Image:
    canvas = base.Canvas(SHEET_W, SHEET_H)
    canvas.text((55, 34), "FROST 04 · CRYSTAL CAGE UPGRADE TREE", 46, INK, True)
    canvas.text((57, 94), "Base + 14 cumulative upgrades · 720 ms fixed-footprint micro-idle · one F", 22, MUTED)

    canvas.draw.rounded_rectangle((55, 145, 2345, 570), radius=16, fill=PANEL_2, outline=BORDER, width=2)
    canvas.tile(tower_tile("", frame, 8100), 95, 180, 9)
    canvas.text((520, 185), "BASE · CRYSTAL CAGE", 31, INK, True)
    canvas.text((520, 240), "Open faceted emitter crown · narrow service mast · cold-plated foundation", 20, MUTED)
    canvas.text((520, 307), "17/40 occupied", 20, ACCENT, True)
    canvas.text((520, 350), "T1 changes cold storage or the crown. T2 changes coverage or cycling.", 19, INK)
    canvas.text((520, 390), "T3 closes the cage into Snow Lantern or grows a fragmentation crown.", 19, INK)
    canvas.text((520, 458), "D / I  →  W / R  →  A / S", 23, ICE, True)
    canvas.text((520, 505), "Deep Chill / Ice Shards  →  Wide Field / Rapid Cycle  →  Absolute Zero / Shatterfield", 18, MUTED)

    card_w, card_h = 1125, 390
    start_y, row_gap = 595, 405
    for i, seq in enumerate(SEQS[1:]):
        col, row = i % 2, i // 2
        x = 55 + col * 1170
        y = start_y + row * row_gap
        canvas.draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=14, fill=PANEL, outline=BORDER, width=2)
        canvas.tile(tower_tile(seq, frame, 8200 + i * 31), x + 28, y + 55, 7)
        tx = x + 355
        canvas.text((tx, y + 25), f"{seq} · {state_name(seq)}", 24, INK, True)
        parent = parent_seq(seq) or ""
        canvas.text((tx, y + 73), f"T{len(seq)} · growth {occupancy(parent)} → {occupancy(seq)}/40", 18, ACCENT, True)
        for j, code in enumerate(seq):
            canvas.text((tx, y + 122 + j * 41), f"T{j + 1} {code}", 17, ICE, True)
            canvas.text((tx + 72, y + 122 + j * 41), SHORT_CUES[code], 17, INK)
        changes = sum(a != b for ra, rb in zip(frost_blueprint(seq, 0), frost_blueprint(seq, 1)) for a, b in zip(ra, rb))
        canvas.text((tx, y + 286), f"idle: {changes} glyph change{'s' if changes != 1 else ''} + local colour pulse", 17, MUTED)
        canvas.text((tx, y + 328), "fixed footprint · inherited branch cues retained", 16, DIM)

    canvas.text((55, 3450), "All fifteen states animate in sync for comparison. Absolute Zero is the evolved Snow Lantern form.", 19, ACCENT)
    return canvas.image


def colour_change_cells(seq: str) -> list[list[int]]:
    a = tower_tile(seq, 0, 9999)
    b = tower_tile(seq, 1, 9999)
    return [
        [x, y]
        for y in range(base.CELL_H)
        for x in range(base.CELL_W)
        if a[y][x].ch != " " and (a[y][x].fg != b[y][x].fg or a[y][x].bg != b[y][x].bg)
    ]


def save_blueprints() -> None:
    payload = {
        "meta": {
            "study": 17,
            "font": "Spleen 5x8",
            "canvasGlyphs": [8, 5],
            "nativePixels": [40, 40],
            "selectedConcept": "04 Crystal Cage",
            "absorbedConcept": "06 Snow Lantern as Absolute Zero capstone",
            "tree": "base + 2 T1 + 4 T2 + 8 T3 = 15 states / 14 upgrades",
            "animation": "two-frame 720ms micro-idle; fixed footprint; zero-to-one glyph changes plus local colour pulse",
        },
        "palette": base.FROST,
        "choices": {"T1": T1, "T2": T2, "T3": T3},
        "visualCues": SHORT_CUES,
        "states": [
            {
                "path": seq or "BASE",
                "name": state_name(seq),
                "tier": len(seq),
                "parent": parent_seq(seq),
                "occupied": occupancy(seq),
                "idleA": frost_blueprint(seq, 0),
                "idleB": frost_blueprint(seq, 1),
                "glyphChangeCells": [
                    [x, y]
                    for y, (ra, rb) in enumerate(zip(frost_blueprint(seq, 0), frost_blueprint(seq, 1)))
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
            rows = frost_blueprint(seq, frame)
            if len(rows) != 5 or any(len(row) != 8 for row in rows):
                raise ValueError((seq or "BASE", frame, [len(row) for row in rows]))
            if sum(ch == "F" for row in rows for ch in row) != 1:
                raise ValueError(f"{seq or 'BASE'} must contain exactly one F")
            if any(ch in "MmOo" for row in rows for ch in row):
                raise ValueError(f"{seq or 'BASE'} leaks another tower identity glyph")
            occ = {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch != " "}
            occupied_sets.append(occ)
            tile = tower_tile(seq, frame, 10000 + len(seq))
            low = min(base.contrast(tile[y][x].fg, tile[y][x].bg) for x, y in occ)
            if low < 4.65:
                raise ValueError(f"{seq or 'BASE'} contrast {low:.2f}")
            used.update("".join(rows))
        if occupied_sets[0] != occupied_sets[1]:
            raise ValueError(f"{seq or 'BASE'} idle footprint moves")
        changes = sum(a != b for ra, rb in zip(frost_blueprint(seq, 0), frost_blueprint(seq, 1)) for a, b in zip(ra, rb))
        if changes > 1:
            raise ValueError(f"{seq or 'BASE'} idle is too busy")
        structure = tuple(frost_blueprint(seq, 0))
        if structure in structures:
            raise ValueError(f"Duplicate state {seq or 'BASE'}")
        structures.add(structure)
        parent = parent_seq(seq)
        if parent is not None and occupancy(seq) <= occupancy(parent):
            raise ValueError(f"{seq} does not grow over {parent or 'BASE'}")

    if len(structures) != 15:
        raise ValueError("Expected fifteen unique Frost states")
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
        duration=[720, 720],
        loop=0,
        disposal=1,
        optimize=False,
    )


if __name__ == "__main__":
    validate()
    save_blueprints()
    save_outputs()
    print("wrote Frost Crystal Cage tree; 15 states / 14 upgrades / 30 animated frames")
