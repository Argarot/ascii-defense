---
name: wrap-session
description: End-of-day wrap for ASCII Defense — close the loop on docs, ledger, postmortem and handover so a fresh context resumes in minutes. Run when Daniil says to wrap up, or when a working day's last session completes.
---

# Wrap the working day

You are closing a working day on ASCII Defense. The next context may be a
different model with zero memory. Everything agreed in chat that is not in a
committed doc **did not happen**. Work through the checklist in order; each
step names its file and its owner-of-truth. Do not restate content across
files — that is how drift starts.

**[CONTRIBUTING.md §6, how a session runs](../../../CONTRIBUTING.md) governs this
skill.** The `triage-round` skill executes its rules 1–3 at a session's start;
this one enforces 3–6 at the end. Where the two disagree, the agreement wins.

## 1. Verify the ground truth

- `git status` clean, on `main`, synced with origin. All PRs merged green
  **on `gh`'s own exit code** (never through a pipe; "no checks reported"
  right after PR creation means *pending*, not failed — wait and re-watch).
- Full gate locally: **`npm run gate`** — typecheck, lint, vitest, build and
  doc-drift chained on their real exit codes, so one command either passes or
  does not. It exists because "the exit code was not actually checked" is a
  finding this log recorded **nine separate times**; a recurrence is answered
  with a mechanism, not a tenth entry. Do not hand-chain the steps again, and
  do not read its verdict off printed output.
- **The branch check is a gate, not a print**: `test "$(git branch
  --show-current)" != main || exit 1` before any commit (a failed compound
  command stranded a wrap commit on local main on 2026-09-06).
- **The test gate is vitest's exit code, never a grep's**: `npx vitest run
  > log 2>&1; test $? -eq 0` before any commit (a red suite went up in a
  PR on 2026-09-06 behind `| grep Tests`).
- **The merge gate is three things**: `gh pr checks N --watch` exits 0,
  `gh pr checks N | grep -q pending` is false, and the PR's head SHA equals
  the branch tip. "No fail line" is not "pass" (a pending line got through
  on 2026-09-06).
- **This working tree is shared with the art agent.** `git add` by explicit
  path only, and `git diff <file>` before adding any file it might touch —
  PR 5 of session 28 shipped two of its uncommitted hunks. Never `stash`,
  `checkout .` or `reset --hard`.
- Live deployment sanity: load the site cache-busted (`?cb=<sha>`), confirm
  the new bundle name, and exercise one shipped feature through the `__ad`
  debug handle. **Motion claims carry the drawn-frame count from
  `__ad.fx()` under a hand-driven `__ad.frame(now)` loop** — the hidden
  pane fires no animation frames, so a probe that waits for them proves
  nothing (motion v2 shipped with every effect dead, 2026-09-06).

## 1b. Close the queue before the docs

The tracker is GitHub Issues, not a document (agreement rule 6). Before
writing anything:

- **Close what shipped.** `gh issue close N --comment "<PR>"` for every issue
  today's PRs answered. An issue left open after its fix merged is worse than
  no tracker.
- **Mint the unanswered defaults.** Every `call` issue asked in a previous
  session and still unanswered is closed now: its default goes into
  **docs/ROADMAP.md**'s decision table with today's date and the words "by
  default, unanswered", and the issue closes citing that row. It is a decision
  from this moment — reversible like any other, never again an open question.
  This is the step that stops his queue accreting; skipping it is how
  twenty-five items tagged "his judgement" happened.
- **File what today produced.** New defects and scope born today become
  issues, not HANDOVER bullets. Under the **content freeze** scope gets
  `later` and does not enter the ledger.
- Check the queue is short: `gh issue list --label call --label blocks-ship`.
  If that is more than a handful, say so in the final reply — it means calls
  are being created faster than they are minted.

## 1c. Count the rounds

Agreement rule 4: **two rounds of fixes on one subsystem in one day, then a
spec — never a third patch.** At the wrap, state for the record how many
rounds each subsystem took today (carve/mapgen · tiles · sim/combat ·
economy · relics · enemies · shell & menus · HUD · art pipeline · save/meta).

If any subsystem reached two and a third patch shipped anyway, that is a
**postmortem entry and a spec row in the next session's plan**, not a line to
leave out. Sessions 20 and 21 are the evidence for both halves of this rule.

## 2. Docs, in dependency order

Each file has ONE job. Update in this order so later files can reference
earlier ones:

1. **docs/ROADMAP.md** — the one plan document. Add items born today to the
   **item tree** with a fresh id (ids are stable forever); **never write an
   item's state** — `node tools/plan-state.mjs` renders done-vs-open from the
   tracker, and a hand-typed checkbox is the drift this merge removed. Minted
   defaults go in the decision table (step 1b). Strike completed ledger rows
   (`~~N~~ DONE (PRs)`) and ensure the next open row states contents AND gate,
   concretely enough that Daniil can just say "go". **Planned rows are NAMED,
   never numbered** (agreement rule 5) — do not renumber anything, do not add a
   number to a planned row, and never let one identity appear twice.
   `doc-drift` fails on both.
2. **docs/PRD.md** — only if the day changed what the game IS (mechanics,
   rejections, acceptance criteria). Rejections go to §14 with reasons.
3. **README.md** — if any player-facing claim drifted. Read it END TO END
   before editing; patching the top of a drifted doc produced a
   self-contradicting README once already.
4. **docs/ROADMAP.md again, its two live sections** — rewrite **"Where the
   project is today"** (what shipped, the golden hash, what was NOT built, the
   gate) and **"The next session"** (see below). These were `HANDOVER.md` until
   2026-09-12; it was folded in because a drift check existed solely to stop it
   disagreeing with the ledger. Keep both free of **open-item lists** — a queue
   in a plan document is what rule 6 forbids; link the query instead. The
   next-session heading carries **no name**: the ledger's NEXT row owns the
   name, and one name in two places is the drift that was just removed.
5. **POSTMORTEM.md** (gitignored, no PR needed) — append today's findings with
   tags (`[process] [comms] [claude-weakness] [claude-strength] [daniil]
   [tooling]`). Corrections Daniil had to repeat get an entry.

   **Write it as source material, not as notes.** Daniil is using this project
   to assess how Claude handles a multi-stage build, and the deliverable is a
   detailed retrospective at the end — what worked, what did not, and how to
   structure a future collaboration, possibly as a skill. That retrospective
   will be written from these entries and from `POSTMORTEM-ARCHIVE.md`, so an
   entry that would be unreadable to a stranger in three months has failed at
   its main job even if it helped tomorrow. Append **as findings happen**,
   during the session — one reconstructed at the wrap from memory is fiction.

   Two further rules make
   the difference between a log that changes behaviour and one that only grows
   — it reached 2,141 lines and 314 findings while the checklist said to read
   "the last two sections", which is 1.5% of it:

   - **A finding is not done until it is installed.** Every `[process]`,
     `[claude-weakness]` or `[tooling]` finding either **names the rule it
     created** — the file and section it now lives in (CONTRIBUTING §1–6, a
     skill, a memory file, a lint, a gate) — or is marked **`(narrative)`**
     because it is a record of what happened and nothing should change. A
     finding filed without either is a lesson that will be learned again.
   - **A recurrence is an escalation, not an entry.** If today's finding
     repeats one already in the log, the rule exists and is not working. Do not
     write it a second time — **build the mechanism that makes it impossible**
     and name that mechanism in the entry. The evidence: shell-escaping was
     written up in seven separate sections, got a memory file on 2026-09-08,
     and recurred anyway on 2026-09-12 in heredoc form. Prose lost to that
     failure eight times; a check would not have.

   When the live file passes ~400 lines, move everything older than the last
   two working weeks to `POSTMORTEM-ARCHIVE.md` (also gitignored). The archive
   is for forensics; the live file is for reading.
6. **Run the generators, then the drift gate** (Daniil, 2026-09-06: "make sure
   the docs don't drift from each other, and that the repo description is
   up-to-date"). **A generated section is never edited by hand** — that is the
   whole reason it is generated:

   ```bash
   node tools/codex.mjs        # docs/CATALOGUE.md from content JSON
   node tools/plan-state.mjs   # ROADMAP's item state from open issues
   node tools/doc-drift.mjs    # the seams that are not generated
   ```

   `doc-drift` holds that the ledger names exactly one NEXT row and that the
   section planning it exists, that no row identity is used twice, that README
   has not grown a session changelog back, the catalogue twin, and the
   **GitHub description and homepage** (`gh repo edit --description …
   --homepage …` when they do not match). CI runs it minus the GitHub and
   issue halves, which need a token.

   A drift it cannot express — a number quoted in two documents, a rejected
   design still described as live — is still yours to read for: grep the day's
   changed nouns across `docs/` before shipping. **Better: if you find yourself
   keeping two files in agreement by hand, that is a signal to merge them or
   generate one of them,** which is how the doc set went from seven
   hand-edited files to three.

## 3. Invariant hygiene

- If the golden replay hash moved today, its constant carries the reason in
  a comment AND the commit message. If it moved without a reason, stop —
  that is a determinism bug, not bookkeeping.
- Grep for artifacts of the day's refactors: dead exports, dead knobs,
  stale schema fields. A dead `isPathable`-style leftover misleads the next
  context; delete it or document it.
- Regenerated content types committed (`node tools/build-content-types.mjs`
  produces no diff).

## 4. Ship the wrap

- All doc changes go through a branch + PR (`docs/<day>-wrap`), merged
  green. Never commit to main directly — check `git branch --show-current`
  BEFORE committing (a failed compound command once stranded a commit on
  main).
- Final reply to Daniil, in this shape (agreement rule 1 decides what he
  reads and what he only counts):
  1. the cache-busted live link first;
  2. **defects as ONE rolled-up line** — *"nine defects fixed: his 1, 2, 4,
     9, 11 and four found in passing (#210)"* — never itemised. He does not
     audit these; itemising them is what made every item cost the same
     attention;
  3. **calls itemised in HIS numbering**, each with what was decided and
     whether that was his answer or the default taken;
  4. **scope as a count and a query**, not a list;
  5. anything planned-but-NOT-BUILT marked explicitly (absence otherwise
     reads as a bug);
  6. **the next session's plan** — see "The next-session plan" below. His
     entire next input must be able to be the word "go".

## The next-session plan (Daniil, 2026-09-05 — stated twice, now a rule)

Every shipped session ends with a PROPOSED PLAN for the next one, in the
final reply AND as HANDOVER's "Next session, proposed" section. A pointer
("next in the ledger is X") is not a plan and has failed twice. The plan
names:

- the theme, in a sentence, and why it is next (what it unblocks);
- **the PR list**, each with its scope and its test/proof, sized to a full
  working day — Daniil: "enough of these tiny things, I want to see
  meaningful progress every time, not just minor cosmetic stuff". Six
  small fixes are not a session; one theme with visible results is;
- the gate, as his judgement on the live build;
- what he has to do (art, decisions), **every one with a stated default** so
  "go" is enough when he has no amendment. A call with no default may not
  ship in a plan (agreement rule 3); each is also a `call` issue, and it
  mints itself at the next wrap if he says nothing;
- the biggest risk and what it makes expensive later if built wrong — and
  **ask him to rule on that risk specifically**, in one sentence: *"that risk
  is real, do X instead"* or *"accepted"*. Agreed with him on 2026-08-17, used
  once the day it was agreed, then written into every plan for three weeks
  without ever being put to him. The risk paragraph is where the dev is least
  certain and where his instincts have repeatedly been better; asking converts
  a guess into a decision with an owner. A plan whose risk line nobody ruled on
  is a plan that was skimmed.

The ledger row and this section say the same thing; the reply repeats it.

**Before writing the PR list**: if the plan cites a PRD section older than
the last map-generator change, check that section's nouns against a
generated board (`demoMap` in the lab, or `__ad.cellAt` in the pane). PRD
§4.9's "unclaimed water" met a board with no water on 2026-09-06.

## Hard rules carried from eleven postmortem sessions

- An approved scope is a contract: finish it or come back BEFORE shipping a
  partial. "Part 2" requires consent, never a summary announcement.
- A repeated identical request from Daniil is an escalation, not a fresh
  go-ahead. Two corrections on one topic = stop proposing, go read the code
  that creates his constraint. *(Rule 4 of the agreement is the same finding
  applied to code: two rounds, then a spec.)*
- **The finish line is a scene, not a count**: a stranger played, lost, and
  started again. "All bugs fixed" is unreachable and grinds. What a stranger
  did not notice is not ship-blocking — which is why the scorecard, not the
  issue count, decides what a session contains.
- Ask at genuine forks with the question tool BEFORE building. Producing a
  wrong artifact costs a round-trip; asking costs a sentence.
- Sessions end with something Daniil can SEE at the live URL, led by that
  link, cache-busted.
