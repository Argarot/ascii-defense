# tools/art — image → `.xp` art pipeline

`prompt or PNG` → **solver** → `.xp` + font atlas → open in REXPaint → hand
touch-up → (later) `rexpaint-import.mjs` → sprite JSON.

This is the generative half of WBS 6.1. It does not replace hand authoring; it
produces a starting frame that is already glyph-correct, colour-correct and
index-correct, so touch-up begins from something rather than from nothing.

```bash
pip install -r tools/art/requirements.txt

python tools/art/run.py --install-font                  # REXPaint assets, once
python tools/art/run.py --source sources/splash.png --slug title --cols 120
python tools/art/verify.py out/title                    # the checklist, measured
```

## What is fixed, and why

| | |
|---|---|
| Font | `vendor/spleen/spleen-5x8.bdf` — the same source `tools/build-fonts.mjs` reads |
| Cell | 5 × 8 px (**not** square: `rows ≈ cols × 5/8` for square output) |
| Glyph order | identical to `glyphset-spleen.json`; asserted on every run |
| Solver subset | ASCII + braille (351 glyphs) by default; `--glyphs` widens it |
| Blocks | impossible — spleen carries no U+2580–259F, and `glyphs.load` asserts it |
| Colour | 24-bit fg and bg per cell |

A `.xp` stores glyph **indices**, so the pipeline is only useful if its indices
mean what the runtime thinks they mean. `glyphs.load` rebuilds the runtime order
from the BDF and `check_against_runtime` compares it against the shipped
`glyphset-spleen.json` — a mismatch stops the run.

## The atlas layout, and the trap it exists to avoid

```
slots   0..255    CP437 compatibility page
slots 256..727    the runtime glyph set, runtime index order   (ART_BASE = 256)
```

Two REXPaint facts force the prefix, both from the 1.70 manual's Fonts section:

1. *"custom fonts always treat index 32 as a space, regardless of what the font
   bitmap contains there."* In runtime order index 32 is `@`. A zero-based atlas
   would render every `@` as a hole and make the glyph undrawable by hand.
2. The GUI font and the art font must share glyph dimensions, so at 5×8 the
   editor draws **its own interface** from this bitmap — and it indexes it as
   CP437.

So the art range starts at 256 and the importer subtracts it:
`runtime index = xp index − 256`.

The CP437 page is filled from spleen where the codepoint exists (163 of 256
slots). Blocks, shades and the line-drawing set are synthesised in `atlas.py`
purely so the editor chrome is legible; they are **not** reachable by the solver
and never enter the art range. Slots spleen cannot cover — Greek, arrows, the
CP437 symbol run — are left blank, and parts of the REXPaint UI will show gaps
there. If that turns out to be intolerable in practice, the fix is more entries
in `_synthetic()`, not a change of layout.

## Density is a knob, and it is `--slack`

The reference spec's tie-break — among glyphs within 2% of the best error, take
the lightest — is necessary and not sufficient. A purely *relative* tolerance
collapses in near-flat regions, because 2% of an error close to zero is close to
nothing, and the winner becomes whichever dense letter happens to correlate with
a three-level gradient. Measured on `sources/testcard.png`, that filled the
entire grey ramp with `b$kkkk`.

`--slack` adds an absolute tolerance in RMS colour levels. On the test card,
`--slack 3` took ink coverage from 16% to 2% and cost 0.012 RMSE — the dense
glyphs were buying nothing. This is ASSETS.md §5's "ground is mostly empty"
rule made operational; treat it as the primary quality lever after `--cols`.

Tuning order: `--cols`, then `--slack`, then `--glyphs`, then source contrast.

## Comparing fonts before committing to one

```bash
python tools/art/compare.py                       # every candidate
python tools/art/compare.py --faces spleen-5x8,unifont-8x16
```

Writes `out/compare/compare.html` — a self-contained gallery — plus the raw
PNGs and `compare.json`. Three sweeps, each answering a different question:

- **A · board at true scale.** The same 12&times;7 cells of battlefield drawn at
  each candidate's real cell size, shown at 1:1. The images come out different
  sizes on purpose; that difference is the cost of a bigger glyph.
- **B · drawing room.** One tower at every combination of font and
  glyphs-per-cell. Glyphs-per-cell is a *layout* parameter, not a rendering one
  — it changes nothing about how the solver works and everything about how much
  board fits on screen, and that trade is printed under each tile.
- **C · large format.** One fixed output size for every candidate, so the RMSE
  column is comparable across fonts. Sweeps A and B render at different
  resolutions, so theirs is not.

The repertoire is pinned to ASCII + braille for every candidate so the sweep
isolates the levers being tested. Widening it is a separate experiment
(`glyphs.SUBSETS` has `box`, `geom` and `latin1` ready).

Candidates come from `fonts.registry()`. Anything dropped into `vendor/fonts/`
as a `.bdf` joins the sweep automatically — that is the intended way to add
Spleen 6&times;12 / 8&times;16 / 12&times;24, Cozette, Terminus or anything else.

### What a `Face` guarantees

- **Declared is not drawn.** A codepoint in the cmap is not evidence of ink;
  spleen declares 99 glyphs it draws nothing in. Blank glyphs are dropped from
  the solver subset, because they are duplicates of space that make the
  tie-break arbitrary without changing a pixel.
- **A missing glyph is silent.** PIL substitutes `.notdef` without raising,
  which is how the reference pipeline once ran to completion using zero braille.
  Outline faces check the cmap before rasterising and report what is absent.
- **A clipped glyph is silent too.** Size and offset are fitted from the advance
  width and the ink bounding box, not hand-picked, and anything still
  overflowing the cell is counted. FreeMono squeezed into an 8&times;16 cell
  lost the stems of `A`, `i` and `l` before this check existed.

## Files

| | |
|---|---|
| `fonts.py` | font candidates — BDF, `.hex`, rasterised outlines, integer upscales |
| `glyphs.py` | index order + coverage masks. The one definition of that order. |
| `scene.py` | board and tower reference subjects, drawn in cell coordinates |
| `compare.py` | the font / cell-geometry sweep and its HTML report |
| `atlas.py` | REXPaint atlas PNG, `_config.xt` rows, Unicode charset file |
| `solve.py` | per-cell least squares in (fg, bg) over every candidate glyph |
| `xp.py` | `.xp` writer and reader (column-major, gzipped — manual Appendix B) |
| `proof.py` | PNG rendered from the **solved** grid; the regression test |
| `generate.py` | stage 1, Retro Diffusion — **written, never exercised** |
| `testcard.py` | stand-in sources until stage 1 is wired |
| `run.py` | CLI; chains everything into `out/<slug>/` |
| `verify.py` | the checklist, each line a measured number |

## What is proven and what is not

Verified on this machine, `python tools/art/verify.py out/title`:

- glyph order identical to the shipped `glyphset-spleen.json` (472 glyphs)
- the solved grid survives `.xp` write → read with a matching SHA-256
- `proof.png` reproduces from the `.xp` alone, max channel difference 0
- braille is genuinely used (22 distinct glyphs in the sample), blocks are not
- atlas is 16-column RGBA, 736 slots, above the highest index used

**Not proven:** that REXPaint opens the atlas and the `.xp` correctly. Nothing
here has been through the actual editor — REXPaint is a Windows GUI and this
pipeline was built headless. That is the next gate, and it is a hands-on one:
open `out/title/art.xp` in REXPaint with the *ASCII Defense 5x8* font selected
and confirm the image matches `proof.png`. Until that is done, treat the `.xp`
writer as reasoned-from-the-spec, not tested.

**Also not exercised:** `generate.py`. No `RD_API_KEY` has been through it.

## Known drift found while building this

- `docs/ASSETS.md` says spleen carries "472 glyphs: printable ASCII, braille
  patterns, light box drawing" and no Latin-1. Both halves are true in effect
  but not in the file: spleen *declares* the Latin-1 codepoints and draws
  nothing in them. 99 of the 472 glyphs in the shipped runtime atlas have empty
  bitmaps, so `term.has()` reports them present and they render as spaces. The
  content linter's "every glyph used exists in the font" check would pass for a
  glyph that draws nothing.
