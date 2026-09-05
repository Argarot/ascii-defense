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
| **Cell** | 8×5 glyphs (40×40 px) | **The placement unit.** One tower occupies exactly one cell |
| **Terrain tile** | 5×5 cells (200×200 px) | The generator's unit |

*(D24, 2026-09-04: the cell grew from 5×3 glyphs to 8×5 — exactly square,
40 glyphs of drawing room — and the board stopped being a constant.)* The
board is sized to the screen at boot: a 1920×1080 display holds **7×5
tiles** beside the HUD, a 2560×1440 one 11×6, clamped between 6×4 and 12×7.
A saved run carries its map and can only continue on a screen that fits it.

Cells and tiles are exactly square. Glyphs are **not** (5×8), so art is
authored in glyph grids and the aspect is absorbed by the cell shape.

## 4. The map

### 4.1 Cell types

| Type | On the route | Buildable | Notes |
|---|---|---|---|
| **Road** | yes | **never** | The route. Never buildable, ever. |
| **Ground** | no | yes | Where towers go |
| **Rock** | no | no | Blocked. May hide ore or a cache (§4.6) |
| **Ore** | no | yes | Buildable; a Refinery here mines Ore. **A deposit is finite and carries a richness** (§6). Generation places ore richer the farther from the road — reach vs. greed |
| **Boon ground** | no | yes | Ground carrying a permanent modifier for whatever is built on it (§4.7). An overlay, not a tile type |
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

### 4.2.1 Roads may touch without connecting *(Daniil, 2026-08-16)*

The tile pool has very few possible road shapes. The cause is not tile size and
not the connector model — it is a **validity rule**, and the fix is three parts
of which only the last is real work.

**1. Connectors stay pegged to edge centres.** A road crosses a tile edge only at
that edge's centre cell; matching stays boolean; connectors stay derived. This is
unchanged, deliberately. *(An earlier draft proposed relaxing connectors to a set
of offsets. Withdrawn: it is a larger change that buys something nobody asked
for, and centre-pegging keeps edge matching trivial.)*

**2. The rule "roads touch edges only at centres" is dropped.** Today a road cell
anywhere on a tile border is illegal, which confines every road to the interior
3×3 plus four centre cells — **that** is why the shape vocabulary is so thin.
Roads may occupy any cell. Only centre cells create connectors, and a road that
runs through a centre cell creates one there, because connectors are derived from
the drawn cells; authoring simply avoids centres it does not mean.

**3. Road cells stop merging by adjacency.** Once roads hug borders, tile A’s road
on its right border sits next to tile B’s road on its left, and a cell-adjacency
BFS fuses them into one route. So the route stops being "every road cell,
4-connected" and becomes a **graph**: road cells form connected components within
a tile, and components join across tiles **only** through matching centre
connectors. Two roads may then run side by side, touching, on separate routes.

Part 3 is the work, and it is the same mechanism bridges need (§4.2.2).
Connectivity still holds by construction: the generator carves the topology and
tiles to match, so the route graph is connected because it was built connected —
never because it was checked.
### 4.2.2 Bridges — SHIPPED 2026-08-18 (session 19)

With the route as a graph (§4.2.1), two roads can cross a tile without merging — a
bridge.
Mechanically this was the larger change, and it landed as specified: the route
is a **graph of strand nodes** in which a bridge cell (`B`) holds two
independent nodes — an east-west deck and a north-south underpass. Validity,
tile partition, the flow field's distances and enemy movement all read strand
nodes; a walker crosses the bridge straight and can never turn off the deck.
The generator deals bridge tiles through straight carve tunnels, gated on a
bridge tile existing in the pool — no tile, no move, connectivity by
construction, as always.

*(Originally sequenced after difficulty and balance; pulled forward by Daniil
at the session-19 smith review — the authoring tool made bridges mintable, and
a mintable cell whose mechanics don't exist is a lie in the palette.)*

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
4b. **The run's chosen special tiles are placed first and are guaranteed**
   (§4.8); basics fill everything they do not claim. *(Amended 2026-08-18,
   playtests 14–15, Daniil's rules: road-carrying specials are ANCHORS —
   placed before filling. One arm per road segment walks and joins the
   network, attaching the special to the tree; every other arm walks outward
   and exits the board as a NEW ENTRY. The road is therefore a TREE on every
   map — exactly one way from each entry to the Core, never a loop, because
   loops are bloat the enemies ignore — and the entry count grows when a
   loadout demands it, which is an accepted difficulty consequence of loading
   demanding tiles. The tree cap on junction arms — entries−2, by the
   handshake lemma — is why entry growth is the only loop-free way to host
   heavy loadouts.)*
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

### 4.3.1 The board fills *(Daniil, 2026-09-04 and 05 — the 8×5 playtest)*

The 8×5 cell put a 7×5 board on a 1080p screen (§3, D24), and the carve
above was written for 12×7: a tree capped at 55% of the slots, and specials
that must each wander their spare arms to the border. Measured on
2026-09-04: one special always fits; **five specials fail on every seed of
every small board**, and three shipped specials need up to 46 rerolls at
6×4. Daniil's direction, which replaces steps 2 and 4b above:

- **Every tile counts now; nearly every tile carries road.** The tree grows
  from the Core until it covers about nine slots in ten; the one or two it
  leaves out are the build islands and the ore. Void all but disappears.
- **The Core is a face at the east edge** (§4.5), fed by one root tile on
  the east border; entries only on the north, west and south borders.
- **Specials are placed first, as fixed nodes.** Their arms are edges the
  tree must use; the tree grows through them. Anchorage stops being a
  search that can fail.
- **Entrances are where the road ends up**, not a starting instruction: a
  dead end may only lie on the border, and every one of them is an entry.
  The count is emergent within the threat's range, and the per-entry floor
  still binds.
- **Lanes are balanced.** A short lane that runs almost straight into the
  Core is far harder than the same enemies on a long one; where the board
  allows, every entry's route length sits within a band of the longest.
  The floor is a minimum; this is the ceiling's partner.

The tree, one route per entry, specials exactly once in their authored
shape, and "every carved shape has a tile" all survive unchanged. The spec
lives in ARCHITECTURE §12 and moves with the rework (WBS 2.30).

### 4.8 Basic and special tiles — agency over the map *(Daniil, 2026-08-17)*

The pivot cut player tile-laying *during* a run (§14) because it converged on a
different game. This restores the agency it removed, and puts it **before** the
run instead of inside it, where it costs no in-run tension:

- **Basic tiles are infinite.** They are the default pool, always available, and
  they fill whatever the specials do not claim. A run always generates.
- **What counts as special is a SHAPE law** *(Daniil, playtests 17–18,
  2026-08-19)*: any tile whose roads **touch without merging** or carry **two
  disconnected segments** is special — chosen, guaranteed, never rolled from
  the random pools. Plain maps therefore contain no touch-without-merge
  moments and no two-roads-in-one-slot crossings; those exist only where the
  player put them. One predicate (`tileIsSpecialShape`) enforces this in the
  generator, in tilegen, and as a CI label audit.
- **Special tiles are finite and chosen.** Before the run, the player loads a
  limited number of them into **slots** (5 as of playtest 17; the count is a
  meta upgrade). Some ship with the game (the flagged shipped shapes), some
  are **minted by the player in Tile Smith** — the authoring tool stops being
  a dev surface and becomes the way you build your own pool. Minted tiles are
  the player's content: the picker pages when the pool outgrows the screen and
  carries a **delete mode** for pruning it.
- **Asset identity is mirror-blind** *(playtest 18)*: the shipped pool never
  contains two tiles that are rotations OR reflections of one shape — a
  CI law, because a mirrored tile reads as a duplicate asset even though it
  plays differently.
- **A loaded special is guaranteed to appear.** That is the whole point: the
  player is not buying a lottery ticket, they are stating what this map will
  contain. If a special cannot be placed legally, generation says so rather than
  silently dropping it.
- **Slot count is a meta upgrade** (§11.1), so "how much of the map do I get to
  decide" is itself a progression axis.

The player therefore shapes the map's *content* while the generator keeps
absolute authority over its *topology* — connectivity stays a construction
guarantee (§4.2), never a thing a loadout could break.

The picker is a **visual** surface: tiles are shown drawn, in the same renderer
the board and Tile Smith use, never as names or JSON. A pool you cannot see is
a pool you cannot choose from.

### 4.9 The void has business *(Daniil, 2026-08-17)*

Unclaimed water is currently scenery. **Chests surface on it occasionally and
sink again after a short window** — a small, seeded, optional prize that gives
the void a reason to be watched. Claiming one pays out through the loot-table
layer (§7.7). It stays strictly off-route and off-buildable, so it can never
touch connectivity or placement.

### 4.4 Map parameters are the difficulty dial

Difficulty is shaped by the generator's knobs, not by authoring levels:

- **More entries → harder.** Each entry is a front; attention and coverage
  divide.
- **Longer paths → easier.** More time on the road is more time under fire.
  The difficulty model already offsets road length sub-linearly (§9's `L`).
- **Uneven lanes → unfair, not hard** *(Daniil, 2026-09-05)*. A lane that
  reaches the Core in a third of the others' length is where runs die, and
  not for an interesting reason. The generator balances lane lengths where
  the board allows (§4.3.1); the offset in §9 is then measured against a
  mean that means something.
- **Terrain mix** — buildable ground near the road, ore far from it, rock in
  the way — tunes how comfortable a map is, and comes from the tile pool.

Buildable density (formerly open question D1) is resolved by the same knobs:
the generator decides how much ground exists and where, so "tens of towers,
not thousands" is a generation target, tuned as data.

### 4.5 The Core

**The Core sits at the east edge, next to the HUD** *(Daniil, 2026-09-05;
session 24)*. It is no longer a tile in the middle of the board. The board
gains one cell column past its east border and a three-cell **Core face**
stands in it where the road arrives; the rest of that column is the wall the
road ends at. The road tree roots at the tile in front of the face, so the
Core has **exactly one entrance**; enemies never spawn on that side; every
lane shares its last stretch. What this buys: the tile the Core used to
occupy and the ring around it go back to the board; the road's shape is
simpler to balance; the actives the Core carries have a natural home in the
strip under the board, right beside the face; and the Core-adjacent range
relic drops from a ring of twelve cells to at most four.

**Cells next to the Core are meant to be precious** *(Daniil, 2026-09-05 —
design intent, details in a later session; WBS 2.35)*. The rules and the
towers will be designed so that the few cells beside the face are the most
valuable ground on the map, and **every tower gets a unique boon when placed
next to the Core** — not the same multiplier for all. Today's rule (the
Loadbearing relic's triple range) is the placeholder for that layer.


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

**The gifts, shipped 2026-09-05 (session 26, WBS 2.35)** — a tower on a
cell touching the Core face gets its own boon, folded like a tier and
printed on its card: Bolt, every shot passes into one more body · Mortar,
no dead zone · Refinery, mines from nothing (1 Ore a cycle, forever) ·
Frost, every third pulse freezes · Tesla, two more bodies per arc ·
Missiles, two per launch · Laser, the heat climbs one multiple higher ·
Bastion, the aura reaches one cell further. The Loadbearing relic's flat
triple range still exists beside them; retiring it is Daniil's call.

### 4.6 Caches and prospecting — the map as a source of power

*(Caches reworked in design round 1, 2026-09-03 — D21. The first design
scattered relic-holding caches at generation and charged Scrap to claim them;
in play every cache was an auto-claim with pure upside, a decision about
nothing.)*

**Caches are sealed containers the run produces, not the generator.** Two
sources: **prospected rock** hides one rarely (at most a few per map, dealt at
generation so replays stay exact), and **every boss drops one where it dies**.
A cache is **opened for free** — select it, click OPEN — and what it holds
comes from a **loot table** (§7.7): Scrap, Ore, a consumable relic, rarely a
full relic, or the cache's own cell turning into **boon ground**, which makes
a cache a place worth defending rather than a coupon. A sealed cache blocks
building until it is opened. *(The former claim-for-Scrap rule and the
"greed versus safety" placement are gone: they never produced a decision.)*

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

Prospecting needs no dedicated tower — it is an interaction with the cell.

**It is not gated behind an unlock** *(revised 2026-08-16, after play)*. The
first design put prospecting behind a Refinery tier choice, spending one of
fourteen tower variants on a one-time boolean and taxing every Refinery
thereafter for a switch that flips once. Instead: anyone may prospect, paying
Scrap **and time** — the rock opens after a delay, so it is a commitment rather
than a purchase. The Refinery tier choice becomes a genuine ability (prospect
adjacent rock automatically, or faster), which is worth a slot in a way a
boolean never was.

### 4.7 Boon ground *(Daniil, 2026-08-16)*

Some ground cells permanently modify whatever is built on them — a range
platform, a heat sink, a power tap. An **overlay** like caches (§4.6), not a new
tile type, so the tile library is untouched.

Two presentation constraints, both load-bearing: the cell must still read as
ground (it is buildable land, not a new terrain class), and it must keep
telegraphing itself **after** a tower covers it without corrupting the tower’s
own fourteen visual states (§5.2). Background colour is the channel; glyphs are
already spoken for.

Same family as ore and caches: the map, not a shop, decides what this run’s good
decisions are (pillar 1).

**Each boon wears its own colour** *(Daniil, 2026-09-05)*: a range platform,
a heat sink and a power tap are three different backgrounds, not one, so the
map reads what it offers before the inspector says it. An **empty** boon cell
also shows corner glyphs so the eye finds the cell it belongs to; once a
tower stands on it only the background survives. Mixed boon ground (one cell,
two effects) is wanted but its rule is undecided (WBS 4.29).

## 5. Towers

### 5.1 Footprint

A tower occupies **exactly one cell** and never changes size. This kills, by
construction, every "can I fit this here" and "can I upgrade this" failure mode
we previously designed mitigations for. *(Under reconsideration, 2026-09-05:
Daniil wants to brainstorm towers larger than one cell. Open decision D25 —
the footprint rule stands until it is resolved, because every placement,
occupancy and upgrade path assumes it.)*

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

**Each committed choice should be legible on the tower itself** *(Daniil,
2026-08-16)*: a second barrel becomes a second glyph, a heavier calibre a heavier
frame, and background colour carries what glyphs cannot. A player should read a
tower's build off the board, never out of a panel. This is the concrete form the
material-language decision (D3) has to take, and the reason D3 closes before the
art pass rather than during it.

### 5.3 Families

M1 ships the first four. Target is **8 towers + the Core**, not 14.

| Tower | Role | Tier 1 | Tier 2 | Tier 3 | Milestone |
|---|---|---|---|---|---|
| Bolt Turret | single target, homing | Marksman (reach) / Gatling (throughput) | Piercing (columns) / Shatter (shields) | Railbore (armour) / Hailstorm (crowds) | M1 |
| Mortar | area, dead zone | Shaped Charge (the few) / Wide Burst (the many) | Long Barrel (sit back) / Short Fuse (sit close) | Concussive (control) / Cluster (saturation) | M1 |
| Frost Emitter | slow field | Deep Chill (slow path) / Ice Shards (damage path) | Wide Field / Brittle | Absolute Zero / Shatterfield | M1 |
| Refinery | economy (§6) | Wide Bore (more now) / Deep Bore (more in the end) | Survey / Automation | Mother Lode / Deep Shaft | M1 |
| Tesla Coil | chain arcs, short range *(session 25)* | Long Arc (reach) / Twin Coil (throughput) | Forked (more bodies) / Grounding (slow on the chain) | Overload (damage) / Conductor (swarms) | shipped 2026-09-05 |
| Missile Rack | homing explosive, long range, dead zone *(session 25)* | Warhead (damage) / Seeker (reach, rate) | Salvo (two missiles) / Fragmentation (blast) | Bunker Buster (armour) / Barrage (three missiles) | shipped 2026-09-05 |
| Laser Lance | a beam down the road it FACES, heat on a held target *(session 26, with facing §5.5)* | Focus (reach) / Wide Beam (corridor) | Overheat (hotter) / Capacitor (steady) | Cutter (columns) / Sweep (re-aims itself) | shipped 2026-09-05 |
| Bastion | support aura, shoots nothing *(session 26)* | Command (harder) / Logistics (faster) | Reach (a wider ring) / Hardpoint (+range) | Warlord / Quartermaster | shipped 2026-09-05 — **eight towers** |

*(Trees reworked in design round 1, 2026-09-03 — D23: every fork is two
**roles** that answer different waves, never two numbers. Piercing answers a
column, Shatter a shellback, Railbore a brute, Hailstorm a swarm; a Mortar
chooses between reach with a bigger dead zone and close work with a smaller
one; the Frost has a slow path and a damage path; the Refinery's deep
choices trade a slower cycle for a bigger vein — costly, for players confident
they can hold the ground. The mechanics these need — volleys, piercing,
shield and armour rules, freezes, blast slows, vein growth — are engine
knobs the content names.)*
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

**The roster grows** *(Daniil, 2026-09-05)*. Beyond the four shipped, the
towers he wants, each with a shape no other has (§5.5): a **tesla** tower
that throws electric arcs (cyan, line-heavy glyphs); a **laser** that fires
in a straight line through every enemy on a run of road, which needs the
tower to **face** a direction (§5.5); a **short-range area** tower; a
**support** tower that improves the towers around it; and a **missile
battery**, the Mortar's logical successor — several homing projectiles, very
expensive to build. Names wait for D8; the earlier list (Acid Sprayer, Arc
Coil, Bastion, Rail Lance) maps onto this one and is superseded by it.

### 5.4 What a tower tells you

Every tower shows a **full stat block** — damage, rate, DPS, range, area, effect
strength and duration, lifetime damage and kills — and every upgrade choice
carries a **written description**, on the same card mechanic relics use (§7.2).
An either/or fork the player cannot read is a coin toss, and the design rests on
those forks being decisions.

**Previews fold every live modifier** *(bug, found 2026-08-16)*. A preview
computed from base stats while the displayed value already includes relic effects
compares two different quantities and quietly lies — observed as a tower showing
range 18 previewing to 8.5. Previews render through the same fold as live stats,
and a change for the worse renders in the colour of a change for the worse.

### 5.5 Attack shapes

Towers differ in the *shape* of what they do, not only its numbers — a chain that
jumps between enemies, a beam covering a straight run of road, an arc sweeping a
wedge rather than a circle. Shape is mechanical, not decorative: each suits a
different piece of map geometry, and it is what makes a tower feel distinct
before its stats are read.

Projectiles carry **spread**, so a rapid or multi-shot tower visibly sprays
instead of firing one glyph repeatedly down an identical line.

**One radius, three consumers** *(Daniil, playtest 8)*. A blast's radius is a
single folded stat: the damage it deals, the area it draws, and the number the
inspector prints all read the *same* value, so an upgrade that widens the blast
widens all three at once. A blast drawn smaller than it kills is the screen
lying, and it corrupts the balance lab's evidence at the same time.

**Some towers have a dead zone** *(design round 1, 2026-09-03 — D22)*. A
minimum range is a real stat, folded like range: the Mortar cannot lob at its
own feet, so a Mortar beside the road needs something else covering the
near lane. The range drawing shows it for every tower — the covered area as
concentric rings fading inward, the dead zone dark with a red rim — so the
hole is read off the board before the first shell tells you.

**Ballistics: aim is committed at fire time.** A shell is thrown at a *place*,
not attached to a creature. It flies to where it was aimed and detonates there
whether or not anyone is still standing on the spot — missing is a real outcome,
and leading a target is a real skill the enemy's speed can defeat. Homing is a
per-projectile property for weapons that genuinely track (Bolt), never the
default.

**A fired shot always resolves** *(Daniil, playtest 8)*. A projectile whose
target dies mid-flight must never evaporate: an unguided shell lands where it
was aimed, and a homing shot re-acquires. Deleting a paid-for shot because the
world moved is both a visual lie and a silent, invisible damage nerf that no
stat block can explain.

**Facing** *(Daniil, 2026-09-05)*. A shape that is a line needs a direction.
A tower that fires along a line gets a facing the player sets — rotate on
build and on demand — and the sim treats the facing as part of the tower's
state, saved and replayed like any other choice. Radial towers have no
facing and never show one.

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

**A deposit is finite** *(Daniil, 2026-08-16, after a wave-14 run banked 2,896
Ore with nothing left to spend it on)*. Each ore cell carries a **richness** — a
quantity and a rate, set at generation. A Refinery draws its deposit down and
**stops when the vein is exhausted**, leaving ordinary ground behind.

That turns the Refinery from a faucet into a decision with a clock: which vein,
how long, when to move. It also puts the answer on the board — a rich vein shows
more gold among its glyphs, a spent one none — so "where is the money" is
answered by looking rather than by clicking.

An infinite faucet feeding a finite sink was the real defect: the currency had
scarcity on neither side.

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

### 7.6 Scarcity, fusion, and why slots are not the constraint

*(Added 2026-08-16, after a run filled every slot within a minute and then stopped
receiving offers entirely: the pool was exhausted, so the acquisition layer
switched itself off in silence.)*

- **Relics outnumber slots by a wide margin.** A pool a single run can drain is a
  mechanic with an expiry date. Unlocks (§11) gate which part of it is live.
- **Held relics are spendable, not merely accumulated.** Fusion — combine several
  into one stronger relic — and salvage — trade one back for Ore — turn a full
  inventory into a decision instead of a wall. Fusion is also what lets slot count
  grow without making the layer *more* trivial: capacity rises, scarcity holds.
- **A far larger share are single-use.** A consumable spent is a slot freed and a
  decision made; a passive held is a number that never asks anything again.

**Rarity is reopened** (was D5, closed flat "until play evidence"). The evidence
arrived: a flat pool deals game-breaking relics as readily as filler, so a run's
ceiling is set by draw order rather than by play.

**Duplicates are a per-relic property, not a global rule** *(D20, design round
1, 2026-09-03)*. A multiplier or a charge held twice is a bigger one; a boolean
rule held twice is a dead card. So each relic says whether it stacks, and an
unstackable relic leaves the pool the moment it is held — an offer never shows
a card worth nothing. Flat global numbers are not relics at all (§7.1's own
test; Ballistics Lab was cut for it), and nothing in the pool multiplies by
"triple".

**Buying relics gets dearer, non-linearly** *(Daniil, D20)*. The first blind
draw at the Core costs 50 Ore and every purchase multiplies the next by 1.5;
rerolls start lower and climb the same way. Ore keeps its spend-now-or-bank
tension (§6) precisely because the fourth relic costs what the first three did.

### 7.7 Loot tables — one answer to "what do I get" *(Daniil, 2026-08-17)*

Rewards are currently hard-coded per source: a cache grants a relic, a vein
grants Ore, a kill grants Scrap. As sources multiply — void chests (§4.9) first,
and whatever follows — that becomes a scatter of bespoke payout code.

A **loot table** is content: a named, weighted list of outcomes (Scrap, Ore of a
tier, a relic drawn at a rarity, a special tile, nothing), rolled on a named RNG
stream at claim time so it rides the input log like every other decision. Sources
reference a table by id; they do not contain their own payout logic.

*Shipped 2026-09-03 (design round 1)*: `content/assets/loot/tables.json`
holds `rock_cache` and `boss_drop`; the outcome kinds are Scrap, Ore, boon
ground, a consumable, a relic, nothing. Caches (§4.6) are the first consumer;
void chests (§4.9) will be the second.

This is deliberately built *with* the relic economy rather than before it:
rarity weighting (§7.6) and a weighted outcome list are the same machinery, and
building them twice is how two subtly different weighting rules end up in one
codebase.

### 7.8 Passives, rarity with teeth, and the relic as an object *(Daniil, 2026-09-05)*

- **Passives are not relics.** A permanent modifier and a found object with
  a cooldown are different things and should not compete for the same
  slots. Passives get far more slots than relics do. The shape is open (D26):
  Tower Dominion's doctrines are the reference for what a passive layer
  feels like, and explicitly not the thing to copy.
- **Rarity means power.** D5 weights the pool by rarity; the second half is
  that a rare relic is actually stronger, not merely scarcer.
- **Single-use, high-damage relics** — a nuke, or something like it — belong
  in the consumable tier: one moment that turns a wave.
- **A relic is drawn, not abbreviated.** Two letters in a box is the
  placeholder; every relic gets its own sprite (§13, 6.7).
- **A held relic can be replaced or removed**, and relics can be **combined**
  into stronger ones (§7.6's fusion, made concrete) — a full row of slots is
  a decision to make, never a wall.

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

**Damage types must decide fights** *(Daniil, 2026-08-16: "2-3 fully upgraded
mortars absolutely demolish everything")*. **Shipped 2026-09-05 (session
26, WBS 2.8)**: every attacking tower deals kinetic (Bolt, Mortar, Missiles)
or energy (Frost, Tesla); every enemy carries a multiplier per type (0.5
resists, 1.5 weak, 0 immune, applied before armour); the card, the strip
and the catalogue print it. Before that, Kinetic and Energy were specified but
inert — nothing resisted either, so no enemy posed a question and no tower was a
wrong answer. Resistance and immunity turn the composition of a wave into a
demand for a composition of *towers*, which is the entire content of "every
placement is a build decision". One tower type clearing every wave is precisely
the failure that rule exists to prevent.

**Traits show on the enemy, not in a legend.** A shield is drawn as a bracket
around the glyph and destroyed separately from the body, so any enemy may carry
one and the player watches it break; status effects and remaining health read off
marks beside the glyph rather than out of a tooltip.

**Every status is visible, and every source is tracked** *(Daniil,
2026-09-05; shipped 2026-09-05, session 26, WBS 2.31: slows are entries
with a source, resolved by "the coldest wins, the longest lasts"; a cold
mark per source and a frozen mark stand beside the walker; Splinter's
second blast is drawn a beat after the first)*. A slowed enemy shows it; a burning one shows it; a shielded
one already does. Behind the mark, the sim keeps each effect with its
source — a slow from a Frost field and a slow from a Concussive shell are
two entries with two rules for how they stack, not one number overwritten.
**And every rule prints**: the Splinter relic says "explosions detonate
twice" and the sim resolves a blast twice, but nothing on screen shows the
second blast or explains the damage. A rule the player cannot see or read is
a bug in the presentation, whatever the code does.

**Which tower answers which enemy must be legible.** Damage types exist and
are inert (above); until resistances land, the roster reads as six glyphs
with different health. The answer is the same as the rule: resistances that
decide fights, and a card that says so in one line.

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

### 9.1 Every run ends in death *(Daniil, 2026-08-16)*

Observed: three or four upgraded towers held past wave 30 with no further input
and an untouched Core. That is not a tuning error but a shape error — **threat
grew linearly while player power compounded**, so beyond some wave the run
stabilises forever and the roguelite stops being one.

> **There is no stable state.** Threat grows faster than any achievable build, so
> every run ends in death — including the run with the god combination. A great
> build buys *how far you get*, never *whether you survive*.

Concretely: threat scales geometrically rather than additively; wave composition
escalates in kind and not only in count; and player power is bounded by finite
build sites and finite Ore (§6). A god build should reach far deeper and still
lose.

**A run therefore needs an end** — a final wave and a victory, or an explicit
endless mode scored by depth. "Play until bored" is the single outcome that
teaches the player nothing and gives meta progression nothing to reward.

**Relics make run power a distribution, not a number** *(added 2026-08-16)*.
Everything above assumes the bot plays a fixed system; §7 makes each run's
ceiling depend on what was acquired and what happened to combine. Two
consequences, both accepted deliberately:

- Calibration targets a **distribution**, not a point: the curve must put the
  reference policy at target margin across a *spread* of relic draws, not in
  the average case. The bot's relic picks are part of its policy.
- **A trivialised run is not automatically a bug.** *Trivial-by-relic is the
  feature; trivial-by-map is the defect.* M3's "no trivial seed across ≥500
  runs" criterion (§17) is therefore measured with the relic layer held fixed —
  otherwise the harness will spend its life reporting the game working.

### 9.2 Wave tempo *(Daniil, design round 1, 2026-09-03 — D17)*

The wave clock runs **from one launch to the next** and never waits for the
last enemy to die. Killing fast buys a quiet board before the next front;
dawdling means two waves on the road at once. The player may **call the next
wave early** once the current one has finished spawning, and is paid the
remaining seconds in Scrap — calling is a bet, not a chore. **Wave 1 waits
for the call**: a fresh map deserves a look before the first front opens.

**The next wave is known before it comes.** It is composed one wave ahead
and shown by kind and count, so "which tower answers this" is a decision
made with the information it needs.

**Boss waves** come every fifth wave **and on the final wave, by rule**: one
boss — the heaviest enemy unlocked, scaled up in health, bounty and Core
damage — behind a normal escort. *(The former elite surge happened to land
on the victory wave because 20 is a multiple of 5; a rule now says so.)*

**The road's length is paid for** (§9's `L`): enemy health scales by the
square root of the mean lane length over the threat's floor. A long road is
time under fire that the waves buy back, not a gift.

**Traits are rules, not labels** (D19): armoured enemies ignore slows,
shielded ones regrow their shield after a pause unhit, fast ones shake slows
off in half the time, swarms arrive in packs of three. Each trait poses a
different tower question.

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

### 11.1 The tile pool is the ore economy *(Daniil, 2026-08-16 — resolves D9)*

Ore tiers do not need a distribution rule in the generator. **They are tiles you
buy.** A richer vein exists on the map because you purchased the tile that
carries it, so rarity is an economic fact rather than a placement heuristic:

- Special tiles are bought with meta-currency between runs and are **expensive**
  — that is what makes them rare.
- The pool holds **the number of copies you actually own**, so it is a multiset,
  not a set. Generation may place at most that many per run (copies return
  between runs; they are stock, not consumables).
- **A tier-N ore node is bought with tier-(N-1) ore**, deliberately steeply. That
  is the sink that gives lower tiers a purpose beyond accumulating.
- Basic ore tiles are already in the pool and stay free — **basics are infinite
  and unslotted** (§4.8); only specials consume a slot.
- **Loadout slots are themselves an upgrade** *(Daniil, 2026-08-17)*: the
  number of special tiles a run may carry starts small and grows through the
  tree, with locked slots shown as locked rather than hidden — a visible ladder
  beats an invisible one.
- Once Tile Smith opens in-game (below), **features price the tile**: richer
  nodes cost more to mint, so the authoring tool and the economy share one
  pricing function.

*Where* a given tile lands barely matters; **how likely it is to appear is a
knob**, and that knob is calibration input rather than a design constant.

This collapses what looked like three systems — ore tiers, the tile pool as
progression, and Tile Smith as a meta feature — into one. The engine keeps only
the shape: ore cells carry a tier, costs are expressed per tier.

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

**The board is alive.** Terrain drifts, towers cycle through two or three frames
of their own artwork, projectiles spray, explosions bloom, and background colour
does far more work than it does today. A static field reads as a diagram; the same
board with slow, cheap motion reads as a place. The renderer already redraws every
frame, so animation costs authoring time rather than engine work.

**Void becomes something rather than nothing.** Unclaimed land should be water or
another readable surface, and the border where terrain meets it should blend
procedurally instead of cutting sharply. By construction those border cells can
never carry road (§4.2), so a procedural overwrite there is always safe.
*Water shipped in session 16; the **shoreline** — a procedural "beach" band
where land meets water, so the edge reads as a coast rather than a cut — is the
outstanding half, and Daniil has asked for it twice.*

**Motion has two clocks, and they are not the same clock** *(clarified
2026-08-17)*. Anything that belongs to the **world** — terrain drift, water,
tower idle cycles, effects — runs on *sim* time: it freezes when the player
pauses and speeds up when they press 4×, because that is what fast-forwarding a
world means. Anything that belongs to the **interface** — telegraph breathing,
preview pulses, cursors — runs on wall-clock time, because the UI is talking to
the player, not simulating anything. Putting world motion on the wall clock was
session 16's mistake, caught immediately in play.

**Smoothness comes from spatial phase, not from redrawing less.** The board
already redraws in full every frame in well under a millisecond, so partial
redraw would buy nothing; what makes a surface *flow* is giving each glyph a
phase offset derived from its position, so a wave travels across the water
instead of the whole sheet blinking together. Recorded because the intuitive fix
("redraw fewer things") optimises the wrong quantity and would cost a session to
discover.

**Relics deserve their own art**, drawn at **board-glyph scale** rather than the
HUD's 2× font: the smaller cell buys the detail that makes a relic look like an
object instead of a label. Their slots are **square**, not the current
rectangles — a slot grid reads as an inventory only if the cells do.

**Names come from the printing trade** *(Daniil, 2026-08-16)*. A game built out of
glyphs should take its vocabulary from typesetting and the press — kerning,
ligature, slug, quoin, pica, leading, widow, orphan, dingbat. Puns encouraged.
Cheap to do and impossible to retrofit: **names settle before the art pass**,
because the art illustrates the names.

**Effects — projectiles, impacts, explosions, tower animation — ship after M1**,
following Cogmind's model: hot-reloadable definition files, templated recolour
variants, duration scaled by importance. The **subcell coordinate system they
need ships in M1**, because retrofitting it would mean rewriting movement,
collision and rendering.

**Motion, second pass** *(Daniil, 2026-09-05)*. The renderer redraws the
whole board every frame in under a millisecond, so the ceiling on smoothness
is authoring and interpolation, not the engine. Today it works and reads as
"retro and choppy". The second pass: enemies and projectiles interpolated
between ticks so a 20 Hz simulation shows as a 60 Hz picture; idle cycles of
many frames, not two; and **per-tower attack animations** — the charge, the
shot, the cooldown where it matters — keyed to the sim's events, in the
sprite format, authored in Daniil's editor. Abilities get the same
treatment: the orbital laser is a wide bright beam from the top of the
screen, not a flash on a cell.

**The bottom of the screen works too** *(Daniil, 2026-09-05)*. The board no
longer fills the viewport; the strip beneath it becomes the second panel:
the wave — composition by type, with each enemy's specialty — the active
abilities, and **build buttons drawn with the towers' own sprites**, full
colour when affordable and grey when not, that look like buttons.

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
- **Mechanically multi-cell enemies** *(2026-08-16)*. A larger boss should be
  drawn wider — but giving it a real multi-cell footprint costs the SoA layout,
  collision, shield resolution, targeting and pathing, to buy nothing the player
  can perceive. Enemies walk single-file and never collide, so a boss drawn three
  glyphs wide with a one-cell footprint looks identical and is nearly free. Visual
  size yes; mechanical size no.
- **Prospecting as a one-time unlock** *(2026-08-16)*. Shipped in Phase 6 and cut
  after play: it spent a tower variant on a boolean (§4.6).
- **Silently simulating while the tab is hidden** *(2026-08-16)*. Returning to a
  Core that died while the player was elsewhere is hostile. Either the pause is
  explicit and visible, or the simulation genuinely runs in a worker; the current
  behaviour — stalling without saying so — is the only unacceptable option.

## 15. The shell — from launch to quit

*(Added 2026-08-16. Daniil: the docs described a simulation and called the rest
"expansion". Everything here is what turns the simulation into something a
stranger can be handed.)*

Today the game starts instantly into a run configured by a URL parameter. That
is a debug harness. A product answers: what do I see first, what happens when I
die, what did I keep, and why would I start again.

### 15.1 Screens and flow

```
launch → title → ┬─ new run → run setup → THE RUN ⇄ pause
                 │                            ↓
                 │                    victory / defeat
                 │                            ↓
                 │                      run summary ──┐
                 ├─ continue (resume a saved run)     │
                 ├─ workshop (the tech tree, §11)     │
                 ├─ settings                          │
                 └─ how to play          ←────────────┘
```

The view gains a **screen stack**: screens push and pop, and the board keeps
rendering beneath when that makes sense. The relic offer modal is the prototype
of this and should generalise into it rather than being duplicated.

**No screen owns game state.** The sim remains the single source of truth; a
screen reads it and sends actions, exactly as the HUD does now. A screen system
that starts caching state is how save bugs are born.

**The run summary is a designed screen, not a dialog.** What killed you, which
wave, what you built, which relics you took, how much Ore you banked. It is the
moment that either produces another run or ends the session.

**The shell owns the whole screen** *(Daniil, 2026-09-05)*. The title is a
designed full-screen page — a loading screen with the menu — not a plate over
the tiled board at the board's size. It is the root of a **screen system**:
the Tile Smith, the tech tree, settings and the summary are pages of the
same system, sized to the viewport, so none of them is a one-off. The board
becomes one of those pages rather than the page everything else floats over.

### 15.2 Persistence

Two kinds of state, deliberately kept apart:

| | Contents | Notes |
|---|---|---|
| **Run state** | seed + input log + tick + **the generated map itself** *(D15, 2026-08-19)* | Determinism means **a save IS a replay**. Resuming replays the log **onto the stored map** — generation never re-runs on resume, so a save survives generator rebuilds; content drift is refused by hash, loudly. Still kilobytes, exact, and it doubles as the bug-report format (§12). The displayed **run code** (generator version + seed + threat + loadout hash) is the run's compact identity; a code from another generator version is refused, never silently regenerated |
| **Meta state** | banked Ore, unlocks, run history, settings | Survives runs. The only thing that makes a second run different from the first |

Stored in the browser. The consequence must be stated rather than discovered:
**no accounts and no cloud saves** (§16), so progress is per-browser and
clearing site data destroys it. Mitigated by **export/import of a save file** —
which costs almost nothing, moves progress between machines, and gives us
reproducible bug reports for free.

Every save carries a **schema version**. On mismatch: migrate when we can,
otherwise say so plainly and offer a reset. Never wipe silently, and never load
a save we only half understand.

### 15.3 Onboarding

A first-timer must reach *"I understand what to do"* without reading anything.
Contextual prompts at first encounter — the first buildable cell, the first
relic offer, the first time the Core is selectable — a **How to play** screen
for people who want the whole thing at once, and opening waves gentle enough to
learn in. **No forced tutorial**; this genre teaches itself if the first ninety
seconds are legible.

### 15.4 Accessibility

Invariant 10 has always promised that accessibility is a view change because
nothing branches on colour. That promise gets cashed here, not indefinitely
deferred:

- a **colourblind-safe palette** variant — the roles already exist, only values
  change
- **full keyboard operation** of every screen
- a **reduced-motion** setting, which the effects engine (§13) must respect from
  the day it ships rather than have retrofitted
- **text scale** for the HUD

### 15.5 What "runs well" means

- **60 fps at full board** on mid-range hardware, within the entity caps the sim
  already enforces.
- **WebGL2 is required.** A browser without it gets an honest message, not a
  blank canvas.
- **Bundle and asset budgets are tracked**, and a regression is flagged in the PR
  that causes it (precedent: the ajv 9KB→134KB note).
- **Every error reachable from a player path has a recovery story.** Engine
  throws are for CI and dev surfaces (§4.3 precedent); players get a message and
  a way forward.

## 16. Out of scope

Mobile/touch · multiplayer · music · accounts or cloud saves · a terminal build.

**Sound moved partly IN scope 2026-08-16** (Daniil): **minimal SFX for beta** —
impacts, builds, wave start, UI. Not music, not a mix. A tower defense without
impact feedback reads as dead, and the cheap version buys most of that; the
expensive version (music, layering, dynamic mixing) stays out.

## 17. Acceptance criteria

**M1 — the fun test. PASSED 2026-08-16.** Verdict: *"the game is fun now, it’s
just very unbalanced and with quite a few holes still."* This is the judgement the
entire milestone existed to obtain. Fun is confirmed; everything after this is
balance and depth, not a question of whether to continue.

*(Amended 2026-08-16: the relic layer is inside the M1 gate, not after it. The
gate asks "is this fun?", and answering it with a competent tower defense that
has no acquisition loop would answer a question we do not care about. Better a
true answer one session late than a misleading one on time.)*

**M2 — a complete run.** Full difficulty arc, escalating waves, Ore banking,
save/resume.

**M3 — trustworthy difficulty.** Calibrated curves; harness catches injected
regressions; no unwinnable or trivial seed across ≥500 runs *(measured with the
relic layer held fixed — §9)*. Tech tree stage 1, including relic pool unlocks.

**M4 — the shell.** A stranger can open the link, start a run from a menu,
pause it, lose it, read why, and start another. Progress persists and survives a
reload; a corrupt save says so instead of vanishing.

**M5 — content completeness.** Enough towers, enemies, relics and tiles that two
runs do not resemble each other.

**M6 — presentation.** Everything the player sees is authored and animated; the
board reads as a place rather than a diagram.

**M7 — meta progression.** Finishing a run changes the next one, and there is a
visible tree of things still to unlock.

**M8 — STABLE BETA.** The shipping bar, and the definition of done for this
project:

- a stranger plays a full run without help, understands why they lost, and wants
  another
- shell complete: title, setup, pause, summary, settings, workshop, how-to-play
- persistence versioned, with export/import; **no silent data loss**
- calibrated difficulty; no unwinnable or trivial seed across ≥500 runs
- content floor: **8 towers · ~14 enemies · ~40 relics · ~100 tiles**
- art pass complete for everything on screen; reduced-motion honoured
- colourblind palette, full keyboard operation
- 60 fps at full board; WebGL2 absence handled honestly
- no known crash and no known save-corruption path
- licences and attribution correct (Apache-2.0; spleen BSD-2-Clause)

## 18. Monetization — intent, not design *(Daniil, 2026-09-05)*

Daniil is seriously considering monetizing the game eventually, on the Stone
Story RPG model and less aggressively than that: small things that make the
game more fun and less grindy, never pay-to-win. Recorded so that nothing
built now closes the door — accounts and cloud saves are "out of scope" in
§16 today, and a paid layer needs some identity story. Open decision D27;
nothing in the beta plan depends on it.
