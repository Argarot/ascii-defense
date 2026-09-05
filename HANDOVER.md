# Handover — state as of 2026-09-05 (end of day; sessions 23 and 24 shipped eleven PRs)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) — **§4.3.1 and §4.5 are today's: the board fills,
the Core at the east edge** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
(§12 is the generation spec, tiers 0–2 rewritten today) →
[docs/ASSETS.md](docs/ASSETS.md) → [docs/WBS.md](docs/WBS.md) (D25–D28, the
debt register, the request index's round 22) → this file → the roadmap
ledger's next open row. The gitignored `POSTMORTEM.md` holds collaboration
findings — **read its last three sections before writing any code today.**
End every working day with the `wrap-session` skill, whose "next-session
plan" section is a contract (Daniil, 2026-09-05).

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since today the title is a full-screen page with the four towers as a hero
row; a run shows the Core face at the right edge and a strip under the
board** — a build without those is the old one.

## Where the project is

**2026-09-05 shipped eleven PRs (#111–#121) in two sessions.**

Session 23 (morning, #111–#115): retune 1 (Hailstorm and Cluster to 60%);
the playtest fixes — junction cells drawn by their EFFECTIVE ports, the
range as three thin rings, the Bolt's gold dash, the ramp a notch down; the
art tooling tracked; the thought dump sorted into the docs (PRD §4.3.1, §7.8,
§13, §15.1, §18; WBS D25–D28 and 2.30–2.37, 4.27–4.29, 5.6–5.8, 6.9–6.10,
7.8); the next-session rule written into the wrap skill.

Session 24 (afternoon, #116–#121), on Daniil's "go make what you've outlined":

1. **The Core at the east edge (#116, his redesign).** No tile carries the
   Core. The cell grid is the slots plus one column on the east; a
   three-cell **Core face** stands in it where the road arrives; the road
   tree roots at the east-border slot in front of it; exactly one entrance;
   entries only north, west, south. `mapCells()` is the grid a run plays
   on. `GENERATOR_VERSION` 2; old saves refused with a sentence.
2. **The board fills (#117, carve v4, D28).** Specials first as fixed
   nodes; walks planned to one lane length; entries emergent until road
   covers ~0.9 of the slots; the carve REPORTS coverage and the lane band
   and `verifyMap` holds the map to the report. `tools/mapgen-sweep.mjs`:
   32 board×loadout cells × 30 seeds, zero failures, zero rerolls (five
   specials on 7×5 failed 30/30 the day before).
3. **The bottom strip (#118, 4.27).** Under the board: the roster as
   sprite buttons (grey when unaffordable), this wave and the next by kind
   with traits, the Core card with its actives — always. 1080p is **7×4
   tiles plus the Core column** now.
4. **The build sweep (#119).** The lab has an economy and a choke
   placement; `tools/build-sweep.mjs`. A five-tower choke build reaches
   wave 19–23 on the 1080p boards against a final wave of 20: **no
   further retune**; Hailstorm is a role problem (WBS 2.37).
5. **Boon colours + the contrast lint (#120).** One background per boon
   type, corner glyphs on empty boon cells; the linter warns per sprite
   frame under 30 luminance points of contrast — it names the cobble
   study's X tier and nothing else.
6. **The shell owns the whole screen (#121, 4.28).** A viewport-sized
   terminal carries the title, setup, loadout, how-to, settings, summary;
   the title is a designed page with the towers as its hero; pause and
   the relic offer stay on the board.

**Not built, by design:** the Core face sprite and button art (the art
agent's; the face wears the Core pool glyphs); the Tile Smith is still its
own page; mixed boon ground; enemy sprites; the `X`/`B` road tiers are still
flat until Daniil regenerates the study (the linter says so on every run).

**Gates:** session 24 — **Daniil's playtest of the deployed build**: five
special loadouts generate every time; the Core face at the right with its
actives under the board; the strip in use; a Standard run reaches wave 10+.
2.27 — still his.

## Fresh-context warnings (beyond CONTRIBUTING)

- **The Core is a face in the strip column, not a tile.** `map.coreFace`,
  `map.cellsW/cellsH`, `mapCells(map, lib)`. A library with a `C` tile is
  refused by generation. Sim, flow, view and lab all read the grid from the
  map; nothing computes `slots × 5` for height or width any more except
  `boardSize.ts`, which adds the column and the strip explicitly.
- **The carve reports, the verifier holds.** `coverage` and `laneBand` on the
  map are what the carve achieved; a board that cannot fill or balance says
  so and passes. Do not "fix" a low band by forcing it — that is what made
  yesterday's carve fail. Priority when rules fight: tree > specials >
  floor > balance > coverage.
- **Entries are many now** (8–12 on a 7×5 board). Every spare arm of a
  special is one. If a playtest says "too many fronts", the knobs are
  `COVERAGE_TARGET`, `MAX_LANE_SHARE` and `EXTRA_WALKS` in `carve.ts`, and
  the sweep is the ruler.
- **Tower tests pick spots by ROAD distance to the Core** (one entrance:
  every enemy passes them). A test that assumes "the first road-adjacent
  ground cell in scan order is on the lane" is wrong on a filled board.
- **Patch scripts use a function replacer** (`s.replace(a, () => b)`): a
  `$$` in a replacement string is eaten by `String.replace`. It cost the
  HUD its dollar sign for an hour.
- **The browser pane cannot show `term.shade`** in its downscaled
  screenshots and cannot read the GL framebuffer; a vitest probe that
  draws through the view into a PNG with the atlas bitmaps is the proof
  for view changes. `__ad.modalText()` reads the page on screen.
- **`gh pr merge` may fail to fast-forward local main** when the art
  agent's files are locked; `git update-ref refs/heads/main origin/main`
  + `git reset` + a targeted checkout of the changed paths recovers it.

## Next session, proposed — 25: Motion

*(Daniil's rule: every shipped session ends with the next one proposed, a
full day on one theme. His "go" is enough.)*

**Theme.** The board moves the way a 60 Hz picture of a 20 Hz world should,
and every tower is animated as a thing that charges, fires and cools. It is
next because every sprite the art agent draws from now on inherits the
frame model, and the shell and strip that would show them exist now.

1. **Interpolation** (6.9 first half): the view keeps the previous
   snapshot and draws enemies and projectiles at positions interpolated by
   the time since the last tick, on the world clock (freezes at pause,
   scales at 4×). No sim change; the golden hash does not move. Proof: a
   vitest probe rendering two frames between ticks, and the pane at 1×.
2. **Sequences in the sprite format**: a state gains named sequences
   (`idle`, `charge`, `fire`, `cool`) of frames with per-frame durations;
   the importer reads them from the studies when present; the linter
   checks every frame. `frames` stays as the idle sequence for old sprites.
3. **Attack animations keyed to events**: the effects layer already
   receives `Sim.events`; a tower's `fire` event plays its `fire` sequence
   once, its cooldown plays `cool`, its target acquisition plays `charge`.
   Placeholder sequences derived from the base art (a two-frame flash and
   recoil) until the art agent's arrive, so the mechanism ships visibly.
4. **Ability graphics** (6.10): the orbital laser as a bright column from
   the top edge to the cell, through the effects layer; the frost field as
   a ring pulse; on the world clock.
5. **Relic sprites** (6.7): the strip's slots draw a sprite when the relic
   has one, the two-letter tag otherwise; a placeholder set for the M1
   relics in the current style.
6. **The mixed-build lab** as the day's ruler for anything that touches
   the sim (nothing should).

**Gate — Daniil's eye on the live build:** motion he cannot point at as
choppy at 1× and 4×; a Bolt visibly charges, fires and cools; the orbital
laser reads as a beam.

**His part:** tower sequences and relic sprites from the art agent as they
come (placeholders until then); the regenerated road study for `X`/`B`.

**Biggest risk:** interpolation across a tick where an enemy dies or
breaches, and across the bridge's strand change; both need "draw the last
known position, never extrapolate" and a test each. **Expensive if wrong:**
the sequence model is what every future sprite is authored against — PR 2
is where to argue.

## Standing open items

- Daniil's playtest of the deployed 2026-09-05 build — his.
- The road study's `X` and `B` tiers (flat stones) — his generator; the
  linter warns until then.
- The Core face sprite, button art, the splash — the art agent.
- Hailstorm as a role (WBS 2.37) — the combat-identity session.
- D25 multi-cell towers, D26 passives vs relics, D27 monetization — open.
- 2.27 gate — his.
- Technical-debt register: terminals once per session; 2× tile previews;
  the lab's analytic model; the lab gate tolerance at 8 (replaced by the
  build sweep as the ruler); the strip cramped below 7 tiles wide.
