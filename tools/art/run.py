#!/usr/bin/env python3
"""
One entry point for the whole chain.

    python tools/art/run.py --source sources/splash.png --slug title --cols 160
    python tools/art/run.py --prompt "a lighthouse in a storm" --cols 100 --seed 42
    python tools/art/run.py --install-font          # write the REXPaint assets

Outputs land in out/<slug>/: source.png, proof.png, art.xp, grid.txt, meta.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from PIL import Image

import atlas
import glyphs
import proof
import solve as solver
import xp

ROOT = Path(__file__).resolve().parents[2]
BDF = ROOT / "vendor" / "spleen" / "spleen-5x8.bdf"
RUNTIME = ROOT / "packages" / "app" / "public" / "assets" / "glyphset-spleen.json"
FONT_NAME = "ASCII Defense 5x8"
FONT_STEM = "ad_spleen_5x8"
CHARSET_STEM = "ad_spleen_utf8"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "untitled"


def install_font(dest: Path, gs: glyphs.GlyphSet) -> None:
    img, charset = atlas.build(gs)
    rows = img.height // glyphs.CELL_H
    dest.mkdir(parents=True, exist_ok=True)
    img.save(dest / f"{FONT_STEM}.png")
    (dest / f"{CHARSET_STEM}.txt").write_text(atlas.charset_file(charset))

    cfg = dest / "_config.xt"
    block = atlas.config_rows(FONT_NAME, FONT_STEM, rows, CHARSET_STEM)
    if cfg.exists():
        text = cfg.read_text(encoding="utf-8", errors="replace")
        text = re.sub(r"\n*// --- ASCII Defense art font.*?(?=\n//[^ ]|\Z)", "",
                      text, flags=re.S)
        cfg.write_text(text.rstrip("\n") + "\n" + block, encoding="utf-8")
    else:
        cfg.write_text(block, encoding="utf-8")
    print(f"atlas   {dest / (FONT_STEM + '.png')}  "
          f"{img.width}x{img.height}px, {atlas.COLUMNS} cols x {rows} rows, "
          f"{atlas.ART_BASE + gs.n} slots")
    print(f"charset {dest / (CHARSET_STEM + '.txt')}")
    print(f"config  {cfg}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--source", help="existing PNG to convert")
    p.add_argument("--prompt", help="Retro Diffusion prompt (needs RD_API_KEY)")
    p.add_argument("--slug")
    p.add_argument("--cols", type=int, default=120)
    p.add_argument("--rows", type=int, default=None)
    p.add_argument("--tie", type=float, default=0.02,
                   help="relative tie-break tolerance")
    p.add_argument("--slack", type=float, default=3.0,
                   help="absolute tie-break tolerance in RMS colour levels; "
                        "the main density knob — higher is emptier and cleaner")
    p.add_argument("--glyphs", default=",".join(glyphs.DEFAULT_SUBSETS),
                   help="comma-separated: " + ",".join(glyphs.SUBSETS))
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--out", default=str(ROOT / "out"))
    p.add_argument("--install-font", action="store_true")
    p.add_argument("--rexpaint", default=str(ROOT / "REXPaint-v1.70" / "data" / "fonts"))
    p.add_argument("--scale", type=int, default=2, help="proof.png upscale")
    args = p.parse_args()

    subsets = tuple(s.strip() for s in args.glyphs.split(",") if s.strip())
    gs = glyphs.load(BDF, subsets)
    if RUNTIME.exists():
        glyphs.check_against_runtime(gs, RUNTIME)
        print(f"glyphset matches the runtime atlas ({gs.n} glyphs)")
    else:
        print(f"note: {RUNTIME} not found — index order unverified against runtime")

    if args.install_font:
        install_font(Path(args.rexpaint), gs)
        if not (args.source or args.prompt):
            return 0

    if not (args.source or args.prompt):
        p.error("give --source or --prompt (or --install-font on its own)")

    slug = args.slug or slugify(args.prompt or Path(args.source).stem)
    out = Path(args.out) / slug
    out.mkdir(parents=True, exist_ok=True)

    if args.prompt:
        import generate
        src_path = generate.generate(args.prompt, out / "source.png", seed=args.seed)
    else:
        src_path = out / "source.png"
        Image.open(args.source).convert("RGB").save(src_path)

    src = Image.open(src_path).convert("RGB")
    rows = args.rows or solver.rows_for(src, gs, args.cols)
    s = solver.solve(src, gs, args.cols, rows, tie=args.tie, slack=args.slack)

    proof.render(gs, s.grid, s.fg, s.bg, scale=args.scale).save(out / "proof.png")
    (out / "grid.txt").write_text(proof.as_text(gs, s.grid), encoding="utf-8")
    xp.write(out / "art.xp", s.grid, s.fg, s.bg)

    used = sorted({int(i) for i in s.grid.ravel()})
    braille = [i for i in used if 0x2800 <= gs.codepoints[i] <= 0x28FF]
    meta = {
        "slug": slug, "source": str(src_path), "cols": s.cols, "rows": s.rows,
        "cell": [glyphs.CELL_W, glyphs.CELL_H], "glyph_subsets": list(subsets),
        "tie": args.tie, "slack": args.slack, "scale": args.scale, "seed": args.seed, "prompt": args.prompt,
        "font": FONT_NAME, "art_base": atlas.ART_BASE,
        "distinct_glyphs": len(used), "braille_glyphs": len(braille),
        "blank_cells": int((s.grid == gs.index_of(0x20)).sum()),
        "ink_coverage": round(float(gs.masks[s.grid.ravel()].mean()), 4),
        "rmse": round(s.err ** 0.5, 3),
        "grid_sha256": hashlib.sha256(
            s.grid.astype("<i4").tobytes()).hexdigest(),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2))

    print(f"\n{s.cols}x{s.rows} cells  rmse {meta['rmse']}  "
          f"{meta['distinct_glyphs']} distinct glyphs "
          f"({meta['braille_glyphs']} braille)  "
          f"{100 * meta['blank_cells'] / (s.cols * s.rows):.0f}% empty  "
          f"{100 * meta['ink_coverage']:.0f}% ink")
    print(f"proof   {out / 'proof.png'}")
    print(f"xp      {out / 'art.xp'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
