# ASCII Defense

A roguelite tower defense that runs in the browser and draws everything —
terrain, towers, enemies, UI — as characters on a grid.

**The game generates the battlefield; you defend the Core.** Roads are carved
outward from a Core at the middle of the map to the board edges, and every road
end is a front the enemy marches in from. You place towers beside those roads,
commit each one to an either/or upgrade path, collect rule-breaking relics, and
try to hold **wave 20** — every run ends in victory or death, and coasting is
death.

▶ **[Play the current build](https://argarot.github.io/ascii-defense/)** ·
▶ **[Tile Smith](https://argarot.github.io/ascii-defense/tilesmith.html)**
(author your own terrain tiles — they join the generator)

Add `?seed=12345` to pin a world, `?threat=0|1|2` for Calm / Standard / Grim.
**A seed is the whole world** — same map, same waves, same relic offers on any
machine, verified to the tick against the live deployment.

## What a run looks like

0. A **title screen**: new run (pick Calm / Standard / Grim), continue a saved
   run, settings, how to play. `Esc` pauses mid-run; a run ends on a summary
   screen. Progress lives in this browser and can be exported to a file.
1. A generated map: the Core near the middle, winding roads to the edges, ore
   veins (finite — richness is visible as gold density), rock that may hide
   ore or relic caches, boon cells that buff whatever is built on them, and
   `[?]` relic caches.
2. Click ground, pick a tower: **Bolt** (homing shots), **Mortar** (ballistic
   shells — aimed at a place, they land there whether or not anyone is still
   standing on it), **Frost** (slow pulse), **Refinery** (mines Ore — on
   veins only, until the vein runs dry). Each has 3 either/or tiers: 14
   variants per tower, every choice final, every choice explained in words
   before you buy it.
3. Every third cleared wave offers a **pick-1-of-3 relic** over the live
   board: passives that break rules (overkill chains, slowed enemies take
   more), actives fired from the Core (orbital strike, board freeze),
   consumables. Duplicates stack. Spend banked Ore to draw or reroll.
4. Rocks are containers: **prospect** them (scrap + time; Survey refineries
   speed and automate it) to reveal ore, a cache, or bare ground.
5. Survive the elite waves, the Juggernauts, and geometric scaling that
   guarantees no build is safe forever — then hold wave 20.

## Where the project is

**M1 passed its gate** ("is it fun?" — yes); M2 and the product shell are under
way. Working today: everything above, plus an **effects engine** (explosions
with shockwaves, projectile trails, drifting terrain, void-as-water, tower idle
frames — all of it respecting reduced motion, none of it able to touch the
simulation), the **sim running in a Web Worker** so a hidden tab keeps playing,
**saves that are replays** (seed + input log, so resuming is bit-identical), a
balance lab (`node tools/lab.mjs`) that predicts a build's death wave and
verifies it against the real headless sim, and full cross-machine determinism.

**Not built yet**: damage-type resistances, relic fusion, tile loadouts chosen
before a run, onboarding, art. **Known broken**: the Tile Smith's road
authoring is mid-rework — it can currently produce tiles the generator will
never place. The roadmap runs to a stable beta at
[docs/ROADMAP.md](docs/ROADMAP.md); the checklist is [docs/WBS.md](docs/WBS.md).

## Design ideas worth knowing

- **Roads are port segments.** A road cell declares which sides connect
  (`- | L J F 7`); two cells join only when both face each other. Roads can
  touch — run side by side, fold into S-bends — without merging, and the
  route is a graph the enemies can never lane-hop across.
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
