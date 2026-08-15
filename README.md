# ASCII Defense

A roguelite tower defense that runs in the browser and draws everything —
terrain, towers, enemies, UI — as characters on a grid.

**The game generates the battlefield; you defend the Core.** Roads are carved
outward from a Core at the middle of the map to the board edges, and every road
end is a front the enemy marches in from. You place towers on the ground beside
those roads, commit each one to an either/or upgrade path, and try to survive
waves that get bigger, tougher and wider every time.

▶ **[Play the current build](https://argarot.github.io/ascii-defense/)** ·
▶ **[Tile Smith](https://argarot.github.io/ascii-defense/tilesmith.html)**
(author your own terrain tiles)

Add `?seed=12345` to the URL to pin a world. **A seed is the whole world** —
same map, same waves, same enemy positions on any machine, verified to the tick
against the live deployment.

---

## What a session at the keyboard actually looks like

1. A map is generated: the teal Core block near the middle, two to five winding
   roads reaching the edges, ore veins scattered away from the roads, rock in
   the way. Press `R` for a different world.
2. **Click a patch of ground** near a road — it stages the tile and shows a
   breathing preview ring of your currently chosen tower's reach.
3. **Pick a tower in the side panel** to build there: **Bolt Turret** (fast
   homing shots), **Mortar** (arcing shells that explode on impact), **Frost
   Emitter** (a pulse field that slows everything inside it and, by default,
   does no damage at all).
4. Waves arrive numbered, with the *next* wave's entry points telegraphed on
   the map — red `!!` markers on a breathing plate — so you can reposition
   before it lands. Enemy roster arrives in stages: grunts, then fast skitters,
   swarmlings, armoured brutes, shielded shellbacks, and husks.
5. Kills pay **Scrap**. Spend it on more towers, or on upgrades: each tower has
   **three tiers, each an either/or fork**, and a committed choice locks its
   sibling out forever — 14 distinct versions per tower. Hovering an option
   previews exactly what it buys: the changed stats pulse green, and a range
   upgrade shows its grown ring on the map.
6. Set each tower's targeting priority (first / last / closest / weakest), sell
   at 70% back, run the clock at 1×/2×/4× or pause with space.
7. Every enemy that reaches the Core takes a bite out of its health. At zero,
   the board goes dark: **THE CORE HAS FALLEN.**

## Where the project actually is

**Playable now** — generated maps, waves with escalating pressure, three tower
families with full upgrade trees, Scrap economy, targeting priorities, Core
health and defeat, a full-height side-panel HUD with live previews, and a
working terrain-tile authoring tool.

**Not built yet** — the Refinery and the in-run Ore economy; the Core's own
upgrade tree (choose its type, then its tiers, paid in Ore); replay
record/playback; the balance harness; meta progression between runs; and the
real art — every sprite you see today is a placeholder awaiting the REXPaint
pipeline.

**Roadmap position:** M1 Phase 1 (test harness and CI) and Phase 3 (the board,
map generation, the simulation) are complete and tagged `v0.1.0` / `v0.2.0`.
Phase 2 (the hand-authored art round-trip) is parked until its one manual step
can happen. Phase 4 (the game itself) is most of the way done — see the
remaining items above. After that: a smoke-test bot, then the honest question
of whether the thing is fun. Details in [docs/WBS.md](docs/WBS.md) and
[docs/ROADMAP.md](docs/ROADMAP.md).

**Difficulty is deliberately uncalibrated.** Wave pressure is currently a
hand-set curve; the plan is to measure it with a bot across hundreds of seeded
runs and commit the result as reviewable data, so a balance change shows up as
a diff rather than a feeling.

## Design ideas worth knowing

- **Invalid maps are unrepresentable.** Terrain tiles are 5×5 cell grids whose
  edge connectors are *derived* from the drawing — a road may cross a tile edge
  only at that edge's centre — so a tile's declared shape can never disagree
  with its drawn shape. Map generation carves a *tree* of roads, so every entry
  has exactly one route to the Core and there is no road that leads nowhere.
  The game never checks whether a map is solvable, because an unsolvable one
  cannot be assembled.
- **One tool, one rule set.** Tile Smith's export button is gated by the same
  engine function that validates the shipped tile library in CI. A tile it
  exports cannot be illegal.
- **Every run is reproducible.** Fixed 20 Hz simulation, seeded RNG with
  independent named streams, and no wall-clock time anywhere in the engine —
  the groundwork for replays as shareable files and for a regression corpus
  built from real play.
- **Content is data.** Towers, enemies, tiles, palettes and upgrade trees are
  JSON with schemas; types are generated from those schemas and CI fails if
  they drift. Mortar's explosions and Frost's slow field were added as *data*,
  against fields reserved before either feature existed.

## Technical shape

Rendered by **WebGL2** at 24-bit colour per glyph — canvas 2D was measured at
38 ms/frame under real animation load and rejected. The font is
**[spleen 5×8](https://github.com/fcambus/spleen)** (BSD-2-Clause), parsed from
BDF into a 1-bit atlas at build time; its **braille patterns** supply the
density ramp terrain shading uses.

Three levels, used consistently everywhere: **glyph** (5×8 px) → **cell**
(5×3 glyphs, one tower) → **terrain tile** (5×5 cells).

The simulation knows no glyphs, colours or pixels — enforced by lint, not by
discipline. Art will be authored in **REXPaint** against a generated spleen
font and imported as JSON.

## Running it

Requires Node 22+.

```bash
npm install
```

```bash
npm run dev
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`, `npm run preview`.

To regenerate the glyph atlases from the vendored fonts:

```bash
node tools/build-fonts.mjs
```

## Documentation

| | |
|---|---|
| What the game is | [docs/PRD.md](docs/PRD.md) |
| How it is built | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| How it looks, and the art pipeline | [docs/ASSETS.md](docs/ASSETS.md) |
| What happens next | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Tracked work packages | [docs/WBS.md](docs/WBS.md) |
| Invariants and environment traps | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Picking up where we left off | [HANDOVER.md](HANDOVER.md) |

## Licence

[Apache-2.0](LICENSE). Vendored fonts keep their own: unscii is public domain,
spleen is BSD-2-Clause.
