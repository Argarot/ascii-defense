#!/usr/bin/env python3
"""
The verification checklist, executable.

    python tools/art/verify.py out/title

Every line prints a measured number. A claim without one is not a check.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
from PIL import Image

import atlas
import glyphs
import proof
import xp

ROOT = Path(__file__).resolve().parents[2]
BDF = ROOT / "vendor" / "spleen" / "spleen-5x8.bdf"
RUNTIME = ROOT / "packages" / "app" / "public" / "assets" / "glyphset-spleen.json"
FONTS = ROOT / "REXPaint-v1.70" / "data" / "fonts"

fails: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  [{'ok' if ok else 'FAIL'}] {name}{('  — ' + detail) if detail else ''}")
    if not ok:
        fails.append(name)


def main(out_dir: str) -> int:
    out = Path(out_dir)
    meta = json.loads((out / "meta.json").read_text())
    gs = glyphs.load(BDF, tuple(meta["glyph_subsets"]))

    print(f"\nfont ({BDF.name})")
    check("required codepoints present", True,
          f"{gs.n} glyphs, {gs.solve_idx.size} in the solver's subset")
    if RUNTIME.exists():
        try:
            glyphs.check_against_runtime(gs, RUNTIME)
            check("index order == runtime glyphset-spleen.json", True)
        except SystemExit as exc:
            check("index order == runtime glyphset-spleen.json", False, str(exc))
    else:
        check("index order == runtime glyphset-spleen.json", False,
              "glyphset-spleen.json absent — run `node tools/build-fonts.mjs`")
    blank = sum(1 for i in range(gs.n) if gs.masks[i].sum() == 0)
    print(f"        note: {blank} of {gs.n} runtime glyphs have empty bitmaps "
          f"(spleen declares Latin-1 codepoints but draws nothing)")

    print("\nsolved grid")
    version, layers = xp.read(out / "art.xp")
    layer = layers[0]
    rows, cols = layer.grid.shape
    check(".xp dimensions match meta", (cols, rows) == (meta["cols"], meta["rows"]),
          f"{cols}x{rows}")
    check(".xp layer count", len(layers) == 1, f"{len(layers)} layer, version {version}")

    runtime_idx = layer.grid - atlas.ART_BASE
    check("every glyph index is inside the art range",
          bool((runtime_idx >= 0).all() and (runtime_idx < gs.n).all()),
          f"{int(layer.grid.min())}..{int(layer.grid.max())} "
          f"(art base {atlas.ART_BASE})")

    used_cps = {gs.codepoints[i] for i in np.unique(runtime_idx)}
    braille = {c for c in used_cps if 0x2800 <= c <= 0x28FF}
    check("braille is actually used", len(braille) > 0,
          f"{len(braille)} distinct braille glyphs of {len(used_cps)} total")
    blocks = {c for c in used_cps if c in glyphs.BLOCK_ELEMENTS}
    check("no block characters U+2580-259F", not blocks, f"{len(blocks)} found")

    print("\nround trip")
    digest = hashlib.sha256(runtime_idx.astype("<i4").tobytes()).hexdigest()
    check("grid read back from .xp hashes to what the solver wrote",
          digest == meta["grid_sha256"], digest[:16])
    re_proof = proof.render(gs, runtime_idx, layer.fg, layer.bg, scale=meta.get("scale", 1))
    saved = Image.open(out / "proof.png")
    if saved.size != re_proof.size:
        re_proof = re_proof.resize(saved.size, Image.NEAREST)
    diff = np.abs(np.asarray(saved, float) - np.asarray(re_proof, float))
    check("proof.png reproduces from the .xp alone", diff.max() == 0,
          f"max channel difference {diff.max():.0f}")

    bgs = layer.bg.reshape(-1, 3)
    hit = int(np.all(bgs == np.array([255, 0, 255]), axis=1).sum())
    check("no background is REXPaint's transparency key", hit == 0, f"{hit} cells")

    print("\nREXPaint assets")
    png = FONTS / "ad_spleen_5x8.png"
    if png.exists():
        im = Image.open(png)
        slots = (im.height // glyphs.CELL_H) * atlas.COLUMNS
        check("atlas installed", True, f"{im.size[0]}x{im.size[1]}px, mode {im.mode}")
        check("atlas is 32-bit (8-bit pngs crash REXPaint)", im.mode == "RGBA", im.mode)
        check("atlas is 16 columns", im.width == atlas.COLUMNS * glyphs.CELL_W)
        check("atlas holds every index used", slots > int(layer.grid.max()),
              f"{slots} slots, highest index {int(layer.grid.max())}")
        cs = FONTS / "ad_spleen_utf8.txt"
        table = {}
        for line in cs.read_text().splitlines():
            parts = line.split("//")[0].split()
            if len(parts) == 2:
                table[int(parts[0])] = int(parts[1])
        art_ok = all(table.get(atlas.ART_BASE + i) == cp
                     for i, cp in enumerate(gs.codepoints))
        check("charset maps every art index to its codepoint", art_ok,
              f"{len(table)} entries, art range "
              f"{atlas.ART_BASE}..{atlas.ART_BASE + gs.n - 1}")
        cfg = (FONTS / "_config.xt").read_text(errors="replace")
        check("_config.xt carries the font row", "ASCII Defense 5x8" in cfg)
    else:
        check("atlas installed", False, f"{png} missing — run run.py --install-font")

    print(f"\n{'PASS' if not fails else 'FAIL: ' + ', '.join(fails)}\n")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "out/title"))
