---
name: triage-round
description: Sort an incoming round of feedback from Daniil — a thought dump, a playtest list, a stranger-test scorecard — into defects, calls and scope before any of it is worked. Run it the moment a numbered list arrives, and at the start of any session that begins with one.
---

# Triage the round

A round of feedback arrives as prose in Daniil's numbering. Worked as prose,
every item costs him the same attention — and most of them should cost him
none. This skill is the intake: it sorts the round, opens the tracker's
items, asks him **one** batched question, and starts work.

Rules 1–3 of [docs/WORKING-AGREEMENT.md](../../../docs/WORKING-AGREEMENT.md)
are what this executes. Read them if any judgement below is unclear.

**Do not begin any fix before the whole round is sorted.** Sorting takes
minutes; starting at item 1 and discovering at item 9 that items 2 and 6 were
the same design question costs the session.

---

## 1. Sort every item into exactly one bucket

Keep **his numbering** on every item, always — it is how he refers back, and
the request index is indexed by it.

| bucket | the test | what happens |
|---|---|---|
| **defect** | it lies, breaks, or **contradicts a rule already written down** — PRD, ARCHITECTURE, a shipped gate, the repo's own claims | fixed this session without asking. He sees one line, not a list |
| **call** | it needs his taste, and **no written rule decides it** | goes into the one question (step 3) |
| **scope** | new work; nothing about what exists is at fault | an issue with today's date. Not this session |

**The one hard test.** *Is there a written rule this contradicts?* Yes →
defect. No → it is a call or scope, never a defect. Do not decide an
uncovered question yourself because the answer seems obvious: that is how the
game becomes something he did not choose, found out three sessions later.

**Cite the rule.** A defect's issue or commit names the rule it violates
(`PRD §7.1`, `session 17's gate`). If you cannot name one, you have
misfiled it — it is a call.

**Split mixed items.** "Boss chests with sprites and a rarity ladder" is
scope (the chests) *with a call inside it* (the ladder). File both, under the
same number: `7a`, `7b`. An unsplit item is a call that will be silently
decided.

**Watch for one design question wearing several numbers.** Three items about
the same subsystem are usually one specification problem — see rule 4 of the
working agreement. Say so instead of filing three fixes.

## 2. File the defects and the scope

Both go to **GitHub Issues** — never into a doc. Labels, and only these:

- bucket: `defect` · `call` · `scope`
- urgency: `blocks-ship` · `later`

```bash
gh issue create --title "[r34.3] the strip's hp is redundant" \
  --label defect --label blocks-ship \
  --body "Round 34, his item 3. Contradicts: PRD §4.x ... "
```

Title convention: `[r<round>.<his number>] <his words, trimmed>`. His words,
not a paraphrase — a paraphrase loses the complaint.

Scope items get `later` unless the stranger test or a shipped gate is waiting
on them. The **content freeze** applies: from the stranger's round onward,
scope does not enter the ledger, it waits in the tracker.

## 3. Ask the calls — once, all of them, with defaults

One `AskUserQuestion` call, every call in the round in it, each with a
**stated default**. Never trickle a call mid-build.

Each call needs, in one line each: what is being decided, the default, and
what the default costs if it is wrong. If a call has no defensible default,
that is the sign it is actually a design conversation — say so and stop,
rather than inventing one.

Then **start work immediately on the defects**. Do not wait for his answer.
If the answer arrives during the session it applies; if it does not, the
default was taken and step 5 mints it.

## 4. Report the round the way he reads it

In the final reply and in the request index:

- **defects** as a single rolled-up line — *"six defects fixed: 1, 2, 4, 9,
  11, 14"* — with the PR, not itemised. He does not audit these.
- **calls** itemised in his numbering, each with what was decided and whether
  it was his answer or the default.
- **scope** as a count and a link to the query, never as a list.

## 5. Mint the unanswered defaults

At the next session's start, any call from the previous round still
unanswered is **closed**: the default is written into the WBS decision table
with its date and "by default, unanswered", and the issue is closed citing
it. It is a decision now — reversible like any other, never again an open
question.

---

## Worked example — round 33, his ten items of 2026-09-08

This is what the round that shipped session 33 would have cost him under
these rules. It was worked as ten prose items; it sorts into three buckets:

| # | his item | bucket | why |
|---|---|---|---|
| 1 | Esc in the workshop; the purse | **defect** | session 27's gate: *every page reachable and back* |
| 2 | no relic offer in a whole run | **defect** | PRD §7.1 states the offer cadence |
| 3 | how-to-play as cards in the game | scope | new; became PRD §20 |
| 4 | the title's towers animate | scope | new; no rule required it |
| 5 | the tree drawn as a tree | scope | new; became PRD §22 |
| 6 | chests too frequent | **call** | a tuning number, no rule. *Default: 30 s* |
| 7a | boss chests with sprites | scope | new; became PRD §4.9 |
| 7b | the boss chest rarity ladder | **call** | his taste. *Default: rare <10, epic <20, legendary 20+* |
| 8 | the Codex as a wiki of what was met | scope | new; became PRD §20 |
| 9 | the mender's green field | **defect** | session 17's gate: *nothing on screen lies* |
| 10 | the creative page | scope | new; became PRD §21 |

**Three defects he never needed to see. Six scope items, none of which had to
happen that day. Two calls — one question.**

Both calls shipped on their defaults and both are *still* sitting in
HANDOVER's "readings for Daniil" a round later, because nothing closed them.
Step 5 is what closes them.
