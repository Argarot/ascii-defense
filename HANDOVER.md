# Handover — state as of 2026-09-08, morning (session 32 shipped Enemies II; Content completeness, the rest, is next)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§9.1b the seven bodies and their marks; §9.2
packs and formations; §9 the curve after Enemies II; §20 the tutorial;
§7.3 the run's pool; §7.6 "the logic comb") →
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/ASSETS.md](docs/ASSETS.md) → [docs/ART-AGENT.md](docs/ART-AGENT.md) →
[docs/CATALOGUE.md](docs/CATALOGUE.md) (fourteen bodies, the trait legend
with its answers) → [docs/lab/](docs/lab/) (the enemy sweep of 2026-09-08
is the counter table and the curve's evidence) →
[docs/WBS.md](docs/WBS.md) (4.37–4.40 session 32's items; the request
index's round 32) → this file → the roadmap ledger's next open row (33).
The gitignored `POSTMORTEM.md` holds collaboration findings — **read its
last two sections before writing any code today.** End every working day
with the `wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since session 32 the strip's NEXT reads "4 ram >! K- E+" and the column
names an answer under the next wave ("brute: Frost is wasted; Bolts and
Mortars, or Railbore"); a burrowed mole is a mound `_^_`** — a build
without those is older.

## Where the project is

**2026-09-08 — session 32 (PRs #190–#194, all merged green; Daniil's "go"
on the HANDOVER plan Enemies II):**

1. **The seven bodies (#190; PRD §9.1b; `engine/sim/traits.ts`)** — the
   courser (`sprint`: 60% faster while unhit for two seconds), the ram
   (`charge`: double speed under half hp), the blob (`split`: dies into two
   skitters where it fell), the mender (`heal`: mends every body within a
   cell and a half by 3 a second), the mole (`burrow`: unseen and unhittable
   for its first eight cells; `burrowLeft` hashed), the pavise
   (`frontshield`: hits from within 45° of ahead do a third), the Warden
   (`bulwark`: cover for every body within two and a half cells; `bossOnly`,
   never in an escort). Each trait one rule with one seam and a test; the
   pure speed and front-shield rules exported; placeholder sprites from the
   generator (the tool rewrites palette.json's key order — restore it by
   path after a run).
2. **Packs and formations (#191; PRD §9.2)** — a queue entry carries def,
   spacing and front (`queueEntry`/`queueDef`/`queueGap`/`queueFront`/
   `queueBoss`); the composer fills the count of BODIES with packs of one
   kind on one front in a formation — column (every wave), wedge (from 4),
   wall (from 8) — heavy kinds in half packs, the boss on a beat behind;
   `nextWavePreview().packs`; `__ad.preview()`. A resumed save's bare
   entries walk the old way. The analytic lab gate widened 8 → 10.
3. **Counter legibility (#192)** — marks on the body (a mound, a cross,
   braces, a trail, a tilde, a plank on the facing side; the worker sends
   `m` and `f`), words and two-glyph marks per trait in the strip with a
   formations line under NEXT when a row is free, **the answer** under the
   column's composition from `view/hud/traitAnswers.ts`, the tutorial's
   NEXT step.
4. **The balance pass and the enemy sweep (#193;
   docs/lab/enemy-sweep-2026-09-08.md)** — packs made the count bodies and
   bodies are Scrap: the old 6 + 4 starved the reference on half the seeds.
   Six variants read; **Standard is 6 + 5 a wave at +15% ×1.07** (the
   reference dies at 22–24 on every seed, the target band), **Grim ×1.09**,
   Calm untouched. `build-sweep --enemies` is every body alone against
   every tower line — the counter table with its reading. The live board
   held Standard's twenty with ten forked towers by the Core.

**Golden replay hash:** 432368675 → 4165960643 (#190, the burrow lane) →
1642996455 (#191, packs by design); both reasons on the constant.

**Not built:** the art agent's studies for the seven (placeholders stand);
a pack's later members dropped when the slot cap refuses the second body;
Grim and relics against the seven are unread; the register's items (below).

**Readings for Daniil, his calls:** the seven's names and looks (defaults
taken: courser, ram, blob, mender, mole, pavise, Warden; generator
placeholders); the curve (the reference at 22–24 on Standard; the live
board's ten forked towers held twenty with six breaches — right, or too
kind?); Calm's ease; the tier-2 purse; the Smith's prices; four or eight
cells; the unlock split; the Laser at 21.5; Hailstorm.

**Gate:** his eye on the live build — a Standard run to wave 10: the
strip's NEXT with marks and a formations line, the column's answer, a
wall of swarmlings and a wedge of coursers arriving as shapes, a mole
surfacing past the entry as a mound, the Warden's braces at wave 15.

## Fresh-context warnings (beyond CONTRIBUTING)

- **The local gate is five things, every time, and the chain must stop on
  a red one before committing:** typecheck, lint, vitest to a log with
  `$?`, `node tools/doc-drift.mjs`, `node tools/codex.mjs --check`.
- **No backtick inside a bash `node -e` string, ever.** Scratch scripts go
  through the Write tool and run by path; read a chain's output from its
  head.
- **After the last merge of a day: `git fetch` and `git checkout -B main
  origin/main`, never a plain `checkout main`** — a stale local main
  reverted 39 files once (session 31's wrap). Between PRs: merge without
  `--delete-branch`, `git reset -q origin/main` on the branch, `checkout -q
  -b <next>`, delete the remote branch by name.
- **`git add` with one nonexistent path stages nothing** — check `git
  status --short` before the commit.
- **Restart or reload the dev server after a new export**; any app/view/
  engine edit reloads the page and kills a running pane probe; keep a
  probe's log in `sessionStorage`; call `__ad.frame()` twice with a gap
  before reading text in a hidden pane; a probe presses N only when
  `alive === 0`, and `skipOffer`s when a pick is refused (a full row).
- **The lab's 7×5 board is not the app's 31×20 board** — a balance claim
  needs both; **and the economy is in the loop**: fewer bodies starved a
  build rather than sparing it.
- **A packed queue entry is read through the codec**, never a hand mask.
- **`chooseTier` tiers are 0-based.**
- **`tools/validate-content.mjs` exits 1 locally** on a gitignored
  `passives/pool.json` and the art agent's `road_muted_cobble` warnings;
  not a repo defect.
- **Two agents share this working tree**: `git add` by explicit path, `git
  diff <file>` before adding, never `stash`/`checkout .`/`reset --hard`.
- **The font decides the language**: spleen has `┌┐└┘─│├┤┬┴┼`, `◆`,
  braille — no double lines, no blocks.

## Next session, proposed — 33 (ledger row 33): Content completeness, the rest

*(The tile half of the old 28–29 plus row 28's remainder. The enemy half
shipped in session 32; the Smith is in the shell since 30; the keyboard
since 31. What is left is the pool's breadth, the register's three tile
debts that block it, and the proof a stranger can play — the row the
whole shell has been pointing at.)*

**Theme.** Two runs should not resemble each other, and a stranger should
play unaided. The tile pool grows from seventeen shapes to about a hundred
through the generator and the Smith's rules; the pool becomes a multiset
of owned copies; the loadout page draws at a scale that shows a page of
them; a stranger test protocol with a script and a scorecard is run on the
live build.

**PR list (a full day):**

1. **The generator's hundred** — `tools/tile-generator` (or the Smith's
   own rules) enumerates every valid 5×5 road shape by partition class,
   dedupes by rotation/mirror, scores each by its road length and turns,
   and writes ~80 new library tiles with names by shape family (bends,
   hairpins, staircases, loops, forks); specials by law stay specials.
   Proof: `validate-content`, the library tests (special IFF the road
   shape is special), a mapgen sweep that every board still carves at
   ≥ 0.9 coverage on 40 seeds.
2. **The multiset of copies** (the register since session 29) — `owned`
   counts copies, the shop sells a second copy at a rising price, the
   carve may place a chosen id up to the copies loaded; the run code
   encodes the multiset. Proof: the engine tests, the run-code test.
3. **Previews at 1×** (the register) — a preview surface inside the
   loadout and workshop pages at the glyph scale, twelve tiles a page,
   paging by keyboard too. Proof: the pane at 1920×1080 and at 1366×768.
4. **The stranger test** — a written protocol (what to watch, what to
   ask, a scorecard of ten observable moments), run once by Daniil's
   friend or a fresh reader on the live build; the findings filed in the
   WBS request index as round 33. Proof: the protocol document and the
   filed round.
5. **The art agent's brief for the seven bodies** — the study slots,
   the marks the view draws that a sprite may own (the plank, the mound,
   the cross), so a painted mole replaces `_^_`. Proof: ASSETS §3 and
   ART-AGENT updated; the placeholder generator skips a study.

**Gate — his judgement:** two runs on Standard do not resemble each other;
a stranger plays a Calm run to wave 5 unaided and can say what NEXT means;
the loadout page shows a page of tiles at once.

**His part:** the stranger (default: he runs the protocol himself as a
fresh reader); the shop price of a second copy (default: the first price
plus half, per copy); tile family names if he wants his own (default:
the generator's). "Go" is enough.

**Biggest risk:** a hundred tiles the carve cannot place at coverage, or
that all look alike — the sweep at 40 seeds is the guard, and the family
names are the legibility. **Expensive if wrong:** the multiset in the run
code (every save and replay carries it) and the library's id scheme (the
Smith, the shop, the tree's tile nodes and the codex all key on ids).

## Standing open items

- Daniil's big feedback session ("I haven't played it yet"): a fresh
  save, the tutorial, the workshop as a tree, the Smith, the plates, an
  offer, the Forge, a Standard run to wave 10 with the seven.
- His calls: the seven's names and looks; the curve; Calm's ease; the
  tier-2 purse; the Smith's prices; four or eight cells; the unlock split;
  the Laser at 21.5; Hailstorm.
- The art brief's additions for the agent: 6×5 relic sprites with a ring,
  the chest kind, a plate shape per kind if drawn, the splash, the seven
  bodies.
- Repo settings: the homepage is empty and the token cannot set it.
- D25 multi-cell towers, D27 monetization, D28 where the meta lives — open.
- 2.27 gate — his.
- Technical-debt register: the multiset of tile copies; terminals once per
  session; 2× tile previews; the lab's analytic model (its gate widened to
  10); the dead `fireRateMul`/`rangeAdd` seams; a pack's members dropped
  when the slot cap refuses its second body; Grim and relics against the
  seven unread.
