# Handover — state as of 2026-08-16 (end of day; sessions 1–15)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/WBS.md](docs/WBS.md) → this file → the roadmap ledger's next open row.
The gitignored `POSTMORTEM.md` holds collaboration findings — append as things
happen. End every working day with the `wrap-session` skill
(.claude/skills/wrap-session).

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).

## Where the project is

**M1 gate PASSED** — "the game is fun now." Sessions 12–15 shipped in one day
(PRs #51–#63): the balance lab (`node tools/lab.mjs`), geometric difficulty,
finite ore with visible richness, victory at wave 20 + elite waves +
Juggernaut, port-segment roads (`- | L J F 7`) with a route graph enemies
cannot lane-hop, carve v3 (edge partitions + turning tunnels; twin bends
appear on real maps), a generated tile library (`node tools/tilegen.mjs`),
timed/stacking/autonomous prospecting, boon ground with tiers 1–4, threat
bundles (`?threat=N`), duplicate relics, tile weights, paint-on-preview Tile
Smith with auto-ids, and five playtest fix rounds. Every session's gate held.

**NEXT: session 16 — the effects & animation engine** (WBS 4.1). Frame model
in the sprite schema; effect entities with lifetimes spawned from sim events
(`Sim.pulses` is the accidental prototype); explosions, projectile spread,
tower idle cycles, terrain drift, void-as-water. **Reduced motion respected
from day one** (PRD §15.4) — retrofitting it is the named failure mode.
Gate: the board is alive and none of it touches the simulation (invariant 2).

## Fresh-context warnings (beyond CONTRIBUTING)

- **Ask at genuine forks before building.** Two consecutive corrections from
  Daniil mean you stopped asking too early. His design instincts are peer
  review — three times his primitive beat the implemented one (either/or
  tiers; directional roads; port segments).
- **When a feature exists to enable authoring, the acceptance test is
  authoring the motivating example** — the lane-letter model shipped without
  trying the S-fold and died on first contact.
- **Verify UI on GPU pixels** (`gl.readPixels` after a synchronous draw), not
  `toText()` — a flush boundary between paint and check lied once already.
- **Scripted regex edits of source keep misfiring** (anchor drift,
  double-application). Use the Edit tool for code; scripts for JSON/content.
- The golden replay hash moves ONLY with a stated reason in the same commit.
- `__ad` debug handle: `step/build/select/hudText/boardText/offer/pick/
  relics/ore/cellAt/replay/hash/reroll` — the whole verification surface.

## Key seams for session 16

- `Sim.pulses` — the sim→view event prototype: sim pushes `{x, y, r, tick}`,
  the view derives `age01` and draws expanding rings. Generalize this shape
  (typed event list, capped, consumed by the view); effects never write back
  into the sim.
- `drawTerrainCell` (view/board/style.ts) owns all terrain texture; the
  mixing hash `hash2` gives stateless per-glyph variety — animation can phase
  it with a frame counter, zero per-cell state.
- Sprite schema (content/schema/sprite.schema.json) has NO frame model yet —
  extending it is the schema half; rerun `node tools/build-content-types.mjs`
  (CI fails on drift).
- The board redraws fully every frame (<1 ms); animation is authoring cost,
  not engine cost. `GLTerm.transparent` exists for overlay layers.
- Reduced-motion: a module-level flag the effects layer consults now; the
  settings screen that toggles it is M4.

## Standing open items

- 2.18 Tile Smith overlay authoring (per-tile ore richness, boons) — needs an
  overlay format beside `cells`; playtest-5 item 7, logged openly.
- Relic rebalance for duplicate stacking (accepted as a later session).
- D8 naming mini-session (printing-trade lexicon) before new content.
- ASSETS.md not audited since D3 closed — audit it in the art session.
