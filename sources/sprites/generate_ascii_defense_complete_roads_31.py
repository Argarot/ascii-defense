#!/usr/bin/env python3
"""Generate the complete randomized road-sprite family for ASCII Defense.

The set covers the engine's twelve road cell codes and supplies four static,
interchangeable variants for each.  Closed sides receive a continuous Braille
contour.  Vertical contours are exactly one dot wide; horizontal contours may
occasionally carry a second adjacent dot while retaining a continuous primary
path.  Open sides use a shared throat treatment so arbitrary variants meet
without visible seams.
"""

from __future__ import annotations

import importlib.util
import json
import random
import shutil
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path


HERE = Path(__file__).resolve().parent
PREV_PATH = HERE.parent / "design_pass_30/generate_ascii_defense_final_road_variants_30.py"
spec = importlib.util.spec_from_file_location("road30", PREV_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load {PREV_PATH}")
prev = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = prev
spec.loader.exec_module(prev)
base = prev.base

OUT_PNG = HERE / "ascii-defense-complete-road-sprites-31.png"
OUT_SEAMS = HERE / "ascii-defense-complete-road-seam-test-31.png"
OUT_JSON = HERE / "ascii-defense-complete-road-sprites-31.json"
OUT_MANIFEST = HERE / "ascii-defense-complete-road-manifest-31.json"
IMPORT_DIR = HERE / "road31-repo-import"
IMPORT_ASSET = IMPORT_DIR / "road-muted-cobble.json"
IMPORT_README = IMPORT_DIR / "README.md"
IMPORT_ZIP = HERE / "ascii-defense-road31-repo-import.zip"

W, H = 8, 5
DOT_W, DOT_H = 16, 20
VARIANT_COUNT = 4
DOT_BITS = prev.DOT_BITS

PAGE = "#071015"
PANEL = "#0d181f"
CARD = "#101e26"
BORDER = "#2b414d"
INK = "#e7edf1"
MUTED = "#9aabb4"
DIM = "#687b85"
ACCENT = "#c9b990"

# Approved Muted River Cobble colour family.  Surface glyphs mix the cobble
# and aggregate vocabularies, but colour remains consistently cool river stone.
ROLE_COLOURS = {
    "terrain.road.cobble.bg0": "#374149",
    "terrain.road.cobble.bg1": "#39434b",
    "terrain.road.cobble.bg2": "#343e45",
    "terrain.road.cobble.bg3": "#3b454d",
    "terrain.road.cobble.bg4": "#354047",
    "terrain.road.cobble.ink0": "#49565d",
    "terrain.road.cobble.ink1": "#4e5b62",
    "terrain.road.cobble.ink2": "#536168",
    "terrain.road.cobble.ink3": "#59676e",
    "terrain.road.cobble.ink4": "#5f6d74",
    "terrain.road.cobble.ink5": "#65747b",
    "terrain.road.cobble.ink6": "#6d7c82",
    "terrain.road.cobble.ink7": "#76858a",
    "terrain.road.cobble.edge": "#c9d8d5",
    "terrain.road.cobble.rail": "#b7c5c3",
    "terrain.road.cobble.deck": "#59676e",
    "terrain.road.cobble.under": "#4b5960",
}

INK_MAP = {
    "a": "terrain.road.cobble.ink0",
    "b": "terrain.road.cobble.ink1",
    "c": "terrain.road.cobble.ink2",
    "d": "terrain.road.cobble.ink3",
    "e": "terrain.road.cobble.ink4",
    "f": "terrain.road.cobble.ink5",
    "g": "terrain.road.cobble.ink6",
    "h": "terrain.road.cobble.ink7",
    "E": "terrain.road.cobble.edge",
    "R": "terrain.road.cobble.rail",
    "D": "terrain.road.cobble.deck",
    "U": "terrain.road.cobble.under",
    "0": "terrain.road.cobble.bg0",
    "1": "terrain.road.cobble.bg1",
    "2": "terrain.road.cobble.bg2",
    "3": "terrain.road.cobble.bg3",
    "4": "terrain.road.cobble.bg4",
}

PORTS = {
    "-": 2 | 8,
    "|": 1 | 4,
    "L": 1 | 2,
    "J": 1 | 8,
    "F": 4 | 2,
    "7": 4 | 8,
    "T": 2 | 4 | 8,
    "U": 1 | 2 | 8,
    "E": 1 | 2 | 4,
    "3": 1 | 4 | 8,
    "X": 15,
    "B": 15,
}

ROAD_ORDER = ["|", "-", "L", "J", "F", "7", "T", "U", "E", "3", "X", "B"]
ROAD_NAMES = {
    "|": "NORTH–SOUTH",
    "-": "EAST–WEST",
    "L": "BEND N→E",
    "J": "BEND N→W",
    "F": "BEND S→E",
    "7": "BEND S→W",
    "T": "T · STEM SOUTH",
    "U": "T · STEM NORTH",
    "E": "T · OPENS EAST",
    "3": "T · OPENS WEST",
    "X": "MERGING CROSSROADS",
    "B": "BRIDGE · E–W OVER N–S",
}

SIDE_BITS = {"top": 1, "right": 2, "bottom": 4, "left": 8}
PORT_H_BG = "01033010"
PORT_V_BG = "01010"


@dataclass(frozen=True)
class SpriteCell:
    ch: str
    ink: str
    bg: str


def braille(mask: int) -> str:
    return chr(0x2800 | mask)


def mirror_lr(mask: int) -> int:
    return prev.mirror_lr(mask)


def mirror_tb(mask: int) -> int:
    return prev.mirror_tb(mask)


def biased_walk(length: int, limit: int, seed: int, start: int, end: int) -> list[int]:
    """A one-step walk that settles after shifting and grows restless on holds."""
    for attempt in range(500):
        rng = random.Random(seed + attempt * 1013)
        path = [start]
        holds = 0
        last_nonzero = 0
        for index in range(1, length):
            current = path[-1]
            remaining = length - 1 - index
            candidates = [
                value
                for value in (current - 1, current, current + 1)
                if 0 <= value < limit and abs(end - value) <= remaining
            ]
            if index == length - 1:
                nxt = end
            else:
                shifts = [value for value in candidates if value != current]
                # The first point after a shift is very likely to hold.  Every
                # additional hold raises the chance of moving by 14 points.
                p_shift = min(0.82, 0.08 + 0.14 * holds)
                if shifts and (current not in candidates or rng.random() < p_shift):
                    # Do not immediately reverse a previous shift.  A hold
                    # clears the prohibition, so broad bends remain possible.
                    legal = [value for value in shifts if value - current != -last_nonzero]
                    nxt = rng.choice(legal or shifts)
                else:
                    nxt = current if current in candidates else rng.choice(candidates)
            delta = nxt - current
            if delta:
                holds = 0
                last_nonzero = delta
            else:
                holds += 1
                last_nonzero = 0
            path.append(nxt)
        if path[-1] == end and len(set(path)) == limit:
            moves = [b - a for a, b in zip(path, path[1:])]
            if not any(a and b and a == -b for a, b in zip(moves, moves[1:])):
                return path
    raise ValueError("unable to build a constrained edge walk")


def horizontal_pairs(path: list[int], seed: int) -> list[tuple[int, ...]]:
    """Add sparse adjacent doubles while preserving the primary continuous path."""
    rng = random.Random(seed)
    eligible = list(range(2, len(path) - 2))
    rng.shuffle(eligible)
    chosen: list[int] = []
    target = 2 if rng.random() < 0.64 else 3
    for index in eligible:
        if any(abs(index - other) < 3 for other in chosen):
            continue
        chosen.append(index)
        if len(chosen) == target:
            break
    out: list[tuple[int, ...]] = []
    for index, value in enumerate(path):
        if index not in chosen:
            out.append((value,))
            continue
        options = [candidate for candidate in (value - 1, value + 1) if 0 <= candidate < 3]
        second = rng.choice(options)
        out.append(tuple(sorted((value, second))))
    return out


def edge_paths(variant: int) -> dict[str, list]:
    left = biased_walk(20, 2, 61001 + variant * 211, 1, 1)
    right = biased_walk(20, 2, 62003 + variant * 223, 1, 1)
    top_base = biased_walk(16, 3, 63011 + variant * 227, 1, 1)
    bottom_base = biased_walk(16, 3, 64007 + variant * 229, 1, 1)
    return {
        "left": left,
        "right": right,
        "top": horizontal_pairs(top_base, 65003 + variant * 233),
        "bottom": horizontal_pairs(bottom_base, 66029 + variant * 239),
    }


def vertical_masks(path: list[int]) -> list[int]:
    masks = [0] * H
    for step, position in enumerate(path):
        glyph_y, dot_y = divmod(step, 4)
        masks[glyph_y] |= DOT_BITS[dot_y][position]
    return masks


def horizontal_masks(path: list[tuple[int, ...]]) -> list[int]:
    masks = [0] * W
    for step, positions in enumerate(path):
        glyph_x, dot_x = divmod(step, 2)
        for position in positions:
            masks[glyph_x] |= DOT_BITS[position][dot_x]
    return masks


def closed_sides(code: str) -> set[str]:
    ports = PORTS[code]
    return {name for name, bit in SIDE_BITS.items() if not ports & bit}


def rgb(colour: str) -> tuple[int, int, int]:
    return tuple(int(colour[i:i + 2], 16) for i in (1, 3, 5))


def weighted_colour(values: list[tuple[str, float]]) -> tuple[int, int, int]:
    total = sum(weight for _, weight in values)
    return tuple(round(sum(rgb(value)[channel] * weight for value, weight in values) / total) for channel in range(3))


def nearest_ink(colour: tuple[int, int, int]) -> str:
    candidates = {key: rgb(ROLE_COLOURS[role]) for key, role in INK_MAP.items() if key in "abcdefgh"}
    return min(candidates, key=lambda key: sum((colour[i] - candidates[key][i]) ** 2 for i in range(3)))


def open_throat_backgrounds(backgrounds: list[list[str]], code: str) -> None:
    ports = PORTS[code]
    if ports & 1:
        backgrounds[0] = list(PORT_H_BG)
    if ports & 4:
        backgrounds[H - 1] = list(PORT_H_BG)
    if ports & 8:
        for y, key in enumerate(PORT_V_BG):
            backgrounds[y][0] = key
    if ports & 2:
        for y, key in enumerate(PORT_V_BG):
            backgrounds[y][W - 1] = key


def surface_grid(code: str, variant: int, reserved: set[tuple[int, int]] | None = None) -> list[list[SpriteCell]]:
    """Author paired cobbles, then colour every mark from its neighbourhood."""
    reserved = reserved or set()
    backgrounds: list[list[str]] = []
    for y in range(H):
        row = []
        for x in range(W):
            rng = random.Random(72101 + ROAD_ORDER.index(code) * 11003 + variant * 1973 + x * 271 + y * 347)
            roll = rng.random()
            row.append("0" if roll < 0.48 else "1" if roll < 0.66 else "2" if roll < 0.80 else "3" if roll < 0.92 else "4")
        backgrounds.append(row)
    open_throat_backgrounds(backgrounds, code)

    chars = [[" " for _ in range(W)] for _ in range(H)]
    targets = [["#65747b" for _ in range(W)] for _ in range(H)]
    for y in range(H):
        x = 0
        while x < W:
            rng = random.Random(73127 + ROAD_ORDER.index(code) * 12007 + variant * 2017 + x * 307 + y * 401)
            # Curly braces are one authored cobble. Both cells must remain
            # visible, so a contour can never erase only half of the pair.
            if x + 1 < W and (x, y) not in reserved and (x + 1, y) not in reserved and rng.random() < 0.31:
                chars[y][x], chars[y][x + 1] = "{", "}"
                targets[y][x], targets[y][x + 1] = "#718087", "#68777e"
                x += 2
                continue
            chars[y][x] = rng.choice("*+.,:⠁⠂⠄  ")
            targets[y][x] = rng.choice(("#59686f", "#617178", "#6a7980", "#728087"))
            x += 1

    cells: list[list[SpriteCell]] = []
    for y in range(H):
        row = []
        for x in range(W):
            own_bg = ROLE_COLOURS[INK_MAP[backgrounds[y][x]]]
            values = [(own_bg, 5.4), (targets[y][x], 1.05)]
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < W and 0 <= ny < H:
                    neighbour_bg = ROLE_COLOURS[INK_MAP[backgrounds[ny][nx]]]
                    values.extend(((neighbour_bg, 0.72), (targets[ny][nx], 0.16)))
            row.append(SpriteCell(chars[y][x], nearest_ink(weighted_colour(values)), backgrounds[y][x]))
        cells.append(row)
    return cells


def points_to_masks(points: set[tuple[int, int]]) -> list[list[int]]:
    masks = [[0 for _ in range(W)] for _ in range(H)]
    for dot_x, dot_y in points:
        glyph_x, local_x = divmod(dot_x, 2)
        glyph_y, local_y = divmod(dot_y, 4)
        masks[glyph_y][glyph_x] |= DOT_BITS[local_y][local_x]
    return masks


def side_points(variant: int) -> dict[str, set[tuple[int, int]]]:
    """Resolve the four straight contour paths into the 16x20 dot grid."""
    p = edge_paths(variant)
    return {
        "left": {(position, y) for y, position in enumerate(p["left"])},
        "right": {(DOT_W - 1 - position, y) for y, position in enumerate(p["right"])},
        "top": {(x, position) for x, positions in enumerate(p["top"]) for position in positions},
        "bottom": {(x, DOT_H - 1 - position) for x, positions in enumerate(p["bottom"]) for position in positions},
    }


def outer_sw_points(variant: int) -> set[tuple[int, int]]:
    """A restrained convex turn joining the north and east road boundaries."""
    sides = side_points(variant)
    points = {(x, y) for x, y in sides["left"] if y <= 15}
    # Keep the convex radius deliberately small.  The old curve began eight
    # dot rows too early and made every bend look bulbous.
    curve = {
        (1, 16),
        (1 + (variant == 2), 17),
        (2, 18),
        (3, 18),
    }
    points.update(curve)
    points.update((x, y) for x, y in sides["bottom"] if x >= 4)
    return points


def inner_ne_points() -> set[tuple[int, int]]:
    """The smallest possible continuous join between two inner seam ends.

    Both dots occupy the same corner glyph. They close the boundary without
    producing the conspicuous seven-dot hook used in the rejected revision.
    """
    return {(DOT_W - 2, 0), (DOT_W - 1, 1)}


def transform_corner(points: set[tuple[int, int]], flip_x: bool, flip_y: bool) -> set[tuple[int, int]]:
    return {
        (DOT_W - 1 - x if flip_x else x, DOT_H - 1 - y if flip_y else y)
        for x, y in points
    }


def contour_points(code: str, variant: int) -> set[tuple[int, int]]:
    """Return every visible road/ground boundary as a one-dot contour.

    Bends carry one restrained convex boundary plus a two-dot inner join.
    T-junctions use the same minimal joins around their stem. Each join fits
    entirely inside one glyph and only exists to keep the boundary continuous.
    """
    sides = side_points(variant)
    outer_sw = outer_sw_points(variant)
    inner_ne = inner_ne_points()
    if code == "|":
        return sides["left"] | sides["right"]
    if code == "-":
        return sides["top"] | sides["bottom"]
    if code == "L":
        return outer_sw | inner_ne
    if code == "J":
        return transform_corner(outer_sw, True, False) | transform_corner(inner_ne, True, False)
    if code == "F":
        return transform_corner(outer_sw, False, True) | transform_corner(inner_ne, False, True)
    if code == "7":
        return transform_corner(outer_sw, True, True) | transform_corner(inner_ne, True, True)
    if code == "T":
        return sides["top"] | transform_corner(inner_ne, True, True) | transform_corner(inner_ne, False, True)
    if code == "U":
        return sides["bottom"] | transform_corner(inner_ne, True, False) | inner_ne
    if code == "E":
        return sides["left"] | inner_ne | transform_corner(inner_ne, False, True)
    if code == "3":
        return sides["right"] | transform_corner(inner_ne, True, False) | transform_corner(inner_ne, True, True)
    if code == "X":
        return set()
    raise ValueError(f"no ordinary contour geometry for {code}")


def edge_masks(code: str, variant: int) -> list[list[int]]:
    return points_to_masks(contour_points(code, variant))


def ordinary_sprite(code: str, variant: int) -> list[list[SpriteCell]]:
    masks = edge_masks(code, variant)
    reserved = {(x, y) for y in range(H) for x in range(W) if masks[y][x]}
    cells = surface_grid(code, variant, reserved)
    for y in range(H):
        for x in range(W):
            if masks[y][x]:
                old = cells[y][x]
                cells[y][x] = SpriteCell(braille(masks[y][x]), "E", old.bg)
    return cells


BRIDGE_TOP_ARCHES = (
    (1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1),
    (1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1),
    (1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1),
    (1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1),
)


def bridge_points(variant: int) -> tuple[set[tuple[int, int]], set[tuple[int, int]]]:
    """Return overpass arches and a continuous N–S contour underneath."""
    upper_path = BRIDGE_TOP_ARCHES[variant]
    upper = {(x, depth) for x, depth in enumerate(upper_path)}
    lower = {(x, DOT_H - 1 - depth) for x, depth in enumerate(upper_path)}
    walks = edge_paths(variant)
    # The underpass retains ordinary vertical-road geometry.  Rendering fades
    # its middle three glyph rows, while the boundary rows stay identical to
    # neighbouring road edges.  The bright arches are composited last.
    under_left = {(1 + (1 - position), y) for y, position in enumerate(walks["left"])}
    under_right = {(DOT_W - 2 - (1 - position), y) for y, position in enumerate(walks["right"])}
    return upper | lower, under_left | under_right


def bridge_sprite(variant: int) -> list[list[SpriteCell]]:
    """A wide E–W cobble overpass above a seamlessly joined N–S road."""
    arches, underpass = bridge_points(variant)
    masks_arch = points_to_masks(arches)
    masks_under = points_to_masks(underpass)
    joint_columns = ((2, 5), (3, 6), (1, 5), (2, 6))[variant]
    reserved = {
        (x, y)
        for y in range(H)
        for x in range(W)
        if masks_arch[y][x] or masks_under[y][x]
    }
    reserved.update((x, 2) for x in joint_columns)
    cells = surface_grid("B", variant, reserved)

    # No special bright deck band: the bridge inherits the ordinary muted
    # road surface.  Only two sparse, low-contrast joints imply construction.
    for x in joint_columns:
        old = cells[2][x]
        cells[2][x] = SpriteCell(":" if (x + variant) % 2 else "+", "d", old.bg)

    for y in range(H):
        for x in range(W):
            old = cells[y][x]
            if masks_under[y][x]:
                cells[y][x] = SpriteCell(
                    braille(masks_under[y][x]),
                    "E" if y in (0, H - 1) else "U",
                    old.bg,
                )
            if masks_arch[y][x]:
                mask = masks_arch[y][x] | (masks_under[y][x] if masks_under[y][x] else 0)
                cells[y][x] = SpriteCell(braille(mask), "E", old.bg)
    return cells


def sprite(code: str, variant: int) -> list[list[SpriteCell]]:
    return bridge_sprite(variant) if code == "B" else ordinary_sprite(code, variant)


def frame_payload(cells: list[list[SpriteCell]]) -> dict:
    return {
        "art": ["".join(cell.ch for cell in row) for row in cells],
        "ink": ["".join(cell.ink for cell in row) for row in cells],
        "bgInk": ["".join(cell.bg for cell in row) for row in cells],
    }


def asset_payload() -> dict:
    tiers = {}
    for tier, code in enumerate(ROAD_ORDER):
        frames = [frame_payload(sprite(code, variant)) for variant in range(VARIANT_COUNT)]
        tiers[str(tier)] = {**frames[0], "frames": frames[1:]}
    return {
        "$schema": "../../schema/sprite.schema.json",
        "id": "road_muted_cobble",
        "cell": [W, H],
        "tiers": tiers,
        "inkMap": INK_MAP,
    }


def colour_for(key: str) -> str:
    if key == "~":
        return "#10261d"
    return ROLE_COLOURS[INK_MAP[key]]


def hash2(x: int, y: int, seed: int) -> float:
    value = (x * 374761393 + y * 668265263 + seed * 2246822519) & 0xFFFFFFFF
    value = ((value ^ (value >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((value ^ (value >> 16)) & 0xFFFFFFFF) / 4294967296


def draw_cells(canvas, cells: list[list[SpriteCell]], x0: int, y0: int, scale: int) -> None:
    for y, row in enumerate(cells):
        for x, cell in enumerate(row):
            canvas.glyph(
                cell.ch,
                x0 + x * 5 * scale,
                y0 + y * 8 * scale,
                scale,
                colour_for(cell.ink),
                colour_for(cell.bg),
            )


def draw_overview():
    sheet_w, sheet_h = 3000, 2520
    canvas = base.Canvas(sheet_w, sheet_h)
    canvas.text((58, 32), "COMPLETE ROAD FAMILY · 12 SHAPES × 4 STATIC VARIANTS", 48, INK, True)
    canvas.text((60, 96), "Neighbour-blended river-cobble palette · paired {} stones + aggregate marks · rounded biased contours", 21, MUTED)
    card_w, card_h = 950, 535
    start_y = 155
    for index, code in enumerate(ROAD_ORDER):
        col, row = index % 3, index // 3
        x = 40 + col * 980
        y = start_y + row * 570
        canvas.draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=14, fill=PANEL, outline=BORDER, width=2)
        canvas.text((x + 22, y + 17), f"{code} · {ROAD_NAMES[code]}", 24, INK, True)
        sides = ", ".join(name.upper() for name in sorted(closed_sides(code))) or "NONE"
        note = "two independent strands" if code == "B" else f"closed-edge contour: {sides}"
        canvas.text((x + 22, y + 56), note, 15, MUTED)
        for variant in range(VARIANT_COUNT):
            vx = x + 22 + variant * 228
            vy = y + 104
            draw_cells(canvas, sprite(code, variant), vx, vy, 4)
            canvas.draw.rectangle((vx, vy, vx + 160, vy + 160), outline=BORDER, width=1)
            canvas.text((vx + 54, vy + 181), f"V{variant + 1}", 14, ACCENT, True)
        canvas.text((x + 22, y + 345), "STATIC VARIATION", 14, ACCENT, True)
        canvas.text((x + 22, y + 378), "Selected by world position; no animation or simulation-state dependency.", 15, INK)
        if code == "B":
            canvas.text((x + 22, y + 422), "Quiet cobble deck and rails pass above the darker N–S underpass.", 15, DIM)
        elif code == "X":
            canvas.text((x + 22, y + 422), "No internal barrier: all four arms visibly merge.", 15, DIM)
        else:
            canvas.text((x + 22, y + 422), "All open throats share identical boundary backgrounds across variants.", 15, DIM)
    canvas.text((58, 2460), "Horizontal edges alone may carry 2 adjacent dots. Vertical edges are always exactly 1 dot wide.", 18, ACCENT)
    return canvas.image


def joined_scene(grid: list[str], seed: int) -> list[list[SpriteCell]]:
    out_h = len(grid) * H
    out_w = max(len(row) for row in grid) * W
    blank = SpriteCell(".", "a", "~")
    out = [[blank for _ in range(out_w)] for _ in range(out_h)]
    for gy, row in enumerate(grid):
        for gx, code in enumerate(row):
            if code == " ":
                continue
            variant = int(hash2(gx, gy, seed) * VARIANT_COUNT) % VARIANT_COUNT
            tile = sprite(code, variant)
            for y in range(H):
                for x in range(W):
                    out[gy * H + y][gx * W + x] = tile[y][x]
    return out


def draw_seam_test():
    canvas = base.Canvas(2600, 1520)
    canvas.text((55, 30), "ROAD FAMILY · RANDOMIZED CONNECTIVITY TEST", 47, INK, True)
    canvas.text((57, 94), "Every displayed cell independently selects V1–V4; open throats and closed contours remain coherent.", 21, MUTED)

    network = [
        "F---T---7",
        "|   |   |",
        "E---X---3",
        "|   |   |",
        "L---U---J",
    ]
    bridge = [
        "  |  ",
        "  |  ",
        "--B--",
        "  |  ",
        "  |  ",
    ]
    network_cells = joined_scene(network, 8101)
    bridge_cells = joined_scene(bridge, 9103)
    canvas.draw.rounded_rectangle((42, 150, 1818, 1375), radius=16, fill=PANEL, outline=BORDER, width=2)
    canvas.text((70, 174), "ALL ORDINARY TOPOLOGIES · RANDOM VARIANTS", 24, INK, True)
    draw_cells(canvas, network_cells, 76, 245, 3)
    canvas.draw.rectangle((76, 245, 76 + 9 * 120, 245 + 5 * 120), outline=BORDER, width=1)
    canvas.text((75, 900), "The X centre merges all four routes; bends and T-junctions close only the absent arms.", 17, MUTED)
    canvas.text((75, 948), "No connector seam depends on which of the four surface variants was selected.", 17, ACCENT)

    canvas.draw.rounded_rectangle((1845, 150, 2558, 1375), radius=16, fill=PANEL, outline=BORDER, width=2)
    canvas.text((1872, 174), "BRIDGE · RANDOM VARIANTS", 24, INK, True)
    draw_cells(canvas, bridge_cells, 1890, 270, 3)
    canvas.draw.rectangle((1890, 270, 1890 + 5 * 120, 270 + 5 * 120), outline=BORDER, width=1)
    canvas.text((1874, 920), "E–W road:", 16, ACCENT, True)
    canvas.text((1874, 954), "raised deck + rails", 16, INK)
    canvas.text((1874, 1012), "N–S road:", 16, ACCENT, True)
    canvas.text((1874, 1046), "darker visible underpass", 16, INK)
    canvas.text((1874, 1110), "They cross visually but", 16, MUTED)
    canvas.text((1874, 1142), "remain separate in routing.", 16, MUTED)
    canvas.text((56, 1452), "Preview uses the exact JSON sprite frames, not a separate illustration path.", 18, ACCENT)
    return canvas.image


def validate_path(path: list[int], length: int, limit: int, start: int, end: int) -> None:
    if len(path) != length or path[0] != start or path[-1] != end:
        raise ValueError("edge endpoint contract failed")
    if any(not 0 <= value < limit for value in path):
        raise ValueError("edge left its allowed depth")
    if any(abs(b - a) > 1 for a, b in zip(path, path[1:])):
        raise ValueError("edge discontinuity")
    moves = [b - a for a, b in zip(path, path[1:])]
    if any(a and b and a == -b for a, b in zip(moves, moves[1:])):
        raise ValueError("immediate zigzag reversal")


def validate_horizontal(path: list[tuple[int, ...]]) -> None:
    if len(path) != 16 or any(len(values) not in (1, 2) for values in path):
        raise ValueError("horizontal multiplicity contract failed")
    if not any(len(values) == 2 for values in path):
        raise ValueError("horizontal path has no paired dot")
    for values in path:
        if tuple(sorted(set(values))) != values or any(not 0 <= value < 3 for value in values):
            raise ValueError("bad paired-dot placement")
        if len(values) == 2 and values[1] - values[0] != 1:
            raise ValueError("horizontal double is not adjacent")
    for left, right in zip(path, path[1:]):
        if min(abs(a - b) for a in left for b in right) > 1:
            raise ValueError("horizontal set-valued continuity failed")


def validate_connected_points(points: set[tuple[int, int]]) -> None:
    pending = [next(iter(points))]
    seen = set(pending)
    while pending:
        x, y = pending.pop()
        for nx in range(x - 1, x + 2):
            for ny in range(y - 1, y + 2):
                if (nx, ny) in points and (nx, ny) not in seen:
                    seen.add((nx, ny))
                    pending.append((nx, ny))
    if seen != points:
        raise ValueError("rounded corner contour contains a gap")


def connected_components(points: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    remaining = set(points)
    components = []
    while remaining:
        pending = [next(iter(remaining))]
        component = set(pending)
        remaining.remove(pending[0])
        while pending:
            x, y = pending.pop()
            neighbours = {
                (nx, ny)
                for nx in range(x - 1, x + 2)
                for ny in range(y - 1, y + 2)
                if (nx, ny) in remaining
            }
            remaining.difference_update(neighbours)
            component.update(neighbours)
            pending.extend(neighbours)
        components.append(component)
    return components


def validate() -> None:
    seen_frames: set[tuple] = set()
    for variant in range(VARIANT_COUNT):
        p = edge_paths(variant)
        validate_path(p["left"], 20, 2, 1, 1)
        validate_path(p["right"], 20, 2, 1, 1)
        validate_horizontal(p["top"])
        validate_horizontal(p["bottom"])
        # Paired dots are horizontal-only: vertical source paths are scalar.
        if any(isinstance(value, tuple) for value in p["left"] + p["right"]):
            raise ValueError("vertical path contains a paired dot")
        outer = outer_sw_points(variant)
        validate_connected_points(outer)
        if (0, DOT_H - 1) in outer:
            raise ValueError("rounded corner collapsed back to a square outside corner")

        # All open arms expose the same two endpoint dots. The minimal inner
        # joins restore these contracts without extending beyond one glyph.
        expected_open_edges = {
            "top": {(1, 0), (14, 0)},
            "right": {(15, 1), (15, 18)},
            "bottom": {(1, 19), (14, 19)},
            "left": {(0, 1), (0, 18)},
        }
        expected_components = {"|": 2, "-": 2, "L": 2, "J": 2, "F": 2, "7": 2, "T": 3, "U": 3, "E": 3, "3": 3, "X": 0}
        for code, component_count in expected_components.items():
            points = contour_points(code, variant)
            if len(connected_components(points)) != component_count:
                raise ValueError(f"wrong contour count for {code}/{variant}")
            if code == "X":
                continue
            for side, bit in SIDE_BITS.items():
                if not PORTS[code] & bit:
                    continue
                if side == "top":
                    actual = {(x, y) for x, y in points if y == 0}
                elif side == "right":
                    actual = {(x, y) for x, y in points if x == DOT_W - 1}
                elif side == "bottom":
                    actual = {(x, y) for x, y in points if y == DOT_H - 1}
                else:
                    actual = {(x, y) for x, y in points if x == 0}
                if actual != expected_open_edges[side]:
                    raise ValueError(f"bad {side} edge contract for {code}/{variant}: {actual}")

        arches, underpass = bridge_points(variant)
        bridge = arches | underpass
        for side, expected in expected_open_edges.items():
            if side == "top":
                actual = {(x, y) for x, y in bridge if y == 0}
            elif side == "right":
                actual = {(x, y) for x, y in bridge if x == DOT_W - 1}
            elif side == "bottom":
                actual = {(x, y) for x, y in bridge if y == DOT_H - 1}
            else:
                actual = {(x, y) for x, y in bridge if x == 0}
            if actual != expected:
                raise ValueError(f"bridge {side} edge does not match ordinary road: {actual}")
        if min((DOT_H - 1 - depth) - depth - 1 for depth in BRIDGE_TOP_ARCHES[variant]) < 11:
            raise ValueError("bridge traversable centre became too narrow")

    for code in ROAD_ORDER:
        if code not in PORTS:
            raise ValueError(f"missing port mask for {code}")
        for variant in range(VARIANT_COUNT):
            cells = sprite(code, variant)
            if len(cells) != H or any(len(row) != W for row in cells):
                raise ValueError(f"bad frame dimensions: {code}/{variant}")
            glyphs = {cell.ch for row in cells for cell in row}
            missing = sorted(ch for ch in glyphs if ch not in base.FONT)
            if missing:
                raise ValueError(f"Spleen is missing {missing} in {code}/{variant}")
            if any(cell.ink not in INK_MAP or cell.bg not in INK_MAP for row in cells for cell in row):
                raise ValueError(f"unmapped ink key in {code}/{variant}")
            signature = tuple((cell.ch, cell.ink, cell.bg) for row in cells for cell in row)
            if signature in seen_frames:
                raise ValueError(f"duplicate frame: {code}/{variant}")
            seen_frames.add(signature)
            for row in cells:
                text = "".join(cell.ch for cell in row)
                for index, ch in enumerate(text):
                    if ch == "{" and (index + 1 >= len(text) or text[index + 1] != "}"):
                        raise ValueError(f"orphan opening cobble in {code}/{variant}: {text}")
                    if ch == "}" and (index == 0 or text[index - 1] != "{"):
                        raise ValueError(f"orphan closing cobble in {code}/{variant}: {text}")
            if code == "B" and any("=" in "".join(cell.ch for cell in row) for row in cells):
                raise ValueError("bridge regressed to the rejected equals-sign band")

    if len(seen_frames) != len(ROAD_ORDER) * VARIANT_COUNT:
        raise ValueError("not all 48 road frames are unique")

    # Every open connector has a fixed background throat across all codes and
    # variants.  This is the game-facing interchangeability guarantee.
    for side, bit in SIDE_BITS.items():
        signatures = set()
        for code in ROAD_ORDER:
            if not PORTS[code] & bit:
                continue
            for variant in range(VARIANT_COUNT):
                cells = sprite(code, variant)
                if side == "top":
                    signatures.add(tuple(cell.bg for cell in cells[0]))
                elif side == "bottom":
                    signatures.add(tuple(cell.bg for cell in cells[-1]))
                elif side == "left":
                    signatures.add(tuple(row[0].bg for row in cells))
                else:
                    signatures.add(tuple(row[-1].bg for row in cells))
        if len(signatures) != 1:
            raise ValueError(f"non-interchangeable {side} throat: {signatures}")


def save_outputs() -> None:
    asset = asset_payload()
    OUT_JSON.write_text(json.dumps(asset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    manifest = {
        "meta": {
            "study": 31,
            "font": "Spleen 5x8",
            "canvasGlyphs": [W, H],
            "nativePixels": [40, 40],
            "roadStyle": "mixed cobble + aggregate glyphs in muted river-cobble colours",
            "variantSelection": "static position hash; four variants per road code",
            "horizontalPairRule": "2–3 nonadjacent steps per edge may contain two vertically adjacent dots; either dot satisfies continuity",
            "verticalPairRule": "prohibited; one dot at every step",
            "walkBias": "shift chance = min(0.82, 0.08 + 0.14 × consecutive holds); immediate reversal prohibited",
            "surfaceBlending": "glyph ink is selected from a quantized low-contrast ramp after weighting its own background, neighbouring backgrounds, and neighbouring intended ink",
            "cornerRule": "bends keep the restrained convex contour; every inner turn is only two diagonal endpoint dots inside one glyph",
            "bridgeRule": "wide E–W surface uses two fourth-dot arches; interrupted N–S approaches and all four boundary endpoint pairs exactly match ordinary roads",
            "cobbleRule": "{ and } are emitted as an inseparable two-glyph unit and never split by an edge",
        },
        "tierMap": {code: tier for tier, code in enumerate(ROAD_ORDER)},
        "ports": PORTS,
        "names": ROAD_NAMES,
        "variantsPerShape": VARIANT_COUNT,
        "paletteRoles": ROLE_COLOURS,
        "asset": OUT_JSON.name,
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if IMPORT_DIR.exists():
        shutil.rmtree(IMPORT_DIR)
    IMPORT_DIR.mkdir(parents=True)
    shutil.copy2(OUT_JSON, IMPORT_ASSET)
    IMPORT_README.write_text(
        """# ASCII Defense complete road sprite set

This bundle contains `road-muted-cobble.json`, a valid existing
`sprite.schema.json` asset. Its numeric tiers map to the twelve engine road
codes as documented in `manifest.json`.

Tier base art is variant 1; `frames` contain variants 2–4. These are static
alternatives, not animation frames: select one with a stable hash of world
cell coordinates.

The included patch:

- adds the asset under `packages/content/assets/sprites/`;
- adds the required muted-cobble palette roles;
- maps every engine road code to its sprite tier;
- selects a stable variant from world position;
- draws the bridge as an east–west deck over a north–south underpass.

Apply from the repository root:

```bash
git apply --check ascii-defense-road31-import.patch
git apply ascii-defense-road31-import.patch
node tools/validate-content.mjs
npm run typecheck
```
""",
        encoding="utf-8",
    )
    shutil.copy2(OUT_MANIFEST, IMPORT_DIR / "manifest.json")
    if IMPORT_ZIP.exists():
        IMPORT_ZIP.unlink()
    with zipfile.ZipFile(IMPORT_ZIP, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(IMPORT_DIR.iterdir()):
            archive.write(path, arcname=f"road31-repo-import/{path.name}")


if __name__ == "__main__":
    HERE.mkdir(parents=True, exist_ok=True)
    validate()
    draw_overview().save(OUT_PNG, optimize=True)
    draw_seam_test().save(OUT_SEAMS, optimize=True)
    save_outputs()
    print("wrote 12 road shapes × 4 static variants, seam test, manifest, and import bundle")
