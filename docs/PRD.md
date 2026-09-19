# ASCII Defense — Product Requirements

**This document is the scope: what the game is.** It is read end to end at the
start of every session and written **in place** — a section says what is true
now, and what it replaced lives in `docs/history/`
([CONTRIBUTING §6](../CONTRIBUTING.md) rule 9).

- **§1–§31 are the game as it runs.** Present tense, no strata. The *why* of a
  decision is in [ROADMAP](ROADMAP.md)'s decision table (D-numbers) and in
  `docs/design/`; the numbers are in the generated [CATALOGUE](CATALOGUE.md)
  and in `docs/lab/`; how it is built is [ARCHITECTURE](ARCHITECTURE.md); how
  it looks is [ASSETS](ASSETS.md).
- **§32 is THE REWORK — an approved design, NOT BUILT.** A section of the
  running game that the rework will change carries one line saying so. When a
  ledger row of the rework ships, its part of §32 is folded into the section it
  changes and the old text moves to history.
- **Section numbers are stable.** Code comments, tests and issues cite them
  (`PRD sec 4.5`, `§28.1`); a section whose content moved keeps its number and
  says where it went.

Everything this file said before it was rewritten is frozen, verbatim, in
[docs/history/prd-2026-09-19.md](history/prd-2026-09-19.md).

It names no glyph, no colour and no pixel — those live in ASSETS and in data.
Live: <https://argarot.github.io/ascii-defense/>

---

## 1. What it is

A roguelite tower defense game in the browser. Everything — terrain, towers,
enemies, effects, menus — is drawn as characters on a grid.

**The game generates the battlefield; you defend the Core.** At run start the
map is assembled from terrain tiles: the Core at the east edge, roads winding
to it from the other three borders, terrain and ore filling the rest. Every
open road end on a border is an entry, and enemies march from all of them. The
map's shape is the difficulty dial (§4.4). The tile pool is meta progression:
the player unlocks richer tiles between runs, chooses which special tiles a run
will contain (§4.8), and eventually authors their own (§11.1).

## 2. Design pillars

> **§32 changes this** *(approved, NOT BUILT)*: the map makes placement a decision — pads are very scarce (§32.1) — and every run asks a different question before wave 1 (§32.5).

| Pillar | Means | Rules out |
|---|---|---|
| **The map is the difficulty dial** | Entries, path length and terrain mix are the knobs the game turns; the tile pool is meta progression the player curates and eventually authors | Hand-designed fixed levels; player tile-laying mid-run |
| **Invalid states are unrepresentable** | Connector matching guarantees a connected road; road cells are never buildable | Runtime "is this still solvable?" checks |
| **Every placement is a build decision** | Three either/or tiers per tower; a committed choice locks its sibling for the run (§5.2) | "Buy the best tower, spam it" |
| **Planned power is strict so found power can break it** | Tower trees are symmetric and predictable; relics (§7) are rule-breakers acquired mid-run, and the collision of the two is where a run becomes a story | A tower defense with a seed; balanced-but-forgettable runs |
| **Every run is reproducible** | A run is a seed plus an input log | Non-deterministic simulation |
| **Content is data** | Terrain, towers, enemies, upgrades, relics, fonts and art are all JSON | Adding a tower requiring engine changes |
| **Swappable presentation** | The simulation knows no glyphs, colours or pixels | Any engine code that branches on appearance |

## 3. The three-level grid

Fixed nomenclature, used everywhere in code and docs:

| Level | Size | Role |
|---|---|---|
| **Glyph** | 1 character (5×8 px) | Smallest drawable unit |
| **Cell** | 8×5 glyphs (40×40 px) | **The placement unit.** One tower occupies exactly one cell |
| **Terrain tile** | 5×5 cells (200×200 px) | The generator's unit |

Cells and tiles are exactly square; glyphs are not, so art is authored in glyph
grids and the aspect is absorbed by the cell. The cell is declared once
(`content/assets/grid.json`) and enforced on every sprite by the content
linter.

**The board is sized to the screen at boot**: a 1920×1080 display holds 7×5
tiles beside the HUD, a 2560×1440 one 11×6, clamped between 6×4 and 12×7. A
saved run carries its map and continues only on a screen that fits it.

## 4. The map

### 4.1 Cell types

> **§32 changes this** *(approved, NOT BUILT)*: every cell that is not road becomes a **pad**, **rock over a pad**, or **bedrock**; plain buildable ground goes (§32.1).

| Type | On the route | Buildable | Notes |
|---|---|---|---|
| **Road** | yes | **never** | The route. Never buildable, ever |
| **Ground** | no | yes | Where towers go |
| **Rock** | no | no | Blocked. May hide ore or a cache (§4.6) |
| **Ore** | no | yes | Buildable; a Refinery here mines Ore. A deposit is finite and carries a richness and a tier (§6). Ore is likelier the farther a tile is from the road — reach versus greed |
| **Boon ground** | no | yes | Ground carrying a permanent modifier for whatever is built on it (§4.7). An overlay, not a cell type |
| **Core** | yes | no | What enemies march toward (§4.5) |

**"On the route" means enemies walk it.** Only Road and Core are. Ground and
Ore are *open* terrain, not *walkable* terrain: nothing ever leaves the road,
because flyers are cut (§8) and no enemy pathfinds. So opening a rock cell can
never create a shortcut.

**Entries are derived, never declared**: an open road end at the board's edge
is a spawn point — the same philosophy as derived connectors.

### 4.2 Tiles and connectors

Each terrain tile is a 5×5 grid of cell types. **Edge connectors are derived
from the grid, never declared**: a road crosses a tile edge only at that edge's
centre cell, and only when the road continues inward from it. "Does this edge
carry road" is a boolean, matching is boolean equality, and inside the tile the
road's shape is arbitrary. A declared connector cannot disagree with the drawn
cells because there is no declared connector.

One engine function decides whether a tile is legal, and it backs the game, the
content CI and the Tile Smith alike: every road strand lies on a route between
two entries (no stubs, no decoration dressed as road), and no loops.

Assembly legality: every interior shared edge agrees (both road, or both not);
a road crosses the **board** edge only where generation routed an entry.

**Connectivity therefore holds by construction.** The game never validates that
a path exists, because a disconnected map cannot be assembled. This is the same
class of guarantee as "road is never buildable", and both are load-bearing.

### 4.2.1 Roads may touch without connecting

Roads may occupy any cell of a tile, including its border. Only centre cells
create connectors. Road cells do **not** merge by adjacency: the route is a
**graph** — road cells form strands within a tile, and strands join across
tiles only through matching centre connectors. Two roads may run side by side,
touching, on separate routes. Connectivity still holds by construction: the
generator carves the topology and tiles to match.

### 4.2.2 Bridges

A bridge cell holds two independent strands — an east-west deck and a
north-south underpass — that cross in one cell and never join. Validity, the
flow field's distances and enemy movement all read strands; a walker crosses
straight and can never turn off the deck. The generator deals bridge tiles
through straight carve tunnels, only when a bridge tile exists in the pool.

### 4.3 Map generation

Seeded from the run seed (stream `map`). The specification the generator
satisfies — and asserts inside every generation — is ARCHITECTURE §12; this is
what it produces:

1. **The Core is a face at the east edge** (§4.5), fed by one root tile; entries
   lie only on the north, west and south borders.
2. **The run's chosen special tiles are placed first, as fixed nodes** (§4.8).
   Their arms are edges the road must use; a loaded special is guaranteed.
3. **The road grows as a TREE** from the root until it covers the fill target —
   about nine slots in ten, on every map. There is exactly one way from each
   entry to the Core and never a loop, because a loop is bloat the enemies
   ignore.
4. **Entrances are where the road ends up**: a dead end may only lie on the
   border, and every one is an entry. The count is emergent within the Threat's
   range, and grows when a loadout of demanding specials needs it — an accepted
   difficulty cost of loading them.
5. **The per-entry path floor is in road cells and is never relaxed by
   retries**; **lanes are balanced** — every entry's route sits within a band of
   the longest (at least 70%), because a lane a third the length of the others
   is where runs die, and not for an interesting reason.
6. Each road slot becomes a tile whose connector signature matches the carved
   topology; remaining slots fill with roadless terrain.
7. **Every rock cell is dealt its hidden contents** at generation (§4.6).

**No ore floor**: generation is heavily biased toward some ore and a rare
ore-less map is legal; the only guaranteed ore is authored ore on a chosen
special. **Void is a probability curve**, not a cap — and on a filled board
almost none is left.

**The walk has a character and the land has regions — §31.**

### 4.3.1 The board fills

Folded into §4.3: its steps 1–5 *are* the filled board's rules (D28, D36) —
the fill target, the Core at the edge, specials as fixed nodes, emergent
entries, balanced lanes.

### 4.4 Map parameters are the difficulty dial

> **§32 changes this** *(approved, NOT BUILT)*: pad count and pad placement become two more Threat knobs (§32.1).

Difficulty is shaped by the generator's knobs, not by authored levels:

- **More entries → harder.** Each entry is a front; attention and coverage
  divide.
- **Longer paths → easier.** More time on the road is more time under fire; the
  difficulty model offsets road length sub-linearly (§9's `L`).
- **Uneven lanes → unfair, not hard** — hence the lane band (§4.3).
- **Terrain mix** — buildable ground near the road, ore far from it, rock in
  the way — tunes how comfortable a map is, and comes from the tile pool.

Three Threats ship: **Calm, Standard, Grim** — each a bundle of entry range,
path floor, wave clock, run length and difficulty curve (`engine/sim/threat.ts`;
the numbers are data).

### 4.5 The Core

**The Core sits at the east edge, next to the HUD.** The board gains one cell
column past its east border and a three-cell **Core face** stands in it where
the road arrives; the rest of that column is the wall the road ends at. The
road tree roots at the tile in front of the face, so the Core has **exactly one
entrance**, enemies never spawn on that side, and every lane shares its last
stretch.

- **The Core has health.** Each enemy that reaches it deals its `damage`;
  bigger and later bodies carry bigger numbers. Health at zero ends the run.
- **The Core is the vessel, not a tower.** It has no tree of its own and it
  never shoots. It *holds the relics* (§7); the strip under the board is where
  their actives are fired and their consumables spent.
- **The Core spends Ore, never Scrap** — it does not compete with towers for
  the run economy. Its purchases are relics: a draw, a reroll, the Forge (§7).

**Cells next to the Core are precious: every tower gets its own gift there**,
folded like a tier and printed on its card — Bolt: every shot passes into one
more body · Mortar: no dead zone · Refinery: mines from nothing · Frost: every
third pulse freezes · Tesla: two more bodies per arc · Missiles: two per launch
· Laser: the heat climbs one multiple higher · Bastion: the plus reaches one
cell further.

### 4.6 Caches and prospecting — the map as a source of power

> **§32 changes this** *(approved, NOT BUILT)*: prospecting becomes **digging** — one rock, always a pad under it, one layer of sight, one crew, slow and costly; rock caches are cut (§32.2).

**Every rock cell is dealt hidden contents at generation — ore, a cache, or
nothing — and prospecting reveals what was always there.** Anyone may prospect:
select a rock cell and pay Scrap **and time**; the rock opens after a delay, so
it is a commitment and not a purchase. On completion the rock becomes an ore
cell, yields a cache, or is cleared to ground. The Refinery's tree makes it an
ability (§5.3), never a gate.

**A cache** is a sealed container: it comes only out of prospected rock (a few
per map at most), is **opened for free**, blocks building until it is, and pays
through a loot table (§7.7) — Scrap, Ore, a consumable, rarely a relic, or its
own cell turning into boon ground.

Three consequences, all deliberate: **no runtime randomness** (contents are
part of the map, so the seed describes the run); **the chance of finding
something is a generation knob**; and **opening rock is always safe** — it
becomes ground or ore, neither of which is on the route.

### 4.7 Boon ground

Some ground cells permanently modify whatever is built on them — a range
platform, a heat sink, a power tap — in four tiers of power. An **overlay**, so
the tile library is untouched. The cell still reads as ground, and keeps
telegraphing itself **after** a tower covers it without corrupting the tower's
fourteen visual states: **background colour is the channel**, each boon its
own; an empty boon cell also wears corner glyphs. A cell carrying two boons is
wanted and its rule is undecided. Same family as ore and caches: the map, not a
shop, decides what this run's good decisions are.

### 4.8 Basic and special tiles — agency over the map

Player tile-laying *during* a run is cut (§14). The agency it carried lives
**before** the run, where it costs no in-run tension:

- **Basic tiles are infinite and unslotted.** They fill whatever the specials
  do not claim. A run always generates.
- **What counts as special is a SHAPE law**: any tile whose roads **touch
  without merging** or carry **two disconnected segments** is special — chosen,
  guaranteed, never rolled. Plain maps therefore contain no such moments; they
  exist only where the player put them. One predicate enforces it in the
  generator, in the tile generator and as a CI audit. A tile carrying a vein
  above tier 1 is special by economy — a bought tile, whatever its road
  (§11.1).
- **Special tiles are finite and chosen.** Before the run the player loads a
  limited number into **slots** (one at first, five at most — a tree upgrade,
  §11). Some ship with the game, some are **minted in the Tile Smith** (§11.1).
- **A loaded special is guaranteed to appear**, every loaded copy of it (§24).
  If one cannot be placed legally, generation says so rather than dropping it.
- **Asset identity is mirror-blind**: the shipped pool never contains two tiles
  that are rotations or reflections of one shape — a CI law.

The player shapes the map's *content*; the generator keeps absolute authority
over its *topology*. The picker is a **visual** surface (§25): a pool you cannot
see is a pool you cannot choose from.

### 4.9 Chests

> **§32 changes this** *(approved, NOT BUILT)*: random chests are cut; a **courier** carries the chest and nothing holds it (§32.4). A boss's chest stays.

**A chest surfaces now and then and sinks again after a short window** — on
water or on empty ground (no tower, no unopened cache); on ground it holds its
cell while it stands. It rolls a rarity as it surfaces, which colours it and
scales its Scrap and Ore; it blinks faster as it sinks; claiming is a click and
a replayed input, and pays through the `void_chest` table. **A boss leaves a
crowned chest where it falls**, rarer with the wave, standing a minute and
paying through the boss table. Chests are strictly off-route.

## 5. Towers

### 5.1 Footprint

A tower occupies **exactly one cell** and never changes size. This kills, by
construction, every "can I fit this here" and "can I upgrade this" failure.
Towers larger than a cell are deferred until after beta, as content, and must
not be designed around before then.

### 5.2 Upgrade tiers

**Three tiers per tower; each tier is an either/or choice; a committed choice
is final and locks out its sibling; tiers unlock in order.** 2 + 4 + 8 = 14
distinct versions per tower, each visually distinct rather than a number.
Tiering changes the artwork within the cell, never the footprint.

**The 14 variants are an art ceiling, and that ceiling is a design
constraint.** Anything that produces a tower state *outside* those 14 has no
possible visual, and a state the player cannot see is a bug wearing a feature's
clothes. This is why no relic may combine both options of a tier (§7.2, §14).
**Each committed choice is legible on the tower itself**: a player reads a
tower's build off the board, never out of a panel.

### 5.3 Families

Eight towers. **Every fork is two roles that answer different waves, never two
numbers.**

| Tower | Role | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|---|
| Bolt Turret | single target, homing | Marksman (reach) / Gatling (throughput) | Piercing (columns) / Shatter (shields) | Railbore (armour) / Hailstorm (crowds) |
| Mortar | area, dead zone | Shaped Charge (the few) / Wide Burst (the many) | Long Barrel (sit back) / Short Fuse (sit close) | Concussive (control) / Cluster (saturation) |
| Frost Emitter | slow field | Deep Chill (slow path) / Ice Shards (damage path) | Wide Field / Brittle | Absolute Zero / Shatterfield |
| Refinery | economy (§6) | Wide Bore (more now) / Deep Bore (more in the end) | Survey / Automation *(§32.2: Survey reveals rock, Automation becomes Second Crew)* | Mother Lode / Deep Shaft |
| Tesla Coil | chain arcs, short range | Long Arc (reach) / Twin Coil (throughput) | Forked (more bodies) / Grounding (slow on the chain) | Overload (damage) / Conductor (swarms) |
| Missile Rack | homing explosive, long range, dead zone | Warhead (damage) / Seeker (reach, rate) | Salvo (two missiles) / Fragmentation (blast) | Bunker Buster (armour) / Barrage (three missiles) |
| Laser Lance | a beam down the road it FACES, to where the road turns; heat on a held target | Capacitor (damage) / Chill (control) | Fast Cycle / Sear (a burn) | Cutter / Deep Sear |
| Bastion | support aura in a plus, shoots nothing | Command (harder) / Logistics (faster) | Reach (longer arms) / Hardpoint (+range) | Warlord / Quartermaster |

The base world is Bolt, Mortar, Frost and Refinery; the other four come from
the tree (§11). Tower names stay functionally readable — a tower is picked
under pressure.

**The Refinery mines Ore, and only on an ore cell.** Site selection is a
pre-commitment, and an ore cell you refine is an ore cell you are not defending
from. Its deep choices trade a slower cycle for a bigger vein. Mining Scrap
off the vein exists only as a relic — a rule that gets broken, not a rule that
ships broken.

**The Bastion's reach is a plus**: the cells straight out from it, one each way
at base, never the diagonals. The reach takes no modifier but the Bastion's own
tree and gift, so the drawing never says more than the rule. **The Missile Rack
is a Standard tower and a sidegrade on Grim**, left so on purpose (D57).

### 5.4 What a tower tells you

Every tower shows a **full stat block** — damage and its type, rate, DPS,
range, area, effect strength and duration, lifetime damage and kills — and
every upgrade choice carries a **written description**. An either/or fork the
player cannot read is a coin toss. **Previews fold every live modifier**
through the same fold the live card reads — the Core's gift, a neighbouring
Bastion, relics, the boon under the cell — so numbers never jump on build, and
a change for the worse is drawn as one.

### 5.5 Attack shapes

Towers differ in the *shape* of what they do: a chain that jumps between
bodies, a beam down a straight run of road, a blast, a plus. Shape is
mechanical — each suits a different piece of map geometry.

- **One radius, three consumers.** A blast's radius is a single folded stat:
  the damage it deals, the area it draws and the number the card prints read
  the same value.
- **Some towers have a dead zone.** A minimum range is a real stat, folded like
  range. The range drawing shows it for every tower — the covered area as rings
  fading inward, the dead zone dark with a red rim.
- **Ballistics: aim is committed at fire time.** A shell is thrown at a
  *place*. Missing is a real outcome. Homing is a per-projectile property,
  never the default.
- **A fired shot always resolves.** A shell lands where it was aimed; a homing
  shot whose target died re-acquires. Deleting a paid-for shot is a visual lie
  and an invisible nerf.
- **Piercing is local**: a shot continues only into bodies within half a cell
  of the impact.
- **Facing.** A tower that fires along a line has a facing the player sets —
  on build and on demand — saved and replayed like any other choice. Radial
  towers have none and never show one.

## 6. Economy

> **§32 changes this** *(approved, NOT BUILT)*: **you bank what you mined**, so Ore spent in a run costs the bank nothing (§32.9); the **clear bonus** pays for killing forward (§32.3). Ore tiers stay.

**Scrap** funds the run: towers, tiers and prospecting. It comes from kills,
and from calling a wave early (§9.2). **Ore** buys relics at the Core (§7.3)
and banks at the run's end for the tree (§11). Towers are Scrap, the Core is
Ore; they never compete for one pool.

**Ore's tension is not what it buys but when**: Ore spent on relics in a run
is Ore not banked.

**A deposit is finite.** Each ore cell carries a richness, set at generation. A
Refinery draws it down and **stops when the vein is exhausted**, leaving
ordinary ground. Which vein, how long, when to move — and the answer is on the
board: a rich vein shows more gold among its glyphs, a spent one none.

**Mining is balanced by opportunity cost alone.** No enemy hunts refineries,
and wave budgets are never reduced to compensate for mining.

> **The general rule:** the difficulty model offsets choices that increase
> combat power, and ignores choices that do not. Longer roads increase power,
> so `L` is offset — sub-linearly. **Known exception:** Ore routed into the Core
> buys combat power; calibration models some Core investment.

**Ore is stored per tier.** Three tiers; one Refinery mines every tier, slower
on a richer one; the HUD, the summary and the bank read by tier. How a higher
tier is reached is §26.

## 7. Relics — the found power

### 7.1 Why the game needs them

Tower trees are **planned power**: strict, symmetric, the same every run. That
is the right spine, and it is not what anyone remembers. What people come back
to a roguelite for is the run where two unrelated things multiplied.

- **Volume × interaction.** Roughly **6–10 acquisitions a run** is the floor at
  which combinations start happening at all.
- **Rule-breaking, not number-breaking.** `+15% damage` is never a story.
  *"Overkill damage carries to the next enemy in line"* is, because it changes
  what the game **is**.

A rule only feels broken if it was iron first. Balance intent: relics are
**allowed to be unfair**; a run trivialised because three of them stacked is
the product working (§9.1).

### 7.2 What a relic is

A **rule modifier, authored as data**, held by the Core, **run-local**. One
pool, one row of slots (six at first, twelve at most — §11):

| Kind | Behaviour |
|---|---|
| **passive** | always-on; the majority. Tower modifiers fold into every tower like a tier |
| **active** | a global ability on a long cooldown, fired from the strip |
| **consumable** | single use, then its slot is free |

The ring around a relic's icon says its rarity by colour and its kind by its
corners. **The authoring constraint**: no relic may create a tower state
without a distinct visual — relics change what towers *do*, never which of the
14 forms they are.

### 7.3 Where relics come from

> **§32 changes this** *(approved, NOT BUILT)*: every offer holds a rule-breaker, flat-stat relics leave the pool for the sets, skipping pays, and a run opens with one relic of three (§32.5, §32.7).

| Channel | Its job |
|---|---|
| **The offer** — every second wave, three relics, pick one or skip | Guarantees the cadence; the only channel a build can count on. Dealt when the board is quiet, or by the clock at the latest (§9.2) |
| **Ore at the Core** — draw a relic, or reroll the offer | Ore's in-run sink. The first draw is dear and every purchase multiplies the next; rerolls climb the same way |
| **The map** — caches (§4.6), chests (§4.9), a boss's chest | Makes *this* map and *this* run decide what is on offer |

**The run's pool is what the run can use**: a relic whose only effect touches a
tower kind the run's tree does not grant is left out of every channel.

### 7.4 The set

The CATALOGUE is the list. The shape of it: rule-breakers (Overflow, Frostbite,
Tithe, Splinter, Vein Tap, Loadbearing, Ricochet, Payload, Penetrators …),
actives (Orbital, Stasis, Deep Vein …), consumables, and tower modifiers.
**Payload and Penetrators are the set that carries a plain-Bolt build** (§8).

### 7.5 Meta progression owns the pool, not the power

Relics never persist between runs. What persists is **which of them the game
may offer** — §28.

### 7.6 Rarity, stacking, fusion

- **Four rarities** — common, rare, epic, legendary — each a colour on every
  frame, slot and card. Every relic has a base rarity; every draw rolls a rarity
  weighted by the wave, never below the base and never above the band the tree
  has opened (§28). A rarer copy carries its own numbers and card text; a
  boolean rule is the same at every rarity. **Rarity means power**, not only
  scarcity. **Legendary is never dealt**: it is reached only in the Forge.
- **Sets**: relics carry tags; at two and three of a tag a set effect lights
  and folds like a passive.
- **Duplicates are a per-relic property.** A multiplier or a charge held twice
  is a bigger one; a boolean rule held twice is a dead card, so an unstackable
  relic leaves the pool the moment it is held. Flat global numbers are not
  relics at all, and nothing multiplies by "triple".
- **A full row is a decision, never a wall.** A pick names the held relic it
  replaces; a held relic salvages for Ore; **the Forge** combines two of a kind
  at one rarity into the next, or a recipe pair into a fusion-only relic, which
  the codex shows as `???` until it is made once. A slot pulses when its rule
  fires and the summary counts the fires.
- **Relics outnumber slots by a wide margin**; a pool a single run can drain is
  a mechanic with an expiry date.

### 7.7 Loot tables — one answer to "what do I get"

A **loot table** is content: a named, weighted list of outcomes (Scrap, Ore of
a tier, a consumable, a relic at a rarity, boon ground, nothing), rolled on a
named RNG stream at claim time so it rides the input log. Sources reference a
table by id and contain no payout logic: `rock_cache`, `boss_drop`,
`void_chest`. The codex shows every table.

### 7.8 The relic as an object

A relic is drawn, not abbreviated: every relic has its own icon at board-glyph
scale, in a square slot (a slot grid reads as an inventory only if its cells
are square).

## 8. Enemies

Fourteen bodies across two damage types (kinetic, energy) and a table of
**traits that are rules, not labels** (`engine/sim/traits.ts`). All enemies
follow the road; there is one flow field; **flyers are cut** (§14). Every body
carries a `damage` — what it costs the Core on a breach. Names: §30.

| trait | the rule | the answer |
|---|---|---|
| armoured | a flat amount off every kinetic hit; ignores slows | hit big, or use energy |
| insulated | a flat amount off every energy hit | hit big, or use kinetic |
| shielded | a shield destroyed separately, regrowing after a pause unhit | Shatter; sustained fire |
| fast | shakes a slow off in half the time | reach and burst |
| swarm | arrives in packs of three | blasts, chains |
| sprint (harrier) | runs faster while unhit | keep it under fire |
| charge (lunge) | double speed under half health | finish it in one volley, or slow it first |
| split (brood) | dies into two scuttles where it fell | kill it early, or let a blast take the halves |
| heal (stitch) | mends every body near it | priority WEAKEST; kill it first |
| burrow (delve) | untargetable for its first cells | a line deeper in, not at the entry |
| frontshield (buckler) | hits from ahead do a third | flank it from beside the road |
| bulwark (the Warden) | bodies near it take less while it lives | the boss to kill first |

**Damage types decide fights.** Every attacking tower deals one type; every
body carries a multiplier per type, wide enough to choose a tower by. One tower
type clearing every wave is precisely the failure "every placement is a build
decision" exists to prevent.

**What bounds a build is what a hit is** (D37, D38). Nothing caps how many
towers a player may build and no price rises with the count. Instead:

1. **The chassis is the expensive part** and an upgrade is a better buy than
   another tower; a run still opens with three guns, or one and its upgrades.
2. **Plating.** From wave 6 every body wears one more point of armour, and one
   more every three waves — against **every** hit, kinetic or energy. The
   next-wave panel says how much before the wave comes: *"PLATED +2: every hit
   loses 2 more - hit big"*. Armour may take all but a small floor of a hit.
3. **Energy goes through a body's own armour**, and meets **insulation**
   instead — armour's mirror, worn by bodies kinetic is good against, never by
   a body that is armoured. Nothing *ignores* armour: Railbore and Bunker Buster
   are big hits, and a big hit is already the answer.

So plain Bolts, never upgraded, lose Standard and Grim, energy width loses them
too, a mixed line wins Standard, and Grim is lost by the base world and won by
the tree. **A Bolt-only build that relics carry is welcome** — "to find
'broken' synergies". The readings are in `docs/lab/`; the bands that hold them
are the balance gate (§9).

**Every rule shows where it acts.** A shield is a bracket around the body and
breaks separately; health reads off a mark beside the glyph; **every status is
the GROUND under the walker** — cold for a slow, ember for a burn, ice for a
freeze — never a glyph and never a tooltip. Each body is drawn as its rule (a
burrowed delve is a mound with nothing to shoot; a buckler wears its plank on
the side it faces). Behind the mark the sim keeps each effect **with its
source**: slows are entries, resolved by "the coldest wins, the longest lasts".
**And every rule prints**: a rule the player cannot see or read is a bug in the
presentation, whatever the code does.

**A field speaks one language.** A *field* is anything that acts on every body
within a radius of a source, again and again: the Frost Emitter's slow, the
stitch's heal. Every field is drawn the same way (`EffectsLayer.drawField`; a
second drawing of a field is a defect):

1. **It is the ground, never a glyph.**
2. **One ring, from the source outward**, one glyph-band wide.
3. **Brightest at its source, nothing at its reach** — the radius it dies at IS
   the field's reach.
4. **It is a glow, never a flash**: ten overlapping fields add up to a glow;
   under reduced motion, a still ring at a third of the peak.
5. **The colour says whose.** The player's fields lift the ground toward light;
   an enemy's field washes the ground toward the colour of what it does, mixed
   INTO the ground and never painted over it — road must still read from rock
   through it.

An **impact** is not a field: a blast, a missile's spokes, the orbital column
are single events whose extent is the radius that kills, never more.

## 9. Difficulty: measured, never derived

Wave budgets are **measured, not computed** — one maxed tower and ten cheap
ones are the same spend and wildly different defences. The instruments:

- **The lab** (`packages/harness`): a headless runner that plays **named
  plans** — every one in one table (`lab/plans.ts`), every run built by one
  function from the app's own map for the seed (`specFor`).
- **The balance gate** (`npm run balance`, in CI): win-rate bands for the
  ladder's rungs and a thermometer, against `balance/targets.json`. The bands
  record what the game **is**; red is a question, and a meant move moves the
  band in the same PR with its why.
- **The fit harness**: every rung of every Threat against a *patch* of the
  game, so a number is derived against a target stated first
  (CONTRIBUTING §6 rule 7).

Not built: a bot that *chooses*, and the **human offset** — every rate is the
lab's player; by how much a person differs, nobody has measured.

Two live inputs remain: **`L`**, effective road length, offsetting as the
square root of the mean lane over the Threat's floor, never below 1; and
**`M`**, permanent tree power, near 1 until stat nodes exist.

### 9.1 Every run ends in death

> **There is no stable state.** Threat grows faster than any achievable build.
> A great build buys *how far you get*, never *whether you survive*.

Threat scales geometrically; composition escalates in kind and not only in
count; player power is bounded. **A run has an end** — a final wave and a
victory (Calm 15, Standard 20, Grim 25); Endless is the tree's last Threat node
and its own curve is not designed (§32.10).

**Relics make run power a distribution, not a number.** Calibration targets a
distribution across relic draws. *Trivial-by-relic is the feature;
trivial-by-map is the defect* — so "no trivial seed" is measured with the relic
layer held fixed.

### 9.2 Wave tempo

> **§32 changes this** *(approved, NOT BUILT)*: a wave arrives inside a short spawn window and pays a **clear bonus** against its par (§32.3). The early call stands as written.

- **The wave clock runs from one launch to the next** and never waits for the
  last enemy. Killing fast buys quiet; dawdling stacks waves.
- **The player may call the next wave early** once the current one has finished
  spawning, and is paid the remaining seconds in Scrap — a bet, not a chore.
  **Wave 1 waits for the call.**
- **The next wave is known before it comes**: composed one wave ahead and shown
  by kind, count, traits, formations and plating, with **the answer** under it
  — the first trait of the wave and what answers it (`traitAnswers.ts` is the
  one table). A trait the strip must show as a two-glyph mark is spelled out in
  a legend beside it.
- **Packs and formations.** A wave is composed from packs — one kind, one
  front, one formation: a **column**, a **wedge**, a **wall**; heavies walk in
  half packs. Wave 10 reads unlike wave 5 by shape. A wave has a ceiling of
  bodies; a body the slot cap refuses waits in the queue.
- **Boss waves** come every fifth wave **and on the final wave, by rule**: the
  heaviest body unlocked — or a boss-only body once its wave is reached —
  scaled in health, bounty and Core damage, with a multiplier that shrinks with
  the body's own weight, behind a normal escort.
- **An owed relic offer is dealt by the clock at the latest**; only a player's
  call over living bodies carries the debt.
- **Calm is where placement is learned**: its own gentler curve, every kind
  three waves late, and it stays winnable by placement alone (D39).

## 10. The bot

One policy, framed honestly as a **regression detector** — "did this change
make wave 14 harder?" Absolute difficulty comes from the human offset. An
in-game autopilot falls out for free. *Not built; the lab's named plans do the
regression job today (§9).*

## 11. Meta progression

> **§32 changes this** *(approved, NOT BUILT)*: towers arrive on a first-hour schedule, Grim and Endless open by wins, and loadout comfort is half offset (§32.11); the difficulty targets are §32.12; the daily run is §32.13.

Banked Ore buys **the tree** (`content/assets/tree/nodes.json`), sold on the
workshop page. **The tree owns the pool and the capacity, never the power.**

| branch | sells |
|---|---|
| **arsenal** | Tesla, Bastion, Missile Rack, the Laser behind the Tesla |
| **reliquary** | the rarity bands — rare, then epic (§28) |
| **capacity** | relic slots 8 / 10 / 12; tile slots 2 / 3 / 5 |
| **threat** | Grim, then Endless |
| **ore** | Rich veins (tier 2), Mother lodes (tier 3), the tile pool (§26) |

A node costs Ore of **one** tier; higher nodes want rarer Ore. The base grant
is Bolt, Mortar, Frost, Refinery, every common relic, six relic slots, Calm and
Standard, one tile slot. **A run's identity carries its tree state**: the run
save and the run code hold what the run started under, so a resume and a replay
see the same towers, pool and slots. A potency stage — permanent stat nodes —
is optional and last: it makes `M` a real variable and multiplies every balance
check.

The workshop draws the tree as a tree — §22.

### 11.1 The tile pool is the ore economy

> **§32 changes this** *(approved, NOT BUILT)*: **the tile shop is removed**: every run past wave 5 pays a tile by depth, tiles recycle into **parts**, and the Smith opens at the first recycle (§32.10).

Ore tiers need no distribution rule in the generator: **richer veins are tiles
you own.**

- **The tile shop** (the workshop's TILES page) sells the shipped specials the
  tree has opened, as previews; the loadout pool is what is **owned** plus what
  was minted. Copies: §24.
- **A tier-N vein is bought with the Ore below it**, steeply — the sink that
  gives lower tiers a purpose.
- **The Tile Smith** opens once every tile the workshop can sell is owned. It
  is a page of the shell: the brush matrix, the tile at the board's scale,
  overlays (a vein at a tier the tree allows, a boon at a tier), the derived
  connectors, the engine's verdict and **the price, itemised** (§27). MINT pays
  from the bank. Minted tiles are the player's: the picker pages and has a
  delete mode. The standalone `tilesmith.html` stays as the authoring tool.

Three systems — ore tiers, the tile pool as progression, the Smith as a meta
feature — are one. "You author the map" survives, one level up.

## 12. Determinism and replays

A run is a **seed plus an input log** — kilobytes. That buys shareable replays,
daily challenges, bug reports as files and a regression corpus. A fixed 20 Hz
tick, a seeded PRNG with named streams, and a golden replay hash in CI hold it.
Every seed's first draws are mixed, so neighbouring seeds deal unrelated maps.

## 13. Presentation

Specified in [ASSETS.md](ASSETS.md). Settled: **spleen 5×8**, an 8×5-glyph cell
(§3), 24-bit colour per glyph, WebGL2 rendering.

- **The board is alive.** Terrain drifts, towers cycle idle frames and play
  **attack animations on the fire clock**, projectiles spray, explosions bloom,
  and background colour does most of the work. A Mortar's blast and a
  Missile's are different drawings; a beam's colour says its path.
- **Motion has two clocks.** What belongs to the **world** runs on sim time —
  it freezes on pause and speeds up at 4×. What belongs to the **interface**
  runs on the wall clock. Walkers and projectiles are **interpolated** between
  ticks, so a 20 Hz simulation shows as a 60 Hz picture.
- **Smoothness comes from spatial phase, not from redrawing less**: each glyph
  takes a phase from its position, so a wave travels across the water.
- **Void is water.** The **shoreline** — a procedural band where land meets
  water — is wanted and not built.
- **Frames are authored, sixteen of them** — §29.
- **The strip under the board is the second panel**: build buttons drawn with
  the towers' own sprites (grey when unaffordable), the wave now and next, the
  Core's slots and actives.
- **Effects are data**: definition files, recoloured variants, duration scaled
  by importance, on a subcell coordinate system. **Reduced motion** is honoured
  by every effect.

## 14. Deliberately rejected

Recorded with their reasons so they are not re-proposed.

- **Pseudo-3D / tilted projection.** Occlusion hides the board; doubles the art.
- **Hex tiles.** Diagonal edges step badly at this scale; rectangular sprites
  sit badly in hexes.
- **Block elements / the CP437 idiom.** Taste; and spleen has no blocks.
- **Sub-tile walls; bypass or shortcut zones; growth-on-upgrade footprints.**
- **Player tile-laying during the run.** Was pillar 1; it converged on a
  different game. The machinery survives in the generator and in §11.1.
- **Flyers.** Their job died with tile-laying. One flow field.
- **The Wall.** Every candidate job died: paid mazing, flyer blocking, ground
  denial.
- **The Core as a fifth tower.** A shooting Core is redundant and makes the
  last line the strongest; and four symmetric purchases cannot produce a
  build-breaking run. Replaced by §7.
- **Relics that unlock both options of an upgrade tier.** The most tempting
  rule to break and the one that cannot be: it invents states with no artwork.
- **The tech tree opened mid-run.** Permanent power bought during a run leaves
  no run-level tension.
- **Mutating the road mid-run.** It would force the runtime path check pillar 2
  forbids.
- **The Core as a wave dial** — skip an entry, delay a wave. It hands the
  player the difficulty model's own inputs. (Calling a wave early is a plain
  HUD button, §9.2.)
- **Claiming a cache by building on it.** Sell the tower and the relic was
  free.
- **Mechanically multi-cell enemies.** Visual size yes; mechanical size no.
- **Prospecting as a one-time unlock.** It spent a tower variant on a boolean.
- **Silently stalling while the tab is hidden.** The sim runs in a worker and a
  pause is explicit.
- **A cap on towers, or a price that rises per copy** (D37): "not the most
  elegant way". The damage model bounds a build; under the rework, the map.
- **Neutral structures on the map.** Boon ground and the Smith's placeables
  already own that job.
- **A per-relic lock behind a tree node** (D29): "convoluted". The tree gates
  rarity only (§28).
- **Print-trade names for towers** (D8): flavour may be themed; a tower's name
  must say what it does.

**Refused at the design review of 2026-09-19** (the reasons are in
`docs/design/rework-2026-09-19.md` §4): collapsing Ore to one tier; a guaranteed
"hands" relic, or an always-on Core ability; burning a part for a one-run
feature ("pretty pointless"); hardness tiers of rock and kinds of find; a dig
priced by the road the pad touches; the dev's first Core roster (a lane buff
dominates a tower buff, and a striking Core is a tower); **paid power, for
good** (§32.14).

## 15. The shell — from launch to quit

### 15.1 Screens and flow

> **§32 changes this** *(approved, NOT BUILT)*: run setup gains **the briefing** and **the Core** the player chooses (§32.5, §32.6).

```
launch → title → ┬─ new run → run setup → THE RUN ⇄ pause
                 │                            ↓
                 │                    victory / defeat
                 │                            ↓
                 │                      run summary ──┐
                 ├─ continue (resume a saved run)     │
                 ├─ workshop (the tree, tiles, Smith) │
                 ├─ settings                          │
                 └─ the codex            ←────────────┘
```

**The shell owns the whole screen.** Every page — the title, run setup with the
loadout, the workshop, the Tile Smith, the Forge, settings, the codex, the
summary — is a page of one screen system in one menu language (a framed plate,
a lit title band, columns, links, key hints), sized to the viewport and
operable by keyboard; Esc leaves every page. **No screen owns game state**: the
sim is the single source of truth. **The run summary is a designed screen** —
what killed you, which wave, what you built, what each relic did, what you
banked, your bests.

### 15.2 Persistence

| | Contents | Notes |
|---|---|---|
| **Run state** | seed + input log + tick + **the generated map itself** | **A save IS a replay.** Resuming replays the log onto the stored map — generation never re-runs on resume, so a save survives generator changes; content drift is refused by hash, loudly. The displayed **run code** (generator version, seed, Threat, loadout, tree state) is the run's compact identity; a stale code is refused with a sentence, never silently regenerated |
| **Meta state** | banked Ore by tier, unlocks, won relics, minted and owned tiles, first meetings, history and bests, settings | Survives runs |

Stored in the browser: **no accounts and no cloud saves**, so progress is
per-browser — mitigated by **export/import of a save file**. Every save carries
a **schema version**: migrate when we can, otherwise say so and offer a reset.
Never wipe silently; never load a save we half understand. The sim runs in a
**Web Worker**, so a hidden tab keeps simulating.

### 15.3 Onboarding

A first-timer reaches *"I understand what to do"* without reading anything:
the tutorial and the first-meeting banners (§20), the codex for the whole
thing at once, and opening waves gentle enough to learn in.

### 15.4 Accessibility

Nothing branches on colour, so accessibility is a view change: a
**colourblind-safe palette**, **full keyboard operation**, **reduced motion**,
**text scale** for the HUD. Colour is never the only carrier — a vein says its
tier in words too.

### 15.5 What "runs well" means

60 fps at full board on mid-range hardware; **WebGL2 required**, and its
absence gets an honest message; bundle and asset budgets tracked; **every error
reachable from a player path has a recovery story**.

## 16. Out of scope

Mobile/touch · multiplayer · music · accounts or cloud saves · a terminal
build. **Minimal SFX are in scope for beta** — impacts, builds, wave start, UI;
not music, not a mix.

## 17. Acceptance criteria

The milestones and their state are ROADMAP's. **M1, the fun test, passed**:
*"the game is fun now, it's just very unbalanced and with quite a few holes
still."* The finish line is an observable scene: **a stranger played, lost, and
started again** ([STRANGER-TEST](STRANGER-TEST.md)).

**STABLE BETA — the definition of done:**

- a stranger plays a full run without help, understands why they lost, and
  wants another
- shell complete: title, setup, pause, summary, settings, workshop, codex
- persistence versioned, with export/import; **no silent data loss**
- calibrated difficulty; no unwinnable or trivial seed across ≥500 runs,
  measured with the relic layer held fixed
- content floor: **8 towers · ~14 enemies · ~40 relics · ~100 tiles**
- art pass complete for everything on screen; reduced motion honoured
- colourblind palette, full keyboard operation
- 60 fps at full board; WebGL2 absence handled honestly
- no known crash and no known save-corruption path
- licences and attribution correct (Apache-2.0; spleen BSD-2-Clause)

## 18. Monetization — intent, not design

> **§32 changes this** *(approved, NOT BUILT)*: what the research found is recorded as advice in §32.14. D27 is still his, and deferred to beta hardening.

Daniil is seriously considering monetizing the game eventually, on the Stone
Story RPG model and lighter: small things that make the game more fun, never
pay-to-win. **Nothing built now may close the door, and nothing may be built
for it before beta.** A named relic is never sold (§28.1).

## 19. The thought dump of 2026-09-06

Thirty-two items, all filed; its table is frozen in
[history](history/prd-2026-09-19.md) because code and commits cite it by item
number. What it decided lives in the sections above; what it left open is in
the tracker.

## 20. The tutorial, first meetings and the codex

**A first run is Calm and is walked**: thirteen steps, each a target, a
sentence in the column and an end — the Core, an entry, good ground by the
Core, the Bolt's button, the tower's card, Scrap and Ore, CALL WAVE, the
strip's NOW and NEXT, the offer, the Core's slots, **a fork**, a rock, the end.
The target is a pulsing box-drawn outline on the terminal it lives on. The run
never pauses for it: the sim is the sim, the tutorial is a lens. The step lives
in the meta save; SKIP ends it; settings replays it.

**A first meeting does not stop the game** (D41). The first time a kind of
enemy walks in sight, a kind of tower stands, a chest surfaces or boon ground
is on the map, **a banner appears in the side panel**, under the next wave: the
name on a quiet plate (never the accent bar — that is CALL WAVE's), the one
line that answers it, *click: the full card*, and a bar that runs down over
running play. A click opens the card, paused, by the player's own hand; an
unread banner is simply gone and its card is in the codex. Several queue. **One
card still pauses: the grunt's, while the tutorial runs** — it is where a
stranger learns that cards exist. Every line a banner can say is held against
the panel's width by a test.

**The codex is the wiki of everything met**: basics, towers, enemies, relics,
boons, loot tables. An enemy not yet met is a `???` page that says when it
walks; a locked tower or relic says what opens it; an undiscovered fusion is
`???`. Reachable from the title and from pause.

## 21. The creative page

A debug page off the pause menu, behind `?dev` or Ctrl+Shift+D: purse, board
(kill all, call, surface a chest), spawn any body or a boss, grant any relic at
a rarity, toggle tree nodes. Every verb records no input, so a replay of such a
run diverges from that point, and the page says so on its first line. **It is
not a player's surface and never will be.**

## 22. The tree drawn as a tree

The workshop draws the tree as rows of **plates**: a row per branch; chains
linked by a rail where a node hangs from the one before it; a plate is a ring in
its state's colour — bought, buyable now, not yet — around the thing it buys
(the tower's own sprite, a relic icon, a drawn glyph icon), with the name and
the price under it. The first click reads the node, the second buys. The purse
stays in the frame, and a node priced in a tier the purse lacks says where that
ore comes from.

## 23. The tile library's breadth

A 5×5 tile holds **nine** legal routing shapes once a road that touches itself
is a special. The tile generator (`harness/src/tilegen`) enumerates them by
family (Lane, Bend, Dogleg, Staircase, Meander; Fork; Cross); the breadth is
the land — fillers (scree, outcrops, veins inside rock) and a decorated road
for every shape. Ids are stable, the tool is idempotent, and the map sweep is
the guard. The road's variety beyond that is the carve's (§31) and the
specials' (§4.8).

## 24. The multiset of copies

The pool holds **the number of copies owned**. A second and a third copy of a
special cost the first price plus half of it per copy owned, three at most; the
loadout badges a tile "1/2" and a click loads one more copy, up to what is
owned and the tile slots; **the carve places every loaded copy**; the run code
carries them all. A minted tile is one copy.

## 25. Mini tile previews

The loadout and the shop draw a tile at **one glyph a cell** — road as
box-drawing, rock, ore and ground as a glyph each, in a 5×5 frame with the
tile's badge — a dozen a page, paged by keyboard. The board's scale stays for
the Tile Smith, where cells are edited.

## 26. The ore ladder — how a higher tier is reached

A higher ore tier is **an upgrade bought in the workshop's ORE branch**, and
that one purchase does two things:

1. **It opens a new ore on the map** — the ore the player already knows,
   differing on three axes and no others: a **different colour** (the rock
   carrying it is tinted too), a **slower cycle and a smaller vein**, and a
   **much lower chance of spawning** — each rung about a third as common as the
   one below. Opening a tier moves nothing but veins: the same seed is the same
   board.
2. **It opens a Tile Smith cell for that tier.** Placing a tier-N vein costs
   tier-N Ore **on top of** the lower-tier cost — so the tier is its own gate,
   and the authoring sink keeps it scarce after the first strike.

Each tier is a slow, self-funding loop rather than a wall. The spawn chance,
the vein size and the cycle per tier are the lab's
(`docs/lab/ore-sweep-2026-09-17.md`).

## 27. The Smith prices a tile by what is on it

> **§32 changes this** *(approved, NOT BUILT)*: `priceTile` gains **pads priced by the road they touch** and loses its free ground; minting also needs the **parts** painted (§32.10).

**One pricing function, `priceTile()`**, used by the Smith's MINT and by the
shop, itemised line by line before the player pays; no price is written in a
content file.

- A **plain straight road costs no more than a shipped tile of similar
  quality** — plain authoring is not a luxury.
- Every feature adds: a road cell a little (path length is what a road tile is
  for), a rock cell, a vein by its Ore and its tier, boon ground **by power,
  steeply**, and **crowding** — every feature after the first raises all of
  them.
- **The extremes are meant to be extreme**: a tile of high-tier veins ringed by
  the strongest boons is prohibitive by design.

The Smith is a dial: pay a little for a shape you need, pay enormously for a
tile that changes a run. The coefficients are the lab's
(`docs/lab/price-sweep-2026-09-17.md`).

## 28. The tree gates rarity, never a named relic

- **No named relic is ever locked behind the tree.** Every common is in the
  pool from the first run.
- **Rarity is what unlocks**: the tree sells *which rarities a run's offers may
  deal* — nothing finer-grained.
- **Some relics exist only at a higher rarity**, and become reachable when that
  rarity does.

### 28.1 What unlocks a rarity, and what unlocks a relic

| | unlocked by | what it is |
|---|---|---|
| **a rarity band** — rare, then epic | **bought**, with Ore, on the workshop's tree | a price per band, paid once |
| **a specific relic above common** | **won** | a Standard win earns the next rare in line, a Grim win the next epic, Calm earns Ore only. **A queue, not a dice roll**, so the codex can name the win: "your NEXT win at GRIM earns it" |

**You never buy a named relic**; selling one is D27's territory and deferred. A
won relic is the player's at once and appears only inside its band. **Forging
in a run is free of the band**: the band gates what is *dealt*, never what is
*made*. There is no third storefront.

## 29. Frame-based animation stays, at sixteen

Sprites animate from **authored frames, sixteen of them**. With a standing
invitation, his: *"I am however open to be convinced that having frame-based
animation is a wrong approach at the root … If so — suggest me smth, with
visuals."* The alternative worth showing is **procedural animation over the
glyph grid** — one key frame plus rules (per-cell phase, a glyph cycle, a
colour ramp, seeded displacement). It is a side-by-side he can look at, never
an argument in prose; until it exists, sixteen is the rule.

## 30. Names

*A body is named for what it does to you, in one plain concrete English word*:
grunt, scuttle, swarmling, brute, shellback, husk, harrier, lunge, brood,
stitch, delve, buckler; a boss is capitalised — Juggernaut, the Warden. These
are defaults he may amend; **a rename is a content edit, never an id** — ids
(`skitter`, `courser`, `ram`, `blob`, `mender`, `mole`, `pavise`) stay in
content, saves, replays and the golden hash.

## 31. The walk has a character, and the land has regions

**The walk.** Each Threat has a taste for straight road, and **each map rolls
its own** around it: Calm reads as avenues — long and gentle; Grim as knots —
short and turning, always; Standard has no taste of its own and the widest
roll. A walk also leans toward the heading its map has used least. None of this
is a rule: it re-weights which *legal* move a wandering walk prefers, and the
topology reads nothing from it.

**The land.** A map draws three region centres, one of each land family
(plain, rock, ore), and a tile of its region's family is far likelier there: an
ore valley, a rocky pass, open ground. **The Core's own region is never rock.**

**What it did not do**: two *Standard* maps still resemble each other more than
the gate wanted. What a Standard map looks like is decided by how many lanes it
has, and that by the fill target, which stays 0.9 on every map (D36).

Both are absent from the engine's defaults — the app, the worker and every
sweep get them from `threatKnobs()` — so the engine's default generator and the
golden hash stand still.

## 32. The rework of 2026-09-19 — the map asks, the run answers *(Daniil, after the design review; D42–D54. APPROVED DESIGN, NOT BUILT)*

**Read this first.** Everything in this section is a decision about what the
game will be; **none of it is in the build.** Until a ledger row of "The
Rework" ships, the sections this one supersedes still describe the running
game, and each of them carries a pointer here. The reasons, the research and
what was dropped are in
[docs/design/rework-2026-09-19.md](design/rework-2026-09-19.md); the order of
work is ROADMAP's. **Every number below is a first pass with its target beside
it** — the lab derives the number, the target is the design (CONTRIBUTING §6
rule 7).

**Why.** The review found that the two decisions a tower defense lives on each
had one answer. *Where do I build?* — the shared stretch by the Core, always:
ground was unlimited and every lane passes there. *What do I build?* — the
same forks every run, because every run asked the same question. Relics and
the tree then added less than they seemed to. The rework makes the **map** ask
a different question each run and gives the **run** the means to answer it.

### 32.1 Build pads: every cell that is not road is a pad, rock, or bedrock *(D42)*

- **A pad** is where a tower stands. A vein sits on a pad (an ore cell is a pad
  with ore under it, as today). Boon ground is a pad with a modifier (§4.7).
- **Rock** is a pad with rock on it. *If it can be dug, there is a pad
  underneath* — always (§32.2).
- **Bedrock** never breaks. It is functionally the void: nothing is built on
  it, nothing is under it. **Scarcity is the share of bedrock.**
- **Plain buildable ground no longer exists as a cell type.** "Ground" in the
  sections above means *pad* from the day this ships.

**Very scarce** *(his word)*. Target: a 7×5-tile board opens with **25–35
pads**, of which **3–5 touch the last shared stretch by the Core** — §4.5's
"cells next to the Core are meant to be precious", finally true of the map and
not only of the gifts. A run ends with 12–20 towers. Pad count and placement
are Threat knobs (§4.4 gains two).

What follows, and is wanted: the special tiles earn their place (a pad beside
roads that touch without merging sees two lanes — §4.8's shapes become
positions worth owning); **width is bounded by the map and by nothing else**
(D37's "no cap, no rising price" stands — a map is not a cap); and a tower is
a character with a build the board shows, because there are few of them.

*For the builder.* The first build is **a generator rule with a density knob**,
not a re-authored library: the carve demotes most of a tile's ground to
bedrock by rule, keeps pads where the rule says (near bends, beside crossings,
by the Core face), and the knob is what Daniil plays with. Tiles author their
own pads only once the rule has been played and he has said the density is
right (§32.10 needs authored pads; §32.1 does not).

### 32.2 Digging replaces prospecting *(D43; supersedes §4.6's prospecting and rock caches)*

- **One rock.** No hardness. A dig turns rock into the pad that was always
  under it. **A rock may hide boon ground** (rarely — a generation knob) **and
  nothing else**: no vein, no cache. Rock caches and their loot table are
  gone; bosses and couriers carry the loot (§32.4). Veins are always visible —
  "where is the money" is still answered by looking (§6).
- **One layer of sight.** From outside, rock and bedrock look the same. A cell
  shows which it is — and the boon under it, if any — **only when it touches an
  open cell** (road, pad, or a finished dig). Everything behind is unknown
  until a neighbour opens. The decision is a tunnel: *can I reach the cell
  that touches both lanes, or is there bedrock in the way?* Contents are dealt
  at generation, so the seed still describes the run (§12).
- **Slow and costly, and flat.** First pass **60 Scrap and 45 seconds** (today
  25 and 30). **The price does not depend on what the pad touches** — that
  prices a pad in the Tile Smith (§32.10), never a dig. *Target:* a run that
  digs at every chance ends with **about six more pads**, so a dig is a
  decision made three to six times a run and never a systematic excavation
  (the Dome Keeper criticism this is built to avoid).
- **One crew.** One dig at a time, queued. More crews come from **the
  Refinery's tree** (the *Automation* fork becomes **Second Crew**) **and/or a
  relic** (*Work Gang*, +1 crew, stacks) — the lab says whether the game wants
  one source or both.
- **Sight is bought.** *Quarry* (faster digs) becomes **Seismograph**, with
  two tiers only: **epic — two layers of sight; legendary — the whole board.**
  The Refinery's *Survey* fork reveals rock within two cells of that Refinery
  — the local, tower-bound version. *Prospector's Eye* stops making digs free
  (digs at half price). *Vein Tap* ("build on rock") has to be read again under
  scarce pads: the lab's question, asked before it ships.

### 32.3 The clear bonus: kill them early, get paid *(D44)*

His rule, in place of the dev's bounty-by-distance: **the sooner a wave is
cleared, the more it pays.** A wave killed near its entry never walks the
road, so clear time already measures how far forward a build kills — and it
reads as one line a player already understands:

> `WAVE 7 CLEARED in 31 s ⠂ par 60 ⠂ +58`

- **Par** is per wave: its spawn window plus the walk of its slowest body from
  the farthest entry to the Core.
- **The bonus** is that wave's bounties × the share of par saved. First pass
  ×1.0, so it grows with the waves by itself. *Target:* a build that hugs the
  Core earns about **60%** of today's income, a build that kills forward about
  **160%** — bounties are re-fitted around that spread.
- **Spawn windows are short** *(his condition)*: a wave finishes arriving
  within about a fifth of its clock (Calm 11 s, Standard 8, Grim 6), or the
  last body's entry time decides the payout and not the build. Formations
  (§9.2) compress to fit.
- **The early call is unchanged** (§9.2): it pays the seconds left on the
  clock and stays the bet on overlapping waves. Par runs from a wave's own
  launch, so a call never touches it. Two bonuses, two jobs: one for killing
  forward, one for risk.
- **The last body decides the payout** — accepted. *Watched in the prototype:*
  one slow Juggernaut setting a whole wave's bonus, and a tax on slow-based
  builds. **The stated fallback** is the per-kill form of the same idea
  (bounty ×1 at the Core rising to ×3 at the entry).
- *For the builder:* a body must know its wave for "wave N cleared" to mean
  anything while waves overlap. Not verified in the sim at the time of
  writing.

### 32.4 The courier replaces the void chest *(D45; supersedes §4.9's random chests)*

A body that carries a chest. **Much faster than anything else** (first pass
3.5–4 cells a second; the swarmling, at 2.8, is today's fastest). **Nothing
holds it: slows, freezes and Stasis all fail on it.** It does no breach
damage. It shows in the NEXT preview and has its own cue on entry. It comes
about **one wave in three**. Killed, it drops its chest where it fell, claimed
by a click as chests are today; missed, the chest is gone and nothing else is
lost. *Target:* a build that ignores it kills it about 30% of the time, one
that answers it (reach and burst on a long straight, priority FAST) about 80%.

Random chests that surface on empty cells are cut: a chest that blinked
somewhere was an attention tax, a courier in the preview is a problem the
build can be asked to solve. **A boss's chest stays.**

### 32.5 The briefing: every run asks a different question, before wave 1 *(D46)*

After the map is dealt and before anything is built, one page shows:

- **the map**, with its entries and its named features ("short approach",
  "two crossings", "a rich vein far west");
- **this run's host** — two or three featured kinds the waves lean toward;
- **the bosses, by the wave they come on** — and each boss has **one
  mechanic of its own**, as the Warden already has; "the heaviest body,
  scaled" stops being a boss;
- **a starting relic: one of three, each a rule-breaker** (§32.7);
- **the Core** (§32.6).

Forks stay permanent (pillar 3). They stop being coin tosses because the plan
is made with information: *shield-heavy host, so Shatter, and an early Tesla.*
**An undo window:** any purchase refunds in full for about five seconds, so a
misclick is not a lesson.

### 32.6 Core types carry the in-wave verb *(D47 the concept, D55 the first roster)*

A planner's game in which sitting back is not optimal needs one thing to do in
every run. It comes from **the Core the player chooses at run setup** — the
roguelite's character select: a run identity, an unlock axis (Cores are earned
by feats and wins), and the home of Core skins later (§32.14).

The laws of a Core, all his or agreed with him:

1. **One verb on a cooldown, never on click rate.** Clicking helps; clicking
   fast never helps more. A design that would reward an auto-clicker is a
   defect.
2. **The Core is still not a tower** (§4.5, §14): no verb deals damage to a
   body.
3. **No verb is another verb's bigger sibling.** He rejected the first roster
   for exactly this: a lane taking +30% always beats one tower at double rate.
   Cores differ in **role**, never in degree.
4. **Relics modify the verb, they do not supply it**: a shorter cooldown, a
   verb that lands twice, one that chains to a neighbour. Nothing
   game-breaking unless stacked for on purpose.

**The first roster** *(D55 — Daniil accepted the dev's three and changed one)*:
**Relay** — *Overdrive*: one tower fires at double rate for four seconds
(offence, a timing call on the build). **Bulwark** — *Brace*: for four
seconds **every breach costs the Core half** (defence: press it as the leak
arrives; *his change — the dev had proposed no damage at all, and a verb that
erases a leak is a verb that forgives the build*). **Foreman** — *Rush*: a dig
or a Refinery cycle finishes fifteen seconds sooner, and the run starts with a
second crew (economy). Offence, defence, economy: three roles, no common unit
to compare them in. The durations and cooldowns are the lab's.

### 32.7 Relics: rule-breakers from the first run *(D48; amends §7)*

- **Every offer holds at least one rule-breaker**, and commons include simple
  ones. §7.1's own test — *"+15% damage is never a story"* — is applied to the
  pool: **flat-stat relics leave it** (Hot Loads, Iron Sights, Quick Hands and
  their kin) and their numbers fold into the set bonuses, where a quiet reward
  for a theme is right and a card is not.
- **Wins unlock stranger relics, never stronger ones** (§28.1 stands as
  written).
- **Skipping an offer pays Scrap**, so taking a relic always costs something.
- **Relics keyed to one tower family**, enough of them that a cold run, a
  blast run and a chain run are each three or four pieces deep; and thought
  dump item 29, **a relic that grants one unique tower for this run only.**
- **A standing check in the lab:** win rate per relic held, every sweep. Pick
  rate needs players and waits for them.

### 32.8 The counter system after the map bounds width *(a question for the lab, not a decision)*

D37 and D38 stand. The review's hypothesis is that chassis pricing and plating
were answers to unlimited ground, and that with §32.1 they have nothing left
to do — in which case plating goes and the eight rapid-fire fork options stop
being late-game traps. **§32.12 measures it; nothing here assumes it.** The
behavioural bodies (harrier, lunge, brood, stitch, delve, buckler) are the
counter system that works, and stay.

### 32.9 Ore: you bank what you mined *(D49; supersedes §6's "spend now or bank")*

**Spending Ore in a run takes nothing from the bank.** At run end the player
banks, per tier, **what the run mined × the Threat's weight × the share of
waves cleared.** One currency, no new purse.

- Relic draws, rerolls and the Forge stop costing the player's future, so the
  third relic channel (§7.3) gets used.
- A Refinery is an ordinary economy tower: Scrap now, relics later this run,
  the bank as a consequence. *When can I afford the greed* is a question a
  tower defense player already likes.
- Farming Calm stops paying: its weight is low (§32.10's weights).
- **Ore tiers stay** (D30, §26). A tier-N vein banks tier-N Ore, as today.

### 32.10 Tiles come from runs; parts come from tiles *(D50, D51; supersedes §11.1's shop and the Smith's gate)*

**The tile shop is removed. The Tile Smith opens with the first recycled
tile.** One loop replaces three competing ones:

**Every run that cleared wave 5 pays one tile**, won or lost. *(The floor is
there because without it the fastest farm is: start, die, collect.)* The
tile's rarity is rolled on a **depth score** *S = waves cleared × the Threat's
weight* — Calm 0.5, Standard 1, Grim 1.6; an endless run keeps counting on its
Threat's weight.

| S | what it means | the tile |
|---|---|---|
| under 20 | any Calm run (a win is 7.5); a Standard run lost part-way | common |
| 20–39 | a Standard win; a Grim run lost past wave 12 | common 70% · rare 30% |
| 40–59 | a Grim win | rare 20% · epic 75% · legendary 5% |
| 60–79 | endless, past about wave 38 on Grim | epic 60% · legendary 40% |
| 80 and over | endless past wave 50 | legendary |

So grinding Calm is pointless by arithmetic, and the deepest tiles exist only
at the bottom of an endless run. **The first time a player reaches a band, the
tile is the band's best and spare parts come with it** — a reason to push
depth that is not a leaderboard (the Greater Rift failure). **An endless run
must be guaranteed to end** — an accelerating curve, never starved income.
Endless is not built; its curve is designed when it is.

**One function values a tile** — §27's `priceTile`, extended, and still the
only pricing function in the game:

| what is on the tile | what it adds |
|---|---|
| a tile | 20 |
| a road cell | 0.9 |
| **a pad** | **by the road it touches**: 6 + 6 × n^1.3, n = road cells among its eight neighbours → 12 at a corner, 21, 42 at four, **96 for a pad ringed by road** *(his rule: the more roads it touches, the dearer)* |
| rock over a pad | six tenths of that pad (it still costs a dig in the run) |
| bedrock | nothing — it is the void |
| a vein, boon ground, crowding | as §27 |

**Nothing but bedrock is free**: there are no plains to paint. That one
number is the tile's **rarity** (bands fitted by the lab so the shipped
library splits about 60 / 25 / 12 / 3), what it **recycles** into, and its
**mint fee**.

**Parts are the features themselves** — Road, Rock, Pad, Vein (by tier), Boon
I–IV, Crossing. They are an inventory shown on the Smith's brushes, **never a
currency: a part has no price and cannot be bought.**

- **Recycle** a tile: half of each kind on it, rounded down, and always at
  least one of its best feature.
- **Mint** a tile: every part painted, **plus** the Ore fee `priceTile` says —
  in the tiers §26 says, so a tier-2 vein still needs tier-2 Ore.
- **The part ladder** *(his point: a player ends up with hundreds of roads and
  rocks, only ever loads a handful of tiles, and should make those few as
  strong as he can)*: **lower parts climb into higher ones.** First pass: 10
  Road or Rock → 1 Pad; 20 Road → 1 Crossing; 5 Pad → 1 Boon I or 1 tier-1
  Vein; two of any tiered part → one of the next tier (the Forge's rule, which
  the player already knows). *Target:* the commons of about ten runs are worth
  one Boon I; a six-boon kill-zone tile is dozens of rare-or-better runs —
  §27's "many runs" ceiling, kept.

### 32.11 The tree sells breadth; wins open the Threats *(D52; amends §11)*

- **Towers arrive on a first-hour schedule** — a new tower in each of the
  first four runs — not as purchases. (This absorbs the unlock schedule of
  #385: what a stranger's first sessions are made of is designed as one
  thing.)
- **Grim opens on a Standard win, Endless on a Grim win.** Skill gates; two
  nodes fewer.
- The tree keeps **relic slots, loadout slots and the rarity bands**, priced
  in Ore by tier as today.
- **Loadout comfort is half offset.** The summed value of a run's loaded tiles
  raises the host's wave budget sub-linearly, as `L` already does for road
  length (§9). *"Gear makes it somewhat easier"* — written as a rule, so
  authoring a tile is expression and never purchased easy mode.

### 32.12 The difficulty targets, stated before any number moves *(D53)*

Grim is a **skill check**. Gear makes it somewhat easier. **No-skill play with
every unlock should almost never win it** *(his words)*.

| the player | Calm | Standard | Grim |
|---|---|---|---|
| naive play, base kit | wins most runs | rarely wins | — |
| naive play, everything unlocked | — | — | **under 5%** |
| skilled play, base kit | — | 85–90% | 15–25% |
| skilled play, everything unlocked | — | — | 50–60% |

This is also the answer to the ladder's open question of 2026-09-19 ("what is
Grim for a player with the whole tree?"): on relics **dealt**, 50–60%, never
the 99% of a hand-picked six. **One re-fit of all three Threats** happens
after §32.1–32.4 are played and settled, against this table; the plating
question (§32.8) is answered in the same pass, by measurement.

### 32.13 The daily run *(D54)*

One seed a day, the same for everyone. **The first attempt is scored; practice
is unlimited** (the Dead Cells compromise — a thirteen-minute run is too long
for a pure one-shot to feel casual). **The loadout and the Core are fixed and
everything is unlocked**: fair, a showcase of what a new player has not
earned yet, and no meta state — earned or ever sold — can touch the score.
The result page makes a **shareable ASCII strip** (a glyph a wave: clean,
leaked, boss) **with no link in it**. No sign-up, no notifications. A plain
*days played* counter with no escalating reward and nothing lost on a missed
day. The first run of any day banks double. Feats ("win Standard with no
Bolts") pay the bank and push players off a solved build. A leaderboard needs
a backend (D28) and comes later, as it did elsewhere.

### 32.14 Money, later *(advice recorded for D27; nothing is designed)*

Stone Story RPG, the model he named, is **premium with no purchases on PC and
free-with-purchases on mobile**; the "aggressive" criticism was of the mobile
half. The lowest-regret path found: **free on the web (own page, itch.io) →
a cosmetic supporter pack (palettes, glyph skins, Core skins) → a paid Steam
build with Steam Cloud.** Keep the save one blob under 1 MB and it ports to
portal cloud saves and to Steam. **Recommended against, permanently: paid
power** — an uber tier, paid chests, sold parts. With a shared daily the
score is only worth something while nothing purchasable touches it; the fixed
daily loadout (§32.13) is the wall that keeps that true even if D27 later
decides otherwise for the rest of the game.

### 32.15 What this section supersedes

| section | what changes when the rework ships |
|---|---|
| §2 pillars | "Every placement is a build decision" gains its other half: **the map makes placement a decision**; pillar 1 means the player's decisions, not only the generator's knobs |
| §4.1 | Ground → pad; Rock always hides a pad; **Bedrock** is new; "buildable" means pad |
| §4.6 | prospecting → digging (§32.2); rock caches are cut |
| §4.9 | random void chests are cut; the courier carries the chest (§32.4); a boss's chest stays |
| §5.3 | the Refinery's T2 forks: *Survey* reveals, *Automation* → *Second Crew* |
| §6 | "spend now or bank" → bank what you mined (§32.9) |
| §7.3–7.4 | every offer holds a rule-breaker; flat stats leave the pool; skipping pays (§32.7) |
| §9.2 | short spawn windows and the clear bonus (§32.3); the early call stands |
| §11, §11.1, §27 | no tile shop; the Smith opens at the first recycle; parts; pads priced by the road they touch; towers on a schedule; Grim and Endless by wins (§32.10–11) |
| §15.1 | run setup gains the briefing and the Core (§32.5–6) |
| §18 | D27's intent gains §32.14's advice |
