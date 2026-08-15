# Handover — state as of 2026-08-15 (sessions 1–10)

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/WBS.md](docs/WBS.md) → this file. The gitignored `POSTMORTEM.md` holds
collaboration findings (append as things happen — standing practice).

Live build: <https://argarot.github.io/ascii-defense/> (always verify
cache-busted; stale bundles have caused two false bug reports).

## Where the project is

M1: Phases 1 and 3 complete (tagged v0.1.0, v0.2.0). Phase 2 (REXPaint art
round-trip) parked until Daniil is at his laptop. Phase 4 is nearly done:

- DONE: towers (Bolt/Mortar/Frost) with **either/or tier trees** (3 tiers × 2
  exclusive choices — PRD §5.2, crosspathing is dead), Scrap economy,
  targeting priorities, waves with telegraphed fronts + steep scaling
  (+18% hp/wave), Core health + defeat, pulse attacks (Frost, zero base
  damage), armor/shield/slow mechanics, select-then-build flow, full-height
  side-panel HUD (2× font, 30 cols) with visual tree + hover previews
  (stats AND range ring).
- **NEXT (D part 2b, promised and twice-deferred — do not defer again):**
  1. Refinery tower + Ore currency (persists across 3 R-rerolls in-memory,
     then wipes — demo rule).
  2. The Core as a selectable entity: type choice first (gunner/mortar/
     slow-field/miner), then its own tier tree, **paid in Ore** (PRD §4.5).
     Selecting any Core cell already brackets the whole block.
  3. Replay recording (`{version, seed, contentHash, inputs}`) + golden
     2,000-tick state-hash test (WBS 1.4.8).
- Then Phase 5 (crude bot + `harness calibrate/check`, ~half session) → M1
  exit: Daniil plays the fun test.

## How we work (hard-learned, do not relearn)

- **An approved scope is a contract — finish it in the turn it was approved.**
  Do not split an agreed block into "part 1 / part 2", and never announce a
  deferral inside a summary. If a split looks necessary, STOP and ASK first
  (what's at risk, proposed split, cost of not splitting). A repeated identical
  request from Daniil is an escalation, not a fresh go-ahead. *(This was the
  single biggest process failure of sessions 1–10; see POSTMORTEM end-of-day
  review.)*
- Feature branch + PR per work package; merge only on green CI **using gh's
  own exit code** — piping `gh pr checks` through `tail` once merged a red PR.
- Every session ends with something Daniil can SEE at the live URL; lead
  summaries with that, and always give the link **cache-busted** (`?cb=…`) —
  stale bundles have produced two false bug reports. He gives feedback as
  screenshots + observed symptoms; translate symptoms into construction
  guarantees, not tunings.
- In summaries, mark features that are **planned but NOT BUILT YET** explicitly
  when adjacent features ship — otherwise absence reads as a bug (it did, for
  the Core's tree).
- Non-ASCII in source only as `\uXXXX` (scratchpad script `escape-nonascii.mjs`
  exists); Edit tool cannot change escape *spellings* — use a script.
- Verification in the browser pane: rAF is frozen when the pane is hidden —
  ALWAYS drive draws through the `window.__ad` debug handle (`step(n)`,
  `build(x,y)`, `canBuild`, `enemies`) and read pixels in the same task.
  Synthetic MouseEvents can lose `offsetX` — force offsets via
  `Object.defineProperty` when testing click regions.
- Determinism rules: engine sqrt never hypot; fixed-order tie-breaks; rng
  streams are a closed union; pure-rand pinned — golden RNG values guard it.
- Content changes: `node tools/build-content-types.mjs` after schema edits
  (CI fails on drift); tile semantics validated by engine code via the
  harness test, not duplicated in the .mjs linter.
- Daniil's open asks likely to recur: sub-glyph shading (deliberately parked
  for the M4 effects render pass), Tile Smith as in-game meta feature (PRD
  §10), REXPaint session when at laptop.

## Key architectural seams for 2b

- Ore: add to `Sim` (like scrap); Refinery = tower def with `attack: 'none'`-
  style production (extend schema: production block or reuse pulse with 0
  range? cleaner: new `production: {scrap?, ore?}` field; ore only counts
  when the tower stands on an `O` cell — engine has `cells` at hand).
- App holds cross-run Ore (module-level var + reroll counter; wipe after 3).
- Core entity: `sim.coreState = {branch: -1, choices: [-1,-1,-1]}`; selecting
  a C cell routes the HUD to a Core card (type buttons cost Ore, then the
  same tier-tree component). Core attacks reuse the tower phase with a
  virtual tower at `map.core`.
- Replay: log `{tick, action}` for build/sell/choose/priority in `Sim`
  methods themselves (they are the only mutation surface); `hashState()` =
  FNV over typed arrays + counters.
