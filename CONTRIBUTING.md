# Contributing

Read this before writing code or debugging anything. Everything here was learned
the expensive way.

Sections 1–5 own the **code** invariants and the traps. **Section 6 owns how a
session runs** — how an incoming item is bucketed, when Daniil is asked, what a
repeated fix round means. Read both.

## Before writing any code today

**Run the `start-session` skill** — it is the procedure and it owns the steps
that belong at a session's start: these reads, minting the calls whose deadline
has just fallen due, proving the tree with `npm run gate`, and then **briefing
Daniil on what loaded and stopping for his go**. It briefs before it builds, so
he can see the right context loaded rather than take it on trust. **That is
for a new, empty conversation only.** Continuing in a conversation that already
holds the context — "go with the next session" after a wrap — the wrap's plan
is the brief and his "go" is the go: mint the overdue calls, prove the gate,
build (the skill says so itself, under "When NOT to run this"). The reads
below are its step 1, repeated here because a context that never loads the
skill still needs them.

1. This file, end to end.
2. **`POSTMORTEM.md`, its last two sections.** Gitignored, so it is on this
   machine only. It is where the current fragilities are recorded — what broke
   last session and what is half-fixed. Read it again at two other moments:
   **before pushing back on Daniil** (to find out whether that argument has
   already been had and settled), and **when a second fix round on one
   subsystem is starting** (§6 rule 4 says stop and write a spec — the log is
   where you find out whether that subsystem has a history of exactly this).
3. [docs/ROADMAP.md](docs/ROADMAP.md) — "Where the project is today" and "The
   next session", then the ledger's NEXT row.

4. **[docs/PRD.md](docs/PRD.md), end to end, every session** (§6 rule 9). It
   is the scope of the project - the thing being built - and a dev who has not
   read it is building from a plan's summary of it. Until 2026-09-19 this list
   called it "reference", and the design drifted for a month with nobody
   holding the whole of it.

Everything else is reference: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it is built,
[docs/CATALOGUE.md](docs/CATALOGUE.md) (generated) for what is in it today.

---

## 1. Invariants — do not break these

Each deletes a class of bug. Each is the kind of thing a fresh context quietly
violates.

1. **`Math.random` is banned.** Everything routes through the seeded PRNG
   (`pure-rand`) with named streams. Determinism is what makes calibration,
   replays and regression tests possible. Lint rule.
2. **The engine knows no glyphs, colours or pixels.** Nothing in `engine/` may
   branch on appearance. Lint rule.
3. **`engine` and `content` never import `render`, `view`, `app` or the DOM.**
   `render` never imports `engine`. Lint rule.
4. **Road cells are never buildable.** Structural guarantee, not a runtime check.
5. **Tile connectors guarantee connectivity.** There is no "is a path still
   available?" check anywhere. If you are writing one, something upstream is
   wrong.
6. **Fixed 20 Hz tick.** No frame delta reaches the simulation. Speed controls
   change ticks-per-frame, never tick size.
7. **A tower occupies exactly one cell, always.** Footprints never change.
8. **Wave budgets are never reduced to compensate for mining.** The model
   offsets choices that increase combat power and ignores those that do not.
9. **Ore is stored per tier** even with one tier active.
10. **Nothing branches on colour.** `pathId` is data; presentation is the view's
    business. This is what keeps accessibility a later view change.
11. **Content is JSON validated against a schema.** Generated types are
    committed; CI fails on drift.

## 2. Environment traps

Windows 10, PowerShell 5.1, Node v22.23.2, npm 12.0.2, git 2.33.0.

- **GitHub Pages caches `index.html` AND `public/` assets.** A green Actions
  check and a new bundle hash prove *nothing* about what a browser receives.
  Verify with a cache-busting query (`?cb=<sha>`), and confirm the loaded bundle
  filename before believing any result. This silently invalidated several
  rounds of visual review.
- **Bump `ASSET_V`** in the app whenever a file under `public/assets/` changes;
  those URLs are stable and will otherwise be served stale.
- **Never round-trip source through PowerShell.** `Get-Content -Raw` reads
  UTF-8 as ANSI and `Set-Content -Encoding utf8` re-encodes it, turning `·` into
  `В·` and `Ω` into `О©`. Use the editor tools. **Write non-ASCII in source as
  `\uXXXX` escapes** — most of this project's source is non-ASCII by nature, so
  this is not optional hygiene.
- **`npm run <script> -- --flag` fails on npm 12** (`EUNKNOWNCONFIG`). Call the
  binary directly: `npx vite preview --port 5197`.
- **PowerShell treats native-tool stderr as failure.** `git push` and
  `npm run build` write to stderr on success. Read the output, not the exit code.
- **`gh` lives at `C:\Program Files\GitHub CLI\gh.exe`** and may not be on PATH
  in a fresh session. Its token is fine-grained and scoped to this repo only —
  it deliberately cannot reach Daniil's corporate org, and must not be widened.
- **Creating a Pages *site* cannot be automated** — refused to both
  `GITHUB_TOKEN` and repo-scoped PATs. Already enabled; a fork does it by hand.
- **Vite's `base` is baked at build time.** `--base /` does not rewrite built
  HTML.
- **The browser pane throttles `requestAnimationFrame` when not displayed**, and
  screenshots fail there. Verify rendering by reading pixels via `readPixels`,
  or by `toText()`.
- **...so a motion or effect is looked at with frames driven on a WALL-CLOCK
  timer while the sim runs, never after the fact.** Stepping the sim by hand
  (`__ad.step`) with no frames between piles effects up - `__ad.fx().alive`
  read 22 - and one frame then draws them all at mixed ages: a thick white
  ring and a green disc the game never shows (2026-09-18, the mender's field).
  The probe that works: `setInterval(() => __ad.frame(), 33)`, a crop of the
  board canvas `drawImage`d onto a fixed overlay every ~110 ms (a filmstrip),
  one screenshot of the overlay; `fx().alive` is the sanity check. And
  `__ad.modalText()` after a menu action is the PREVIOUS page until
  `__ad.frame()` has run.
- **A bitmap font must be drawn at native size or an integer multiple.**
  Fractional scaling turns it to mush. Never set CSS `max-width` on the canvas.

## 3. Conventions

- **Branch:** `main` deploys. Work on feature branches, open PRs. Branch
  protection is not configured yet; it needs `Administration: write` added to
  the token, which is a deliberate widening to decide consciously.
- **Commits:** Conventional Commits. The body explains *why*. End with
  `Co-Authored-By: <model> <noreply@anthropic.com>`.
- **Comments** explain reasoning that is not evident from the code. Match the
  density in `render/GLTerm.ts`.
- **Numbers in docs are measured.** If you quote a benchmark you ran it; if you
  quote a vendor limit you linked it.
- **Verify claims at the right end.** "CI is green" is not "the user sees it".

## 4. Where things are

| | |
|---|---|
| What the game is | [docs/PRD.md](docs/PRD.md) |
| How it is built | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| How it looks, and the art pipeline | [docs/ASSETS.md](docs/ASSETS.md) |
| What happens next, session by session | [docs/ROADMAP.md](docs/ROADMAP.md) |
| The item tree, the decisions, the ledger | [docs/ROADMAP.md](docs/ROADMAP.md) |
| How a session is run | §6 of this file |
| The live queue — requests, calls, debt | GitHub Issues (`gh issue list --label call`) |

Read the PRD before the architecture; read this file before touching anything.

## 5. Traps a fresh context falls into

- **The local gate is `npm run gate`, one command** — typecheck, lint, vitest,
  build and doc-drift chained on their real exit codes. Do not hand-chain them
  and do not read the verdict off printed output: a printed "LINT" line once
  passed a `prefer-const` that CI caught, and "the exit code was not actually
  checked" is a finding this project recorded nine separate times before the
  script existed.
- **The balance gate is part of it** (`npm run balance`, a step of CI, half a
  minute). Eighty of the app's own seeds a band, against
  `packages/harness/balance/targets.json`. The bands record what the game
  **is** — target met or not — so the gate is green on the day it is set and
  red the day the game moves: a curve nudged, a tower re-priced, a generator
  rule that shortens roads. **Red is a question, not a failure: if the move
  was meant, move the band in the same PR and say why in its `why`.** Two
  kinds of band: *win rates* for the ladder's rungs, which sit near 0% or 100%
  and only catch a rung breaking; and the **thermometer** — the six-tower
  reference that stops buying, useless as a player and exact as an
  instrument, whose mean death wave moved 21.85 → 20.95 when Grim's growth
  was nudged ×1.09 → ×1.10 while Grim's win rate stayed inside its band.
- **No backtick — and no backslash escape — inside a shell string or a
  heredoc, even a quoted one.** Backticks were interpolated five times across
  sessions 29–31; on 2026-09-12 a `python - <<'PY'` heredoc collapsed `\\n` to a
  real newline, so an anchor silently never matched and the edit did not apply.
  Multi-line scripts go to the scratchpad via the Write tool and run by path;
  single anchored replacements go through the Edit tool. **Since 2026-09-17
  this is a mechanism, not a request**: `.claude/settings.json` runs
  `.claude/hooks/no-inline-scripts.mjs` before every Bash call and refuses a
  heredoc, or a `node -e` / `python -c`, whose body carries a backslash or a
  backtick. The prose had been broken ten times - twice that evening with the
  rule loaded - and one collapse had silently turned a regex's `\.` into `.`
  in shipped source. The guard fails open, so a bug in it cannot take the
  shell away.
- **A generator that merges into the file it reads is tested by its
  second run** (tilegen accumulated 82 → 111 until its id filter matched
  every id it makes).
- **Vite's eager glob of sprite JSON needs a dev-server restart for NEW
  files**; a new export needs one too. `preview_start` by name when the
  pane's server is not running; the tab id changes.
- **The lab's analytic model is a floor, not a forecast** - and its gate is
  retired (issue #223). The tolerance between `predict()` and the real run was
  widened four times (5, 7, 8, 10 waves) and read on ONE seed. Over sixty
  seeds the model says wave 7-9 for every map while real runs die anywhere
  from 5 to 27: a median error of eleven waves, a third of seeds inside the
  tolerance, and the gate's own seed passing at exactly ten. What holds on
  every seed is that the model never promises more than the run delivers;
  that is what `lab.test.ts` keeps. **Before widening any tolerance, measure
  the quantity across seeds** - a bound that is met on a third of them was
  never a bound. The headless runner is the instrument.
- **Fit with the harness, not with the content files** (`node tools/fit.mjs
  --patch=candidate.json`): named plans - every rung of every Threat at once -
  against a PATCH of the game (a combat rule, an enemy's armour or
  resistances, a tower's numbers tier by tier, every price by one rule, the
  purse, a curve), three to four minutes a read. The damage model of D37 was
  five rounds of it in an afternoon. Two things it taught: **change one kind
  of thing per round**, or the table cannot say which change did it; and
  **before believing a new dominant line, check the plans are played the same
  way** - "Railbores beat the mixed line" was the lab buying one depth first
  and the other chassis first. When the candidate ships, **run the harness
  with no patch and diff the rows**: the shipped game must reproduce the
  candidate to the digit, or something was typed wrong on the way in. **Both
  sides of that diff come from ONE bundle, and nothing the bundle reads - the
  engine, the lab, a content file - is edited while a read is in flight**
  (2026-09-18: a tier edited mid-run made three rows differ by a seed each).
  And a one-seed difference is never noise: the lab is deterministic. Chasing
  that one found the lab dealing the base world rares and epics it cannot have.
- **Every named player lives in ONE table: `harness/src/lab/plans.ts`.** The
  fit harness, the balance gate, the ladder and the seed corpus take their
  plans from it (`plans.test.ts` fails a tool that builds a placement by
  hand). **A plan's name is a claim - read its towers before quoting its
  number.** Issue #366 said "the Tesla line wins Grim 16%"; the line had no
  Frost in it, and a Tesla at half its price or three times its damage still
  won 1%. The fair rung for a tower is the SLOT: the base line with one
  tower's place given to it and nothing else changed (`bare*Slot`) - there
  the Tesla is the Mortar's equal. And a tool that builds its own `LabSpec`
  drifts from the app: the ladder dealt maps the app never deals until
  2026-09-18, because it spread `threatKnobs()` of a fresh stream into the
  spec instead of using `map: { threat }`.
- **When a bound says a lever cannot move the number, stop tuning and look at
  the question.** The bounding round below exists to say "this mechanism can
  meet the target"; on 2026-09-18 it said the opposite about five of the
  Missile Rack's own numbers, which made its gap a question about the
  tower's role (a call) and not a number (the dev's).
- **The lab's bundles live in `node_modules/.cache/lab/`, never in `dist/`.**
  `npm run build` empties `dist/`, and `tools/ladder.mjs` spawns one process
  a ROW from its bundle for the length of the read: on 2026-09-18 the wrap's
  gate deleted `dist/lab/build-sweep.mjs` under a 120-seed ladder, which died
  with "Cannot find module" and no table. All fifteen runners moved the same
  night. What is still true: **two reads of ONE tool share one bundle path**,
  so do not start a second `fit.mjs` while the first is building, and a gate
  beside an hour-long read still steals its cores and stretches its time.
- **Every lab run is built by `specFor(threat, plan, seed)`**
  (`harness/src/lab/spec.ts`, #394): the app's own map for the seed, the
  Threat's clock and curve, the engine's purse, the plan's towers. A tool
  that spells its own `LabSpec` is a tool that drifts from the app - it
  happened three times in three sessions - and `spec.test.ts` fails the
  four plan-playing tools if one does.
- **When a literal is found lying, grep for its siblings before closing the
  finding.** Session 40 took "100 Scrap" out of two headers; the ladder's and
  the seed corpus's went on saying it for another session.
- **Test the set, not the example you happened to think of.** The
  first-meeting banner was tested against the longest ENEMY answer and
  shipped a tower's sentence cut at "sources stack: +"; `notices.test.ts`
  now holds every line the game can produce, and failed on its first run on
  a line nobody had looked at. (And vitest does not typecheck: a test that
  passes `npx vitest` can still fail `npm run gate`.)
- **A rule that closes one door gets a rung for the door it opens, in the same
  change.** D37's damage model made armour blunt kinetic hits alone - "energy
  goes through plate" - and the harness that proved plain-Bolt spam dead had
  no Tesla, Laser or Frost-shard rung in it. The lab measured the exploit it
  already knew and shipped the mirror image unread; Daniil named it in one
  reading (D38). When a change makes X worse, ask what it makes *relatively
  better*, and add that plan to the table before believing the table.
- **Before tuning a mechanism, bound it: play it at a value far too large.**
  The synergy relics of #365 read 1% at sensible numbers; a bounding round at
  three times those read 99% - so the mechanism could meet its target - and
  showed in the same table that the flat bonus lifted the base world's mixed
  line on Grim from 32% to 71%. Tuning would have walked into that one step at
  a time. One round tells you whether the target is reachable at all, and what
  else moves when it is.
- **No row of the lab "holds nothing".** `runLab` takes option 0 of every relic
  offer - one every two waves, twelve slots - so a plan that "holds nothing"
  ends a Standard run holding up to ten commons the pool dealt it, and every
  band is a function of the POOL. Adding two relics moved
  `standard:spam` 4% -> 3% and `standard:mixedDeep` 90% -> 91% with no rule
  changed. A PR that adds or cuts a relic will nudge bands it never touched:
  expect it, re-read them, and say so in their `why`.
- **Look at every new line of text in the running game before it ships.** Both
  HUD lines D37 added were cut off mid-sentence at the panel's width ("Big
  hits and +", "small +") and every test was green. A sentence that does not
  fit is a lie by omission; `traitAnswers.test.ts` now wraps each answer the
  way the panel does.
- **A lab plan that can finish buying says what it buys next** (`LabSpec.tail`,
  issue #348), **and a sweep over an economy prints the purse.** For six
  sessions the reference build was six towers: bought out by wave 12, dead at
  wave 22 holding 4,266 Scrap, and every rung of the difficulty ladder was
  read off it. A plan without a tail is a player who stops on purpose - say so
  in the row's name. `build-sweep --debt` prints towers standing and Scrap in
  hand beside what the last wave paid; a run that ends holding several waves'
  income was not played by a player.
- **A statistical test needs a corpus that can carry its bound.** A rate near
  0.17 read on 40 seeds strays past 0.2 one time in three; the re-deal of
  D35 found one such test by changing the dice. State the true rate and the
  corpus size next to the bound.
- **After the last merge of a day: `npm run home`** (`git fetch`, then `git
  checkout -B main origin/main`, then the status). It is a script because the
  sentence alone was not enough: on 2026-09-18 the wrap typed `git checkout
  main && git reset origin/main` instead. Local `main` was a night stale, the
  checkout half-failed on three content files the dev server held open, and
  the reset moved HEAD under a tree of old files - **78 reverse diffs of the
  whole night's work**, one `git add` from reverting eleven PRs. `-B` to
  `origin/main` from an up-to-date branch touches no file, so nothing can be
  locked. If it ever happens anyway: prove every dirty path equals the stale
  commit (`git diff --name-only <stale> -- <paths>` prints nothing), then
  restore that list by path. Between PRs: merge without `--delete-branch`, `git
  reset -q origin/main` on the branch, `checkout -q -b <next>`, delete
  the remote branch by name.
- **After that dance, `git status` must list only files you mean to change.**
  The mixed reset keeps the working tree, which is the point - and it is
  also the trap: if you branched from `origin/main` *before* an open PR of
  yours merged, the tree still holds that PR's files as they were **without**
  it, and they show up as "modified". Staging them silently reverts a merged
  PR (2026-09-17: four files of the placement fix, caught by reading the
  status line by line). Anything you cannot explain, restore **by path**:
  `git checkout -- <file>`.
- **"Every PR says MERGED" is not "it is on main".** A stack of squash-merged
  PRs is correct under exactly one merge order, and on 2026-09-18 the five of
  session 40 were merged out of it inside two minutes: #376 carried its branch
  onward before #377 (and inside it the wrap) had landed in it, so `main` got
  three of five and `gh pr list` said "no open PRs". **Check by ancestry or by
  tree, never by PR state**: `git merge-base --is-ancestor <tip> origin/main`,
  or an empty `git diff --stat origin/main <gated tip>`. And while the dev
  cannot merge (the auto-mode classifier refuses `gh pr merge` and `gh issue
  close` even on Daniil's instruction in chat; only a permission rule in his
  settings lifts it, and that file is his) **a run of stacked PRs ends in ONE
  roll-up PR, tip -> `main`**, whose body carries the `Closes #N` lines: one
  click is the whole merge, and the item PRs are closed citing it.
- **A file that can be written but not unlinked** (`pool.json`, held open by
  another agent's process: "unable to unlink ... Invalid argument" on every
  checkout that touches it). Do the merge in a scratch `git worktree` - a
  fresh path has no locks - then in the real tree `git symbolic-ref HEAD
  refs/heads/<branch>`, `git reset -q`, and restore the files `git status`
  lists BY PATH. Never kill the holder: it is not ours.
- **`git add` with one nonexistent path stages nothing.**
- **The pane at 1920×1080** (`resize_window`) is how the workshop's plates
  fit; the hidden pane's default is far smaller and clips tall pages.
- **Two agents share this working tree**: `git add` by explicit path,
  never `stash`/`checkout .`/`reset --hard`; the placeholder-sprite tool
  rewrites palette.json's key order — restore it by path.
- **The machine is shared too: never kill a process by NAME.** On 2026-09-18
  `taskkill /F /IM node.exe`, meant for three leftover sweeps, killed every
  Node process on the machine - the preview server and one nobody could
  name afterwards. Start long jobs through the harness so they have an id to
  stop, and let a sharded sweep's parent own its children.
- **The font decides the language**: spleen has `┌┐└┘─│├┤┬┴┼`, `◆`,
  braille — no double lines, no blocks.

## 6. How a session runs

Sections 1–5 own the **code**; this owns the **process**. Written 2026-09-11
after a review of how this project is managed found the problem is not the
defect count — it is that **every incoming item costs Daniil the same
attention**, whether it needs his taste or not. The queue is not bugs, it is
decisions only he can make, mixed in with defects that never needed him. So
the job is to stop him being the queue.

The `triage-round` skill executes rules 1–3 at a session's start; the
`wrap-session` skill enforces 3–6 at the end.

### 1. Every incoming item gets exactly one bucket

A thought dump, a playtest round, a stranger's scorecard: each item is sorted
before any of it is worked, and the bucket decides who sees it.

| bucket | test | who acts |
|---|---|---|
| **defect** | it lies, breaks, or **contradicts a rule already written down** (PRD, ARCHITECTURE, this repo's own claims) | the dev, without asking. Daniil sees a one-line roll-up, never the list |
| **call** | it needs his taste, and **no written rule decides it** — names, prices, ladders, feel | Daniil. This is his only queue |
| **scope** | new work, not a fault in what exists | nobody today. It gets an issue with a date and waits |

**The boundary is the load-bearing part.** "Contradicts a written rule" is
the whole test. If no rule covers it, it is a call — do not quietly decide it
as a defect. Silently "fixing" an uncovered question is how the game becomes
something he did not choose, discovered three sessions later.

*Prevents:* a prose list of twenty items where each one costs the same
attention, and most should have cost none.

### 2. Calls are asked once, in one window

Every call a session needs is asked in **one batched question at the session's
start**, before any code. Not trickled as they arise, not at the end.

The exception is a fork that only appears mid-build and would waste the rest
of the session if guessed wrong — that one stops the work and gets asked. A
call that merely *would be nice* to have answered waits for the next window.

*Prevents:* ad-hoc availability, which feels helpful and makes him the
bottleneck for a whole day's work.

### 3. Every call carries a default, and silence mints it

No call is ever asked without a stated default and a deadline. The deadline is
**the start of the next session**.

Unanswered by then → the default is taken, and it is **minted as a decision**
in the WBS decision table with its date and the words "by default, unanswered".
It is then a real decision: reversible like any other, but never re-opened as
an open question.

Work never waits on him. "Go" is always enough.

*Prevents:* twenty-five items tagged "his judgement" accumulating across
sessions with nothing forcing them closed.

### 4. Two rounds on one subsystem, then a spec — not a third patch

Count **rounds, not severity**. A second round of fixes on the same subsystem
in the same working day means the specification is wrong, not the code.

At round 2 the dev **stops patching and says so out loud**, then writes the
spec — a PRD or ARCHITECTURE section that states the rule the subsystem must
satisfy — and the fixes follow from it. Session 20 is the proof this works;
session 21 is the proof of what three rounds cost.

The subsystems that count separately: **carve/mapgen · tiles · sim/combat ·
economy · relics · enemies · shell & menus · HUD · art pipeline · save/meta**.

*(This tightens the roadmap's own note, which said three rounds and then was
not enforced.)*

*Prevents:* a session bought not by a feature but by accumulated patch debt.

### 5. The ledger names rows; it does not renumber them

Session numbers that move cost more than they explain — the roadmap already
had to add "each row carries its previous identity" to cope, and still ended
up with two rows numbered 33 and three numbered 34.

- **Done rows** are keyed by their **date** and their name.
- **Planned rows** are keyed by a **stable name** only. No number.
- "Next" is a name, written **once**: the ledger's NEXT row owns it and
  `## The next session` plans it without repeating it. `tools/doc-drift.mjs`
  checks that exactly one row is NEXT and that the section exists.

A number may appear as a *count* ("about eight sessions to beta"). It is never
an identifier.

*Prevents:* renumbering churn, and the paperwork that renumbering needs.

### 6. The plan and the tracker are never the same document

> Never let a doc be both the plan and the tracker. That is the specific thing
> that produces "scattered and disorganised".

- **The plan** is `docs/ROADMAP.md` — sequencing, the item tree with its
  stable ids, the decisions, the ledger. One document, because two of them
  drifted from each other (2026-09-12). Plans get read end to end.
- **The tracker** is **GitHub Issues**. Trackers get queried, never read.

Two label axes, and only two:

- `defect` · `call` · `scope` — the bucket from rule 1.
- `blocks-ship` · `later` — whether beta waits for it.

What lives in Issues: every open item — the technical-debt register, the
the standing open items, every call, every item of the plan's tree whose
work is not done, and each new feedback round from round 34
(titled `[r34.3] …`, his numbering kept). What does **not**: milestones,
gates, decisions once minted, and the **closed** history — rounds 1–33 and
every shipped item are frozen in `docs/history/`, because PRs and commits
cite them. The rule is about the live queue, not the archive.

An item's **state** is part of the tracker too: `docs/ROADMAP.md` lists the
ids and never says whether one is done. `node tools/plan-state.mjs` renders
that from open issues, so it cannot go stale by hand.

His whole queue is one query:

```
gh issue list --label call --label blocks-ship
```

*Prevents:* hundreds of items in prose. Hundreds in a filtered list is a
normal Tuesday.

### 7. A question measurement can answer is never a call

Rule 1 says a call is something no *written rule* decides. That was too loose,
and it let five balance questions sit in Daniil's queue for a week. The test has
a second half:

> **Could a sweep, the lab, or the headless runner settle this?** Yes → it is
> `scope` (go and measure) or `defect` (the number contradicts a stated
> target). Only if **no rule and no measurement** can settle it is it a `call`.

Balance, tuning, difficulty and dominance are **never** calls. The dev states
the target, derives the number, ships it with the evidence, and Daniil nudges
only if it is way off. In his words, 2026-09-17:

> *"You are being lazy and using me as QA, you should be able to do it
> yourself. I only nudge you if you are way off, but I shouldn't be the
> bottleneck, figure it out."*

**The trap this closes.** When no target exists, the honest-feeling move is to
ask him what the number should be. That is the lazy move. **Stating the target
is the dev's job too** — propose it, argue it from what the sweeps already
measured, and hold the build to it. Bring him a target only when the evidence
genuinely cannot say which target is right, and bring it as a proposal with the
data, never as an open question.

What remains a legitimate call: names, feel, prices as *taste* rather than
balance, whether a mechanic should exist at all, and anything where "better" is
not measurable.

*Prevents:* him being used as QA — which is the original diagnosis this whole
section exists to fix, recurring in a new costume.


### 8. The design is reviewed on a schedule, and the schedule is a gate

From 2026-08-16 ("the game is fun now") to 2026-09-19 nobody asked whether
the plan was still the right game. Forty sessions of balance work sat on two
decisions that each had one answer - *where to build* and *what to build* -
and the evidence was in the project's own lab, in a rung the dev had named
"placement learned" (docs/design/rework-2026-09-19.md). Daniil: *"If I didn't
do this session, we would have continued to build a shit project. … Let's bake
regular reviews into our work schedule, so they are pre-planned."*

- **A design review is due after six done ledger rows.** ROADMAP carries one
  line - `Last design review: <date>, after done row <N>` - and
  `tools/doc-drift.mjs` **fails** when more than six rows have been struck
  since. Six is a first guess, his and the dev's; change the constant when it
  proves wrong.
- **When one is due, the wrap's next-session plan IS the review** - the
  `design-review` skill - and not a build. The brief at every session's open
  shows the count (`design review: 2 of 6`).
- **It needs him in the conversation.** No code, no overnight run, no "go".
- **Four things pull one forward**, whatever the count: a **third** fix round
  on one subsystem *across* sessions (rule 4 counts a day; this counts a
  history - D37, D38 and the re-fit behind them were three rounds on "what
  bounds a build" and the rule never fired); **three open "his eye" gates** in
  the ledger; **a lab result that needs a blunt global rule to hold** (plating
  was one); and **any milestone gate or the stranger's round**, before it.
- **`design-signal`** is a label beside the three buckets of rule 1, never in
  place of one: an item or a lab finding that recurs on a theme. "Three
  Mortars demolish everything", "400 Bolts win" and "ignore-armour is always
  the pick" were each triaged as balance; together they said width was
  unbounded. The review reads the label first.

*Prevents:* building the wrong game correctly.

### 9. The PRD is the scope: read whole, written once, never stacked

Daniil, 2026-09-19: *"PRD is the scope of the project, the thing we are trying
to build, and the fact that you don't read it defeats the purpose of having it.
… PRD is the source of truth for the whole project, and it should be clear. If
amendments pile up, and especially if they start contradicting or confusing
each other - that's a prime signal for design review."*

- **Read it end to end at every session's start** ("Before writing any code
  today", item 4). It is kept short enough for that on purpose.
- **A change to the design is written in place.** The section is rewritten to
  say what is true now; what it replaced moves to `docs/history/` verbatim;
  the *why* lives in ROADMAP's decision table and in `docs/design/`. **No
  "amended", no "superseded", no dated stratum.** A design that is approved
  and not built yet is the one exception: it is marked as such until its row
  ships, and folded in the day it does.
- **Amendments are budgeted.** `doc-drift` counts the PRD's amendment markers
  and fails above the budget; the budget only ever goes down. Going over it is
  not a formatting problem - it is rule 8's fifth trigger.

*How it got this way, so it does not again:* early sessions kept dated
amendments to preserve the why, the wrap checklist said "only if the day
changed what the game IS", nothing ever consolidated, and at 2,000 lines the
session checklist stopped reading it to save tokens. Each step was sensible.

*Prevents:* a source of truth nobody reads.

### 10. Push back on autonomy when decisions are hanging

Long autonomous sessions are right for instruments, defects and detail, and
wrong for direction. **Before accepting one, count what is hanging** - open
calls, open "his eye" gates, plan items whose default is a guess - and if the
work would mostly be built on those, **say so and propose the shorter session
or the conversation instead.** Daniil, 2026-09-19: *"push back if I ask you for
a long autonomous session which you think would be not particularly productive
because of lots of hanging decisions."* His assumption - that what remained
was unimportant detail - was reasonable from what the wraps told him; the
wraps were the dev's.

*Prevents:* throughput in the wrong direction.

---

### The content freeze

**From the stranger's round onward, nothing new enters the ledger except
defects and calls.** (Daniil, 2026-09-11, by default on the plan.)

New ideas get a `scope` / `later` issue with the date they were raised, and
are read when the freeze lifts. The number that mattered was never the bug
count — it was the plan growing 32 → 40 sessions by accretion.

### The finish line

Not "all bugs fixed" — unreachable, and it grinds. The finish line is an
observable scene with a person in it:

> **A stranger played, lost, and started again.**

That is reachable, and it settles arguments. Everything a stranger did not
notice is, by definition, not ship-blocking — which is what makes
[STRANGER-TEST.md](docs/STRANGER-TEST.md) the highest-leverage thing in this repo
and the reason its round is run **before** the session it feeds, not inside it.
