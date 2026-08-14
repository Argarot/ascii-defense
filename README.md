# ASCII Defense

A roguelite tower defense game that runs in the browser and draws everything —
terrain, towers, enemies, projectiles, menus — as coloured ASCII characters on a
monospace grid.

**Status: M0.** The delivery path is being proven. What is deployed right now is
a render-loop demo, not the game. See [docs/ROADMAP.md](docs/ROADMAP.md).

▶ **[Play the current build](https://argarot.github.io/ascii-defense/)**

---

## What it will be

- **Deep tower evolution.** Three upgrade paths of five tiers per tower, with a
  hard crosspathing limit — one path to tier 5, a second to tier 2, the third
  stays locked. Eight tower families behave like sixty builds.
- **Procedural everything.** Maps, waves and run structure are generated, not
  authored. Runs are a branching node map across three acts.
- **Mazing without unwinnable states.** Roads are pathable but never buildable,
  so a valid route always exists. Bypass zones let you lengthen the route by
  building — mazing is an economic decision, not a puzzle you can lose to.
- **Difficulty derived, not tuned by hand.** Wave budgets come from a model of
  achievable DPS against live path length, validated by a headless bot harness
  that plays hundreds of seeded runs.

Full design in [docs/PRD.md](docs/PRD.md); technical approach in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Running it locally

Requires Node 22 or newer.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default <http://localhost:5173>).

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck, then production build into dist/
npm run preview     # serve the production build locally
```

## Why the rendering is fast

Drawing a character grid naively — `fillText` per cell, every frame — costs
about 17 ms/frame at 120x50 with 400 moving entities. That is already over
budget at 60 fps before any game logic exists.

`src/term/Term.ts` instead pre-rasterises every (glyph, colour) pair into an
offscreen atlas and repaints only cells that changed between frames. Same scene:
**0.93 ms/frame**, roughly 17x headroom. Numbers were measured before the
approach was chosen, not after.

## License

[Apache-2.0](LICENSE).
