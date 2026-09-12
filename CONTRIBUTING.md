# Contributing

Read this before writing code or debugging anything. Everything here was learned
the expensive way.

Sections 1–5 own the **code** invariants and the traps. **Section 6 owns how a
session runs** — how an incoming item is bucketed, when Daniil is asked, what a
repeated fix round means. Read both.

## Before writing any code today

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

Everything else is reference: read [docs/PRD.md](docs/PRD.md) for what the game
is, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it is built,
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
