# ASCII Defense — Product Requirements

Status: **scoping complete, M1 not started.** Live: <https://argarot.github.io/ascii-defense/>

This document specifies *what the game is*. It deliberately names no glyph, no
colour and no pixel — those live in [ASSETS.md](ASSETS.md) and in data files.

---

## 1. What it is

A roguelite tower defense game in the browser. Everything — terrain, towers,
enemies, effects, menus — is drawn as characters on a grid.

**You build the map, then defend it.** Most of the board starts empty. Every few
waves you lay a terrain tile from a drafted hand, extending the road, opening
buildable ground, and pushing the enemy spawn further away. When you run out of
room to expand, the run is effectively over.

## 2. Design pillars

| Pillar | Means | Rules out |
|---|---|---|
| **You author the map** | Tile-laying is the core decision, not a side system | Procedurally generated levels you merely react to |
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
| **Ore** | yes | yes | Buildable; a Refinery here mines Ore |
| **Spawn** | yes | no | Enemy entry point |

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

Placement legality: every shared edge agrees (both road, or both not); a
connector may not face off the board — roads to nowhere are unrepresentable;
in-game, a tile must touch the existing landmass, and **a road-carrying tile
must join the existing road** (≥1 matched road edge), so the network stays one
component growing from the spawn. Roadless scenery tiles need only contact.

**Connectivity therefore holds by construction.** The game never validates that
a path exists, because a disconnected board cannot be built. This is the same
class of guarantee as "road is never buildable", and both are load-bearing.

### 4.3 Buildable density is unresolved

A full board is ~135 tiles × 25 cells = **~3,400 cells**. If most are ground,
that is roughly 2,000 tower slots — an order of magnitude more than a tower
defense wants. A TD is interesting at tens of towers, not thousands.

**This must be resolved before M1 Phase 4.** Options, not exclusive:

- Tiles carry far fewer ground cells — mostly road, rock and impassable scenery,
  with a handful of buildable spots each. This is the likeliest answer and is
  purely a content change to the tile library.
- Towers cost enough that Scrap, not space, is the binding constraint.
- A hard cap on simultaneous towers.

The first is preferred because it needs no new mechanic and makes tile choice
matter more: *"how many build spots does this tile give me"* becomes a reason to
pick one tile over another.

### 4.4 The board is the run length

Board size × waves-per-tile = run length. At 135 tile slots and one tile every
two waves, a full board is a ~270-wave run; a smaller board is a shorter run.

**Run length is tuned by resizing the board**, which is one number, rather than
by authoring content. Difficulty must rise such that a player who fills the
board is comprehensively unable to hold it.

## 5. Towers

### 5.1 Footprint

A tower occupies **exactly one cell** and never changes size. This kills, by
construction, every "can I fit this here" and "can I upgrade this" failure mode
we previously designed mitigations for.

### 5.2 Crosspathing

Three upgrade paths of five tiers. **One path may reach tier 5, a second tier 2,
the third stays at 0.** Eight towers plus that rule is a large build space.

Tiering changes the artwork within the cell — frame detail, accent colour,
brightness — never the footprint.

### 5.3 Families

M1 ships the first four. Target is **8 towers + Wall**, not 14.

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

**The Wall is unresolved and must be decided before M1 Phase 4.** It existed to
make mazing cost money — you spent Scrap to lengthen the enemy path. Tile-laying
replaced mazing entirely: the road now comes from tiles, and a wall on ground
blocks nothing. As specified it is a tower that does nothing.

Three options, in order of preference:

1. **Cut it.** Simplest. Mazing lives in tile placement now.
2. **Repurpose as a blocker for *flyers*** — a tall obstruction that forces
   flying enemies to divert. Gives the flying trait a counter it currently lacks.
3. **Repurpose as a cheap ground-denial piece** that occupies a cell so enemies
   with off-road behaviour cannot cross it. Only meaningful if such enemies exist.

## 6. Economy

**Scrap** funds the run. **Ore** is meta-only, banks at run's end, and buys tech
tree nodes. Ore is never spendable during a run.

The **Refinery** is the one two-path tower. Yield produces Scrap anywhere;
Extraction produces Ore but only on an ore cell. Site selection is therefore a
pre-commitment.

**Mining is balanced by opportunity cost alone.** No enemy hunts refineries, and
wave budgets are never reduced to compensate for mining. Compensating would
refund the cost that makes the decision matter.

> **The general rule:** the difficulty model offsets choices that increase
> combat power, and ignores choices that do not. Mining buys no combat power, so
> it is not offset. Lengthening the road does, so it is offset — sub-linearly.

Ore is stored **per tier** from day one, shipping with one tier active, so
richer ore later is content rather than a save migration.

## 7. Enemies

Start narrow: **two damage types** (Kinetic, Energy) and **five traits** —
`armoured`, `shielded`, `fast`, `flying`, `swarm`. Each trait poses a counter
question. Flyers ignore the road entirely and are the structural answer to
over-extending the path.

M1 ships six enemies across that matrix. Traits expand only once the small
matrix is proven; a 4×11 matrix is 44 interactions and is where balance bugs
breed.

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
| 1 | ~5 nodes: a tower, a starting relic, +1 draft option, Threat Level 2 | M3 |
| 2 | Full tree: five disciplines, alternate tier-5s, capped economy nodes | M4+ |
| 3 | Potency nodes — permanent stat increases | optional |

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
- **Sub-tile walls.** Rejected; tile-laying supplies mazing granularity instead.
- **Bypass / shortcut zones.** Superseded by tile-laying. The path is explicit
  from tiles rather than emergent from a cost field.
- **Growth-on-upgrade footprints.** Bought one visual moment for a whole class
  of failure modes.

## 14. Out of scope

Mobile/touch · multiplayer · sound · accounts or cloud saves · a terminal build.

## 15. Acceptance criteria

**M1 — the fun test.** Lay tiles, build and upgrade towers across waves on one
board, win or lose. Daniil plays it and says whether it is fun.

**M2 — a complete run.** Full board, escalating waves, drafts, Ore banking,
save/resume.

**M3 — trustworthy difficulty.** Calibrated curves; harness catches injected
regressions; no unwinnable or trivial seed across ≥500 runs. Tech tree stage 1.

**M4+ — expansion.** Effects system, towers 5–9, biomes, full art pass.
