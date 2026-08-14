# ASCII Defense — Technical Vision

Status: **draft, awaiting approval.**

---

## 1. Stack, and why

| Choice | Why | Alternative rejected because |
|---|---|---|
| **TypeScript** | The sim is a rules engine — 200+ upgrade definitions, trait flags, modifier pipelines. Types are the only thing that keeps that authorable. Same language browser + headless harness. | JS: unmaintainable at this content volume. Rust/WASM: build complexity buys nothing, we have 17× perf headroom already. Python: browser story is Pyodide (megabytes, slow start) and you chose browser. |
| **Vite 7** | Verified working on your machine: install + typecheck + prod build in 0.9 s. Static output → drops straight onto GitHub Pages. | — |
| **npm workspaces** | Monorepo with genuinely separate packages, no extra tooling to install. You have npm 12. | pnpm/turbo: not installed, no benefit at this size. |
| **Vitest** | Shares the Vite config. Fast. | Jest: separate transform pipeline for no gain. |
| **No game engine** | It is a character grid. Phaser/Pixi would add megabytes and an abstraction layer over a `<canvas>` we drive in under 1 ms. | |
| **No React (in the game)** | The board is one canvas; the HUD is a handful of panels. React would own the DOM we're deliberately not using. Plain TS + a tiny reactive store. | |
| **`rot-js` — read, don't depend** | BSD-3-Clause. Its display layer is slower than what we measured, and we need a TD-specific flow field, not its A*. We take ideas (and the licence permits taking code, with attribution) rather than the dependency. | |
| **JetBrains Mono, bundled** | OFL-1.1, free for commercial use and redistribution. Bundling means every player sees the identical grid; system-font fallback does not. | |

Runtime dependencies: **target zero.** Dev dependencies only.

## 2. Repository layout

```
ascii-defense/
├─ packages/
│  ├─ engine/          # headless simulation. ZERO DOM references.
│  │  ├─ src/rng/          seeded PRNG, named streams
│  │  ├─ src/grid/         terrain, flow field, spatial queries
│  │  ├─ src/sim/          tick loop, towers, enemies, projectiles, effects
│  │  ├─ src/procgen/      battle maps, node maps, ore nodes, wave composition
│  │  ├─ src/balance/      the H(w) model, budget solver, metaPowerIndex
│  │  ├─ src/economy/      Scrap, Ore extraction, node depletion, cost curves
│  │  ├─ src/meta/         tech tree graph, unlock gating, persistence
│  │  └─ src/run/          run state machine, nodes, drafting, save/load
│  ├─ content/         # DATA. towers, enemies, modifiers, biomes, bosses
│  │  ├─ src/towers/       one file per family, full 3×5 trees
│  │  ├─ src/sprites/      per-tier ASCII sprite art + animation frames
│  │  ├─ src/enemies/
│  │  ├─ src/modifiers/
│  │  ├─ src/tech/         tech tree nodes, prerequisites, costs
│  │  ├─ src/biomes/
│  │  └─ src/schema.ts     types + a runtime validator run in CI
│  ├─ term/            # the ASCII "terminal": glyph atlas, dirty-cell canvas
│  ├─ web/             # the game: screens, HUD, input, rendering, localStorage
│  ├─ bot/             # policy AI — used by harness AND in-game autopilot
│  └─ harness/         # headless CLI: batch runs, balance reports, CI gate
├─ assets/fonts/       # JetBrains Mono subset + licence
├─ docs/               # PRD, ARCHITECTURE, ROADMAP, balance notes
├─ .github/workflows/  # ci.yml (typecheck/test/build), pages.yml, balance.yml
└─ tools/              # content scaffolding + validation scripts
```

The hard rule: **`engine` and `content` never import from `term` or `web`.**
That is what makes the headless harness possible, and it is enforced by a lint
rule, not by discipline.

## 3. Rendering — measured, not assumed

Benchmarked in-browser on your machine before writing this document. Scene:
**120×50 grid (6,000 cells), 400 moving entities, dpr 1**.

| Strategy | ms/frame | fps ceiling |
|---|---:|---:|
| `fillText` per cell, full grid | 17.22 | 58 |
| Glyph atlas blit, full grid | 15.92 | 63 |
| **Glyph atlas + dirty cells** | **0.93** | **1,073** |

Verified the output is real pixels, not a silent no-op: 4.2 % ink coverage,
843 distinct colours, correct background dominance.

**Decision: glyph atlas + dirty-cell diffing.** ~17× headroom at 60 fps, which
is the budget we need for particles, damage numbers and 4× speed.

How it works: at boot, rasterise every (glyph × palette colour) pair once into
an offscreen canvas. The frame loop compares a front and back cell buffer
(`Uint8Array`s of glyph/fg/bg indices) and `drawImage`s only the cells that
changed. This is a terminal emulator. `term.put(x, y, glyph, fg, bg)` is the
entire public API, which is why a real TUI backend could be dropped in later
without touching the game.

## 3a. Sprites and footprints

Towers occupy a rectangle of cells and grow with tier — 3×2, then 5×3, then 7×4
(PRD §6.2). Three consequences for the engine:

**An occupancy grid.** A `Uint16Array` the size of the board maps each cell to
the id of whatever owns it, or 0. It is the single source of truth for "can I
build here", "what did I click on", and "is this tile pathable". Placement is a
rectangle scan against it; there is no per-tower geometry maths anywhere else.

**Upgrades are placement operations.** Growing 3×2 → 5×3 must re-check the
occupancy grid for the expanded rectangle, and is rejected if blocked. The
expansion rectangle is computed by the same function the hover preview calls, so
what the UI outlines and what the engine permits cannot drift — the classic bug
in games with variable-size buildings.

**Footprints change pathing.** Every occupied cell is impassable, so building
and upgrading both trigger a flow-field recompute. This is already the trigger
condition (§5), so no new machinery — but it does mean an *upgrade* can reroute
enemies, which the wave budget reads live via `L`.

Sprites are authored as per-cell `(glyph, colour)` pairs with 2–3 animation
frames, stored in `content/src/sprites`. The renderer blits them through the
same `term.put()` as everything else; a sprite is data, not a special case.

## 4. Determinism

Non-negotiable — it is the foundation of the balance harness, bug reproduction
and save/resume.

- One seeded PRNG (xorshift128+ / PCG), **`Math.random` banned by lint rule.**
- **Named streams** so that map generation, wave composition and combat rolls
  draw from independent sequences. Changing combat code must not reshuffle maps.
- **Fixed tick, 20 Hz.** No frame delta touches the simulation. Speed controls
  (pause / 1× / 2× / 4×) change how many ticks run per frame, never tick size.
- Rendering reads the sim; it never writes to it.
- **Golden test:** seed + scripted inputs → 2,000 ticks → hash the sim state.
  If that hash moves unintentionally, CI fails. This is the single most valuable
  test in the project.

## 5. Pathfinding

Dijkstra flow field from the Core outward across the terrain cost grid
(Red Blob Games' tower-defense approach). Each tile stores distance-to-Core and
the cheapest outgoing direction; every enemy just reads its current tile.

- Recomputed **only on build/sell**, not per tick. A 64×36 grid is ~2,300 tiles —
  sub-millisecond.
- **Three fields**: ground, burrowing (ignores ground cost), flying (straight
  line, no field needed). Cheap to keep in sync.
- The field also yields `L`, the effective path length, which feeds the wave
  budget model directly (PRD §8). Pathfinding and balance are the same system.

## 6. Simulation data layout

- **Enemies**: structure-of-arrays (`Float32Array` positions, `Uint16Array` HP,
  `Uint32Array` trait bitflags). Hundreds alive at once; this keeps the hot loop
  cache-friendly and allocation-free.
- **Towers**: plain objects. Dozens at most, and they carry rich upgrade state.
- **Projectiles**: pooled ring buffer, no per-shot allocation.
- **Occupancy**: one `Uint16Array` over the board, cell → owner id (0 = free).
  Multi-cell footprints, click targeting and buildability all read from it.
- **Ore nodes**: plain objects with remaining yield; small in number, and
  depletion must be inspectable for the balance report.

Not a general ECS. An ECS is the right answer for open-ended entity composition;
here the entity kinds are fixed and small, and the indirection would cost more
than it buys.

## 7. Stat resolution pipeline

Order is explicit, documented, and unit-tested, because this is where upgrade
systems rot:

```
base stats
  → path tier bonuses (additive within a path, multiplicative across paths)
  → crosspath synergy bonuses
  → aura buffs (Bastion, adjacency)
  → run modifiers (drafted relics)
  → temporary effects (boss debuffs, event curses)
  = resolved stats, recomputed only on change, cached per tower
```

## 8. Content as data

Everything in `packages/content` is typed data validated at build time:

```ts
export const BOLT_TURRET: TowerDef = {
  id: 'bolt_turret', glyph: '^', cost: 90, family: 'kinetic',
  base: { damage: 4, cooldownTicks: 12, range: 5.5, pierce: 1 },
  paths: {
    A: { name: 'Velocity', tiers: [ /* 5 tiers */ ] },
    B: { name: 'Caliber',  tiers: [ /* 5 tiers */ ] },
    C: { name: 'Optics',   tiers: [ /* 5 tiers */ ] },
  },
};
```

A CI validator checks every tree for: 5 tiers per path, monotonically rising
cost, no undefined effect keys, no orphaned references, and — importantly — that
each tier's cost-to-power ratio sits inside a sane band. Broken content fails
the build instead of shipping a dead upgrade.

## 9. Testing strategy

| Layer | What | Where |
|---|---|---|
| Unit | RNG streams, flow field, crosspath legality, stat pipeline order, wave budget solver | Vitest, `packages/*/test` |
| Property | Generate 10,000 maps → assert a path always exists, bypass ratio in range, buildable area in range | Vitest |
| Golden | Seeded run → state hash after N ticks | Vitest, CI gate |
| Balance | 500+ seeded runs × 4 bot policies → win-rate bands, leak curves | `harness`, nightly + on PR |
| Property | Placement/upgrade never disagrees with the hover preview; growth never overlaps | Vitest |
| Manual | Does it feel good | You. The one thing I cannot self-verify. |

**The harness matrix, and why Tech Tree stage 2 is deferred.** Stage 1 pins
`metaPowerIndex` into a narrow band, so validating `seeds × policies` is
sufficient. Stage 2 (Potency nodes) makes it a real variable, and correctness
then requires `seeds × policies × meta tiers` — a multiplicative increase in CI
time for every balance change. The model reads `metaPowerIndex` from day one so
this is a scaling decision later, not a redesign.

## 9a. Persistence and save migration

Two stores in `localStorage`, versioned separately:

- `ad.meta.v1` — banked Ore, purchased tech nodes, unlocked content, settings.
  This is the one that must survive forever; losing it destroys progression.
- `ad.run.v1` — in-progress run snapshot. Disposable; a failed migration may
  discard it with a message rather than attempting repair.

Every write carries a schema version, and loaders are pure
`(oldShape) => newShape` functions chained in sequence. Migrations are unit
tested against captured fixtures of every previously shipped shape. For a
project meant to accrete content for months, this is the difference between
adding a tower and stranding a save.

## 10. CI/CD

Three GitHub Actions workflows, on GitHub's free tier for public repositories:

- `ci.yml` — typecheck, lint, unit + golden tests, build. On every push/PR.
- `pages.yml` — build and deploy to GitHub Pages on `main`.
- `balance.yml` — headless harness, posts a balance report; fails if win rates
  leave their bands.

**Verified limits** ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)):
1 GB published site, 100 GB/month soft bandwidth, 10 builds/hour soft limit
(not applied to Actions-based deploys), 10-minute deploy timeout. The built game
will be well under 5 MB including the bundled font.
[GitHub Free](https://github.com/pricing) includes Pages, and Actions minutes
are free for public repositories.

## 11. Verified environment (checked, not assumed)

| Tool | Status |
|---|---|
| Node | v22.23.2 ✅ |
| npm | 12.0.2 ✅ |
| git | 2.33.0.windows.2 ✅ |
| Python | 3.11.15 ✅ (not needed) |
| `gh` CLI | 2.97.0 ✅, authenticated with a fine-grained token scoped to this repo only |
| Vite build | ✅ proven locally and on a clean CI runner |
| Canvas ASCII perf | ✅ measured, 17× headroom |
| GitHub push + Pages deploy | ✅ **proven — live at <https://argarot.github.io/ascii-defense/>** |

**One thing that cannot be automated:** creating the Pages *site* is refused to
both `GITHUB_TOKEN` and a repo-scoped fine-grained PAT
(`Resource not accessible by integration`). It was enabled once by hand in
Settings → Pages → Source → GitHub Actions. A fork must do the same. This is
recorded in a comment in `.github/workflows/pages.yml` so nobody re-discovers it.

---

## Sources

- [Red Blob Games — Flow Field Pathfinding for Tower Defense](https://www.redblobgames.com/pathfinding/tower-defense/)
- [rot.js (BSD-3-Clause)](https://github.com/ondras/rot.js/)
- [Bloons Wiki — Crosspathing](https://bloons.fandom.com/wiki/Crosspathing)
- [A Novel Procedural Content Generation Algorithm for Tower Defense Games (ACM)](https://dl.acm.org/doi/fullHtml/10.1145/3564982.3564993)
- [A NEAT Approach to Wave Generation in Tower Defense Games (PDF)](https://www.open-access.bcu.ac.uk/13568/1/A_NEAT_Approach_to_Wave_Generation_in_Tower_Defense_Games___IMET.pdf)
- [Balance in TD games — Game Developer](https://www.gamedeveloper.com/design/balance-in-td-games)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [GitHub pricing](https://github.com/pricing)
- [JetBrains Mono (OFL-1.1)](https://github.com/JetBrains/JetBrainsMono)
