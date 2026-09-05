"""
Glyph source of truth for the art pipeline.

The runtime ships `glyphset-spleen.json`, built by tools/build-fonts.mjs from
vendor/spleen/spleen-5x8.bdf: every glyph the font has at codepoint >= 0x20,
sorted ascending. A `.xp` file stores glyph INDICES, so the pipeline is only
correct if it reproduces that order byte for byte. This module is the one place
that order is defined; everything else imports from here.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

CELL_W, CELL_H = 5, 8


# ------------------------------------------------------------------ BDF parser
def read_bdf(path: str | Path) -> dict[int, list[int]]:
    """codepoint -> list of CELL_H row bytes (MSB is the leftmost pixel)."""
    out: dict[int, list[int]] = {}
    cp, rows = -1, None
    for raw in Path(path).read_text(encoding="utf-8", errors="replace").split("\n"):
        line = raw.strip()
        if line.startswith("ENCODING "):
            cp = int(line[9:])
        elif line == "BITMAP":
            rows = []
        elif line == "ENDCHAR":
            if cp >= 0 and rows is not None and len(rows) == CELL_H:
                out[cp] = [int(r, 16) for r in rows]
            cp, rows = -1, None
        elif rows is not None and re.fullmatch(r"[0-9A-Fa-f]{2}", line):
            rows.append(line)
    return out


def bitmap(rows: list[int]) -> np.ndarray:
    """CELL_H x CELL_W float mask in {0,1}. Row bytes are left-aligned."""
    m = np.zeros((CELL_H, CELL_W), dtype=np.float64)
    for y, byte in enumerate(rows):
        for x in range(CELL_W):
            if byte & (0x80 >> x):
                m[y, x] = 1.0
    return m


# --------------------------------------------------------------- glyph subsets
BLOCK_ELEMENTS = range(0x2580, 0x25A0)

SUBSETS: dict[str, callable] = {
    "ascii":   lambda c: 0x20 <= c <= 0x7E,
    "braille": lambda c: 0x2800 <= c <= 0x28FF,
    "box":     lambda c: 0x2500 <= c <= 0x257F,
    "geom":    lambda c: 0x25A0 <= c <= 0x25FF or c in (0x2665, 0x2666),
    "latin1":  lambda c: 0xA0 <= c <= 0xFF,
    "cyrillic": lambda c: 0x400 <= c <= 0x4FF,
}

# "whatever the font draws in these blocks". Cyrillic is in the default because
# a glyph here is texture, not language: the solver picks shapes, and excluding
# a font's Cyrillic would handicap the X11 faces by two thirds of their
# repertoire for a reason that does not apply to how they are used.
DEFAULT_SUBSETS = ("ascii", "braille", "cyrillic")

# A glyph this dense is a block whatever its codepoint. The no-blocks rule is
# written as U+2580-259F and unscii's fully-dotted braille walks straight
# through it; this ceiling is what actually enforces the aesthetic.
MAX_INK = 0.55

# Glyph classes, in the order the art should reach for them. This is not a
# stylistic preference bolted on afterwards — it is the vocabulary the game's
# own content already uses. packages/content/assets/terrain/appearance.json
# lists ground as " .'`," THEN sparse braille, and every authored sprite is
# pure ASCII linework (".-^-." / "|[O]|" / "'---'"). Braille earns its place as
# an intermediate dot density, not as the alphabet.
CLASS_ASCII, CLASS_OTHER, CLASS_BRAILLE = 0, 1, 2


def glyph_class(cp: int) -> int:
    if 0x20 <= cp <= 0x7E or 0x2500 <= cp <= 0x257F or 0x25A0 <= cp <= 0x25FF:
        return CLASS_ASCII
    if 0x2800 <= cp <= 0x28FF:
        return CLASS_BRAILLE
    return CLASS_OTHER


@dataclass(frozen=True)
class GlyphSet:
    """A glyph list in a fixed index order, plus the solver's subset of it."""

    codepoints: list[int]        # index i == glyph index i
    masks: np.ndarray            # (N, ch*cw) coverage in {0,1}
    solve_idx: np.ndarray        # indices the solver may choose from
    cw: int = CELL_W
    ch: int = CELL_H
    name: str = "spleen"
    provenance: str = "vendored"
    licence: str = "BSD-2-Clause"
    notes: tuple[str, ...] = ()
    native_ink: float = 0.0
    rank: np.ndarray | None = None      # class rank, parallel to solve_idx

    @property
    def n(self) -> int:
        return len(self.codepoints)

    @property
    def label(self) -> str:
        return f"{self.name} {self.cw}x{self.ch}"

    @property
    def max_ink(self) -> float:
        """
        The brightest a cell can get. With the background fixed, a cell's
        rendered value is bg + ink*(fg - bg), so the densest available glyph is
        a hard ceiling on brightness — and it, not the codepoint range, is what
        decides whether output reads as text or as painted blocks.
        """
        return float(self.masks[self.solve_idx].mean(1).max())

    def index_of(self, cp: int) -> int:
        return self.codepoints.index(cp)


def from_face(face, subsets=DEFAULT_SUBSETS, max_ink: float = MAX_INK) -> GlyphSet:
    """
    Build a solvable glyph set from any `fonts.Face`.

    DECLARED IS NOT DRAWN — a codepoint present in the font is not evidence of
    ink, and spleen proves it: 99 of its glyphs are declared and empty. Blank
    glyphs other than space are dropped from the solver's subset, because they
    are duplicates of space that make the tie-break's choice arbitrary without
    changing a single pixel.
    """
    cps = sorted(face.masks)
    masks = np.stack([face.masks[c].ravel() for c in cps])

    tests = [SUBSETS[s] for s in subsets]
    wanted = [i for i, c in enumerate(cps) if any(t(c) for t in tests)]
    native_ceiling = max((masks[i].mean() for i in wanted), default=0.0)
    dense = [i for i in wanted if masks[i].mean() > max_ink]
    wanted = [i for i in wanted if i not in set(dense)]
    solve = np.array([i for i in wanted
                      if masks[i].any() or cps[i] == 0x20])
    if solve.size == 0:
        raise SystemExit(f"{face.label}: subsets {subsets} selected no drawn glyphs")
    if 0x20 in cps and cps.index(0x20) not in set(solve.tolist()):
        solve = np.append(solve, cps.index(0x20))

    blocked = [i for i in solve.tolist() if cps[i] in BLOCK_ELEMENTS]
    if blocked:
        raise SystemExit(f"{face.label}: {len(blocked)} block elements reached "
                         f"the solver subset — banned")

    dropped = len(wanted) - solve.size
    notes = tuple(face.notes)
    if dense:
        notes += (f"{len(dense)} glyphs above {max_ink:g} ink coverage removed "
                  f"(native ceiling {native_ceiling:.2f})",)
    if dropped > 0:
        notes += (f"{dropped} declared-but-empty glyphs dropped from the subset",)
    order = np.sort(solve)
    return GlyphSet(codepoints=cps, masks=masks, solve_idx=order,
                    cw=face.cw, ch=face.ch, name=face.name,
                    provenance=face.provenance, licence=face.licence,
                    notes=notes, native_ink=round(float(native_ceiling), 3),
                    rank=np.array([glyph_class(cps[i]) for i in order]))


def load(bdf_path: str | Path, subsets=DEFAULT_SUBSETS) -> GlyphSet:
    font = read_bdf(bdf_path)

    # ---- the runtime order, reproduced from tools/build-fonts.mjs
    cps = sorted(c for c in font if c >= 0x20)

    missing = [c for c in list(range(0x2800, 0x2900)) + list(range(0x20, 0x7F))
               if c not in font]
    if missing:
        raise SystemExit(f"font lacks {len(missing)} required codepoints "
                         f"(first: {hex(missing[0])})")

    blocks = [c for c in cps if c in BLOCK_ELEMENTS]
    if blocks:
        raise SystemExit(f"font carries {len(blocks)} block elements — banned")

    masks = np.stack([bitmap(font[c]).ravel() for c in cps])

    tests = [SUBSETS[s] for s in subsets]
    solve = np.array([i for i, c in enumerate(cps) if any(t(c) for t in tests)])
    if solve.size == 0:
        raise SystemExit(f"subsets {subsets} selected no glyphs")

    return GlyphSet(codepoints=cps, masks=masks, solve_idx=solve)


def check_against_runtime(gs: GlyphSet, glyphset_json: str | Path) -> None:
    """Hard proof that our index order is the game's index order."""
    data = json.loads(Path(glyphset_json).read_text())
    if data["codepoints"] != gs.codepoints:
        n = min(len(data["codepoints"]), gs.n)
        first = next((i for i in range(n) if data["codepoints"][i] != gs.codepoints[i]),
                     n)
        raise SystemExit(
            f"glyph order differs from the runtime atlas at index {first} "
            f"(runtime {len(data['codepoints'])} glyphs, pipeline {gs.n})")
