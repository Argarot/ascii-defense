# ASCII Defense — Product Requirements

Status: **M1 in flight - Phases 1 & 3 done, Phase 4 nearly done (Refinery/Ore and
replay remain); Phase 6, the relic layer (§7), added 2026-08-16.** Live:
<https://argarot.github.io/ascii-defense/>

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
(§11). *(Pivoted 2026-08-15 from player tile-laying — see §14.)*

## 2. Design pillars

| Pillar | Means | Rules out |
|---|---|---|
| **The map is the difficulty dial** | Entries, path length and terrain mix are the knobs the game turns; the tile pool is meta progression the player curates and eventually authors | Hand-designed fixed levels; player tile-laying mid-run |
| **Invalid states are unrepresentable** | Connector matching guarantees a connected road; road cells are never buildable | Runtime "is this still solvable?" checks |
| **Every placement is a build decision** | Three either/or tiers per tower; a committed choice locks its sibling for the run (§5.2) | "Buy the best tower, spam it" |
| **Planned power is strict so found power can break it** | Tower trees are symmetric and predictable; relics (§7) are rule-breakers acquired mid-run, and the collision of the two is where a run becomes a story | A tower defense with a seed; balanced-but-forgettable runs |
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

| Type | On the route | Buildable | Notes |
|---|---|---|---|
| **Road** | yes | **never** | The route. Never buildable, ever. |
| **Ground** | no | yes | Where towers go |
| **Rock** | no | no | Blocked. May hide ore or a cache (§4.6) |
| **Ore** | no | yes | Buildable; a Refinery here mines Ore. Generation places ore richer the farther from the road — reach vs. greed |
| **Core** | yes | no | The Core's own cells, center of its tile. What enemies march toward |

**"On the route" means enemies walk it.** Only Road and Core are — the flow
field is a BFS over exactly those two (`isRouteCell`). Ground and Ore are
*open* terrain, not *walkable* terrain: nothing ever leaves the road, because
flyers are cut (§8) and no enemy pathfinds. This matters for §4.6: opening a
rock cell can never create a shortcut, because the thing it opens into was
never part of the route to begin with.

*(Corrected 2026-08-16. The table previously marked Ground and Ore pathable —
a leftover from the pre-pivot design, contradicted by the engine since the
flow field shipped. A dead `isPathable()` helper encoding the same error was
deleted in the same change. It had already misled one fresh context into
hedging about shortcut risk, which is exactly the cost of a stale doc.)*

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
5. **Caches are scattered** as an overlay (§4.6) — a list of cells, not a cell
   type, so the tile library is untouched.
6. **Every rock cell is dealt its hidden contents** — ore, a cache, or nothing
   — at generation time (§4.6).

**Generation guarantees**, in the same family as connectivity-by-construction:
at least *N* buildable ore cells exist within reach of the road, and at least
*M* caches are placed. A map cannot generate without an economy. These are
knobs, but they are floors, not averages — an ore-starved map is not a
difficulty variation, it is a broken run.

The generator only produces maps; it never checks them. Whether a map is
*interesting* is a content question (which tiles are in the pool) and a knob
question (§4.4), not a validity question.

### 4.4 Map parameters are the difficulty dial

Difficulty is shaped by the generator's knobs, not by authoring levels:

- **More entries → harder.** Each entry is a front; attention and coverage
  divide.
- **Longer paths → easier.** More time on the road is more time under fire.
  The difficulty model already offsets road length sub-linearly (§9's `L`).
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
- **The Core is the vessel, not a tower.** It has no progression tree of its
  own. It *holds the relics* you acquire during the run (§7), and its panel is
  where their actives are fired and their consumables spent. The thing you
  defend is literally the thing your power accumulates in.
- **The Core spends Ore, never Scrap** — it does not compete with towers for
  the run economy; it competes with the tech tree for your banked Ore. Its one
  purchase is relics (§7.3). *(Consequence, recorded: Ore mined in-run and
  spent at the Core buys combat power, so §6's "mining is not offset" rule
  gains an explicit exception — the calibration model must account for it.
  Accepted 2026-08-15.)*

*(Rewritten 2026-08-16. The Core was previously specified as a fifth tower with
a broad branch tree — gunner / mortar / slow-field / miner — one branch locking
the rest. **Cut before implementation**, on Daniil's call, for a reason worth
keeping: a handful of symmetric, individually-balanced purchases cannot produce
the build-breaking power spike that makes a roguelite a roguelite. Four buys
that each add a percentage have nothing to combine. See §7 for what replaced
it, and §14 for the full rejection.)*

### 4.6 Caches and prospecting — the map as a source of power

Two ways the board itself hands you relics, both resolved at **generation
time** so nothing rolls dice mid-run.

**Caches** are an overlay: a list of cells the generator marks, each already
holding a specific relic. Generation places them away from the road, so the
cell they occupy is usually a cell you would have wanted for a tower — the same
greed-versus-safety trade as ore.

A cache is **claimed by selecting it and paying**, not by building on it. (The
obvious alternative — build a tower on it to claim it — is not a cost at all:
you sell the tower back immediately afterwards. Daniil, 2026-08-16.) Selecting
a cache replaces the build palette in the HUD with a claim card: one price, one
button.

**Prospecting** applies the same idea to rock. Every rock cell is dealt hidden
contents at generation — ore, a cache, or nothing — and prospecting *reveals*
what was always there. Selecting a rock cell opens a small card offering
**Prospect** for Scrap; on completion the rock becomes an ore cell, yields a
cache, or is simply cleared to ground.

Three consequences, all deliberate:

- **No runtime randomness.** Contents are part of the generated map, so the
  seed still describes the run completely (§12) and replays stay exact.
- **The "chance of finding something" is a generation knob**, which makes it a
  difficulty dial (§4.4) rather than a slot machine.
- **Opening rock is always safe.** Rock becomes ground or ore, neither of which
  is on the route (§4.1), so no shortcut can ever be opened and the flow field
  is untouched. Prospecting only ever *adds* buildable land.

Prospecting needs no dedicated tower — it is an interaction with the cell, and
the Refinery's tree gates whether it is available at all (§5.3).

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
brightness - never the footprint. The Core has no tier tree (§4.5).

**The 14 variants are an art ceiling, and that ceiling is a design
constraint.** A tower has 5×3 glyphs to say what it is and which of 14 forms it
took. Anything that produces a tower state *outside* those 14 has no possible
visual, and a state the player cannot see is a bug wearing a feature's clothes.
This is why no relic may combine both options of a tier (§7.2, §14).

### 5.3 Families

M1 ships the first four. Target is **8 towers + the Core**, not 14.

| Tower | Role | Path A | Path B | Path C | Milestone |
|---|---|---|---|---|---|
| Bolt Turret | cheap single target | Velocity | Caliber | Optics | M1 |
| Mortar | AoE, minimum range | Payload | Cadence | Ordnance | M1 |
| Frost Emitter | slow aura | Chill | Shatter | Field | M1 |
| Refinery | economy (§6) | Extraction | Survey | — | M1 |
| ~~Wall~~ | **UNRESOLVED — see below** | — | — | — | — |
| Acid Sprayer | DoT, armour shred | Corrosion | Volatility | Saturation | M4 |
| Arc Coil | chain lightning | Conductivity | Overcharge | Capacitor | M4 |
| Bastion | buff aura | Command | Logistics | Fortify | M4 |
| Rail Lance | long-range line pierce | Focus | Penetration | Overwatch | M4 |

**The Wall is CUT** *(resolved 2026-08-15, formerly decision D2)*. Its original
job (paid mazing) died with player tile-laying; its fallback job (flyer
blocker) died with flyers (§8); ground denial is meaningless when no enemy
leaves the road. A tower with no job is not content, it is clutter.

**The Core is not a tower** — see §4.5. M1 ships four towers and the relic
layer, not five towers.

**The Refinery's tree is about where you may mine, not how fast.** It produces
Ore, and only on an ore cell — mining Scrap is not a thing a Refinery does
(Daniil, 2026-08-16; this replaced an earlier Yield path that produced Scrap
anywhere, which made site selection meaningless). Its two paths sell reach
rather than rate: **Extraction** deepens output on the vein, **Survey** unlocks
prospecting (§4.6) so the Refinery is how you *find* veins as well as work
them. Mining Scrap off-vein survives only as a relic (§7.4) — a rule that gets
broken, not a rule that ships broken.

## 6. Economy

**Scrap** funds the run: towers, tiers, cache claims and prospecting. **Ore**
buys relics at the Core (§7.3) and banks at run's end for tech tree nodes.
Towers are Scrap, the Core is Ore, so they never compete for the same pool.

The **Refinery** produces Ore, and only standing on an ore cell (§5.3). There
is no way to mine Scrap by default — Scrap comes from kills. Site selection is
therefore a pre-commitment, and an ore cell you refine is an ore cell you are
not defending from.

**Ore's real tension is not what it buys but when.** Ore spent on relics during
a run is Ore not banked toward the tech tree afterwards: survive now, or be
permanently stronger later. That trade would carry the currency even if every
relic were dull.

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

## 7. Relics — the found power

*(Added 2026-08-16. This is the layer that makes the game a roguelite rather
than a tower defense with a seed.)*

### 7.1 Why the game needs them

Tower trees are **planned power**: strict, symmetric, Scrap-funded, the same
every run. That is the right spine, and it is not what anyone remembers. What
people come back to a roguelite for is the run where two unrelated things
multiplied and they became absurd.

Two conditions produce that feeling, and both were missing:

- **Volume × interaction.** Four balanced purchases per run cannot combine.
  Roughly **6–10 acquisitions a run** is the floor at which combinations start
  happening at all. (Reference points: Vampire Survivors ~10, Slay the Spire
  ~15 relics.)
- **Rule-breaking, not number-breaking.** `+15% damage` is never a story.
  *"Overkill damage carries to the next enemy in line"* is, because it changes
  what the game **is**, and it multiplies with things nobody hand-paired.

Relics supply both. The tower tree's strictness is what makes them land: a rule
only feels broken if it was iron first.

### 7.2 What a relic is

A relic is a **rule modifier, authored as data**, held by the Core (§4.5), and
**run-local** — it lasts the run and is gone. Three kinds, all in the schema
from day one even where M1 ships few of a kind:

| Kind | Behaviour |
|---|---|
| **passive** | always-on modifier; the default and the majority |
| **active** | a global ability on a long cooldown, fired from the Core panel — the orbital-strike shape |
| **consumable** | single use, then spent |

**The authoring constraint** (§5.2): *no relic may create a tower state without
a distinct visual.* The tower art budget is 5×3 glyphs across 14 defined
variants; a relic that lets a tower hold **both** options of a tier invents a
15th–28th state that cannot be drawn. Cut, permanently (§14). Relics may change
what towers *do* — freely — but never which of the 14 forms they are.

### 7.3 Where relics come from

Three channels, each with a job the others cannot do. Build order is the order
listed — each is independently shippable and useful alone.

| | Channel | Its job | Cost to build |
|---|---|---|---|
| **B** | **Wave-clear offer** — every *N* waves, three relics, pick one | Guarantees the cadence. The only channel you can count on, so it alone makes combinations reliable | a panel |
| **C** | **Ore purchase at the Core** — draw a relic, or reroll the offer | Gives Ore an in-run sink and creates the spend-now-versus-bank tension (§6) | reuses the HUD card |
| **A** | **Map caches** — claimed by selecting the cell and paying (§4.6) | Makes *this* map's shape decide what is on offer; greed versus safety | mapgen overlay + claim card |

Target cadence: **~6 from offers** (one every 3 waves, decided 2026-08-16),
**~3 from caches**, **~2–3 bought** over a 20-wave run. Fewer than that and the
layer does not fire.

M1 ships the pool **flat** — every relic equally likely. The schema carries a
`rarity` field from the first commit and ignores it, because weighting a pool
before anyone has played with it is guessing, and the reserved field makes it a
data change rather than a migration.

### 7.4 The M1 set

~20 relics, weighted toward passives. Each breaks a rule rather than moving a
number:

| Relic | Kind | The rule it breaks |
|---|---|---|
| **Overflow** | passive | overkill damage carries to the next enemy on the path |
| **Frostbite** | passive | slowed enemies take +50% from everything — Frost stops being a utility tower |
| **Tithe** | passive | every kill refunds Scrap; compounds with fire-rate builds |
| **Splinter** | passive | mortar explosions trigger twice |
| **Vein Tap** | passive | you may build on rock |
| **Loadbearing** | passive | towers adjacent to the Core get greatly extended range |
| **Foundry** | consumable | a Refinery off the vein produces Scrap — the §5.3 rule, broken by an item rather than shipped as a path |
| **Deep Vein** | active | refineries produce at a huge multiple for a short window |
| **Orbital** | active | massive damage anywhere on the board, long cooldown |
| **Stasis** | active | the whole board freezes briefly — the get-out-of-jail card |

Balance intent: relics are **allowed to be unfair**. A run that trivialises
because three of them stacked is the product working. See §9 for what that does
to calibration.

### 7.5 Meta progression owns the pool, not the power

Relics never persist between runs (permanent relics would flatten the tech
tree's job). What the tech tree grants is **which relics can appear at all** —
the pool is a content list filtered by an unlocked set, everything unlocked in
M1 (§11). This is the standard roguelite unlock model, and it is nearly free:
one filter, no new system.

## 8. Enemies

Start narrow: **two damage types** (Kinetic, Energy) and **four traits** —
`armoured`, `shielded`, `fast`, `swarm`. Each trait poses a counter question.
Every enemy carries a **`damage` parameter** — what it costs the Core's health
on a breach — scaling with size and wave number.

**Flyers are cut** *(Daniil, 2026-08-15)*: their structural job (punishing
over-extension) vanished with player tile-laying, and nobody here likes them.
All enemies follow the road; there is exactly one flow field.

M1 ships six enemies across that matrix. Traits expand only once the small
matrix is proven; a wide matrix is where balance bugs breed.

## 9. Difficulty: calibrated, not derived

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

**Relics make run power a distribution, not a number** *(added 2026-08-16)*.
Everything above assumes the bot plays a fixed system; §7 makes each run's
ceiling depend on what was acquired and what happened to combine. Two
consequences, both accepted deliberately:

- Calibration targets a **distribution**, not a point: the curve must put the
  reference policy at target margin across a *spread* of relic draws, not in
  the average case. The bot's relic picks are part of its policy.
- **A trivialised run is not automatically a bug.** *Trivial-by-relic is the
  feature; trivial-by-map is the defect.* M3's "no trivial seed across ≥500
  runs" criterion (§16) is therefore measured with the relic layer held fixed —
  otherwise the harness will spend its life reporting the game working.

## 10. The bot

**One** policy, framed honestly as a **regression detector** — "did this change
make wave 14 harder?" is answerable with confidence and is most of the value.
Absolute difficulty comes from a human offset measured against real replays. An
in-game autopilot falls out for free.

## 11. Meta progression

Ore buys a tech tree, staged and gated behind the core loop being fun.

| Stage | Grants | When |
|---|---|---|
| 1 | ~5 nodes: a tower, a starting relic, **+1 terrain tile unlock**, **+relic pool unlocks**, Threat Level 2 | M3 |
| 2 | Full tree: five disciplines, alternate tier-5s, capped economy nodes, **terrain tile pool expansion**, **the bulk of the relic pool** | M4+ |
| 3 | Potency nodes — permanent stat increases | optional |

**The relic pool is the main unlock currency sink** *(2026-08-16)*. Relics
themselves are run-local (§7.5); what persists is *which of them the game may
offer you*. That gives the tech tree a job that grows with the content library
instead of competing with it, and it means new relics are pure content forever.

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

## 12. Determinism and replays

A run is a **seed plus an input log** — kilobytes. That buys shareable replays,
daily challenges, bug reports as files, and a regression corpus of real play.
The fixed 20 Hz tick and seeded RNG are already paid for; this is what they buy.

## 13. Presentation

Specified in [ASSETS.md](ASSETS.md). Settled: **spleen 5×8** (BSD-2-Clause), a
5×3-glyph cell, 24-bit colour per glyph, WebGL2 rendering, and art authored in
REXPaint against a generated spleen font.

**Effects — projectiles, impacts, explosions, tower animation — ship after M1**,
following Cogmind's model: hot-reloadable definition files, templated recolour
variants, duration scaled by importance. The **subcell coordinate system they
need ships in M1**, because retrofitting it would mean rewriting movement,
collision and rendering.

## 14. Deliberately rejected

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
  the map generator and in meta progression (§11) — the *mechanic* was cut,
  not the machinery. If reconsidered, that machinery makes it a content
  change, not a rewrite.
- **Flyers** *(2026-08-15)*. Their structural job (punishing over-extension)
  died with tile-laying, and Daniil hates them. One flow field, all enemies
  on the road.
- **The Wall** *(2026-08-15, was D2)*. Every candidate job died: paid mazing
  (no player laying), flyer blocking (no flyers), ground denial (no off-road
  enemies).
- **The Core as a fifth tower** *(2026-08-16)*. A type choice (gunner / mortar /
  slow-field / miner) locking the others, then its own 3-tier tree. Cut before
  any of it was built. Two reasons, both worth keeping: a *shooting* Core is
  redundant (you can already buy local DPS next to the Core with Scrap) and it
  inverts the game's tension by making the last line the strongest; and, more
  fundamentally, four symmetric balanced purchases cannot generate a
  build-breaking run — the thing a roguelite is actually for. Replaced by §7.
- **Relics that unlock both options of an upgrade tier** *(Daniil, 2026-08-16)*.
  The single most tempting rule to break, and the one that cannot be. A tower
  has 5×3 glyphs and 14 defined visual states; "both paths" invents states with
  no possible artwork, and the art budget is the binding constraint on this
  whole game. A state the player cannot see is not a power fantasy, it is a
  rendering bug they paid for. Relics change what towers *do*, never which of
  the 14 forms they are (§5.2, §7.2).
- **The tech tree opened from the Core mid-run** *(2026-08-16)*. Proposed as a
  way to make Ore feel weighty. Rejected: permanent multipliers bought during a
  run move `M` (§9) underneath the calibration model, and a roguelite where you
  can permanently power up mid-run has no run-level tension left. The meta tree
  stays **between** runs; the in-run weight of Ore comes from spend-now-versus-
  bank instead (§6).
- **Mutating the road mid-run** *(2026-08-16)*. Spending Ore to re-carve or
  extend the path was considered as a uniquely-Core power. It would force
  exactly the runtime "is a path still available?" check that pillar 2 exists to
  forbid. Prospecting (§4.6) gets the same "the map changes" feeling while only
  ever opening *off-route* cells, so connectivity is never in question.
- **The Core as a wave dial** *(2026-08-16)*. Skip an entry, delay a wave, call
  the next one early. Cheap to build, but it hands the player control of the
  difficulty model's own inputs. "Call the next wave early for bonus Scrap" may
  return later as a plain HUD button, which is what it actually is.
- **Claiming a cache by building a tower on it** *(Daniil, 2026-08-16)*. Not a
  cost: sell the tower immediately afterwards and the relic was free. Caches
  are claimed by selecting the cell and paying (§4.6).

## 15. Out of scope

Mobile/touch · multiplayer · sound · accounts or cloud saves · a terminal build.

## 16. Acceptance criteria

**M1 — the fun test.** A generated map; build and upgrade towers across waves;
**acquire relics and have at least one run go gloriously wrong in your favour**;
defend the Core; win or lose. Daniil plays it and says whether it is fun.

*(Amended 2026-08-16: the relic layer is inside the M1 gate, not after it. The
gate asks "is this fun?", and answering it with a competent tower defense that
has no acquisition loop would answer a question we do not care about. Better a
true answer one session late than a misleading one on time.)*

**M2 — a complete run.** Full difficulty arc, escalating waves, Ore banking,
save/resume.

**M3 — trustworthy difficulty.** Calibrated curves; harness catches injected
regressions; no unwinnable or trivial seed across ≥500 runs *(measured with the
relic layer held fixed — §9)*. Tech tree stage 1, including relic pool unlocks.

**M4+ — expansion.** Effects system, towers 5–9, biomes, full art pass.
