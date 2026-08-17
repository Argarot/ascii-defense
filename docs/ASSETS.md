# Asset library

**The engine knows no glyphs.** It knows ids, cells and footprints. Which
characters get drawn, and in what colour, is decided entirely here.

That is why [PRD.md](PRD.md) names no glyph. If you find yourself writing
`'^' = Bolt Turret` in a design document, the design has leaked into the art.

---

## 1. The canvas you are drawing on

| | |
|---|---|
| **Font** | [spleen 5×8](https://github.com/fcambus/spleen), BSD-2-Clause, F. Cambus |
| **Glyph** | 5 × 8 px — **not square** |
| **Cell** | **5 × 3 glyphs** = 25 × 24 px — the placement unit, one tower per cell |
| **Tile** | 5 × 5 cells = 125 × 120 px — the piece the player lays |
| **Board** | ~15 × 9 tiles on 1920 × 1200 |
| **Colour** | 24-bit per glyph, foreground and background, no palette cap |

### What spleen gives you, and what it does not

**472 glyphs: printable ASCII, braille patterns, light box drawing.**

- ✅ **Braille is the point.** `⠁⠂⠄⠈⠐⠠⡀⢀` through `⣿⡿⢿⣻⣽⣾⣷` is a genuine
  dot-density ramp with far finer steps than punctuation. It is what terrain
  shading uses.
- ❌ **No Latin-1.** `´ ¯ ¤ § µ ° « »` do not exist. This was a deliberate trade:
  spleen's 5-wide glyph buys 15 glyphs per cell against unscii's 9, and towers
  had been the weakest thing in every mock.
- ❌ **No block elements.** `█▓▒░` do not exist. Braille replaces them.
- ⚠️ **Light box drawing only.** UI chrome uses `─│┌┐└┘├┤┬┴┼`, never `╔═╗`.

Measured in the final comparison: both fonts resolved **65 distinct glyphs** in
terrain. We use 14% of spleen. Palette breadth was never the binding constraint;
per-cell drawing room was.

## 2. Authoring: REXPaint with a generated spleen font

[REXPaint](https://www.gridsagegames.com/rexpaint/) is free, Windows-native, and
already in the working folder. Its
[manual](https://www.gridsagegames.com/rexpaint/manual.txt) confirms the three
things this pipeline needs:

- fonts load from **16-column PNG bitmaps** listed in `data/fonts/_config.xt`
- **more than 256 glyphs** are supported via additional rows
- **non-square glyphs are supported** — "rectangles are acceptable"
- `.xp` stores **glyph indices, not codepoints**, so it is format-agnostic

So the round trip is exact:

```
vendor/spleen/spleen-5x8.bdf
        │  tools/build-fonts.mjs
        ▼
content/assets/fonts/glyphset-spleen.json      ← runtime atlas (index → codepoint)
        │  tools/build-rexpaint-font.mjs
        ▼
REXPaint data/fonts/spleen-5x8.png (16 cols)   ← same index order
        │  author art
        ▼
*.xp  ──  tools/rexpaint-import.mjs  ──▶  content/assets/**/*.json
```

Because both the runtime atlas and the REXPaint font are generated from the same
source in the same order, a glyph index in a `.xp` file means exactly the same
glyph at runtime. **Braille included** — the constraint that worried us was
CP437, and REXPaint is only CP437 *by default*.

One usability note: REXPaint requires the GUI font and art font to share glyph
dimensions, so the editor UI will also render at 5×8. Cramped but workable.

Commit `.xp` sources alongside the generated JSON so art stays editable.

## 3. Sprite format

Art is a grid of glyphs plus a parallel grid of **ink keys** naming colour roles.

```jsonc
{
  "id": "tower_bolt",
  "cell": [5, 3],
  "tiers": {
    "1": {
      "art": [".-^-.", "|[O]|", "'---'"],
      "ink": ["fffff", "fcwcf", "fffff"]
    }
  },
  "inkMap": { "f": "tower.frame", "c": "PATH", "w": "tower.core", ".": null }
}
```

- `art[r].length` must equal `cell[0]`; `art.length` must equal `cell[1]`.
  Validated; a mismatch is reported, not drawn.
- **`.` is transparent** — terrain shows through, so sprites do not read as
  rectangular stamps.
- **`"PATH"` resolves to the instance's upgrade path colour**, so one drawing
  serves all three specialisations instead of needing three copies.

### Frames (the idle cycle — WBS 4.1, session 16)

A tier may carry additional **idle frames** beyond its base art, and the sprite
a **`frameMs`** cadence; the cycle is `[base, ...frames]`:

```jsonc
{
  "id": "bolt",
  "cell": [5, 3],
  "frameMs": 700,
  "tiers": {
    "0": {
      "art": [".-^-.", "|[O]|", "'---'"],
      "ink": ["FFFFF", "FFCFF", "FFFFF"],
      "frames": [{ "art": [".-^-.", "|[o]|", "'---'"], "ink": ["FFFFF", "FFCFF", "FFFFF"] }]
    }
  },
  "inkMap": { "F": "tower.frame", "C": "path.1" }
}
```

Rules that keep this cheap and honest:

- Every frame is the **same cell size** as the base — the linter enforces it.
- The cycle runs on the **wall clock**, never sim time: idles are ambient, the
  sim knows nothing, and pause does not stop a tower breathing. The view
  offsets each instance's phase by its board position so a row of identical
  towers churns out of step.
- **Reduced motion pins frame 0 forever** (PRD §15.4).
- The format is **plain grids, nothing importer-specific** (decided
  2026-08-17): when the REXPaint round trip lands (6.1), `.xp` layers become
  frames at import time and the schema does not change.

Terrain is a **weighted glyph pool per cell type** plus three colours (lit, mid,
dark), applied per row at the boundary of a terrain mass. That is where depth
comes from — shading, never geometry.

## 4. Palette

`palette.json` maps role names to colours. **Sprites never contain a hex value**
— they name roles, and the palette decides. That is what makes a biome re-tint a
palette swap rather than an art rewrite.

## 5. Authoring rules

From [Stone Story RPG's tutorial](https://stonestoryrpg.com/ascii_tutorial.html),
the best published source on making this look good:

- **Material language.** Fix a vocabulary where specific combinations
  consistently mean metal, stone, energy, organic. Players absorb it untaught,
  and it is what makes art read as *objects* rather than texture.
  **Define this before drawing anything else.**
- **Anti-alias edges** with lighter-density glyphs along a boundary.
- **Dither for tone.** Braille is the fine ramp; punctuation the coarse one.
- **Negative space is form.**
- **Ground your sprites** — a dark row beneath a figure reads as shadow.
- **Consistent light**: highlights top-left, shadow bottom-right, everywhere.
- **Silhouette first.** If it is not recognisable in one colour, more colours
  will not save it.
- **Legibility is the tie-breaker**, and it overrides every rule above.

Two terrain rules learned by getting them wrong:

- **Ground is mostly empty** — roughly 9% of glyphs carry a mark. Filling every
  glyph produces static that buries entities.
- **Glyph choice must use a *mixing* hash.** `(x*a + y*b) % n` is linear and
  lays visible diagonal moiré across open ground.

## 6. Validation

Enforced in CI:

- art/ink grids match the declared `cell`
- every ink key exists in the sprite's `inkMap`
- every `inkMap` value resolves in the palette
- **every glyph used exists in the font** — the loader filters through
  `term.has()` and reports, so a missing glyph is never silently dropped
- every referenced sprite id exists, and every sprite is referenced

## 7. Still to do

Everything currently under `public/assets/` is **scale and format demonstration,
not art**. It is hand-typed, was drawn against three different fonts across the
week, and should be replaced wholesale.

- Define the material language — before any sprite.
- Redraw terrain, towers and enemies in REXPaint at 5×3.
- Biome palettes.
- Animation frames — the format supports named frames; none are authored.
- Effects: projectiles, impacts, explosions, deaths. Deferred past M1 by
  decision; the subcell coordinates they need ship in M1.
- UI chrome: HUD, tile hand, menus, tech tree — light box drawing only.
