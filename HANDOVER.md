# Handover — state as of 2026-08-16 (sessions 1–11)

> **Updated once per working day, not per session** (Daniil, 2026-08-16). It
> carries state and seams only; sequencing lives in the roadmap ledger and the
> checklist in the WBS. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/WBS.md](docs/WBS.md) → this file. The gitignored `POSTMORTEM.md` holds
collaboration findings (append as things happen — standing practice).

Live build: <https://argarot.github.io/ascii-defense/> (always verify
cache-busted; stale bundles have caused two false bug reports).

## Where the project is

**M1 exit gate: PASSED 2026-08-16.** Daniil played past wave 48: *"the game is
fun now, it’s just very unbalanced and with quite a few holes still."* That is
the judgement the milestone existed to obtain. Everything after is balance and
depth, not a question of whether to continue.

Complete: Phase 1 (harness, `v0.1.0`), Phase 3 (board, `v0.2.0`), Phase 4 (the
game — towers, enemies, economy, waves, HUD, Refinery + Ore, replay + golden
hash), Phase 6 (the relic layer entire — hooks, offers, modal, eleven relics,
Core vessel with slot inventory, Ore draw/reroll, caches, prospecting).

Outstanding M1 work: Phase 2 (art round-trip, re-planned — see below), Phase 5
(split: measurement now, bot much later), Phase 7 (post-playtest triage).

## What the two playtests changed

Read the **request index** at the top of [docs/WBS.md](docs/WBS.md) before
planning anything — it maps every request Daniil has made to the work item that
owns it.

The headline findings, because they reshaped the plan:

- **Threat grew linearly while player power compounded.** Wave 48, five towers
  placed forty waves earlier, Core untouched. Not a tuning error — a shape
  error (PRD §9.1). Every run must end in death, including the god run.
- **Both economies saturated.** 42k Scrap, 28k Ore, nothing to spend either on.
  Ore deposits become finite with richness (PRD §6); mining slows ~10×.
- **The relic layer switched itself off.** Eleven relics, caches deal
  duplicates, the unheld pool empties and offers stop with no message. Needs a
  far bigger pool plus fusion and salvage (PRD §7.6).
- **The road shape vocabulary is thin** — and the cause is a *validity rule*,
  not tile size and not the connector model (PRD §4.2.1). Connectors stay
  centre-pegged; roads gain the right to touch without connecting.
- **Animation is engine work**, and had been mis-filed as an art chore.

## Next, in order

Sessions and gates live in [ROADMAP.md](docs/ROADMAP.md#session-ledger). Short
form:

1. Sessions 12–14 — DONE (PRs #51–#55): the balance lab (`node tools/lab.mjs`),
   geometric difficulty, finite ore with visible richness, the run ends at
   wave 20 with victory, elite waves + Juggernaut, and the full lane model
   (in-tile lanes, directional connectors, route-as-graph, Tile Smith ADD TO
   POOL). Session 15 DONE (PRs #57–#61): directional roads corrected to PORT SEGMENTS
   (-|LJF7, AND-rule, rim visuals), timed+stacking+autonomous prospecting,
   2× transparent offer modal, absolute richness visuals, no enclosed voids,
   carve v3 (edge partitions + turning tunnels; twin_bend dealt on real maps),
   generated tile library (tools/tilegen.mjs), boon ground, threat bundles
   (?threat=N). Next per the ledger: **session 16 — the effects & animation
   engine** (WBS 4.1): frame model in the sprite schema, effect entities with
   lifetimes from sim events (pulses is the prototype), explosions, projectile
   spread, tower idle cycles, terrain drift, void-as-water — reduced-motion
   respected from day one (PRD sec 15.4).
2. Session 13 — finite ore, slower mining, the run ends (D6 finite).
3. Session 14 — roads that touch without connecting (WBS 2.16).
4. Sessions 15–24 — map variance, the effects engine, damage types, attack
   shapes, relic economy, legibility + Worker, naming, art, the meta loop, and
   only then the bot and calibration.

Open decisions: **D3** material language (before art), **D8** the printing-trade
lexicon (own session; first candidates rejected), **D9** Ore tiers (deferred,
trigger recorded). D4–D7 and D10 are closed — see the WBS table.

## Architectural seams for what is next

- **The balance lab is mostly built already**: `engine` is DOM-free and
  deterministic, so it runs headless in Node today. What is missing is the
  measurement layer (place a loadout from a spec, run N waves, report leak,
  margin, TTK) and the sweep runner. `harness` is its home.
- **Roads that touch without connecting**: `computeFlowField` BFSes over every
  `isRouteCell` 4-connected — that adjacency IS the merging. It becomes a graph
  built from within-tile components joined by matching centre connectors.
  `validateTileCells` is shared by the game, CI and Tile Smith, so the validity
  relaxation lands in one function.
- **Effects engine**: `Sim.pulses` is the accidental prototype of a sim-event →
  view effect pipeline. Keep effects out of the simulation (invariant 2).
- **Save/resume is nearly free**: a save IS the seed plus the input log, which
  replay already produces.
- Every reserved replay action shape is now implemented, and `applyAction`’s
  default arm is `a satisfies never` — the union is compile-checked.
## How we work (hard-learned, do not relearn)

- **An approved scope is a contract — finish it in the turn it was approved.**
  Do not split an agreed block into "part 1 / part 2", and never announce a
  deferral inside a summary. If a split looks necessary, STOP and ASK first
  (what's at risk, proposed split, cost of not splitting). A repeated identical
  request from Daniil is an escalation, not a fresh go-ahead. *(This was the
  single biggest process failure of sessions 1–10.)* Note the distinction that
  matters: work Daniil **replaces** is cut, not deferred — say so in those
  words, so the record cannot be misread as another slip.
- Feature branch + PR per work package; merge only on green CI **using gh's
  own exit code** — piping `gh pr checks` through `tail` once merged a red PR.
- Every session ends with something Daniil can SEE at the live URL; lead
  summaries with that, and always give the link **cache-busted** (`?cb=…`).
  He gives feedback as screenshots + observed symptoms; translate symptoms into
  construction guarantees, not tunings.
- Every session ends with a plan for the next session, so if there is no corrective feedback, he can just prompt to keep going. If there was corrective feedback - make sure we are aligned before suggesting next steps. 
- In summaries, mark features that are **planned but NOT BUILT YET** explicitly
  when adjacent features ship — otherwise absence reads as a bug (it did, for
  the Core's tree).
- **Context is a budget.** Prefer targeted greps over whole-file reads, and
  keep prose tight (Daniil, 2026-08-16).
- Non-ASCII in source only as `\uXXXX` (scratchpad script `escape-nonascii.mjs`
  exists); Edit tool cannot change escape *spellings* — use a script. Markdown
  docs are exempt.
- Verification in the browser pane: rAF is frozen when the pane is hidden —
  ALWAYS drive draws through the `window.__ad` debug handle (`step(n)`,
  `build(x,y)`, `canBuild`, `enemies`) and read pixels in the same task.
  Synthetic MouseEvents can lose `offsetX` — force offsets via
  `Object.defineProperty` when testing click regions.
- Determinism rules: engine sqrt never hypot; fixed-order tie-breaks; rng
  streams are a closed union; pure-rand pinned — golden RNG values guard it.
- Content changes: `node tools/build-content-types.mjs` after schema edits
  (CI fails on drift).
- Daniil's open asks likely to recur: sub-glyph shading (parked for the M4
  effects render pass), Tile Smith as in-game meta feature (PRD §11), REXPaint
  session when at laptop.

## Key architectural seams

**For 1.6.1 (hooks):** `effectiveStats(def, choices)` in
`packages/engine/src/sim/defs.ts` is the single fold point where every tower
stat is computed — global modifiers hook in there and nowhere else. The tick is
`wavePhase → towerPhase → projectilePhase → walkPhase`, which gives `onWaveStart`,
`onProjectileSpawn`, `onDamage`/`onKill` natural homes. Hook application order
must be fixed and documented, or determinism dies quietly.

**For 1.6.5/1.6.6 (caches, prospecting):** caches are an **overlay list** on
the map, not a cell type — the tile library and its schema stay untouched.
Rock contents are dealt in `mapgen` on the `map` stream. The HUD already routes
selection through one region list (session 10's rework), so a cache card and a
rock card are new card types, not a new interaction model.
