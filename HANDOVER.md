# Handover — state as of 2026-08-16 (sessions 1–11)

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/WBS.md](docs/WBS.md) → this file. The gitignored `POSTMORTEM.md` holds
collaboration findings (append as things happen — standing practice).

Live build: <https://argarot.github.io/ascii-defense/> (always verify
cache-busted; stale bundles have caused two false bug reports).

## Where the project is

M1: Phases 1 and 3 complete (tagged v0.1.0, v0.2.0). Phase 2 (REXPaint art
round-trip) parked until Daniil is at his laptop — and graphics polish is
deliberately last, so it stays parked. Phase 4 is nearly done:

- DONE: towers (Bolt/Mortar/Frost) with either/or tier trees (3 tiers × 2
  exclusive choices — PRD §5.2), Scrap economy, targeting priorities, waves
  with telegraphed fronts + steep scaling (+18% hp/wave), Core health + defeat,
  pulse attacks (Frost), armor/shield/slow mechanics, select-then-build flow,
  full-height side-panel HUD (2× font, 30 cols) with visual tree + hover
  previews (stats AND range ring).
- **OPEN: 1.4.6 (Refinery + Ore) and 1.4.8 (replay + golden hash).** These are
  the outstanding tail of the twice-deferred "session D" block. They are the
  next thing built, before anything else.
- **NEW: Phase 6, the relic layer** (WBS 1.6, PRD §7) — added 2026-08-16,
  sequenced before Phase 5, inside the M1 fun-test gate.

## The 2026-08-16 design session (read PRD §7 before touching Phase 6)

The Core was going to be a fifth tower: pick a type, then a 3-tier tree, paid
in Ore. **Cut before implementation.** The argument that killed it, because it
will come up again: a handful of symmetric, individually-balanced purchases
cannot produce a build-breaking run, and the build-breaking run is what a
roguelite is *for*. Four buys that each add a percentage have nothing to
combine.

What replaced it:

- **The Core is the vessel**, not a tower. HP, plus it holds the run's relics
  and is where actives fire and consumables are spent. No tree of its own.
- **Relics are rule-breakers acquired mid-run**, run-local, authored as data:
  *"overkill carries to the next enemy"*, not *"+15% damage"*. Three kinds:
  passive / active / consumable. ~20 in M1, target ~6–10 acquisitions per run
  (below that, combinations never happen and the layer does nothing).
- **Two axes.** Tower trees are planned power: strict, symmetric, Scrap. Relics
  are found power. The strictness is load-bearing — a rule only feels broken if
  it was iron first.
- **Acquisition, in build order:** B wave-clear pick-1-of-3 (guarantees
  cadence) → C Ore draw/reroll at the Core (Ore's in-run sink) → A map caches
  (makes this map's shape matter). Each is shippable alone.

Hard constraints that came out of it, all now in the PRD:

- **No relic may combine both options of a tier.** A tower has 5×3 glyphs and
  14 defined visual states; "both paths" invents states with no possible art.
  The art budget is a design constraint, not a rendering detail (§5.2, §14).
- **Caches are claimed by selecting and paying, never by building on them** —
  building is not a cost when you can sell the tower back immediately.
- **The Refinery mines Ore only, on ore cells.** Its Scrap-anywhere path is cut
  and survives as the `foundry` relic. Its tree now sells reach: Extraction
  (deeper output) / Survey (unlocks prospecting).
- **Prospecting reveals, it does not roll.** Every rock cell is dealt its
  contents (ore / cache / nothing) at generation, so no runtime randomness and
  replays stay exact. Selecting a rock offers Prospect for Scrap.
- **Only Road and Core are on the route.** Ground and Ore are open, not
  walkable. Therefore opening a rock cell can never create a shortcut. The PRD
  table said otherwise for months (pre-pivot leftover) and a dead
  `isPathable()` encoded the same error — both corrected/deleted 2026-08-16.
- **Mid-run meta tree, road mutation, and wave-dial powers are all rejected**
  with reasons in §14. Do not re-propose.

## Next block, in order

1. **1.4.6 Refinery + Ore** — Ore in `Sim` stored per tier; Refinery produces
   only on `O`; app holds cross-run Ore (module var + reroll counter, wipes
   after 3 — demo rule); HUD readout; mapgen ore-floor guarantee.
2. **1.4.8 Replay + golden hash** — `{version, seed, contentHash, inputs}`,
   playback, 2,000-tick state-hash test. **Reserve the Phase 6 action shapes in
   the union now** (`claimCache`, `prospect`, `pickRelic`, `buyRelic`,
   `rerollOffer`, `fireActive`, `useConsumable`) so the relic layer needs no
   migration. This project's reserve-the-shape pattern has paid out four times.
3. **Phase 6** — 1.6.1 hooks → 1.6.2 offers → 1.6.3 content → 1.6.4 Core
   vessel → 1.6.5 draws + caches → 1.6.6 prospecting.

Two decisions are open and blocking inside Phase 6: **D4** wave-clear cadence
(proposal: every 3 waves) and **D5** relic rarity tiers (proposal: flat in M1,
field reserved). Ask Daniil; do not pick silently.

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

**For 1.4.6 (Ore):** add to `Sim` like `scrap`; ore only counts when the tower
stands on an `O` cell — the engine has `cells` at hand. Store per tier from day
one (invariant 9) even with one tier live.

**For 1.4.8 (replay):** the Sim's entire mutation surface is four methods —
`buildTower`, `chooseTier`, `setPriority`, `sellTower` — plus `tick()`. That is
the complete input log; log `{tick, action}` inside those methods.
`hashState()` = FNV over the typed arrays + counters.

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
