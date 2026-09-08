# Handover — state as of 2026-09-08, small hours (session 31 shipped the tutorial, the early game and the comb; Enemies II is next)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§20 the tutorial; §9 the early game's curve
and rules; §7.3 the run's pool; §7.6 "the logic comb"; §11 "Built" — the
tree and the Smith; §19 the thought dump's status table) →
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/ASSETS.md](docs/ASSETS.md) → [docs/ART-AGENT.md](docs/ART-AGENT.md) →
[docs/CATALOGUE.md](docs/CATALOGUE.md) → [docs/lab/](docs/lab/) (the base
sweep of 2026-09-07 with its live-board addendum; the tree sweep) →
[docs/WBS.md](docs/WBS.md) (4.30–4.36 session 31's items; the request
index's round 31; §9 the thought dump) → this file → the roadmap ledger's
next open row (32). The gitignored `POSTMORTEM.md` holds collaboration
findings — **read its last two sections before writing any code today.**
End every working day with the `wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since session 31 a fresh save's first run starts on Calm with a
thirteen-step tutorial (a pulsing yellow box on the thing to look at), the
run setup shows a phrase under the selected Threat, and the history page
opens with a bests line per Threat** — a build without those is older.

## Where the project is

**2026-09-07 night into 2026-09-08 — session 31 (PRs #181–#189, all
merged green; Daniil's "make this session big… you have all night"):**

1. **The tutorial (#181, the fork step in #186; PRD §20)** —
   `app/src/tutorial.ts` is a step machine: thirteen steps, each a target,
   a sentence in the column and an end (the Core; an entry; the Core's
   ground; the Bolt's button; the card; Scrap and Ore; CALL WAVE; NOW and
   NEXT; the offer; the slots; a fork; a rock; the end). The target is a
   yellow box-drawn outline pulsing one glyph wider on the terminal it
   lives on (`view/board/tutorialBox.ts`; sideways only on a panel). NEXT
   or Enter ends a look-step, the player's own action ends the rest, SKIP
   ends it all; the step lives in the meta save; SETTINGS → TUTORIAL
   replays it. A first run is Calm until onboarded or a win. The sim never
   pauses for it.
2. **The early game (#182; docs/lab/base-sweep-2026-09-07.md; PRD §9)** —
   the base world measured with a new player's builds: every plan died at
   8–12 on the old Calm, the wall the wave-10 juggernaut boss. Three rules:
   armour strips at most 65% of a hit (`ARMOR_FLOOR`), a boss's multiplier
   shrinks with its own weight (`bossHpMul`), and every Threat carries its
   own curve (`THREAT_LEVELS[].difficulty`; Calm +8%/×1.03, the heavier
   kinds three waves later, `unlockDelay`). The reference line holds Calm on
   every seed. **The live board (31×20, seven entries on average) added the
   real finding in #186:** three plain Bolts far from the Core fall at wave
   8, fourteen plain ones by the Core at 13, eight forked ones by the Core
   hold fifteen with no breach — placement and forks decide, so the
   tutorial names the Core's ground and asks for a fork.
3. **The combs (#183, #186, #188)** — the HUD's dead slot grid gone; the
   title's first-run line; the summary's WORKSHOP row; the page sweep by
   `modalText()` (body lines wrap at words, a note never draws left of the
   plate, the Threat's phrase is a body line, the title's settings show no
   run keys, "1 special tile", names for the generator's tiles, the codex
   wraps to the screen, a Calm win says Calm banks Ore); the strip's kind
   column fits "swarmling"; the G key is "tile seams" on every page;
   personal bests per Threat on the history page.
4. **The keyboard on every page (#184)** — the arrows walk a page's rows
   and tiles, Enter clicks the one they are on, the cursor row is lit
   (`MenuSpec.cursor`, `MenuScreen.itemIds()`).
5. **The sim's edges (#185)** — a body the 1024-slot cap refuses waits in
   the queue (it was dropped: a free wave); a wave holds at most sixty
   queue entries (`countMax`; a swarm pack still triples one).
6. **Applicable relics (#187; PRD §7.3)** — `needsTower` on Grounding Rod,
   Overclock, Kindling, Wide Aura; `relicApplies` filters the run's pool in
   the worker and the lab; the codex says "Needs the Tesla Coil in the
   run"; nested mods print properly in the catalogue.
7. **The logic comb (#188; PRD §7.6)** — an audit of the sim against the
   cards, fourteen findings verified and fixed: Thick Walls symmetric on
   salvage; a sold tower refunds a share of what it PAID (`Tower.paid`);
   a dead duplicate is not a pick and a held fusion not a Forge target;
   two of a kind keep the readier cooldown; aura-widening relics widen the
   plus; an empty pool keeps the offer's debt; Frostbite counts a freeze;
   Overflow carries the hit's type; the mods fold no longer marks every
   tower Core-adjacent; targeting read at the held rarity; honest cards
   (Wide Net, Superheated, Salvage Rights' epic, the support sets
   reachable). **The golden replay hash moved 4031597317 → 432368675** —
   the hash now covers a shot's type, the Bloodstone counter, slow and
   burn entries, a beam's lead, paid Scrap; the reason is on the constant.
8. **Debug ops** — `__ad.choose/sell/stats/tutorial`; a probe in the
   hidden pane must call `frame()` twice with a gap before reading text.

**Not built:** the register's multiset of tile copies, terminals once per
session, the 2× tile previews (each a refactor, not a comb item);
`countMax` as bodies; the dead `fireRateMul`/`rangeAdd` seams; the art
agent's 6×5 relic sprites and chest sprite; Enemies II.

**Readings for Daniil, his calls:** Calm's curve (a plain-Bolt player who
forks holds it with no breach and 2,100 Scrap unspent — too easy, or right
for a first run?); the fork step's wording; the tier-2 purse; the Smith's
prices; four or eight cells; the unlock split; the Laser at 21.5; the ramp;
Hailstorm.

**Gate:** his eye on the live build — a fresh save's first run through the
tutorial (SETTINGS → WIPE DATA, then NEW RUN), the run setup's phrase, the
history page's bests, the summary on a Calm win.

## Fresh-context warnings (beyond CONTRIBUTING)

- **The local gate is five things, every time, and the chain must stop on
  a red one before committing:** typecheck, lint, vitest to a log with
  `$?`, `node tools/doc-drift.mjs`, `node tools/codex.mjs --check`. PR 5
  of session 31 went out on a red gate because the chain's `&&` did not
  cover the commit.
- **No backtick inside a bash `node -e` string, ever.** Three chains of
  session 31 died on it (one parsed as "unexpected EOF" and pushed an
  empty branch, so `gh pr create` said "No commits between main and
  branch"). Scratch scripts go through the Write tool and run by path.
- **After a merge, never `gh pr merge --delete-branch`**; the recipe: merge
  without the flag, `git fetch`, `git reset -q origin/main` on the current
  branch, `git checkout -q -b <next>`, delete the remote branch by name.
- **`git add` with one nonexistent path stages nothing** — check `git
  status --short` before the commit; never guess a path into an add.
- **Restart the dev server after a new export or a new cross-module import
  in a workspace package.** Any app/view/engine edit reloads the page and
  kills a running pane probe — never edit while a probe runs; keep a
  probe's log in `sessionStorage` and read it in a later call.
- **The hidden pane draws nothing until `__ad.frame()` is called twice
  with a gap** (the first asks the worker, the second draws); `hudText()`
  reads empty otherwise. Never `location.reload()` inside a javascript_tool
  call — the navigate tool first.
- **The lab's 7×5 board is not the app's 31×20 board with seven entries.**
  A balance claim needs the live board too (`__ad` playthrough).
- **`chooseTier` tiers are 0-based**; a probe that passed 1 for the first
  fork read "no upgrades" and nearly became a balance finding.
- **`tools/validate-content.mjs` exits 1 locally** on a gitignored
  `passives/pool.json` (a #161 leftover the OS will not let me delete) and
  the art agent's `road_muted_cobble` contrast warnings; CI does not run it
  on those. Not a repo defect.
- **Two agents share this working tree**: `git add` by explicit path, `git
  diff <file>` before adding, never `stash`/`checkout .`/`reset --hard`.
- **The font decides the language**: spleen has `┌┐└┘─│├┤┬┴┼`, `◆`,
  braille — no double lines, no blocks.

## Next session, proposed — 32 (ledger row 32): Enemies II

*(Deferred twice — 2026-09-06 as "bells and whistles while the game itself
is not finished", and again by session 31's tutorial mandate. The game is
finished in its pieces, a stranger's first run is walked, and the early
game holds; the enemy half of content completeness is what the towers'
identity has been waiting for: seven bodies fight eight towers today, and
the logic comb found the sim clean enough to build on.)*

**Theme.** What walks in. Seven bodies across the trait matrix with traits
that make the towers' roles matter (a Laser that ramps wants a column to
hold; a Bastion wants a front to widen), waves composed in packs and
formations so wave 10 reads unlike wave 5, and the counters legible on the
body and in the strip.

**PR list (a full day):**

1. **Seven bodies** in the roster with placeholder sprites from the
   generator: splitter (dies into two), healer (mends neighbours), burrower
   (surfaces past the first towers), charger (a sprint when hurt),
   shieldbearer (a shield that faces the front), a runner, and a second
   boss with a rule. Traits as engine rules in `traits.ts`, each with a
   test; `unlockDelay` and `needsTower`-style applicability respected (a
   burrower before wave 8 on Calm is a wall); the codex entries generated.
   Proof: the sim tests, the catalogue.
2. **The wave composer's packs and formations** — a pack is a body and its
   escort; a formation is a spacing (a column, a wedge, a wall); waves
   compose from packs with the boss behind; `countMax` becomes a ceiling
   on BODIES (a swarm pack counts three). Proof: the composition test and
   a look at wave 5 vs wave 10 in the pane; the golden hash moves once,
   with its reason.
3. **Counter legibility** — every trait shows on the body (a healer's
   glow, a shield facing) and in the strip's NOW/NEXT with the answer
   named; the codex says what counters what; the tutorial's NEXT step
   points at the first trait mark. Proof: the pane.
4. **The balance pass against a stated target** — the Laser at 21.5 and
   the ramp; the reference build lands between 16 and 24 on Standard with
   the new bodies, and Calm's plain-Bolt-with-forks line still holds
   fifteen; retune the matrix, not the bodies. Proof: the sweep doc, on
   the lab AND the live board.
5. **The enemy sweep** — every body against every tower line; the counter
   table in the doc. Proof: `docs/lab/enemy-sweep-<date>.md`.

**Gate — his judgement:** wave 10 looks different from wave 5 for what
walks in; every new body says what it does by standing there; no build
clears every wave alone; a first run on Calm is still walkable.

**His part:** the seven bodies' names and looks if he has them (default:
the names above and generator placeholders in the study style); a target
for the ramp (default: the reference build dies between 16 and 24 on
Standard; Calm unchanged). "Go" is enough.

**Biggest risk:** the wave composer rework re-baselines every sweep in
docs/lab, and a trait that the towers cannot answer is a wall, not a
counter. **Expensive if wrong:** the trait rules (every enemy sprite,
sweep and codex entry hangs on them) and the composer's shape (the
replay hashes every queue; the tutorial's wave texts assume packs read
as "N kind").

## Standing open items

- Daniil's big feedback session ("I haven't played it yet"): a fresh save,
  the tutorial, the workshop as a tree, the Smith, the plates, an offer,
  the Forge, a Calm win's summary.
- His calls: Calm's ease; the tier-2 purse; the Smith's prices; four or
  eight cells; the unlock split; the Laser at 21.5; the ramp; Hailstorm.
- The art brief's additions for the agent: 6×5 relic sprites with a ring,
  the chest kind, a plate shape per kind if drawn, the splash.
- Repo settings: the homepage is empty and the token cannot set it.
- D25 multi-cell towers, D27 monetization, D28 where the meta lives — open.
- 2.27 gate — his.
- Technical-debt register: the multiset of tile copies; terminals once per
  session; 2× tile previews; the lab's analytic model; `countMax` as
  bodies; the dead `fireRateMul`/`rangeAdd` seams; the pack members
  dropped when the slot cap refuses a pack's second body.
