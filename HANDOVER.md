# Handover — state as of 2026-08-17 (end of day; sessions 1–18 + session 19 opened)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/WBS.md](docs/WBS.md) → this file → the roadmap ledger's next open row.
The gitignored `POSTMORTEM.md` holds collaboration findings — **read its last
two entries before writing any code today.** End every working day with the
`wrap-session` skill (.claude/skills/wrap-session).

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).

## Where the project is

Sessions 16–18 shipped in one day (PRs #69–#76): the **effects & animation
engine** (typed `Sim.events` feed, view-side `EffectsLayer`, sprite frame
model, terrain drift, void-as-water, reduced motion from day one), **combat
truth** (ballistic Mortar, shots that always resolve, one blast radius driving
damage + visual + readout), **legibility** (stat blocks, written upgrade
descriptions, enemy-as-readout, square relic slots, scrollable panel), and
**the shell** (sim in a Web Worker, screen stack, title / setup / pause /
summary, saves that are replays, export/import, settings).

**The semi-stable alpha marker is NOT crossed.** The machinery exists; the
judgement is Daniil's and he has not given it. The dev announced it on merging
session 18 and was corrected — a milestone is not a checklist of merged PRs.

**Daniil's verdict on the day's back half**, which matters more than the
feature list: *"quite disappointingly underwhelming with the ratio of what's
actually done to bugs surfaced."* Every session closed its gate and also
handed him a defect list; he became QA for work he was meant to be judging.
The remedy under consideration — **smaller slices, each with a playable check,
and no new feature while a reported defect is open** — is a proposal to agree
with him, not a decision already taken.

**NEXT: session 19 — the Tile Smith, done properly.** Nothing else in that row
starts until Daniil says the smith works.

## Fresh-context warnings (beyond CONTRIBUTING)

- **A pushback is a claim, and claims get verified.** Twice in one day the dev
  pushed back on Daniil's design with something structurally worse ("a T is
  just `R`" — refuted by a 30-second ports check; then neighbourhood
  inference — which *cannot* express touch-without-merge). Before sending a
  pushback: name the requirement it must satisfy, and test it in code.
- **Verify the experience, not the mechanism.** Hashes, event counts and
  synthetic clicks all passed while shipping a Tile Smith nobody can use and
  menus with clipped text. For a tool or a screen, operate it as the user
  would and *look at it* — the screenshot Daniil sends is the check that
  should have run first.
- **When the cell alphabet or any model grows, the authoring surface grows
  with it in the same commit.** This rule was written into POSTMORTEM and
  violated hours later (T-types shipped with no smith brushes).
- **Verify UI on GPU pixels** (`gl.readPixels` after a synchronous draw) or
  `toText()`, never screenshots in the hidden pane.
- **Scripted regex edits of source keep misfiring.** Edit tool for code;
  scripts for JSON/content. (Cost a stray brace deletion again today.)
- The golden replay hash moves ONLY with a stated reason in the same commit.
  It moved once today: `3768274921 → 2003059284`, WBS 2.19, reason in the test.
- `__ad` is now **async** (the sim answers from its worker): `await
  __ad.step(n)`, `hash()`, `events()`, `enemies()`, `build()`, `canBuild()`,
  `cellAt()`, `offer()`, `pick()`, `relics()`, `replay()`, `ore()`; sync:
  `hudText()`, `boardText()`, `select()`, `mode()`, `motion()`.

## Key seams for session 19

- **`packages/app/src/tilesmith.ts`** — the file to rework. It currently holds
  the abandoned inference (`inferRoads`, `SHAPE_BY_MASK`, the single ROAD
  brush): **delete that, do not extend it.** Brushes become one button per
  cell type in a grouped matrix. `BRUSH_LABEL`/`BRUSH_BG` are the tables to
  widen; the paint path is the canvas click handler; `update()` is the single
  render path and stays that way.
- **Why explicit types are non-negotiable**: a segment type *is* its port mask
  (`ROAD_PORTS` in `packages/engine/src/grid/cells.ts`). `|` beside `|` touch
  and stay separate because neither has an E/W port. Any rule that derives
  ports from adjacency destroys exactly that.
- **`validateTileCells`** (`packages/engine/src/tiles/tile.ts`) — the entry-
  point rule lives here and is where 2.26 tightens (every road cell on a route
  between two distinct entries). `twin_bend` is the fixture that punishes a
  careless formulation — verify against the whole shipped library before
  adopting a rule, as was done for 2.20.
- **Rotation (2.24)**: the generator's index already resolves and deals all
  four rotations (`indexLibrary` in `mapgen.ts` loops `[0,1,2,3]`). The
  missing half is pool-level dedup — canonical form, tilegen collapsing its
  four orientation families, minted pool canonicalising.
- The smith renders through the same `drawTerrainCell` the board uses, so the
  visual tile picker (2.21) is nearly free.

## Standing open items

- 2.18 Tile Smith overlay authoring (per-tile ore richness, boons) — rides
  session 19 since both rework the tile format.
- 4.12 — two of Daniil's playtest-1 visual items (V8, V9) are **lost**; ask
  him to restate them at the next playtest, then write or retire the ID.
- Relic rebalance for duplicate stacking (accepted as a later session).
- D8 naming mini-session (printing-trade lexicon) opens session 20.
- ASSETS.md not audited since D3 closed — audit it in the art session.
- The REXPaint art pipeline is still **unproven**; both tools are unwritten
  and 6.1 opens session 29. Accepted risk, recorded on the item.
