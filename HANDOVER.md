# Handover — state as of 2026-09-08, night (session 33 shipped the feedback round and the plan's five; The stranger's round and the carve's variety is next)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§20 the tutorial and the encounter cards; §21
the creative page; §22 the tree as plates; §23 the library's breadth; §24
the multiset; §25 mini previews; §4.9 boss chests; §9.2 the clock deals an
owed offer) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/ASSETS.md](docs/ASSETS.md) → [docs/ART-AGENT.md](docs/ART-AGENT.md)
(§2 item 3: the fourteen bodies and the marks a study may own) →
[docs/CATALOGUE.md](docs/CATALOGUE.md) → [docs/lab/](docs/lab/) (the tile
sweep of 2026-09-08: nine road shapes is the law's count) →
[docs/STRANGER-TEST.md](docs/STRANGER-TEST.md) (the protocol, not yet
run) → [docs/WBS.md](docs/WBS.md) (4.41–4.50; the request index's round
33 by HIS numbering) → this file → the roadmap ledger's next open row
(34). The gitignored `POSTMORTEM.md` holds collaboration findings — **read
its last two sections before writing any code today.** End every working
day with the `wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since session 33 the title says CODEX, a card pops on the first grunt of
a run, the workshop is rows of ringed plates with the towers' sprites,
and a boss leaves a crowned chest** — a build without those is older.

## Where the project is

**2026-09-08 — session 33 (PRs #195–#203, all merged green; Daniil's ten
items, then the plan's five):**

1. **The fix bundle (#195)** — Esc leaves every page; the workshop's title
   band carries the purse and a node priced in a tier the purse lacks says
   where that ore comes from; an owed relic offer is dealt when the CLOCK
   launches the next wave if no quiet moment dealt it (a player's call
   still carries the debt: item 18 of the thought dump stands); chests
   every thirty seconds; the mender's field is a green pulse (`heal`
   event); the title's towers idle through their frames.
2. **Encounter cards and the Codex (#196; PRD §20)** — the first sight of
   an enemy kind (not a burrowed one), the first tower of a kind, the
   first chest and the first boon ground once a tower stands pop a card
   over the board and pause the run under it; once ever, in `meta.met`
   (loads empty from older saves). HOW TO PLAY is the CODEX: basics,
   towers, enemies (`???` until met), relics, boons.
3. **The creative page (#197; PRD §21)** — off the pause menu behind
   `?dev` or Ctrl+Shift+D: purse, board, spawn any kind or a boss, grant
   any relic at any rarity, toggle every tree node; the sim's `debugSpawn`,
   `debugGive`, a rarity on `debugGrantRelic` — none recorded.
4. **Boss chests (#198; PRD §4.9)** — a boss leaves a crowned chest, rare
   before wave 10, epic before 20, legendary from 20, a minute to claim,
   paid through the boss table at ×1.5/×2/×3; `chest` and `chest_boss`
   4×3 placeholder sprites; the validator knows the chest's size.
5. **The tree drawn as a tree (#199; PRD §22)** — `view/screens/treePlates.ts`:
   rows of ringed plates per branch, chains on rails, the towers' sprites
   and relic icons inside, the state in the ring's colour; `MenuSpec.tree`.
6. **The library's breadth (#200; PRD §23; docs/lab/tile-sweep-2026-09-08.md)**
   — the enumerator proves a 5×5 tile holds NINE legal routing shapes under
   the touching law (five were new); the breadth is the land: forty
   fillers and twenty decorated roads, eighty-two tiles, ids stable, the
   tool idempotent; `tools/map-sweep.mjs` is the guard (75 tile ids used
   where 15 were); the analytic lab gate reads the hand tiles only.
7. **The multiset of copies (#201; PRD §24)** — a second and a third copy
   at the first price plus half per copy, three at most; badges in the
   shop and the loadout; a click loads one more copy; the carve places
   every loaded copy and the verifier expects it.
8. **Mini tile previews (#202; PRD §25)** — one glyph a cell, a dozen a
   page in the loadout and the shop; the Smith keeps the board's scale.
9. **Docs (#203)** — docs/STRANGER-TEST.md (ten scored moments; the gate
   for row 33 is a 2 on NEXT, the answer and wave 5) and the art brief's
   fourteen bodies with the marks a study may own. **The stranger test is
   written, not run.**

**Golden replay hash:** unchanged this session (1642996455).

**Not built:** a hundred ROAD shapes (the law allows nine — the document
says why); the stranger test itself (his hands); Grim and relics against
the seven; the art agent's studies for the seven and the chests; the
register's rows below.

**Readings for Daniil, his calls:** whether the encounter cards should
pause the run (they do, like an offer) or float; the boss chest's rarity
ladder (10/20); the copy prices (20/30/40, three at most); whether nine
road shapes is enough once the land varies (the carve is the next lever);
the seven's names; the curve.

**Gate:** his eye on the live build — a fresh save: the first card, the
CODEX with `???` pages, the workshop as plates, a boss's chest at wave 5,
the creative page with Ctrl+Shift+D, three copies of a tile in the
loadout at one glyph a cell.

## Fresh-context warnings (beyond CONTRIBUTING)

- **The local gate is five things and EVERY exit code goes into the RED
  check, lint included** — a printed "LINT" line once passed a
  `prefer-const` that CI caught.
- **No backtick inside a bash-quoted `node -e` string, ever**; patch
  scratch scripts with the Edit tool, run them by path.
- **A generator that merges into the file it reads is tested by its
  second run** (tilegen accumulated 82 → 111 until its id filter matched
  every id it makes).
- **Vite's eager glob of sprite JSON needs a dev-server restart for NEW
  files**; a new export needs one too. `preview_start` by name when the
  pane's server is not running; the tab id changes.
- **A gate that reads the analytic model reads a fixed world** (the hand
  tiles); widening its tolerance a fourth time was the wrong fix.
- **After the last merge of a day: `git fetch` and `git checkout -B main
  origin/main`.** Between PRs: merge without `--delete-branch`, `git
  reset -q origin/main` on the branch, `checkout -q -b <next>`, delete
  the remote branch by name.
- **`git add` with one nonexistent path stages nothing.**
- **The pane at 1920×1080** (`resize_window`) is how the workshop's plates
  fit; the hidden pane's default is far smaller and clips tall pages.
- **Two agents share this working tree**: `git add` by explicit path,
  never `stash`/`checkout .`/`reset --hard`; the placeholder-sprite tool
  rewrites palette.json's key order — restore it by path.
- **The font decides the language**: spleen has `┌┐└┘─│├┤┬┴┼`, `◆`,
  braille — no double lines, no blocks.

## Next session, proposed — 34 (ledger row 34): The stranger's round and the carve's variety

*(Row 33 shipped everything but the one thing that needs a person: the
stranger test. Its scorecard is the gate, and the road's variety turned
out to be the carve's, not the shape count's — the enumerator settled
that. So the next session runs the test, answers what it finds, and
gives the carve the variety the tiles cannot.)*

**Theme.** A stranger plays unaided and the round is filed; two Standard
runs stop resembling each other by how the road WALKS; the seven bodies
get their studies; the register empties.

**PR list (a full day):**

1. **The stranger's round** — Daniil (or his friend) runs
   docs/STRANGER-TEST.md on the live build; the ten rows go into the WBS
   request index as round 34; every 0 and 1 becomes a fix PR the same
   session, in his numbering. Proof: the filed round; the fixes' pane
   proofs.
2. **The carve's variety** — lane length and turn preference by Threat
   (Calm long and gentle, Grim short and knotted), a walk that prefers
   unused directions, and the fill's land grouped by family (a scree
   field, not a scatter); the map sweep gains a "resemblance" column
   (shared tile ids between two seeds). Proof: the sweep, forty seeds,
   before and after; two seeds in the pane side by side.
3. **Grim and relics against the seven** — the enemy sweep at Grim and
   with six relics per state; the counter table's second page; a retune
   of the seven's numbers only where a line cannot answer a body at all.
   Proof: docs/lab/enemy-sweep-<date>-grim.md.
4. **The art agent's studies for the seven and the chests** — run the
   agent on the brief (docs/ART-AGENT.md §2 item 3 and 3b); import;
   the view's marks retired where a study owns them. Proof: the sprites
   in the pane, the placeholder generator skipping them.
5. **The register's rows** — terminals once per session (a save for
   another board size rebuilds the terminals instead of refusing); the
   analytic model retired from the gate (the mixed-build lab is the
   ruler); a pack's members no longer dropped when the slot cap refuses
   its second body. Proof: tests; the register empty.

**Gate — his judgement:** the filed round's zeros are answered; two
Standard runs do not resemble each other by the road's walk; the seven
have faces.

**His part:** the stranger (default: he runs the protocol himself as a
fresh reader, thirty minutes); a word on whether cards should pause the
run (default: they do); the carve's Threat character in a phrase each
(default: Calm long and gentle, Standard as measured, Grim short and
knotted). "Go" is enough.

**Biggest risk:** the carve's variety re-baselines every lab sweep and
moves the golden hash again; a walk that prefers novelty can starve
coverage — the sweep at forty seeds is the guard. **Expensive if wrong:**
the carve's rules (every map, save and replay hangs on them) and the
resemblance metric (a wrong one steers every later tuning).

## Standing open items

- Daniil's big feedback session, continued: the ten items are answered;
  "there will be more".
- His calls: the cards' pause; the boss chest ladder; the copy prices;
  the seven's names and looks; the curve; Calm's ease; the tier-2 purse;
  the Smith's prices; four or eight cells; the unlock split; the Laser at
  21.5; Hailstorm.
- The art brief's additions for the agent: 6×5 relic sprites with a ring,
  the chests (shape only), the seven bodies with their marks.
- Repo settings: the homepage is empty and the token cannot set it.
- D25 multi-cell towers, D27 monetization, D28 where the meta lives — open.
- 2.27 gate — his.
- Technical-debt register: terminals once per session; the lab's analytic
  model (pinned to the hand tiles, still in the gate); the dead
  `fireRateMul`/`rangeAdd` seams; a pack's members dropped when the slot
  cap refuses its second body; Grim and relics against the seven unread;
  the carve's variety (row 34).
