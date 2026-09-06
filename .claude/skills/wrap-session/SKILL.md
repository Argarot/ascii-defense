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

## 1. Verify the ground truth

- `git status` clean, on `main`, synced with origin. All PRs merged green
  **on `gh`'s own exit code** (never through a pipe; "no checks reported"
  right after PR creation means *pending*, not failed — wait and re-watch).
- Full gate locally: `npm run typecheck && npm run lint && npm test &&
  npm run build`.
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

## 2. Docs, in dependency order

Each file has ONE job. Update in this order so later files can reference
earlier ones:

1. **docs/WBS.md** — mark `[x]` with PR numbers on every finished item; add
   new items born today; append today's feedback round to the **request
   index** (item → WBS id, deferrals with triggers, declines with reasons —
   indexed by DANIIL'S numbering, never by the plan's).
2. **docs/ROADMAP.md** — strike completed ledger rows (`~~N~~ DONE (PRs)`);
   ensure the next open row states contents AND gate, concretely enough that
   Daniil can just say "go".
3. **docs/PRD.md** — only if the day changed what the game IS (mechanics,
   rejections, acceptance criteria). Rejections go to §14 with reasons.
4. **README.md** — if any player-facing claim drifted. Read it END TO END
   before editing; patching the top of a drifted doc produced a
   self-contradicting README once already.
5. **HANDOVER.md** — full rewrite, not a patch (it is a daily document):
   state, fresh-context warnings, **"Next session, proposed"** (see below),
   standing open items. No sequencing, no checklists.
6. **POSTMORTEM.md** (gitignored, no PR needed) — append today's findings
   with tags (`[process] [comms] [claude-weakness] [claude-strength]
   [daniil] [tooling]`). Corrections Daniil had to repeat get an entry.
7. **`node tools/doc-drift.mjs`** (Daniil, 2026-09-06: "make sure the docs
   don't drift from each other, and that the repo description is
   up-to-date") — HANDOVER's proposed session names the ledger's NEXT row
   (by row number and title), README's newest session paragraph is the
   ledger's newest DONE row, README's top paragraph describes the map the
   game makes, ASSETS names every sprite kind, the catalogue and codex twin
   are current, and the **GitHub description and homepage** match (`gh repo
   edit --description … --homepage …` when they do not). CI runs the same
   check minus the GitHub half. A drift it cannot express (a number quoted
   in two files, a rejected design still described as live) is still yours
   to read for: grep the day's changed nouns across docs/ before shipping.

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
- Final reply to Daniil, in this shape:
  1. the cache-busted live link first;
  2. what shipped today, indexed by HIS feedback numbering where it answers
     feedback;
  3. anything planned-but-NOT-BUILT marked explicitly (absence otherwise
     reads as a bug);
  4. **the next session's plan** — see "The next-session plan" below. His
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
- what he has to do (art, decisions), with defaults stated so "go" is
  enough when he has no amendment;
- the biggest risk and what it makes expensive later if built wrong.

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
  that creates his constraint.
- Ask at genuine forks with the question tool BEFORE building. Producing a
  wrong artifact costs a round-trip; asking costs a sentence.
- Sessions end with something Daniil can SEE at the live URL, led by that
  link, cache-busted.
