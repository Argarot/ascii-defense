# Handover — state as of 2026-09-06 (session 27 shipped six PRs; sessions 23–27 thirty in two days)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§4.5 the Core's gifts, §5.3 eight towers, §8
types and statuses) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/ASSETS.md](docs/ASSETS.md) (§3: kinds, sequences, painted studies,
facings) → **[docs/ART-AGENT.md](docs/ART-AGENT.md)** (the brief Daniil
hands his art agent; what it promises, the code must keep) →
[docs/CATALOGUE.md](docs/CATALOGUE.md) (every tower, enemy and relic;
the in-game HOW TO PLAY renders the same facts from
`packages/app/src/generated/codex.ts`) → [docs/lab/](docs/lab/) (three
sweeps of 2026-09-05/06: types, eight towers, the instruments) →
[docs/WBS.md](docs/WBS.md) → this file → the roadmap ledger's next open
row. The gitignored `POSTMORTEM.md` holds collaboration findings — **read
its last three sections before writing any code today.** End every
working day with the `wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since today HOW TO PLAY pages through every tower, enemy and relic with
its sprite; SETTINGS has four new rows; the Laser's beam is a background
glow; a run opens on HINT 1/3** — a build without those is older.

## Where the project is

**2026-09-06, session 27 (#138–#143), on Daniil's five feedback items,
the art agent's brief, then "polish and the other menus":**

1. **The art seam (#138).** `docs/ART-AGENT.md` — the standalone brief.
   The importer imports **painted studies** of any kind
   (`sources/sprites/<id>.study.json`, per-glyph inks, a named palette →
   roles) with the shape checked and named on refusal; a study silences
   the placeholder generator for its id; a state key `<path>/n|e|s|w`
   is a facing variant. Also: the Orbital Lance's click (the strip read
   the column's card, null unless the face is selected), the Core's hp
   out of the strip, minted tiles the loader cannot offer listed with
   the reason.
2. **The Laser reworked (#139).** A background beam three glyphs wide
   (centre + afterglow), pulsing from fire to fire, whiter with heat;
   reach = the straight run of road in front of it, to the turn; the
   tree Capacitor/Chill, Fast Cycle/Sear, Cutter/Deep Sear; **burns** as
   a status with a source and a `!` mark.
3. **Motion v2 (#140).** A render clock: the picture drawn at a steady
   time one tick behind the newest snapshot, blended between the two
   bracketing snapshots, whatever burst the ticks arrived in; effects
   aged by the same continuous tick.
4. **The codex (#141).** `tools/codex.mjs` writes a TypeScript twin; HOW
   TO PLAY is sections of pages — basics, one tower/enemy/relic per page
   with its sprite — from the title and from pause.
5. **Settings, the summary, onboarding (#142).** HUD text scale (reload),
   the colourblind palette (a role override set), hints on/off, the key
   list; the summary tells the run's story (kills by tower, bodies met,
   relics held); three first-run prompts in the column.
6. **The lab's instruments (#143).** `at: 'adjacent'`, `at: 'inline'`,
   `killsByDef`; the eight-tower sweep rerun
   (`docs/lab/build-sweep-2026-09-06-instruments.md`).

**Not built:** the Tile Smith as a page of the shell (the day had no room;
it stays its own page); full keyboard operation (4.24's second half); the
'inline' instrument's distance term (an aimed Laser can be placed far from
the choke).

**Three readings for Daniil** (his calls, numbers in the docs): Hailstorm
at close quarters kills fewer crowd bodies than a Railbore line even on
the instrument built to see it; the ramp after damage types is ~3 waves
harder than before; the strip's text at board scale.

**Gates:** session 27 — **Daniil's eye on the live build**: every page
reachable and back; the how-to shows every tower, enemy and relic; the
beam readable with walkers in it; the first run explaining itself; the
Orbital firing; the summary telling a story. 2.27 — his.

## Fresh-context warnings (beyond CONTRIBUTING)

- **`docs/ART-AGENT.md` is a promise to another agent.** The painted
  study shape, the facing keys, the kinds and cells, the sequence names —
  changing any of them means changing that file first and telling Daniil.
- **The codex twin is generated** (`node tools/codex.mjs`; CI checks it
  with `--check`). Roster or pool change → run it → commit both outputs.
- **The render clock is the picture's time**; `snap` is still the newest
  snapshot for everything that is not drawn (the HUD, the strip, the
  events feed). Do not read positions from `snap.board` in the view.
- **The beam's reach is the road**, not `range` (range is the cap); the
  lab mirrors the rule in `corridorRoad`. A rule change lands in both.
- **Burns and slows are entries with a source**; a new status follows the
  same shape (`applyX`, `tickX`, `enemyStatuses`, a mark in BoardView, a
  flag on the snapshot).
- **Settings are read at boot**: `UI_SCALE` comes from the meta save
  before the terminals are sized; the palette set applies live.
- **`__ad.hudText()` lags a frame**; read after a step and a wait, or
  trust the screenshot. Heredocs through Bash break on backslashes:
  scratch `.mjs` through the Write tool, function replacers.

## Next session, proposed — 28 (ledger row 27): Relics II

*(The ledger's next row; Daniil has not amended it. His "go" is enough;
D26 has defaults below. Sessions and ledger rows are numbered apart —
the row is the theme's place in the plan, the session is the day it was
built; `tools/doc-drift.mjs` holds the two together.)*

**Theme.** The found power gets its second layer: passives separate from
relics with far more slots, rarity that means power, the ways to replace,
remove and combine, a pool that outlives one run's drain, and one loot
mechanism for every reward. Next because eight towers and a matrix now
make builds, and the relic layer is what makes two runs of the same build
different.

1. **D26 decided and built (5.8): passives are not relics.** A permanent
   modifier layer with its own slots (default: six, one per column of a
   new strip section), acquired from waves (default: one pick every second
   wave from three offered, like relics today), separate from the found
   objects that remain relics. Reference for feel, not to copy: doctrines.
2. **Rarity with teeth (5.7)**: common/rare/epic on every relic with power
   that scales (the same rule, bigger numbers or a second clause), rarity
   sprites (a frame colour per rarity on the icon), the offer weighted by
   wave.
3. **Replace, remove, combine (5.7)**: a full inventory is a decision — drop
   one, or combine two of a kind into the next rarity; an honest "pool
   exhausted" when nothing is left to offer.
4. **The pool grown past one run's drain (2.7 + 1.7.2)**: twenty more
   relics from the PROPOSED table and the PRD's list (Foundry first),
   salvage for Ore when the pool is empty.
5. **Loot tables and void chests (2.22)**: caches, waves, the void's
   business — one table mechanism every reward comes from, printed in
   the codex.
6. **The lab's relic sweep**: a relic-driven build set, the power spread
   bounded, the crowd/aim instruments' distance term while there.

**Gate — Daniil's eye on the live build:** full slots is a decision, not a
wall; a rare relic reads as rare; two runs of the same seed and loadout
play differently for the relics alone; the lab bounds the spread.

**His part:** D26 (defaults above), the twenty relics' names if he wants
to name them (the PROPOSED table), art for rarity frames as it comes.

**Biggest risk:** the passive layer doubling the fold's surface — every
stat gets a second modifier path. `foldStats` is the one place; the
sweep before and after each PR is the ruler. **Expensive if wrong:** the
slot model (how many, how acquired) is what every later relic and passive
is authored against; PR 1 is where to argue.

## Standing open items

- Daniil's playtest of the 2026-09-06 build — his; the Orbital click fix
  is proven by his click.
- Hailstorm's role, the ramp, the strip's text scale — his three calls.
- Retire Loadbearing beside the Core gifts — his call.
- The art agent: the brief is `docs/ART-AGENT.md`; the placeholders it
  replaces are listed there.
- D25 multi-cell towers, D26 (session 28), D27 monetization — open.
- 2.27 gate — his.
- Technical-debt register: the Tile Smith as a page; 4.24's keyboard
  half; the inline instrument's distance term; terminals once per session;
  2× tile previews; the lab's analytic model; the offer modal without
  icons.
