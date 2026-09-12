# The working agreement

How a session runs. Six rules, each with the failure it prevents. Written
2026-09-11 after a review of how this project is managed found the problem
is not the defect count — it is that **every incoming item costs Daniil the
same attention**, whether it needs his taste or not.

The diagnosis, in two lines: the queue is not bugs, it is decisions only he
can make, mixed in with defects that never needed him. So the job is to stop
him being the queue.

These rules bind the dev. [CONTRIBUTING.md](../CONTRIBUTING.md) owns the code
invariants; this file owns the process. The `triage-round` skill executes
rules 1–3, the `wrap-session` skill enforces 4–6.

---

## 1. Every incoming item gets exactly one bucket

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

## 2. Calls are asked once, in one window

Every call a session needs is asked in **one batched question at the session's
start**, before any code. Not trickled as they arise, not at the end.

The exception is a fork that only appears mid-build and would waste the rest
of the session if guessed wrong — that one stops the work and gets asked. A
call that merely *would be nice* to have answered waits for the next window.

*Prevents:* ad-hoc availability, which feels helpful and makes him the
bottleneck for a whole day's work.

## 3. Every call carries a default, and silence mints it

No call is ever asked without a stated default and a deadline. The deadline is
**the start of the next session**.

Unanswered by then → the default is taken, and it is **minted as a decision**
in the WBS decision table with its date and the words "by default, unanswered".
It is then a real decision: reversible like any other, but never re-opened as
an open question.

Work never waits on him. "Go" is always enough.

*Prevents:* twenty-five items tagged "his judgement" accumulating across
sessions with nothing forcing them closed.

## 4. Two rounds on one subsystem, then a spec — not a third patch

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

## 5. The ledger names rows; it does not renumber them

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

## 6. The plan and the tracker are never the same document

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

## The content freeze

**From the stranger's round onward, nothing new enters the ledger except
defects and calls.** (Daniil, 2026-09-11, by default on the plan.)

New ideas get a `scope` / `later` issue with the date they were raised, and
are read when the freeze lifts. The number that mattered was never the bug
count — it was the plan growing 32 → 40 sessions by accretion.

## The finish line

Not "all bugs fixed" — unreachable, and it grinds. The finish line is an
observable scene with a person in it:

> **A stranger played, lost, and started again.**

That is reachable, and it settles arguments. Everything a stranger did not
notice is, by definition, not ship-blocking — which is what makes
[STRANGER-TEST.md](STRANGER-TEST.md) the highest-leverage thing in this repo
and the reason its round is run **before** the session it feeds, not inside it.
