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
way, and the project is working toward a stable beta.

This section used to be a session-by-session changelog, and it was a copy of
the roadmap's ledger that had to be kept in agreement with it by hand. It is a
link now, because the ledger is the record:

- **what shipped, session by session, and what is next** —
  [docs/ROADMAP.md](docs/ROADMAP.md)
- **what is in the game right now** — [docs/CATALOGUE.md](docs/CATALOGUE.md),
  generated from the content files, so it cannot be out of date
- **what is still open** — the issue tracker:
  `gh issue list --label scope`

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
