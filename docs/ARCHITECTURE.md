# ASCII Defense — Architecture

Status: **M0 shipped, M1 not started.**

---

## 1. The modularity contract

The requirement is that any one aspect can be changed without touching the
others — swap the font, the cell size, the difficulty curve, the enemy roster or
the HUD, and nothing else needs to know.

That is achieved by one rule, stated once and enforced by lint:

> **The engine knows no glyphs, no colours and no pixels.**
> It knows ids, cells, ticks and numbers. Nothing in `engine/` may branch on
> appearance.

Everything else follows. Layers, innermost first — **each layer may import only
from layers above it in this list:**

| Layer | Knows about | Never knows about |
|---|---|---|
| `engine` | rules, ids, cells, ticks, RNG | glyphs, colours, DOM, pixels |
| `content` | JSON data + schemas | anything executable |
| `render` | glyphs, colours, atlas, WebGL | towers, waves, tiles, game rules |
| `view` | **both** engine state and render calls | — |
| `app` | screens, input, wiring | game rules |

`view` is the **only** place where game concepts and drawing meet. It is
deliberately thin: it reads engine state, asks the asset registry what that
state looks like, and calls `render`.

### What "swap the font and only JSON changes" actually means

| Change | Touches |
|---|---|
| Different font | `content/assets/fonts/*.json`, render config, **and the art must be redrawn** |
| Different cell size | same as above |
| Different palette | `content/assets/palette.json` |
| New tower | `content/assets/towers/*.json` + art |
| New terrain tile | `content/assets/tiles/*.json` + art |
| Difficulty retune | `content/balance/curves.json` |
| New enemy trait | `engine/enemies` + content |

Engine, view and render logic are untouched by everything above the line.
**ASCII art cannot be auto-scaled**, so changing cell size always means
re-authoring art. That is unavoidable and worth stating plainly rather than
implying otherwise.

## 2. Repository layout

```
packages/
├─ engine/                    headless. ZERO DOM. ZERO appearance.
│  ├─ rng/                    seeded PRNG, named streams
│  ├─ grid/                   cells, occupancy, flow field
│  ├─ tiles/                  tile placement, connector matching, legality
│  ├─ sim/                    tick loop, towers, projectiles, targeting
│  ├─ enemies/                traits, composition, spawning
│  ├─ difficulty/             budget curves, k(w), L scaling, metaPowerIndex
│  ├─ economy/                Scrap, Ore per tier, costs
│  ├─ meta/                   tech tree graph, unlocks, persistence
│  ├─ replay/                 seed + input log, record and playback
│  └─ run/                    run state machine, drafting, save/load
├─ content/                   DATA ONLY. no logic.
│  ├─ assets/fonts/           glyphset-*.json  (generated)
│  ├─ assets/terrain/         terrain appearance per cell type
│  ├─ assets/tiles/           tile definitions + connectors
│  ├─ assets/towers/          stats, trees, art per tier
│  ├─ assets/enemies/         stats, traits, art
│  ├─ assets/upgrades/        modifiers and relics
│  ├─ assets/ui/              HUD, menu and tech-tree chrome
│  ├─ balance/                calibrated curves (harness output)
│  ├─ schema/                 *.schema.json
│  └─ src/registry.ts         loads, validates, exposes typed lookups
├─ render/                    glyph grid only
│  ├─ GLTerm.ts               WebGL2 instanced renderer
│  ├─ atlas.ts                1-bit bitmaps -> texture
│  └─ config.ts               cell size in glyphs, glyph size in px
├─ view/                      the ONLY layer that knows both sides
│  ├─ board/                  terrain, towers, enemies, effects
│  ├─ hud/                    build palette, wave state, tile hand
│  ├─ menus/
│  └─ techtree/
├─ bot/                       one policy; regression detector
├─ harness/                   headless CLI: calibrate, check, report
└─ app/                       screens, input, bootstrap
tools/                        font build, REXPaint import, schema codegen
vendor/                       unscii-8.hex, spleen-5x8.bdf
```

**Enforced by lint, not discipline:** `engine` and `content` may not import
`render`, `view`, `app` or the DOM. `render` may not import `engine`.

## 3. Rendering

### Why WebGL2

Measured, at 100% cell churn with true per-cell colour:

| Grid | Cells | Canvas 2D | **WebGL2** |
|---|---:|---:|---:|
| 120×50 | 6,000 | 38.0 ms | **0.51 ms** |
| 240×90 | 21,600 | 118.8 ms | **1.32 ms** |
| 320×120 | 38,400 | 212.1 ms | **2.36 ms** |

Canvas 2D fails at the smallest useful grid, and its atlas must rasterise each
glyph *per colour*, capping near 64. WebGL carries colour as a per-instance
vertex attribute, so 24-bit per glyph is free.

One white glyph atlas, one instanced quad, a `Float32Array` of per-glyph
instance data uploaded per frame, `mix(bg, fg, coverage)` in the fragment
shader. No dirty-cell diffing — unnecessary at these speeds and it misleads
about worst-case cost.

### Font

**spleen 5×8**, BSD-2-Clause, F. Cambus. 472 glyphs: printable ASCII, **braille
patterns**, and light box drawing. Parsed from `vendor/spleen/spleen-5x8.bdf`
into 1-bit bitmaps and expanded into an atlas at load, drawn with `NEAREST`.

No webfont: at this size the browser's rasteriser would decide what the art
looks like.

**Braille is the reason for this font.** It supplies a genuine dot-density ramp
(`⠁⠂⠄⠈` … `⣿⡿⢿⣻`) that nothing else in the set provides, and it is what terrain
shading uses in place of block elements.

**Consequences of choosing spleen, recorded so they are not rediscovered:**

- **No Latin-1.** `´ ¯ ¤ § µ ° « »` do not exist. Art is ASCII + braille + light
  box drawing.
- **No block elements.** `█▓▒░` do not exist; braille replaces them.
- **Only light box drawing.** UI chrome cannot use `╔═╗`.
- **Glyphs are 5×8, not square.** Square-ish cells require a 5×3 glyph grid.

## 4. The grid, and subcell coordinates

Three levels — glyph, cell (5×3 glyphs), tile (5×5 cells) — per PRD §3.

**Entity positions are stored in subcell units from M1.** Cogmind positions
particles on a subcell grid inside every cell, which is why its effects flow
rather than snap. Retrofitting that into a cell-resolution sim means rewriting
movement, collision and rendering, so the shape ships now even though the
effects system does not.

This is one instance of a general pattern:

| Reserved | Ships as | Avoids |
|---|---|---|
| Ore stored per tier | one tier | a save migration |
| `metaPowerIndex` in the model | pinned near 1.0 | re-deriving balance |
| Subcell coordinates | 1×1 subcells | rewriting movement |
| **Path identity as data, not colour** | colour only | rewriting the sim for accessibility |

That last one is deliberate. Encoding upgrade path purely in hue fails for ~8%
of men. Full colour-vision-deficiency support is **out of scope by decision**,
but the sim stores `pathId` and the view decides presentation, so adding a
redundant channel later is a view and asset change. **Nothing in the engine may
branch on colour.**

## 5. Pathfinding

Dijkstra flow field over the **cell** grid, from the Core outward. A full board
is roughly 3,400 cells — sub-millisecond. Recomputed on build/sell and on tile
placement, not per tick. Two fields: ground, and flying (straight line).

Yields `L`, effective road length in cells, feeding the difficulty model.

Because tiles guarantee connectivity by construction, there is **no
"is a path still available" check anywhere**. If you find yourself writing one,
something upstream is wrong.

## 6. Determinism

- One seeded PRNG (`pure-rand`, MIT). **`Math.random` banned by lint** — the
  hand-rolled xorshift used in the mocks is biased and must not ship.
- **Named streams** so map, waves and combat draw independently.
- **Fixed 20 Hz tick.** No frame delta reaches the simulation.
- Rendering reads the sim; it never writes to it.
- **Replay** = `{ version, seed, contentHash, inputs: [{tick, action}] }`.
  `contentHash` matters: a replay recorded against different content is not
  replayable and must say so rather than diverge silently.
- **Golden test:** seed + scripted inputs → 2,000 ticks → state hash.

## 7. Data layout

- **Enemies**: structure-of-arrays typed arrays; hundreds alive.
- **Towers**: plain objects; dozens, rich upgrade state.
- **Occupancy**: one `Uint16Array` over cells, cell → owner id.
- **Tiles**: small array of tile-def ids plus rotation.

Not a general ECS — entity kinds here are fixed and few.

## 8. Content pipeline

All content is JSON with a `$schema`, so editors validate while typing. Types
are generated from schemas (`json-schema-to-typescript`, MIT) and committed; CI
fails if regenerating produces a diff. `ajv` (MIT) validates at load. A content
linter flags what schemas cannot: non-monotonic upgrade costs, cost-to-power
outliers, orphaned art references, unreachable tech nodes.

Everything visual is reached through **one asset registry**. `view` never reads
an asset file directly.

## 9. Testing and QA

**Text snapshots are the backbone.** `GLTerm.toText()` renders screen state as
plain text, so golden files are git-diffable and a failing test shows the actual
screen in the PR diff. Strictly better than image comparison here.

| Layer | What | Where |
|---|---|---|
| Unit | RNG streams, flow field, connector matching, crosspath legality, stat pipeline | Vitest |
| Property | 10k generated boards: connectivity holds, no orphaned tiles | Vitest |
| Golden | seeded run → state hash | Vitest, CI gate |
| Text snapshot | rendered screens as diffable text | Vitest browser mode |
| Replay | recorded runs replay to identical state | Vitest |
| Content | schema validation, type drift, linter | CI |
| Balance | calibrated curves vs measured margin | harness, CI |
| Manual | does it feel good | Daniil |

**The renderer cannot be tested in Node** — no WebGL. Vitest 4 Browser Mode with
the Playwright provider runs real Chromium; Browser Mode is stable as of
Vitest 4.

## 10. CI/CD

**Exists today:** `pages.yml` only.

**Not built yet** — an earlier draft of this document described these as if they
existed, which was wrong:

- `ci.yml` — typecheck, lint, unit + golden + snapshot + replay, content validation
- `balance.yml` — `harness check`, fails on drift

Both land in M1 Phase 1, before any game code.

## 11. Verified environment

| | |
|---|---|
| Node / npm / git | v22.23.2 / 12.0.2 / 2.33.0 ✅ |
| `gh` | 2.97.0, fine-grained token scoped to this repo only ✅ |
| WebGL2 | ANGLE / D3D11, RTX 2060 ✅ |
| Build + Pages deploy | ✅ live |
| REXPaint | v1.70 present, custom-font pipeline verified compatible |

Environment traps are in [CONTRIBUTING.md](../CONTRIBUTING.md) — read them
before debugging anything.

---

## Sources

- [Red Blob Games — Flow Field Pathfinding for Tower Defense](https://www.redblobgames.com/pathfinding/tower-defense/)
- [Cogmind — ASCII particle effects](https://www.gridsagegames.com/blog/2014/03/particle-effects/)
- [Stone Story RPG — ASCII art tutorial](https://stonestoryrpg.com/ascii_tutorial.html)
- [xterm.js WebGL renderer](https://github.com/xtermjs/xterm.js/pull/1790)
- [spleen (BSD-2-Clause)](https://github.com/fcambus/spleen)
- [unscii (public domain)](https://github.com/viznut/unscii)
- [REXPaint](https://www.gridsagegames.com/rexpaint/) · [manual](https://www.gridsagegames.com/rexpaint/manual.txt)
