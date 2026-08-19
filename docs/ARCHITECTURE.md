# ASCII Defense — Architecture

Status: **M1 Phase 4 in flight; see docs/WBS.md for live state.**

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

## 12. Map generation — the specification (WBS 2.27, agreed 2026-08-19)

The generator is built against THIS section, not against playtest patches.
Every rule below is checked in one place — `engine/src/mapgen/verify.ts`
(`verifyMap`) — in tests today, and at the end of generation once the
constraint-first rebuild (2.27 PRs 2–3) lands. A rule that is not in this
section and not in `verifyMap` is not a rule.

### Hierarchy

Rules live in tiers. **A lower tier always wins a conflict**, and a higher
tier is satisfied by **rearrangement** — entries may move, appear and
disappear during generation; basics, specials and the Core may all be
rearranged — never by silently changing a knob, and never by
retry-until-lucky ladders that relax the target (removed 2026-08-19; they
were an implementation invention, not a rule).

Units are stated per rule: **slots** are tile positions on the board;
**cells** are the `TILE_SIZE`-per-side grid inside them — the thing enemies
actually walk.

### Tier 0 — definitional

- **Determinism.** Same seed + threat + loadout → the same map, bit-exact.
  All map randomness is spent on the map stream at generation; nothing about
  the map rolls dice mid-run. Whole-map retries advance the same stream, so
  a seed still names exactly one map.
- **One Core**, within 1 slot of the board center on each axis.
- **The pool is basics plus the chosen loadout, nothing else.** Two owners:
  the caller builds each run's library as shipped basics + the selected
  specials (an unloaded special is not in the library at all); the generator
  excludes loaded specials from every random pool (they appear because
  chosen). A special appears **exactly once**, in its authored shape
  (rotation allowed, cells never redrawn); its authored overlays (deposits,
  boons) are law on its cells — **authored ore is the only guaranteed ore**.
  An impossible loadout fails with a sentence, never silently.
- **Every carved shape has a tile.** No carve move — tunnels *and* anchor
  joints — may produce a slot shape the pool cannot express.

### Tier 1 — topology

- **All roads lead somewhere.** Every road cell lies on a route between an
  entry and the Core (no dead-end spurs; validity rule 2.26 at tile level,
  the same property at board level).
- **The road is a tree.** Exactly one route from each entry to the Core, no
  loops — loops are bloat the enemies ignore (Daniil, playtest 15). Road
  specials anchor: one arm per separate road on the tile joins the tree,
  every other arm exits the board as a new entry.
- **Path length is denominated in road CELLS, per entry, as a minimum.**
  Every entry's realized route to the Core is at least the threat's cell
  target, clamped to what the board can hold. Conversion at carve time uses
  the *minimum* cells any pool tile expresses for the shape, so the floor
  holds by construction; overshoot is legal (longer = easier). The target is
  never relaxed by retries. **The floor binds ALL entries, anchor-grown
  included** (Daniil, 2026-08-19): an entry arm measures its route's deficit
  against the existing tree and wanders until it has earned it — a loaded
  special never hands the player a lane shorter than the threat promises.
- Entry count may grow beyond the threat's roll to host anchors; entries are
  distinct road cells on the board border.

### Tier 2 — terrain

- **Void only farther than `ORE_REACH` (3) slots from the road.** Enclosed
  void is legal when it satisfies this and the share rule (the former
  no-enclosed-void repair pass was removed by Daniil's call, 2026-08-19 —
  it was never his rule).
- **Void share follows a probability curve, not a hard cap**: a target share
  is drawn from a heavily-low-biased curve on the map stream; the emergent
  void is trimmed (nearest-to-land first) down to the target. Shares beyond
  ~22% are vanishingly rare by the curve's shape. The drawn target rides the
  map so `verifyMap` can check against it.
- **All land within `ORE_REACH` of the road fills** — a slot at road
  distance 1..3 always carries a tile.
- **Ore is a bias, not a guarantee** (Daniil, 2026-08-19: floor removed).
  Fill odds lean heavily toward some ore per map; a rare ore-less map is
  legal. The only guaranteed ore is authored ore on a chosen special
  (Tier 0).

### Tier 3 — dressing

- **Boons only on buildable ground cells** — dealt *and authored*: the
  content validator and the Tile Smith refuse an authored boon on a
  non-ground cell (regression fixture: playtest 16's boon-on-void).
- **Caches on any ground cell, uniformly** — no distance shaping (Daniil,
  2026-08-19).
- Every ore cell carries a finite vein dealt at generation; when the relic
  layer is on, every rock cell's hidden contents are dealt at generation.
- Placement *preferences* (sector spread, walk eagerness, boon-near-road)
  are free implementation space, not rules.

### Identity

- Within one generator version, **the seed is law** (Tier 0 determinism).
- **The run save stores the generated map itself**, not just the seed —
  resume loads the map and never re-generates, so saves survive generator
  changes (guarded by content hash).
- The shareable **run code** is compact — seed + threat + loadout + a
  generator-version stamp — and a stale code is refused with a sentence,
  never silently regenerated into a different map.

### Parameterization

- Generation takes board dimensions in slots and `TILE_SIZE` as parameters;
  no constant in generation assumes 12×7 boards or 5×5 tiles. The app owns
  one shared board-dimension constant (derivable from resolution later).
- **`TILE_SIZE` must be odd** — roads cross tile borders at edge centers
  (the center-or-nothing connector rule), and an even tile has no center
  cell. This is a property of the design; document it, never work around it.

### Lifecycle (the worker half of 2.27)

- `init` yields exactly one of `ready` or `genError` — never silence. Every
  throw inside `newRun` is caught; no state from a failed init may serve a
  later frame.
- The main thread enters `playing` only on `ready`, not on send
  (regression fixtures: playtest 16's phantom resume and dropped bridge
  specials).

---

## Sources

- [Red Blob Games — Flow Field Pathfinding for Tower Defense](https://www.redblobgames.com/pathfinding/tower-defense/)
- [Cogmind — ASCII particle effects](https://www.gridsagegames.com/blog/2014/03/particle-effects/)
- [Stone Story RPG — ASCII art tutorial](https://stonestoryrpg.com/ascii_tutorial.html)
- [xterm.js WebGL renderer](https://github.com/xtermjs/xterm.js/pull/1790)
- [spleen (BSD-2-Clause)](https://github.com/fcambus/spleen)
- [unscii (public domain)](https://github.com/viznut/unscii)
- [REXPaint](https://www.gridsagegames.com/rexpaint/) · [manual](https://www.gridsagegames.com/rexpaint/manual.txt)
