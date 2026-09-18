# Standard's curve, fitted behind the evening's changes (2026-09-18)

`node tools/fit.mjs --patch=… --seeds=120` · the app's own maps, 7×5 · 120
seeds a row throughout (nine rows, about a minute a read). Fourth of the
evening's lab records, after [damage-model](damage-model-2026-09-18.md),
[energy-door](energy-door-2026-09-18.md) and [synergy](synergy-2026-09-18.md).

**The question.** D37 fitted the base world's mixed line to win Standard
**93%** — the top of its 85–95%, on purpose: *the lab's player buys the instant
it can afford and places by arithmetic, and a person does neither.* By the end
of the evening it read **86%**, the floor. Two things took it there, neither of
them aimed at it: plating's twin for energy (D38) blunted the line's own Frost
(−4), and the lab's base world stopped dealing itself rares and epics it
cannot have (−3).

**The answer:** Standard grows ×**1.105** a wave where it grew ×1.12, and
Payload adds **10** where it added 11. Grim is untouched.

## Targets, stated before the first read

| # | target | reads |
|---|---|---|
| C1 | the mixed line wins Standard 90–95% — the upper half, for D37's reason | **93%. Met** |
| C2 | the doors stay shut: plain Bolt spam and Ice Shards spam ≤ 10%, three plain Bolts by the entry ≤ 5% | **3%, 4%, 0%. Met** |
| C3 | the relic set stays a find and not a certainty: 70–95%, and no closer to the top than it was | **83%. Met** — by taking Payload 11 → 10; at 11 the easier curve read 93% |

## The rounds

**1. The curve alone** (Payload 11):

| Standard's growth a wave | 1.12 *(was shipped)* | 1.115 | 1.11 | **1.105** |
|---|---|---|---|---|
| the mixed line, depth first | 86% | 88% | 89% | **93%** |
| Railbores only, depth first | 80% | 85% | 88% | 93% |
| plain Bolt spam | 2% | 2% | 2% | 3% |
| Ice Shards spam | 4% | 4% | 4% | 6% |
| mono-Frost, depth first | 22% | 25% | 26% | 29% |
| Bolts forked, never finished | 3% | 3% | 3% | 3% |
| three plain Bolts by the entry | 0% | 0% | 0% | 0% |
| the old reference, chassis first | 40% | 42% | 42% | 47% |
| plain Bolts holding the relic set | 83% | 87% | 90% | 93% |

The doors do not notice: what keeps width out is what a hit is, not how fast
the wave grows — which is D37's point, read from the other side.

**2. Then the relic, behind the curve.** At ×1.105 with Payload **10**: the set
**83%**, Payload alone 13%, the pair 20%, Gatlings with Payload alone 13%, Ice
Shards width holding the set 19% — where Payload 11 stood at ×1.12, to the
point.

## What shipped

- `THREAT_LEVELS` Standard `hpGeometric: 1.105`, with the reason in its comment.
- Payload 10 / 12 / 15 (common / rare / epic; the rarer two are still unfitted).
- The bands that moved, each with its why: **S3's floor goes up with the
  line** — 89% on the gate's 80 seeds, where it measures 91% — so that sliding
  back to the bottom of the range, which took two unrelated PRs one evening,
  is a red gate and not a note in a document; the Standard thermometer
  (11.90 → 12.88: five thousandths of growth a wave is a wave of life).

## The confirmation

The candidate was read as a patch on the tree before the change; the changed
tree was then read with no patch on the same six rows that both typed values
reach: **6 rows, 0 differ.** The rest of the ladder on the shipped game, 120
seeds: the mixed line **93%**, Railbores only 92%, plain Bolt spam 3%, Ice
Shards spam 4%, mono-Frost 29%, three plain Bolts 0% (they hold wave 5 on 77%
of seeds — 74% before the evening began), the base world on Grim 3% and
holding the relic set 21%, Calm untouched (a know-nothing holds wave 5 on 99%
and wins none).

## Not done, said plainly

- **The human offset is still a guess.** 93% is "the top of the range because
  a person plays worse than the lab" — by how much, nobody has measured. This
  PR restores D37's guess; it does not replace it with a reading.
- **Mono-Frost wins Standard 29%** with nothing but Frost towers. D38's targets
  speak of *spam* (met) and of the tree on Grim (met); a finished mono-energy
  line in the base world on Standard has no target. It lost 47 points this
  evening (76% → 29%) and is recorded here rather than argued with.
