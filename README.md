# ASCII Defense

A roguelite tower defense game that runs in the browser and draws everything —
terrain, towers, enemies, menus — as characters on a grid.

**You build the map, then defend it.** Most of the board starts empty. Every few
waves you lay a terrain tile from a drafted hand, extending the road and opening
new ground. When you run out of room to expand, the run is over.

**Status: M0 complete.** What is deployed is a rendering and scale study, not the
game. See [docs/ROADMAP.md](docs/ROADMAP.md).

▶ **[Current build](https://argarot.github.io/ascii-defense/)**

---

## What it will be

- **You author the map.** Terrain tiles are Carcassonne pieces with edge
  connectors. A tile is legal only where its connectors match — so a connected
  road holds *by construction*, and the game never checks whether the board is
  still solvable.
- **Deep tower evolution.** Three upgrade paths of five tiers, with a hard
  crosspathing limit: one path to tier 5, a second to tier 2, the third locked.
- **Mining the margins.** Ore is meta-only and never helps the current run, so
  every refinery is a bet against your own survival, funding a permanent tech
  tree instead.
- **Every run is reproducible.** A run is a seed plus an input log — a couple of
  kilobytes. That gives shareable replays, daily challenges, bug reports as
  files, and a regression corpus built from real play.
- **Difficulty measured, not guessed.** Wave budgets are calibrated from a bot
  playing hundreds of seeded runs, then committed as reviewable data. A balance
  change shows up in a diff.

## Technical shape

Rendered by **WebGL2** at 24-bit colour per glyph — canvas 2D was measured at
38 ms/frame under real animation load and rejected. The font is
**[spleen 5×8](https://github.com/fcambus/spleen)** (BSD-2-Clause), parsed from
BDF into a 1-bit atlas at build time; its **braille patterns** supply the
density ramp that terrain shading uses.

Three levels, used consistently everywhere: **glyph** (5×8 px) → **cell**
(5×3 glyphs, one tower) → **terrain tile** (5×5 cells).

The simulation knows no glyphs, colours or pixels. Art is authored in
**REXPaint** against a generated spleen font and imported as JSON.

## Running it

Requires Node 22+.

```bash
npm install
```

```bash
npm run dev
```

Other scripts: `npm run typecheck`, `npm run build`, `npm run preview`.

To regenerate the glyph atlases from the vendored fonts:

```bash
node tools/build-fonts.mjs
```

## Documentation

| | |
|---|---|
| What the game is | [docs/PRD.md](docs/PRD.md) |
| How it is built | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| How it looks, and the art pipeline | [docs/ASSETS.md](docs/ASSETS.md) |
| What happens next | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Invariants and environment traps | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Licence

[Apache-2.0](LICENSE). Vendored fonts keep their own: unscii is public domain,
spleen is BSD-2-Clause.
