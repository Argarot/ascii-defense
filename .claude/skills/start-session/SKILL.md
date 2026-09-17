---
name: start-session
description: Open a working session on ASCII Defense — read the right three things, mint the calls whose deadline has passed, prove the tree is green, then BRIEF Daniil on what loaded and what is about to be built and WAIT for his go. Run at the start of every session, including one that opens with just "go".
---

# Open the working day

The counterpart to `wrap-session`. Run it **before writing any code**, every
session — including the ones that open with a single word.

It exists because the start of a session had no procedure. `triage-round` fires
only when a numbered list arrives; the wrap fires at the end; a session that
opened with "go" went straight to building, so the steps that belong at a
session's *start* — minting the calls whose deadline just passed, proving the
tree is green before touching it — happened whenever someone remembered.

---

## 1. Read exactly three things

Not the whole doc set. These three, in order:

1. **[CONTRIBUTING.md](../../../CONTRIBUTING.md)** — the invariants, the traps,
   and **§6, how a session runs**. §6 is the one that changes behaviour; the
   rest is reference you will come back to.
2. **`POSTMORTEM.md`, its last two sections** (gitignored, this machine only) —
   what broke last session and what is half-fixed. Read it again before pushing
   back on Daniil, and again when a second fix round on one subsystem starts.
3. **[docs/ROADMAP.md](../../../docs/ROADMAP.md)** — "Where the project is
   today", "The next session", then the ledger's NEXT row.

Everything else is reference, opened when the work needs it: PRD for what the
game is, ARCHITECTURE for how it is built, CATALOGUE (generated) for what is in
it right now.

## 2. Mint the calls whose deadline has passed

**This is the moment the deadline in CONTRIBUTING §6 rule 3 falls due** — "the
start of the next session" is *now*. Do it before anything else, because a call
that stays open is a decision nobody made.

```bash
gh issue list --label call --state open
```

For every call asked in a previous session and still unanswered:

- write its **default** into `docs/ROADMAP.md`'s decision table with today's
  date and the words **"by default, unanswered"**, giving it the next free
  D-number;
- close the issue citing that row.

It is a decision from that moment — reversible like any other, never again an
open question. Skipping this is how twenty-five items tagged "his judgement"
accumulated once already.

**A call asked *today* is not overdue.** Only ones that have already had a
session's grace.

## 3. Prove the tree before you touch it

```bash
git fetch && git status          # clean, on main, synced
npm run gate                     # typecheck, lint, vitest, build, doc-drift
node tools/plan-state.mjs        # re-render the item state from open issues
```

`npm run gate` is one command on purpose: "the exit code was not actually
checked" is a finding this project recorded nine separate times. **Do not
hand-chain the steps and do not read the verdict off printed output.**

If the gate is red *before* you have written anything, that is the state of
`main` and it is the session's first job — say so rather than building on it.

## 4. Decide what this session is

| what arrived | what to do |
|---|---|
| **"go"**, or nothing | Build **ROADMAP's "The next session"**. It is written so that this is enough |
| **a numbered list** of feedback | Invoke the **`triage-round`** skill *before* touching any of it |
| **a specific ask** | Do that. If it is more than a trivial edit, plan first and stop (CLAUDE.md) |
| **nothing is planned** | The previous wrap failed its own rule. Propose a session, sized to a day, and wait |

## 5. Brief him, and STOP

**This is a checkpoint, not a status line.** Print the brief below and wait.
Do not start building, do not open a branch, do not "begin while he reads".

Daniil, 2026-09-17: *"If I start a new chat in this space and just type 'go' I
have no clue what's about to happen, no bueno."* He is not asking to make the
decision again — the plan is already approved in the roadmap. He is asking to
**see that the right context loaded** before a day's work runs on it. One round
trip buys that, and "go" is still the whole of his reply.

**Give evidence, never a claim.** "I read the postmortem" is worthless; the
newest finding quoted back is proof. If a fact below is wrong, he spots it in
seconds — which is the entire point.

Keep it to roughly the shape and length below. It is scanned, not read.

```
## Session brief — <date>

**Loaded**
- CONTRIBUTING §6 — <n> rules, newest: <rule n, in five words>
- POSTMORTEM — last session was <date>; newest finding: <one line>
- ROADMAP — last shipped: <ledger row>; newest decision: <D-number, five words>
- golden hash <n> · live <url>

**Tree** — main @ <sha>, clean/dirty, `npm run gate` <green|RED>
**Queue** — <n> calls (<n> blocks-ship) · <n> defects · <n> scope
**Minted on open** — <the calls whose deadline passed, or "none">

**This session** — <name from the ledger's NEXT row>
1. <PR> — <its proof>
2. …

**Your part** — <"nothing", or the one thing>
**Risk wanting your verdict** — <one line, or "none">

Say "go", or amend.
```

**Anything that looks wrong goes at the top, not in its slot.** A red gate on a
clean tree, a plan that cites a deleted document, a call overdue by three
sessions, a golden hash that moved without a reason — these are the cases his
visibility exists for. Lead with them and say what you propose to do about
them; do not bury the finding under a tidy brief.

**Where the four facts actually live**, because getting one wrong in the brief
is worse than not printing it — a wrong fact reads as loaded context:

```bash
grep -c '^### [0-9]\.' CONTRIBUTING.md            # how many §6 rules
grep '^## ' POSTMORTEM.md | tail -1               # the last session logged
grep -o '^| D[0-9]* |' docs/ROADMAP.md \
  | grep -o 'D[0-9]*' | sort -t D -k2 -n | tail -1   # newest decision
grep -n 'hashState()).toBe' packages/engine/src/sim/replay.test.ts
```

Two traps, both hit while writing this: the decision table is **prepended**, so
the newest D is the highest *number*, never the last *row*; and the golden hash
is the `toBe(...)` in `replay.test.ts`, not `GOLDEN_SEED`, which is a different
constant that looks like an answer.

If he amends, the amendment is the session's scope and the roadmap's plan is
superseded for the day — say so back in one line before building, because an
approved scope is a contract and a silently-widened one is not approved.

## 6. While building

- **A branch and a PR per item**, never a commit to `main`. Check
  `git branch --show-current` *before* committing.
- **Every PR is gated**: `gh pr checks N --watch` exits 0, no `pending` line,
  and the PR's head SHA equals the branch tip. "No fail line" is not "pass".
- **Two rounds on one subsystem, then a spec** (§6 rule 4) — at the second
  round, stop patching, say so, and write the rule the subsystem must satisfy.
- **A question measurement can answer is never a call** (§6 rule 7). Balance,
  tuning and dominance belong to the lab: state the target, derive the number,
  ship it with the evidence. Asking Daniil for a number when no target exists
  is the lazy move wearing diligence.
- **Append findings to `POSTMORTEM.md` as they happen**, each naming where it
  was installed or marked `(narrative)`. Not reconstructed at the end.

## 7. Close with the wrap

Run the **`wrap-session`** skill. It is the other half of this one, and the
session is not finished until it has run — a session whose findings were never
written is a session whose lessons will be learned again.
