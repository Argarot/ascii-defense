# Handover — state as of 2026-09-05 (late night; sessions 23–26 shipped twenty-four PRs)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§4.5 the Core's gifts, §5.3 **eight towers**,
§5.5 facing, §8 damage types and statuses) →
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/ASSETS.md](docs/ASSETS.md) (§3 kinds, sequences, placeholders) →
[docs/CATALOGUE.md](docs/CATALOGUE.md) (every tower, enemy and relic, with
the type matrix and the Core gifts — Daniil's reading table; its PROPOSED
section is his request queue) → [docs/lab/](docs/lab/) (the two sweeps of
2026-09-05 evening: types, eight towers) → [docs/WBS.md](docs/WBS.md) →
this file → the roadmap ledger's next open row. The gitignored
`POSTMORTEM.md` holds collaboration findings — **read its last three
sections before writing any code today.** End every working day with the
`wrap-session` skill, whose "next-session plan" section is a contract.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since tonight the title's hero row has EIGHT towers, the strip renders at
the board's glyph size, walkers glide between ticks, a Tesla's arc is one
curved stroke, a Laser has an arrow and a corridor** — a build without
those is older.

## Where the project is

**2026-09-05 shipped twenty-four PRs (#111–#136) in four sessions.**
Sessions 23–25 (#111–#128): the junction cells, the Core at the east edge,
the filled board, the strip, the sweeps, boon colours, the shell, the
catalogue, placeholder sprites for everything, attack sequences, two
towers.

Session 26 (late night, #129–#136), on Daniil's six feedback items then
his "go for session 26":

1. **Feedback (#129–#131).** The strip at board scale (288×16 on a 7-tile
   board; text at board scale too — his call whether it stays); the build
   preview card on hover; greying only for scrap or a tile unbuildable
   for that tower; subtle attack animation — every sprite carries
   placeholder `sequences` from the importer/generator, the view's own
   fallback is a spark and smoke over an unmoved frame; the arc as one
   continuous, curving stroke (`arcPath`); **positional interpolation**
   between snapshots on the world clock, never ahead of the sim.
2. **Damage types (#132, WBS 2.8).** Kinetic (Bolt, Mortar, Missiles) and
   energy (Frost, Tesla, Laser); every enemy multiplies by its resist
   entry (×0.6 resists, ×1.4–1.6 weak, 0 immune, before armour). The
   first matrix (×0.5/×1.5) was a nerf in a matrix's clothes and was
   replaced; the shipped one leaves the ramp ~3 waves harder than the
   day before (`docs/lab/build-sweep-2026-09-05-types.md`).
3. **Statuses (#133, WBS 2.31).** Slows are entries with a source, one
   stacking rule (coldest wins, longest lasts), marks on the walker;
   Splinter's second blast drawn a beat later.
4. **Facing and the Laser Lance (#134, WBS 2.34).** Facing is replayed,
   hashed tower state (**the golden moved 1486502285 → 3921408197 for
   that reason**); a beam corridor with heat on a held lead; ROTATE / R.
5. **The Bastion and the Core's gifts (#135, WBS 2.35).** A support aura
   (strongest of each kind, never stacking); every tower's unique boon on
   the cells touching the face, printed on the card. **Eight towers.**
6. **Hailstorm as a role (#136, WBS 2.37).** Point-blank saturation: three
   full-damage shots at close quarters. The sweep cannot see a crowd role
   (survival is decided by brutes); recorded honestly, with the three lab
   instruments that are missing (`docs/lab/build-sweep-2026-09-05-eight.md`).

**Not built, by design:** the printing-trade lexicon (D8, Daniil: keep the
names); retiring the Loadbearing relic beside the Core gifts (his call);
per-facing art for the Laser (an arrow overlay until the art agent has a
slot for it); the lab's adjacent/aimed placements and per-wave-type
reading (debt, named).

**Gates:** session 26 — **Daniil's eye on the live build**: the card says
which tower answers which enemy; a Laser he can point that reads as a
beam; walkers that glide; the strip usable at board scale. 2.27 — his.

## Fresh-context warnings (beyond CONTRIBUTING)

- **Tower state now carries facing and heat, both hashed.** A new hashed
  field moves the golden; say why in `replay.test.ts` and the commit.
- **Four attack shapes**: projectile, pulse, chain, beam; 'none' for the
  Refinery and the Bastion (the Bastion has `aura`). The coverage test
  accepts a tower that attacks, produces or supports.
- **The Core gift folds inside `foldStats`** via `applyCoreBoon`, before
  auras and relics; a supporter's aura is read from `effectiveStats` +
  its own gift, never from another `foldStats` (no recursion).
- **Interpolation lives in `view/board/interpolate.ts`**; the main thread
  keeps `prevSnap`, `snapAtMs`, `snapTicks`. Enemies carry `k`/`g`, shots
  `k`. Never extrapolate.
- **The strip is at board scale**: `StripPanel` receives glyph px 5×8; the
  hit-test scale in tests is 5/8, not 10/16.
- **Sequences are in every tower sprite** (the importer and the generator
  write placeholders); `attackLook()` only falls back for a sprite with
  none. Re-import (`node tools/import-sprites.mjs`) after a study changes.
- **The lab cannot place a Bastion next to anything or aim a Laser**; its
  numbers for those towers are wasted scrap, not evidence.
- **`__ad.hudText()` lags a frame**: read it after a `step` and a wait, or
  trust the screenshot.
- **Heredocs through Bash still break** on backslashes and quotes: scratch
  `.mjs` through the Write tool, function replacers, `node -e` only for
  quote-free edits.

## Next session, proposed — 27: Polish and the other menus

*(Daniil, 2026-09-05: "for session 27, let's polish up what we have, and
start working on the other menus, so they are at least there, unless you
disagree and we have way too much technical debt". I do not disagree: the
debt that matters — the lab's three instruments — fits inside this day as
one PR, and the rest is exactly polish.)*

**Theme.** Everything the player can reach from the title exists and
explains itself, and what he saw tonight that annoyed him is gone. Next
because eight towers, sixteen relics and a matrix now need a place in the
game where they can be read (the how-to is the catalogue), and because
his playtest list is the cheapest balance instrument we have.

1. **His playtest list first**: whatever tonight's build shows him — the
   strip's text scale decision, the ramp knob if he wants yesterday's
   feel back, anything that jumps. Fixed and shipped before the pages.
2. **The how-to as the codex**: the catalogue's generator grows a JSON
   twin that the shell renders — every tower (with tree and gift), enemy
   (with resists and traits) and relic on pages the player can page
   through from the title and from pause. One source, two consumers.
3. **Settings that exist**: reduced motion (there), text scale for the
   HUD and the strip, the colourblind palette (4.24), a key list; all
   persisted with the meta save.
4. **The summary as a story**: the run's waves, kills by tower, what he
   met, what he held; TRY AGAIN with the same seed and loadout.
5. **Onboarding (4.23)**: the first run's three prompts (select a tile,
   the strip, call the wave), dismissed once, off by a setting.
6. **The lab's three instruments**: "adjacent to the last tower" and
   "aimed along the road" placements, and a per-wave-type reading (kills
   per scrap on swarm waves); the eight-tower sweep rerun with them so the
   Bastion, the Laser and Hailstorm get real numbers.
7. **The Tile Smith as a page** of the shell, if the day has room.

**Gate — Daniil's eye on the live build:** every page reachable from the
title and back with no dead end; the how-to shows every tower, enemy and
relic from content; settings survive a reload; the first run explains
itself; his playtest list closed.

**His part:** the playtest list (one line each, his numbering); the
strip's text-scale call; the ramp call. Otherwise "go".

**Biggest risk:** a second navigation model. The shell already has one
(`MenuSpec` pages on the fullscreen terminal); every new page must be a
spec on it, never a new mode with its own click handling. **Expensive if
wrong:** the in-game codex is the catalogue's second consumer — both must
come from `tools/codex.mjs`, or the two drift the day after.

## Standing open items

- Daniil's playtest of the 2026-09-05 late build — his.
- The strip's text at board scale — his call.
- The ramp after damage types (~3 waves harder) — his call; the knob is
  `protocol.ts` hpGeometric.
- Retire Loadbearing beside the Core gifts — his call.
- The road study's `X`/`B` tiers — his generator; the linter warns.
- The art agent: enemy, relic, Core-face, tesla/missile/laser/bastion
  studies and attack sequences; a per-facing art slot for the Laser.
- D25 multi-cell towers, D26 passives vs relics, D27 monetization — open;
  D8 lexicon — closed as "keep the names".
- 2.27 gate — his.
- Technical-debt register: terminals once per session; 2× tile previews;
  the lab's analytic model and gate tolerance; the lab's three missing
  instruments; the offer modal without icons; the derived flash (now a
  spark) if any sprite lacks sequences.
