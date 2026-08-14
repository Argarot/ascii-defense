# ASCII Defense — Technical Vision

Status: **scoping complete.** M0 shipped; M1 not started.

---

## 1. Stack, and why

| Choice | Why | Rejected alternative |
|---|---|---|
| **TypeScript** | The sim is a rules engine. Types are what keep 100+ upgrade definitions authorable. Same language in browser and headless harness. | JS (unmaintainable at this content volume); Rust/WASM (build complexity buys nothing — we measured 17× headroom); Python (Pyodide is megabytes and slow to start) |
| **Vite 7** | Verified: install, typecheck and prod build in under a second. Static output drops onto Pages. | — |
| **npm workspaces** | Real package boundaries, no extra tooling. npm 12 is already installed. | pnpm/turbo — not installed, no benefit at this size |
| **Vitest** | Shares the Vite config. | Jest — separate transform pipeline, no gain |
| **No game engine** | It is a character grid. Phaser/Pixi would add megabytes over a `<canvas>` we drive in under 1 ms. | |
| **No React in the game** | The board is one canvas; the HUD is a few panels. | |
| **`rot-js`: read, don't depend** | BSD-3-Clause. Its display layer is slower than what we measured and we need a TD flow field, not its A*. Take ideas, not the dependency. | |

Runtime dependencies: **target zero.**

## 2. Repository layout

```
ascii-defense/
├─ packages/
│  ├─ engine/           # headless simulation. ZERO DOM references.
│  │  ├─ src/rng/           seeded PRNG, named streams
│  │  ├─ src/grid/          terrain, occupancy, flow field
│  │  ├─ src/sim/           tick loop, towers, enemies, projectiles
│  │  ├─ src/procgen/       maps, ore nodes, wave composition
│  │  ├─ src/balance/       budget tables, k(w), path scaling, metaPowerIndex
│  │  ├─ src/economy/       Scrap, Ore, node depletion, cost curves
│  │  ├─ src/meta/          tech tree graph, unlocks, persistence
│  │  ├─ src/replay/        seed + input log record/playback
│  │  └─ src/run/           run state machine, drafting, save/load
│  ├─ content/          # DATA — JSON, validated against schemas
│  │  ├─ towers/*.json
│  │  ├─ enemies/*.json
│  │  ├─ sprites/*.json
│  │  ├─ tech/*.json
│  │  ├─ balance/*.json     calibrated budget curves (harness output)
│  │  ├─ schema/*.schema.json
│  │  └─ src/index.ts       loads, validates, exposes generated types
│  ├─ term/             # canvas character display (SHIPPED in M0)
│  ├─ web/              # game app: screens, HUD, input, overlays, storage
│  ├─ bot/              # the single policy bot
│  └─ harness/          # headless CLI: calibration, regression, reports
├─ assets/fonts/
├─ docs/
├─ tools/               # schema→types codegen, content linter
└─ .github/workflows/
```

**The hard rule:** `engine` and `content` never import from `term` or `web`.
Enforced by a lint rule, not by discipline. It is what makes the harness
possible.

## 3. Content is JSON with a schema

Content must be editable without touching TypeScript, so it lives as JSON. To
keep that from becoming untyped mush, every file declares `$schema`:

```jsonc
// packages/content/towers/bolt_turret.json
{
  "$schema": "../schema/tower.schema.json",
  "id": "bolt_turret",
  "name": "Bolt Turret",
  "glyph": "^",
  "size": [3, 2],
  "cost": 90,
  "damageType": "kinetic",
  "sprite": "bolt_turret",
  "base": { "damage": 4, "cooldownTicks": 12, "range": 5.5, "pierce": 1 },
  "paths": {
    "A": { "name": "Velocity", "tiers": [ /* 5 */ ] },
    "B": { "name": "Caliber",  "tiers": [ /* 5 */ ] },
    "C": { "name": "Optics",   "tiers": [ /* 5 */ ] }
  }
}
```

What this buys, in order of importance:

1. **VS Code validates and autocompletes while editing** — from `$schema`, with
   no tooling to install.
2. **TS types are generated from the schemas** (`tools/schema-to-types`), so
   engine and data cannot drift. Types are committed, and CI fails if
   regenerating them produces a diff.
3. **CI validates every file** against its schema before anything builds.
4. **A content linter** (`tools/content-lint`) flags what schemas cannot:
   non-monotonic upgrade costs, cost-to-power outliers, orphaned sprite or
   effect references, unreachable tech nodes. This is what keeps 100+ upgrades
   from rotting over months.

Sprites are JSON too, and live under `public/assets/` so they are **fetched at
runtime rather than bundled** — edit a file, reload, see the change, no rebuild.
Full format in [ASSETS.md](ASSETS.md); the short version is parallel `art` and
`ink` grids resolved through a role palette:

```jsonc
{
  "id": "tower_bolt", "size": [7, 4], "bg": "tower.shadow",
  "inkMap": { ".": null, "f": "tower.frame", "c": "PATH", "w": "tower.core" },
  "tiers": {
    "1": { "art": ["  ___  ", " /:::\\ ", "[|-O-|]", " \\___/ "],
           "ink": ["..fff..", ".fbbbf.", "efbcbfe", ".fffff."] }
  }
}
```

`.` is transparent, so terrain shows through the gaps in a drawing. `"PATH"`
resolves to the instance's upgrade path colour, so one drawing serves all three
specialisations.

**The engine knows no glyphs.** It knows sprite ids, ink keys and footprints.
This is why the PRD names no characters — if it did, the library would not be
the source of truth.

Vite's `build.assetsDir` is set to `build/` so bundled output lands in
`dist/build/` and `dist/assets/` stays purely the art library. Without that both
share `dist/assets/` and a bundled file could shadow a sprite.

## 4. Rendering — measured, not assumed

Benchmarked in-browser before the approach was chosen. 120×50 grid (6,000
cells), 400 moving entities:

| Strategy | ms/frame | fps ceiling |
|---|---:|---:|
| `fillText` per cell, full grid | 17.22 | 58 |
| Glyph atlas blit, full grid | 15.92 | 63 |
| **Glyph atlas + dirty cells** | **0.93** | **1,073** |

Shipped in `packages/term`. Every (glyph, colour) pair is rasterised once into
an offscreen atlas; the frame loop diffs a front and back cell buffer and blits
only what changed. `term.put(x, y, glyph, fg, bg)` is the whole API, which is
why a terminal backend could replace it later without the game noticing.

## 5. Occupancy and footprints

Towers are 7×4 (heavies 9×5, walls 3×2) and **never change size**. A
`Uint16Array` over the board maps each cell to its owner id, or 0.

Sprite sizes drive board size: fitting 20–25 towers needs roughly a 160×50 cell
viewport (~1440×750 px). Desktop only, by consequence rather than by choice.

It is the single source of truth for buildability, click targeting and
pathability. Placement is a rectangle scan; no per-tower geometry maths exists
anywhere else. Because footprints are fixed, placement is checked once and never
re-checked — the UI/engine contract that growth would have required does not
exist.

## 6. Pathfinding and the preview overlay

Dijkstra flow field from the Core outward over the terrain cost grid (Red Blob
Games' approach). Each tile stores distance-to-Core and its cheapest outgoing
direction; enemies just read their current tile.

- Recomputed **only on build/sell**, not per tick. ~2,300 tiles is sub-millisecond.
- **Two fields**: ground, and flying (straight line, no field). Burrowing added
  later if the trait returns.
- Yields `L`, effective path length, feeding the wave budget (PRD §8.3).

**The preview overlay is part of this system, not the UI layer.** On build-hover
the engine computes a *speculative* field for the hypothetical placement and
returns both routes. The UI only renders what the engine says. This is the one
feature that makes mazing legible, and putting the speculation in the engine is
what keeps preview and reality identical by construction.

## 7. Determinism and replay

Non-negotiable. It is the foundation of calibration, regression testing,
bug reproduction, save/resume and daily challenges.

- One seeded PRNG (xorshift128+/PCG). **`Math.random` banned by lint rule.**
- **Named streams** — map generation, wave composition and combat draw from
  independent sequences, so changing combat code cannot reshuffle maps.
- **Fixed 20 Hz tick.** No frame delta reaches the simulation. Speed controls
  change ticks-per-frame, never tick size.
- Rendering reads the sim and never writes to it.

**Replay format:** `{ version, seed, contentHash, inputs: [{tick, action}] }`.
Kilobytes. Playback re-runs the sim and asserts the final state hash matches.

`contentHash` matters: a replay recorded against different tower data is not
replayable, and must say so rather than silently diverging.

**Golden test:** seed + scripted inputs → 2,000 ticks → state hash. If that hash
moves unintentionally, CI fails. The single most valuable test in the project.

## 8. Simulation data layout

- **Enemies**: structure-of-arrays (`Float32Array` positions, `Uint16Array` HP,
  `Uint32Array` trait bitflags). Hundreds alive; cache-friendly, allocation-free.
- **Towers**: plain objects. Dozens at most, rich upgrade state.
- **Projectiles**: pooled ring buffer.
- **Occupancy**: one `Uint16Array`, cell → owner id.
- **Ore nodes**: plain objects carrying `tier` and remaining yield.

Not a general ECS. Entity kinds here are fixed and few; the indirection would
cost more than it buys.

## 9. Stat resolution pipeline

Order is explicit, documented and unit-tested, because this is where upgrade
systems rot:

```
base → path tier bonuses → crosspath synergies → aura buffs
     → run modifiers → temporary effects → resolved (cached, recomputed on change)
```

## 10. Balance calibration

The harness produces the shipped numbers; it does not merely check them.

```
tools/harness calibrate --seeds 500 --waves 12
  → runs the bot against candidate budget curves
  → records clear margin, lives lost, leak %, time-to-kill distribution
  → solves for the curve hitting target margin per wave
  → writes packages/content/balance/curves.json

tools/harness check
  → re-runs against the frozen curves
  → fails if measured margin drifts beyond tolerance
```

Calibration output is **committed data**, reviewable in a diff like any other
content. A balance change is a visible change.

The bot is one policy, treated as a **regression detector**. Absolute difficulty
comes from a human offset constant measured against Daniil's recorded replays —
which is another thing replays give us for free.

## 11. Testing

| Layer | What | Where |
|---|---|---|
| Unit | RNG streams, flow field, crosspath legality, stat pipeline order, occupancy | Vitest |
| Property | 10,000 maps → path always exists, buildable area and shortcut count in range | Vitest |
| Golden | Seeded run → state hash after N ticks | Vitest, CI gate |
| Replay | Recorded human runs replay to identical final state | Vitest |
| Content | Schema validation, generated-types drift, content linter | CI |
| Balance | Calibrated curves vs. measured margin | `harness check`, CI |
| Manual | Does it feel good | Daniil. The one thing that cannot be automated. |

## 12. Persistence

Two `localStorage` stores, versioned separately:

- `ad.meta.v1` — banked Ore (per tier), purchased tech nodes, unlocks, settings.
  Must survive forever; losing it destroys progression.
- `ad.run.v1` — in-progress run snapshot. Disposable; a failed migration may
  discard it with a message rather than attempt repair.

Loaders are pure `(oldShape) => newShape` functions chained in sequence, unit
tested against captured fixtures of every shipped shape. For a project meant to
accrete content for months, this is the difference between adding a tower and
stranding a save.

Ore is stored as a **per-tier record** (`{ "1": 240 }`) from day one, so ore
tiers arrive as content rather than as a migration.

## 13. CI/CD

- `ci.yml` — typecheck, lint, unit + golden + replay tests, content validation, build.
- `pages.yml` — build and deploy to Pages on `main`. **Shipped and working.**
- `balance.yml` — `harness check`, posts a report, fails on drift.

Verified free on public repositories:
[Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
(1 GB site, 100 GB/month bandwidth), [GitHub Free](https://github.com/pricing)
includes Pages, Actions minutes free for public repos.

## 14. Verified environment

| Tool | Status |
|---|---|
| Node | v22.23.2 ✅ |
| npm | 12.0.2 ✅ |
| git | 2.33.0.windows.2 ✅ |
| `gh` CLI | 2.97.0 ✅, fine-grained token scoped to this repo only |
| Vite build | ✅ locally and on a clean CI runner |
| Canvas ASCII perf | ✅ measured, 17× headroom |
| Push + Pages deploy | ✅ live at <https://argarot.github.io/ascii-defense/> |

**Cannot be automated:** creating the Pages *site* is refused to both
`GITHUB_TOKEN` and repo-scoped fine-grained PATs. Enabled once by hand; recorded
in a comment in `.github/workflows/pages.yml`.

---

## Sources

- [Red Blob Games — Flow Field Pathfinding for Tower Defense](https://www.redblobgames.com/pathfinding/tower-defense/)
- [rot.js (BSD-3-Clause)](https://github.com/ondras/rot.js/)
- [Bloons Wiki — Crosspathing](https://bloons.fandom.com/wiki/Crosspathing)
- [A Novel Procedural Content Generation Algorithm for Tower Defense Games (ACM)](https://dl.acm.org/doi/fullHtml/10.1145/3564982.3564993)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [JetBrains Mono (OFL-1.1)](https://github.com/JetBrains/JetBrainsMono)
