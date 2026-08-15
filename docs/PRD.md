# ASCII Defense — Product Requirements

Status: **scoping complete, M1 not started.** Live: <https://argarot.github.io/ascii-defense/>

This document specifies *what the game is*. It deliberately names no glyph, no
colour and no pixel — those live in [ASSETS.md](ASSETS.md) and in data files.

---

## 1. What it is

A roguelite tower defense game in the browser. Everything — terrain, towers,
enemies, effects, menus — is drawn as characters on a grid.

**The game generates the battlefield; you defend the Core.** At run start the
map is assembled from terrain tiles: the Core near the middle, roads winding
from the board edges to it, terrain and ore filling the rest. Every open road
end is an entry — enemies march from all of them toward the Core. Map shape is
the difficulty dial (§4.4), and the tile pool itself is meta progression: you
unlock richer terrain tiles between runs, and eventually author your own
(§10). *(Pivoted 2026-08-15 from player tile-laying — see §13.)*

## 2. Design pillars

| Pillar | Means | Rules out |
|---|---|---|
| **The map is the difficulty dial** | Entries, path length and terrain mix are the knobs the game turns; the tile pool is meta progression the player curates and eventually authors | Hand-designed fixed levels; player tile-laying mid-run |
| **Invalid states are unrepresentable** | Connector matching guarantees a connected road; road cells are never buildable | Runtime "is this still solvable?" checks |
| **Every placement is a build decision** | Deep evolution trees with a hard crosspathing limit | "Buy the best tower, spam it" |
| **Every run is reproducible** | A run is a seed plus an input log | Non-deterministic simulation |
| **Content is data** | Terrain, towers, enemies, upgrades, fonts and art are all JSON | Adding a tower requiring engine changes |
| **Swappable presentation** | The simulation knows no glyphs, colours or pixels | Any engine code that branches on appearance |

## 3. The three-level grid

Fixed nomenclature, used everywhere in code and docs:

| Level | Size | Role |
|---|---|---|
| **Glyph** | 1 character (5×8 px) | Smallest drawable unit |
| **Cell** | 5×3 glyphs (25×24 px) | **The placement unit.** One tower occupies exactly one cell |
| **Terrain tile** | 5×5 cells (125×120 px) | The Carcassonne piece the player lays |

A 1920×1200 display holds roughly **15×9 = 135 tiles**, or ~3,400 cells.

Cells and tiles are square within 4%. Glyphs are **not** square (5×8), so art is
authored in glyph grids and the aspect is absorbed by the cell shape.

## 4. The map

### 4.1 Cell types

| Type | Pathable | Buildable | Notes |
|---|---|---|---|
| **Road** | yes | **never** | The route. Never buildable, ever. |
| **Ground** | yes | yes | Where towers go |
| **Rock** | no | no | Blocked |
| **Ore** | yes | yes | Buildable; a Refinery here mines Ore. Generation places ore richer the farther from the road — reach vs. greed |
| **Core** | yes | no | The Core's own cells, center of its tile. What enemies march toward |

*(The former Spawn cell type is gone: entries are **derived** — an open road
end at the board edge is a spawn point, the same philosophy as derived
connectors. Nothing declares a spawn; the map's shape simply has them.)*

### 4.2 Tiles and connectors

Each terrain tile is a 5×5 grid of cell types. **Edge connectors are derived
from the grid, never declared**: a road may cross a tile edge **only at that
edge's center cell** — the center-or-nothing rule. So "does this edge carry
road" is a boolean, matching is boolean equality, and inside the tile the road
shape is arbitrary, Carcassonne-style. A declared connector cannot disagree
with the drawn cells because there is no declared connector.

Tile validity (enforced by one engine function, shared by the game, the
content CI and the authoring tool): roads touch edges only at centers; all
road/spawn cells form one connected group; a road that exists reaches at least
one edge; spawns are interior cells.

Assembly legality: every interior shared edge agrees (both road, or both not);
a road may cross the **board** edge only where generation routed an entry —
those crossings are the spawn points. The road network is one component
containing the Core, because generation carves paths outward from the Core and
tiles them; roadless terrain fills the rest.

**Connectivity therefore holds by construction.** The game never validates that
a path exists, because a disconnected map cannot be assembled. This is the same
class of guarantee as "road is never buildable", and both are load-bearing.

### 4.3 Map generation

At run start, seeded from the run seed (stream `map`):

1. The **Core tile** is placed near the board center.
2. **Paths are carved** from the Core to the board edge — `entries` of them,
   winding until each reaches `targetPathLength` before it may exit. Where a
   path leaves the board is an entry.
3. Each road slot becomes a tile whose **connector signature** matches the
   carved topology, drawn from the unlocked tile pool.
4. Remaining slots fill with roadless terrain from the pool; **ore likelihood
   rises with distance from the road**.

The generator only produces maps; it never checks them. Whether a map is
*interesting* is a content question (which tiles are in the pool) and a knob
question (§4.4), not a validity question.

### 4.4 Map parameters are the difficulty dial

Difficulty is shaped by the generator's knobs, not by authoring levels:

- **More entries → harder.** Each entry is a front; attention and coverage
  divide.
- **Longer paths → easier.** More time on the road is more time under fire.
  The difficulty model already offsets road length sub-linearly (§8's `L`).
- **Terrain mix** — buildable ground near the road, ore far from it, rock in
  the way — tunes how comfortable a map is, and comes from the tile pool.

Buildable density (formerly open question D1) is resolved by the same knobs:
the generator decides how much ground exists and where, so "tens of towers,
not thousands" is a generation target, tuned as data.

### 4.5 The Core

The Core is a special tile placed near the board center; its center cells are
Core cells; roads attach to its connectors. Mechanically:

- **The Core has health.** Each enemy that reaches it deals its `damage`
  parameter — bigger and later-wave enemies carry bigger numbers. Health can
  be restored or increased during a run (mechanisms deliberately open).
  Health reaching zero ends the run.
- **The Core is itself a tower** — with its own progression tree, unusually
  broad at the root: branches like gunner, mortar, slow-field, **miner**. On
  choosing a branch the others lock for the run, so the choice is a build
  identity, not a shopping list.
- **Core upgrades are paid in the cheapest meta-currency tier (Ore t1), never
  Scrap** — the Core does not compete with towers for the run economy; it
  competes with the tech tree for your banked Ore. *(Consequence, recorded:
  Ore mined in-run and spent on the Core buys combat power, so §6's "mining
  is not offset" rule gains an explicit exception — the calibration model
  must account for Core investment. Accepted 2026-08-15.)*

## 5. Towers

### 5.1 Footprint

A tower occupies **exactly one cell** and never changes size. This kills, by
construction, every "can I fit this here" and "can I upgrade this" failure mode
we previously designed mitigations for.

### 5.2 Upgrade tiers (replaced crosspathing, 2026-08-15)

**Three tiers per tower; each tier is an either/or choice; a committed choice
is final and locks out its sibling; tiers unlock in order.** 2+4+8 = 14
distinct versions per tower, each visually distinct rather than a number.
*(Replaced the 5/2/0 crosspathing model, which suited slot-scarce TDs; with
generated maps, build depth comes from which towers and which forks, and the
either/or fork is directly renderable as a tree - Daniil's call.)*

Tiering changes the artwork within the cell - frame detail, accent colour,
brightness - never the footprint. The Core follows the same tier structure
after its type choice (sec 4.5).

### 5.3 Families

M1 ships the first four. Target is **8 towers + the Core**, not 14.

| Tower | Role | Path A | Path B | Path C | Milestone |
|---|---|---|---|---|---|
| Bolt Turret | cheap single target | Velocity | Caliber | Optics | M1 |
| Mortar | AoE, minimum range | Payload | Cadence | Ordnance | M1 |
| Frost Emitter | slow aura | Chill | Shatter | Field | M1 |
| Refinery | economy (§6) | Yield | Extraction | — | M1 |
| ~~Wall~~ | **UNRESOLVED — see below** | — | — | — | — |
| Acid Sprayer | DoT, armour shred | Corrosion | Volatility | Saturation | M4 |
| Arc Coil | chain lightning | Conductivity | Overcharge | Capacitor | M4 |
| Bastion | buff aura | Command | Logistics | Fortify | M4 |
| Rail Lance | long-range line pierce | Focus | Penetration | Overwatch | M4 |

**The Wall is CUT** *(resolved 2026-08-15, formerly decision D2)*. Its original
job (paid mazing) died with player tile-laying; its fallback job (flyer
blocker) died with flyers (§7); ground denial is meaningless when no enemy
leaves the road. A tower with no job is not content, it is clutter.

**The Core is the fifth M1 "tower"** — see §4.5. Its branch tree (gunner /
mortar / slow-field / miner, one branch locks the rest) is authored as tower
content in the same format; what makes it special is its funding (Ore, not
Scrap) and that it is placed by the generator, not the player.

## 6. Economy

**Scrap** funds the run. **Ore** banks at run's end and buys tech tree nodes.
The one in-run Ore sink is the **Core** (§4.5) — towers are Scrap, the Core is
Ore, so they never compete for the same pool.

The **Refinery** is the one two-path tower. Yield produces Scrap anywhere;
Extraction produces Ore but only on an ore cell. Site selection is therefore a
pre-commitment.

**Mining is balanced by opportunity cost alone.** No enemy hunts refineries, and
wave budgets are never reduced to compensate for mining. Compensating would
refund the cost that makes the decision matter.

> **The general rule:** the difficulty model offsets choices that increase
> combat power, and ignores choices that do not. Longer roads increase power
> (more time under fire), so `L` is offset — sub-linearly. **Known exception:**
> Ore routed into the Core buys combat power; calibration must model some
> Core investment rather than pretending mining is inert (§4.5, accepted
> 2026-08-15).

Ore is stored **per tier** from day one, shipping with one tier active, so
richer ore later is content rather than a save migration.

## 7. Enemies

Start narrow: **two damage types** (Kinetic, Energy) and **four traits** —
`armoured`, `shielded`, `fast`, `swarm`. Each trait poses a counter question.
Every enemy carries a **`damage` parameter** — what it costs the Core's health
on a breach — scaling with size and wave number.

**Flyers are cut** *(Daniil, 2026-08-15)*: their structural job (punishing
over-extension) vanished with player tile-laying, and nobody here likes them.
All enemies follow the road; there is exactly one flow field.

M1 ships six enemies across that matrix. Traits expand only once the small
matrix is proven; a wide matrix is where balance bugs breed.

## 8. Difficulty: calibrated, not derived

Wave budgets are **measured, not computed**. An earlier draft derived achievable
DPS analytically from Scrap earned; that was dishonest, because one maxed tower
and ten cheap ones represent the same spend and wildly different defense.

```
1. Analytic prior    a rough starting curve, used as an initial guess and an
                     outlier alarm only
2. Bot calibration   the bot plays N seeds against candidate budgets; record
                     clear margin, lives lost, leak %, time-to-kill
3. Solve             pick the curve putting the reference policy at target margin
4. Human offset      a measured constant between bot and real play, from
                     recorded replays
5. Freeze            the curve ships as data in content/balance/
6. Guard             the harness re-runs on every change; drift fails CI
```

Two live inputs remain: **`L`**, effective road length in cells, offsetting
sub-linearly as `(L/L_base)^p` with `p ≈ 0.5` — at `p = 0` extending the road is
dominant, at `p = 1` it is pointless; and **`M`**, `metaPowerIndex`, summarising
permanent tech-tree power, near 1.0 until stat nodes exist.

`k(w)`, the pressure curve, is the one hand-authored difficulty knob.

## 9. The bot

**One** policy, framed honestly as a **regression detector** — "did this change
make wave 14 harder?" is answerable with confidence and is most of the value.
Absolute difficulty comes from a human offset measured against real replays. An
in-game autopilot falls out for free.

## 10. Meta progression

Ore buys a tech tree, staged and gated behind the core loop being fun.

| Stage | Grants | When |
|---|---|---|
| 1 | ~5 nodes: a tower, a starting relic, **+1 terrain tile unlock**, Threat Level 2 | M3 |
| 2 | Full tree: five disciplines, alternate tier-5s, capped economy nodes, **terrain tile pool expansion** | M4+ |
| 3 | Potency nodes — permanent stat increases | optional |

**Map authorship lives here.** Unlocking terrain tiles enriches what the
generator can build — the player curates the world their runs happen in. The
endgame of that arc: once every pre-made tile is unlocked, **Tile Smith opens
in-game** — after a run, spend meta-currency to author your own tile (the
same tool, the same engine legality, already built) and add it to the pool.
The "you author the map" identity from the original design survives, one
level up. *(Daniil, 2026-08-15.)*

Stage 3 makes `metaPowerIndex` a real variable, at which point the harness must
validate `seeds × meta tiers`. That multiplies CI time for every balance change,
which is why it is last and optional.

## 11. Determinism and replays

A run is a **seed plus an input log** — kilobytes. That buys shareable replays,
daily challenges, bug reports as files, and a regression corpus of real play.
The fixed 20 Hz tick and seeded RNG are already paid for; this is what they buy.

## 12. Presentation

Specified in [ASSETS.md](ASSETS.md). Settled: **spleen 5×8** (BSD-2-Clause), a
5×3-glyph cell, 24-bit colour per glyph, WebGL2 rendering, and art authored in
REXPaint against a generated spleen font.

**Effects — projectiles, impacts, explosions, tower animation — ship after M1**,
following Cogmind's model: hot-reloadable definition files, templated recolour
variants, duration scaled by importance. The **subcell coordinate system they
need ships in M1**, because retrofitting it would mean rewriting movement,
collision and rendering.

## 13. Deliberately rejected

Recorded so they are not re-proposed:

- **Pseudo-3D / tilted projection.** Occlusion hides the board, which is fatal
  for a TD; it fights the mostly-void expanding board; it doubles the art and
  adds a projection layer. Depth comes from shading instead.
- **Hex tiles.** Workable logically, but diagonal edges step badly at this
  scale, REXPaint canvases are rectangular, and rectangular sprites sit badly in
  hexes. Square wins on art-pipeline cost.
- **Block elements as the main visual tool.** Rejected on taste; also moot,
  since spleen has none.
- **CP437 / Dwarf Fortress idiom.** Rejected on aesthetics.
- **Sub-tile walls.** Rejected; tile granularity supplies the mazing detail.
- **Bypass / shortcut zones.** Superseded by tiles. The path is explicit
  from tiles rather than emergent from a cost field.
- **Growth-on-upgrade footprints.** Bought one visual moment for a whole class
  of failure modes.
- **Player tile-laying during the run** *(2026-08-15)*. Was pillar #1; cut
  because it converged on being an ASCII Tower Dominion. The tile system it
  produced (derived connectors, legality, Tile Smith) survives wholesale in
  the map generator and in meta progression (§10) — the *mechanic* was cut,
  not the machinery. If reconsidered, that machinery makes it a content
  change, not a rewrite.
- **Flyers** *(2026-08-15)*. Their structural job (punishing over-extension)
  died with tile-laying, and Daniil hates them. One flow field, all enemies
  on the road.
- **The Wall** *(2026-08-15, was D2)*. Every candidate job died: paid mazing
  (no player laying), flyer blocking (no flyers), ground denial (no off-road
  enemies).

## 14. Out of scope

Mobile/touch · multiplayer · sound · accounts or cloud saves · a terminal build.

## 15. Acceptance criteria

**M1 — the fun test.** A generated map; build and upgrade towers across waves;
defend the Core; win or lose. Daniil plays it and says whether it is fun.

**M2 — a complete run.** Full difficulty arc, escalating waves, Core branches,
Ore banking, save/resume.

**M3 — trustworthy difficulty.** Calibrated curves; harness catches injected
regressions; no unwinnable or trivial seed across ≥500 runs. Tech tree stage 1.

**M4+ — expansion.** Effects system, towers 5–9, biomes, full art pass.
