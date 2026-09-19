# The clear bonus - the first reading (Rework I, PR 3)

*2026-09-19. PRD sec 32.3, D44. Instruments: `packages/harness/src/lab/clear.test.ts`
and `node tools/rework-probe.mjs 40 --clear`. **A prototype behind a switch: a
reading, never a tuning.***

## What is built, under the switch

**A body knows its wave** - it did not before; a split's halves inherit their
parent's. **Par** is the wave's spawn window plus the walk of its slowest body
from its farthest entry to the Core. When a wave's last body is gone - killed or
through the Core - it pays **its bounties x the share of par saved** (x1.0), and
the column says `WAVE 7 CLEARED in 31 s` / `par 60 . +58 scrap`, or "no bonus:
over par". **Spawn windows are short**: a wave arrives within a fifth of its
Threat's clock (Calm 11 s, Standard 8, Grim 6) by compressing its formations'
spacing, shape kept. The early call is untouched; par runs from a wave's own
launch, so waves may overlap.

## The reading - Standard, the mixed line bought depth first, 40 seeds, pads on, never digs

| the same build, placed | wins | waves cleared a run | bounties a run | clear bonus a run | bonus as a share of bounties | mean seconds to clear / par |
|---|---|---|---|---|---|---|
| at the choke, by the Core | 88% | 17.3 | 3934 | 1466 | **37%** | 67.8 / 107.0 |
| forward, by the entries | 30% | 8.9 | 1372 | 673 | **49%** | 54.8 / 105.9 |

Against the target (sec 32.3, for the re-fit: a build that hugs the Core earns
about 60% of today's income, one that kills forward about 160%):

1. **At first-pass numbers the bonus is mostly a flat raise.** The Core-hugging
   build earns 37% on top of its bounties, and that alone takes pads-on Standard
   from 53% (docs/lab/digging-2026-09-19.md) to 88%. It does not yet pay for
   *where* the build kills: 37% against 49% is a spread of a third, where the
   target wants the forward build earning nearly three times the other.
2. **Why, as far as this reading can say.** Par is the *slowest* body's walk from
   the *farthest* entry, so most of a wave is far under par wherever it dies:
   the choke build clears in 68 seconds of a par of 107. The share saved is
   generous to everyone before it is generous to anyone.
3. **The forward row is a weak witness, and it is the lab's fault, not the
   rule's**: the lab's `entry` placement builds by the FIRST entry only, so on a
   map of three fronts it leaves two unanswered and loses 70% of its runs. A
   forward build that covers every front is dearer - which is the tension the
   rule is for - and the lab has no such placement yet. Filed with the ladder's
   rebuild (Rework IV).

**Not tuned, on purpose.** Two levers exist if his runs say the bonus does not
make him build forward: a **tighter par** (the wave's median body, not its
slowest; or the nearest entry) and a **steeper payout** (the share saved,
squared). The stated fallback stands beside them: the per-kill form, bounty x1
at the Core rising to x3 at the entry. Which one is his call after playing; the
number behind it is the re-fit's.

## What this does not know

- Whether the line makes him build forward *without being told* (the gate).
- Whether one slow Juggernaut setting a whole wave's bonus feels like a tax on
  slow builds - sec 32.3 says watch it in the prototype.
- Calm and Grim.
