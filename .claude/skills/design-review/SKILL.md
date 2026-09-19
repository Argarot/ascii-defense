---
name: design-review
description: Run the pre-planned design review - back to first principles, no code. Use when the ledger's NEXT row is a design review, when doc-drift says one is overdue, or when Daniil asks to revisit what the game is.
---

# The design review

A working session in which **no code is written**. Its question is not "does
the build do what the plan says" but **"is the plan still the right game?"**
It exists because the project went from 2026-08-16 to 2026-09-19 without one:
forty sessions of balance work sat on two decisions that each had one answer
(`docs/design/rework-2026-09-19.md`), and the evidence was in the project's own
lab the whole time, in a rung the dev had named "placement learned".

**It needs Daniil in the conversation.** It cannot run overnight, cannot be
delegated, and a "go" does not start it. If he is not there, do the reading
(steps 1–3), write what you found, and stop.

**[CONTRIBUTING.md §6 rule 8](../../../CONTRIBUTING.md) governs this skill** —
when a review is due and what pulls one forward.

## Switch roles first

You are the designer in this session, not the developer. The developer asks
whether a number holds; the designer asks whether the number should exist.
Bring objections with evidence (his global rule: a pushback is a claim —
verify it against the code and the lab before sending it), and **prefer the
one rule that serves several goals to a mechanism per goal**: in the first
review he cut three over-built proposals to a sentence each.

## 1. Read the design whole

`docs/PRD.md`, end to end, in one sitting. It is kept short enough for that on
purpose (rule 9). While reading, list:

- every sentence that contradicts another sentence;
- every section that describes something the running game does not do;
- every "amended", "superseded", "see also" — **a PRD that needs those is
  overdue for this review's own step 7.**

## 2. Hold every pillar to evidence

For each row of PRD §2: **what in the running game shows this is true?** A lab
rung, a sweep, or something Daniil did in a run. "The map is the difficulty
dial" was a pillar for a month while lane balancing, health scaled by road
length and a single Core entrance quietly cancelled it — each a sensible local
decision, none ever checked against the pillar. A pillar with no evidence is a
finding, not a formality.

## 3. The decision audit

List what the player actually decides in a run (where to build, what to build,
which fork, which relic, when to call, what to dig, …). For each:

- **the gap between the naive answer and the learned one**, read off the
  ladder's rung pairs (`docs/lab/ladder-*.md`). A huge gap that never varies
  is a lesson learned once, not a decision;
- **does the right answer change between runs?** If the same answer wins on
  every seed, the map and the relics are not doing their job;
- Sid Meier's test: would a player always pick this, or could they pick at
  random? Either way it is not a decision.

Then read the tracker's `design-signal` label: items and lab findings that
recur on one theme. Three balance complaints about one thing are one design
finding.

## 4. He plays; you watch

One run at least, on the live build, **while he says what he is thinking**.
Note where he always builds, what he never uses, what he reads and what he
ignores, when he reaches for fast-forward. Twenty minutes of this would have
found the kill zone in August.

## 5. The outside view

One or two research questions, no more, chosen from what steps 1–4 turned up.
Research agents with the instruction *"every claim needs a URL you opened;
list what you could not verify"*. Third-party facts are never stated from
memory, in this role as in any other.

## 6. The subtraction list

What should be **cut**? This project adds readily and removes rarely; the
first review's most valuable outputs were removals (the tile shop, random
chests, Automation, the flat-stat relics). A review that proposes only
additions has not finished.

## 7. Rewrite the PRD clean

The PRD is the source of truth and is read whole at every session's start, so
it states **what the game is now, once, with no strata**. Fold the review's
decisions in *in place*; move what they replace to `docs/history/` verbatim;
the why lives in ROADMAP's decision table and in `docs/design/`. Lower the
amendment budget in `tools/doc-drift.mjs` to the new count.

## 8. The process retro

Which of CONTRIBUTING §6's rules fired since the last review, which should
have and did not, and why. What cost time on either side. Ask him for his
half. Findings go to `POSTMORTEM.md`, each installed or marked `(narrative)`.

## 9. Output

- decisions in ROADMAP's table, or **an explicit "no change"** — a review
  that confirms the direction is a result, not a wasted session;
- `docs/design/review-<date>.md`: the findings, the sources, what he said,
  what was dropped;
- **ROADMAP's `Last design review:` line updated** — the date and the highest
  done row — which is what resets the counter `doc-drift` enforces;
- the next session's plan, as at any wrap.
