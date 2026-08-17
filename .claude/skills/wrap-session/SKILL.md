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
- Live deployment sanity: load the site cache-busted (`?cb=<sha>`), confirm
  the new bundle name, and exercise one shipped feature through the `__ad`
  debug handle. Screenshots fail in the hidden pane; verify UI claims with
  `gl.readPixels` after a synchronous draw, text claims with `hudText()`.

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
   state, NEXT session with its gate, fresh-context warnings, key seams for
   the next session, standing open items. No sequencing, no checklists.
6. **POSTMORTEM.md** (gitignored, no PR needed) — append today's findings
   with tags (`[process] [comms] [claude-weakness] [claude-strength]
   [daniil] [tooling]`). Corrections Daniil had to repeat get an entry.

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
  4. **the next session's plan with its gate**, pulled from the ledger, so
     his entire next input can be the word "go".

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
