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
| **Cell** | **8 × 5 glyphs = 40 × 40 px, exactly square** — the placement unit, one tower per cell *(D24, 2026-09-04; was 5 × 3 = 25 × 24)* |
| **Tile** | 5 × 5 cells = 200 × 200 px — the generator's unit |
| **Board** | sized to the viewport at boot: about 8 × 5 tiles beside the HUD on a 1920-wide screen |
| **Colour** | 24-bit per glyph, foreground and background, no palette cap |

The cell is declared ONCE, in `content/assets/grid.json`; the content linter
refuses any sprite whose `cell` differs, and the view reads its cell size from
the same file. Changing it means redrawing every sprite — stated plainly in
ARCHITECTURE §1, and true.

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

## 3. Sprite format (v2, session 22 — 2026-09-04; kinds and sequences session 25)

Art is a grid of glyphs plus parallel grids of **ink keys** naming colour
roles. A sprite is a map of **states**, keyed by a string the view chooses:

- **towers**: the committed choice path — `""` base, `"0"`, `"01"`, `"010"`
  (option index per tier, in tier order). Fifteen keys cover a three-tier
  either/or tree; the view falls back to the longest authored prefix.
- **terrain**: the cell letter (`"|"`, `"L"`, `"B"` …).
- **the Core face** (`kind: "face"`): `"top"`, `"mid"`, `"bot"` — the three
  stacked cells past the east border; the road arrives at the middle one.
- **enemies** (`kind: "enemy"`) and **relics** (`kind: "relic"`): `""` alone.

**`kind` decides the cell rule** *(session 25)*. Towers, terrain and the
face are board cells (`cell` equals grid.json). An **enemy** is a small
walker, at most 5×3, drawn centred on its position with its feet on the
position row, transparent over the road (a slow tints its ground cold); the
sprite id is `enemy_<roster id>`. A **relic** is exactly 4×3, the inventory
slot's interior in the strip and the column; the id is `relic_<pool id>`.
The view looks sprites up by those ids and falls back to the old
single-glyph look or the two-letter tag when none exists.

```jsonc
{
  "id": "bolt",
  "cell": [8, 5],
  "frameMs": 720,
  "source": "sources/sprites/ascii-defense-bolt-upgrade-tree-12.json via tools/import-sprites.mjs",
  "states": {
    "": {
      "art":   [" .-#-.  ", "|[o]|==>", "   ||)  ", "   ||   ", " /_||_\\ "],
      "ink":   [".abcba..", "defgh...", "...ii...", "...ii...", ".jjiijj."],
      "bgInk": [".kkkkk..", "lmnml...", "...oo...", "...oo...", ".pppppp."],
      "frames": [{ "art": ["…"], "ink": ["…"], "bgInk": ["…"] }]
    },
    "0": { "…": "…" }
  },
  "inkMap": { "a": "tower.bolt.turret_high", "k": "tower.bolt.mix.1a2b3c", ".": null }
}
```

- Every grid is exactly `cell` in size, and `cell` equals
  `content/assets/grid.json`; the linter refuses anything else.
- **`.` is transparent** — terrain shows through, so sprites do not read as
  rectangular stamps. A space in `art` is always transparent.
- **`bgInk`** is optional: per-glyph background roles through the same
  `inkMap`. Without it a tower stands on its ground role.
- **`"PATH"`** resolves to the instance's upgrade-path colour.
- **`frames`** are the idle cycle `[base, ...frames]` at `frameMs` on the
  wall clock; reduced motion pins frame 0; the view offsets each instance's
  phase by its board position so a row of towers churns out of step.
- **`variations`** are static alternates of a state (roads have four). The
  view picks one per board position with the mixing hash — same cell, same
  look forever, no randomness spent.
- **`sequences`** *(session 25)* are event-keyed animations on a state:
  `charge`, `fire`, `cool`, `hit` — each a list of frames with an optional
  per-frame `ms`, played ONCE from the first on the **world clock** (a
  paused world holds the frame), then the idle cycle resumes. A tower
  without them gets a placeholder the view derives from its base art (a
  flash and a recoil), so the mechanism is visible before the art arrives.
  **This is the model every future sprite is authored against**: a study
  that wants its own attack animation ships these four lists.

### Where sprites come from: `sources/sprites/` and the importer

Sprites are **not hand-edited** under `content/assets/sprites/`. Daniil's
generators (`sources/sprites/generate_*.py`, committed for provenance) emit
study files (`sources/sprites/*.json`); `node tools/import-sprites.mjs` turns
them into the format above and adds the palette roles they need. The tower
studies carry no per-glyph colour — their colour is a **rule** in the
generator (row, glyph, chosen path) — so the importer ports each rule and
paints every glyph with it, substituting the game's ground colour for the
study's grass. Every computed colour becomes a palette role
(`tower.<id>.<name>` for the study's named colours, `tower.<id>.mix.<hex>`
for mixed ones), so a re-tint is still a palette edit. The road family comes
in already sprite-shaped; its `tiers` are the twelve road letters in the
generator's `ROAD_ORDER` and its `frames` become `variations`.

Re-import after a study changes and the diff is the change. A study with a new
rule fails to import until the rule is ported — never guessed.

**Placeholders** *(session 25)*: `node tools/placeholder-sprites.mjs` writes
the sprites nobody has drawn yet — the seven enemies, the sixteen relics,
the Core face — from art that lives in the script (a base grid, a second
idle frame, one colour rule per glyph class, the studies' own spirit). Their
`source` field says so. The art agent replaces one by dropping a study into
`sources/sprites/` and giving the importer its rule; the generator then
stops writing that id. The palette roles they name (`enemy.limb`,
`enemy.boss`, `relic.*`, `status.slowed`) are added by the generator.

Terrain that has no sprite yet (ground, rock, ore, Core, water) is a
**weighted glyph pool per cell type** plus three colours (lit, mid, dark),
applied per row at the boundary of a terrain mass. That is where depth comes
from — shading, never geometry.

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

## 7. State of the art (2026-09-04)

- **Towers**: all four have full 15-state trees with two idle frames, drawn
  by Daniil at 8×5, imported. Their state names predate the design-round-1
  tree rework (Rifled/Gas Seals vs Marksman/Gatling); the shapes stand,
  the visuals get renamed later.
- **Roads**: twelve letters, four static variations each, muted river cobble.
- **Still placeholders**: ground, rock, ore, Core, water — glyph pools scaled
  to the larger cell until Daniil draws them. Enemies are single glyphs.
- **UI chrome**: light box drawing only.
- **Effects**: authored in code (the effects layer), not as sprites.
- The REXPaint round trip (§2) remains an unexercised option; the working
  authoring path is the generators plus the importer.
