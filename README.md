# ASCII Defense

A roguelite tower defense that runs in the browser and draws everything —
terrain, towers, enemies, UI — as characters on a grid.

**The game generates the battlefield; you defend the Core.** The Core stands
at the board's east edge; roads are carved from it across the board until
nine tenths of the land is road, and every road end on the other three
sides is a front the enemy marches in from. You place eight kinds of tower
beside those roads against fourteen kinds of enemy, commit each tower to
an either/or upgrade path, collect rule-breaking relics, and try to hold
**wave 20** — every run ends in
victory or death, and coasting is death.

▶ **[Play the current build](https://argarot.github.io/ascii-defense/)** ·
▶ **[Tile Smith](https://argarot.github.io/ascii-defense/tilesmith.html)**
(the standalone authoring tool; **the game has its own Tile Smith page**,
in the workshop, once every tile the workshop sells is yours — author a
tile with the game's own brushes, MINT it for Ore at the price its roads,
veins and boons earn, and load it in run setup, as many as the tree's slots
allow: a loaded tile is guaranteed on the map. Tiles whose roads touch
without merging, carry two separate roads, or carry a richer vein, are
specials by law — they appear only when you chose them)

Add `?seed=12345` to pin a world, `?threat=0|1|2` for Calm / Standard / Grim.
A seed determines the whole run **for a given loadout**; the pause and
summary screens show a copyable **run code** (generator version + seed +
threat + loadout + the tree state the run started under). The save file
carries the generated map itself, so resuming never re-rolls the world — a
save doubles as an exact replay.

## What a run looks like

0. A **title screen**: new run (pick a Threat the tree has opened), continue a
   saved run, the **workshop**, settings, how to play. `Esc` pauses mid-run; a
   run ends on a summary screen. Progress lives in this browser and can be
   exported to a file. **A first run is Calm and comes with a tutorial**:
   thirteen steps, each pointing a pulsing yellow box at the thing to look
   at (the Core, an entry, ground by the Core, the Bolt, its card, Scrap and
   Ore, CALL WAVE, the strip, the offer, the slots, a fork, rock) with a sentence on what it
   means; NEXT or Enter moves the look-steps, your own actions move the
   rest, SKIP ends it, and SETTINGS replays it.
1. A generated map: the Core near the middle, winding roads to the edges, ore
   veins (finite — richness is visible as gold density), rock that may hide
   ore or relic caches, boon cells that buff whatever is built on them, and
   `[?]` relic caches.
2. Click ground, pick a tower: **Bolt** (homing shots), **Mortar** (ballistic
   shells — aimed at a place, they land there whether or not anyone is still
   standing on it), **Frost** (slow pulse), **Refinery** (mines Ore — on
   veins only, until the vein runs dry; a richer vein pays a rarer tier of
   Ore, slower). Four more — the Tesla Coil, the Missile Rack, the Laser
   Lance, the Bastion — are bought in the workshop. Each has 3 either/or
   tiers: 14 variants per tower, every choice final, every choice explained
   in words before you buy it — and the build preview shows the tower as it
   would be on THAT cell, every modifier folded.
3. Every second wave, once the board is quiet, offers a **pick-1-of-3 relic**
   over the live board: passives that break rules (overkill chains, slowed
   enemies take more, a toll on every enemy walking past a tower), actives
   fired from the Core (orbital strike, board freeze), consumables
   (sandbags, a flashbang). A rule you already hold is never dealt again.
   Relics come in rarities — common, rare, epic, and a legendary reached
   only by forging — and the **Forge** combines two of a kind into the next
   rarity or a recipe pair into a fused relic. Spend Ore to draw or reroll —
   each purchase makes the next dearer.
4. Rocks are containers: **prospect** them (scrap + time; Survey refineries
   speed and automate it) to reveal ore, a sealed cache, or bare ground.
   **Caches open free**, and hold Scrap, Ore, a relic — or turn their own
   ground into a boon. Every boss drops one where it falls.
5. **The wave clock never waits for you**: waves come on a timer from the
   last launch, you can **call the next one early** for Scrap, and the HUD
   shows what is coming before it comes. Boss waves every fifth wave and on
   the last; the road's length is paid for in enemy health. Hold wave 20 —
   or, once the tree grants it, play **endless**.
6. **Between runs, the workshop.** Every run banks its Ore by tier, and the
   tree spends it: four towers to buy, relic branches by tag (their commons
   join the pool; their rarer relics are **earned by wins** — a rare at
   Standard, an epic at Grim), relic slots from six to twelve, tile slots,
   the Grim threat, endless, and tiles — road specials and the richer veins
   whose Ore buys the higher nodes. A new player starts with four towers,
   sixteen relics and six slots; the codex shows every locked thing and what
   opens it. The tree owns what may appear and how much you may carry — never
   a stat.

## Where the project is

**M1 passed its gate** ("is it fun?" — yes); M2 and the product shell are under
way.
**Session 33 (2026-09-08)** was Daniil's feedback round and the plan's
five: Esc leaves every page and the workshop's purse sits in its title
band; the clock deals a relic offer the board never went quiet for;
**encounter cards** pop on every first meeting and the title's **CODEX**
is the wiki of what was met; the title's towers animate; **the tree is
drawn as a tree** of ringed plates with the towers' sprites; chests come
half as often and **a boss leaves a crowned chest** rarer with the wave;
the mender's field is a green pulse; a **creative page** behind `?dev` or
Ctrl+Shift+D spawns anything; the tile library goes to eighty-two (every
legal road shape, sixty land tiles) with a map sweep as the guard; a
second and third copy of a special can be bought and every copy is
placed; tile previews are one glyph a cell; and a stranger-test protocol
waits for hands. **Session 32 (2026-09-08)** was Enemies II: seven more bodies, each a
rule the towers answer (a courser that sprints while unhit, a ram that
charges under half hp, a blob that dies into two, a mender that heals its
neighbours, a mole that surfaces past the entry, a pavise whose shield
faces the way it walks, and the Warden, a boss whose cover softens every
hit around it); waves composed from **packs** of one kind on one front in
a column, a wedge or a wall, the boss on a beat behind; every rule shown on
the body, in the strip and as **the answer** under the next wave; and a
balance pass with an enemy sweep (every body alone against every tower
line) that set Standard at five bodies a wave on a steeper hp curve.
**Session 31 (2026-09-07 night into 2026-09-08)** was Daniil's "make this
session big": a **tutorial** for new players (thirteen steps, a pulsing
box on the thing to look at, the Core's ground and the first fork among
them), the **early game measured** on the base world and re-curved (armour
never strips more than 65% of a hit, a boss's multiplier shrinks with its
own weight, Calm has its own curve and meets the heavier kinds three waves
later - a plain-Bolt player who forks holds it), the keyboard on every
page, three comb passes over the pages and the HUD, relics that need a
tower the run lacks left out of its pool, a **logic comb** over the sim
against the relic cards (fourteen findings, all fixed - among them a
repeatable Core heal, a sell refund at today's prices, and holes in the
state hash), and personal bests on the history page.
**Session 30 (2026-09-07)** gave the shell one face: every page is a
framed plate with a lit title band, columns and key hints; the workshop is
drawn as a tree with a node hanging from the one it needs; the Tile Smith
is a page of the game behind its door; held and offered relics wear a ring
in their rarity's colour with corners that say the kind; chests surface
with a rarity that colours them and pays more; a Missile's blast looks
unlike a Mortar's and a Laser's path colours its beam; and the lab read
the tier-2 and tier-3 Ore a loaded vein tile banks.
**Session 29 (2026-09-06 night into 2026-09-07)** built the meta tree
in eight PRs: a fix bundle from Daniil's thought dump (the Bastion's reach
as a plus, the build preview folding every modifier, the relic offer only
at a quiet board, chests on ground, pierce within half a cell), then the
tree as content and as a run's identity, the workshop page, Ore by tier,
the tile shop and the Tile Smith's door, the lab at tree states (which
priced the nodes), and the codex with locked entries, undiscovered fusions
and the legendary lane. Working today: everything above, plus an **effects engine** (explosions
with shockwaves, projectile trails, drifting terrain, void-as-water, tower idle
frames — all of it respecting reduced motion, none of it able to touch the
simulation), the **sim running in a Web Worker** so a hidden tab keeps playing,
**saves that are replays** (seed + input log + the generated map, so resuming
is bit-identical and survives generator changes), a balance lab
(`node tools/lab.mjs`) that predicts a build's death wave and verifies it
against the real headless sim, and full cross-machine determinism.

The map generator and worker lifecycle were **rebuilt against a written
specification** (2026-08-19): every generated map is checked against the whole
rule set — exactly one route per entry at the resolution enemies walk, so
loops are impossible; a chosen special appears exactly once; a run start
yields a fresh game or a stated error, never a silent fallback. The three
bugs that forced the rebuild are named regression tests now.

**Design round 1 (2026-09-03)** reworked the fundamentals a player's-eye
review found flat: the wave clock and the call button, boss waves, traits as
real rules, stackability and escalating prices for relics, caches that open
free onto loot tables, a dead zone for the Mortar with the range drawn as a
filled disc, and every tower fork rebuilt as two roles instead of two numbers.
**Later that evening** Daniil's feedback on the build folded the passive
layer back into the relic pool (passives are relics: one pool of
fifty-two, the offer every second wave), gave combining its own window
(the Forge), priced the Laser, Tesla and Missiles up, fixed the relic
card, the HUD column's height and the copy buttons, and added a SPRITE
PACK setting that loads the art agent's reworked pack beside the shipped
one.
**Session 28 (2026-09-06, evening)** built Relics II on Daniil's accepted
defaults: a passive layer of six slots picked every second wave and
folded into every tower; rarity with teeth (a wave-weighted roll on every
draw, rare and epic copies with their own numbers), tags and set effects;
replace, salvage and combine — two of a kind climb a rarity, five recipe
pairs fuse; twenty more relics for forty-one; void chests claimed through
one loot table; and a relic sweep that bounds the layer. The morning's
feedback fixed the effects that died before the render clock reached
them, statuses as the ground under the walker, a Laser with no range and
a pulse a second, an Orbital column of light, and the paused board.
**Session 27 (2026-09-06)** wrote the art agent's brief
([docs/ART-AGENT.md](docs/ART-AGENT.md)) and the painted-study importer
behind it, reworked the Laser into a pulsing background beam that reaches
the road's turn, gave the picture a render clock, turned HOW TO PLAY into
the codex (every tower, enemy and relic on pages with its sprite), added
settings that persist, a summary that tells the run's story, first-run
prompts, and the lab's three instruments.
**Session 26 (2026-09-05, late night)** answered six feedback items (the
strip at board scale, a build preview card, subtle attack sequences in
every sprite, a curving continuous arc, interpolated movement) and gave the
game its combat identity: kinetic and energy damage with resistances,
statuses with sources, tower facing and the Laser Lance, the Bastion's
aura and a unique gift for every tower next to the Core — **eight
towers**.
**Session 25 (2026-09-05, evening)** gave every enemy, relic and the Core
face a generated placeholder sprite, taught the sprite format kinds and
attack sequences (every tower flashes, recoils and charges on screen),
drew the orbital as a beam, added two towers — the Tesla Coil's chain arcs
and the Missile Rack — and wrote [docs/CATALOGUE.md](docs/CATALOGUE.md),
every tower, enemy and relic in one table.
**Sessions 23–24 (2026-09-05)** moved the Core to the east edge as a
three-cell face with one entrance (Daniil's redesign), filled the board with
road on a carve that no longer fails any loadout, put a strip under the board
with the towers as sprite buttons and the Core's actives, measured the
difficulty with an economy, and made the title a full-screen page.
**Session 22 (2026-09-04)** grew the cell to 8×5 glyphs (a 40 px square) and
made the board fit the screen; Daniil's own tower trees (fifteen states each,
two idle frames) and cobbled roads (four variations, picked by position) are
on the board through a sprite format that keys art by upgrade path. The
variant sweep in `docs/lab/` measures every path; three forks still lose.

**Not built yet**: the art agent's 6×5 relic sprites and chest sprite (the
view draws its own ring and box until then), the enemies of Enemies II,
copies of a tile as a multiset.
The roadmap runs to a stable beta at [docs/ROADMAP.md](docs/ROADMAP.md); the
checklist is [docs/WBS.md](docs/WBS.md).

## Design ideas worth knowing

- **Roads are port segments.** A road cell declares which sides connect
  (`- | L J F 7`, T-junctions `T U E 3`, the omni crossroads `X`); two cells
  join only when both face each other. Roads can touch — run side by side,
  fold into S-bends — without merging, and the **bridge** cell `B` carries
  two independent roads through one cell. The route is a graph of strands
  the enemies can never lane-hop across. Tiles that use these tricks are
  **specials**: they reach a map only through the player's loadout.
- **Connectors are derived, never declared.** A tile edge carries a crossing
  only when its centre cell continues inward. Tiles are indexed by their edge
  *partition*, so a tile carrying two separate roads is placed exactly where
  the carve routed two separate paths.
- **Invalid states are unrepresentable.** No runtime "is the path blocked?"
  checks anywhere — connectivity holds by construction, from tile validity
  through the carve to the flow field.
- **Difficulty is data, chosen by measurement.** The wave curve was picked
  from a lab sweep table, not invented; threat levels bundle generator knobs.
- **Everything is deterministic.** Seeded named RNG streams, fixed 20 Hz tick,
  no `Math.random`, no `Math.pow`/`hypot` (implementation-defined precision
  would split replay hashes across engines).

## Technical shape

npm workspaces: `engine` (pure simulation, no DOM), `content` (JSON schemas +
validated assets), `render` (WebGL2 glyph terminal), `view` (board + HUD),
`app` (bootstrap), `harness` (balance lab, tile generator, cross-content
tests), `bot` (reserved). ESLint enforces the layer boundaries and the
determinism bans; CI runs lint, typecheck, unit + browser tests, content
validation, codegen drift and build on every PR.

## Running it

```bash
npm ci
npm run dev        # local dev server
npm test           # unit + engine tests
npm run build      # production build
node tools/lab.mjs # balance sweep table
```

Licensed Apache-2.0. Font: [spleen](https://github.com/fcambus/spleen)
(BSD-2-Clause).
