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
  stays locked. Eight tower families produce a very large build space.
- **Every run is reproducible.** A run is a seed plus an input log, a couple of
  kilobytes. That gives shareable replays, daily challenges, bug reports as
  files, and a regression corpus built from real play.
- **Mazing without unwinnable states.** Road is pathable but never buildable, so
  a valid route always exists — a structural guarantee, not a runtime check.
  Building on shortcuts lengthens the route; a live preview shows you where
  enemies will go before you spend.
- **Mining the margins.** Ore sits far from the path. The Refinery's upgrade
  tree *is* the decision: one path pays Scrap that helps you now, another pays
  Ore that only helps future runs. Nothing compensates you for choosing wrong.
- **Difficulty measured, not guessed.** Wave budgets are calibrated from a bot
  playing hundreds of seeded runs, then committed as reviewable data. A balance
  change shows up in a diff.

Full design in [docs/PRD.md](docs/PRD.md); technical approach in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); build order and conventions in
[docs/HANDOFF.md](docs/HANDOFF.md).

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
