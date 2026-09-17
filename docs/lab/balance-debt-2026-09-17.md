# The balance debt, measured (2026-09-17; issues #234 and #235)

`node tools/build-sweep.mjs --debt 120` · `node tools/tail-probe.mjs <threat> 120` ·
board 7×5 · economy 100 Scrap · **the shipped Threat levels, read from the
engine** · 120 seeds a row · horizon 40.

Two questions sat in Daniil's queue as `blocks-ship` calls for a week — *"the
curve — is the ramp right?"* and *"Calm's ease — is Calm easy enough for a
first run?"* — until CONTRIBUTING §6 rule 7 moved them back: a question a
sweep can answer is never a call. This is the sweep. Every earlier reading of
the curve used **four seeds**; this one uses a hundred and twenty.

## Before measuring: the lab was measuring a world the game does not ship

The Threat levels lived in the app's `protocol.ts`, which the harness may not
import, so every sweep carried a hand copy "as protocol.ts ships it". **Seven
copies in six files, and they had drifted**: `sweep.ts` still read Standard
at ×1.05 and four a wave — two sessions after the game moved to ×1.07 and
five — and `cli.ts`'s row named *current* was the curve of session 12. The
table lives in `engine/src/sim/threat.ts` now; the worker, the setup page and
every sweep read that one object, and `threat-source.test.ts` fails, by file
and line, if a sweep spells a curve out by hand again.

## The targets, stated before reading them

The band this project has quoted since session 31 — *"the reference build
dies at 22–24 on Standard"* — is a proxy. What it stands for, in the terms a
player meets:

| # | target | what it protects |
|---|---|---|
| L1 | **Calm: a player who knows nothing holds wave 5 on every seed.** One plain Bolt where the enemies appear, then nothing | The stranger test runs Calm to wave 5 unaided (docs/STRANGER-TEST.md). A seed that kills a stranger before wave 5 spends the one first session a stranger has |
| L2 | **Calm: that same player LOSES, later, having seen the game** — between waves 6 and 12 | The finish line is "a stranger played, lost, and started again". A first run that cannot be lost teaches nothing; one lost at wave 3 teaches less |
| L3 | **Each lesson is a rung.** Placement, then forks, then the mixed line — each must move the death wave visibly, and the last must win Calm | A lesson that does not pay is a lesson nobody learns |
| L4 | **Standard is lost by what wins Calm, and won by the reference build** — most of the time, not always | Standard is the default run. It should ask for the whole base toolkit and no more |
| L5 | **Grim is lost by the base world and won by the tree** | Grim costs 40 Ore to open. It must need what the tree sells, and must not be a wall for a player who has it |
| L6 | **No seed is unwinnable for the build its Threat is meant for** | Calibration I's gate, read early |

## Calm — issue #235

| build | mean death | median | 10th–90th | min | holds 3 | **holds 5** | holds 10 | WINS (15) | first leak | Core left at the win (of 50) |
|---|---|---|---|---|---|---|---|---|---|---|
| NAIVE: one plain Bolt by the entry, then nothing | 8.2 | 7 | 6–11 | **6** | 100% | **100%** | 17% | 2% | wave 2 | 34 |
| NAIVE: three plain Bolts by the entry, no forks | 10.1 | 10 | 6–16 | 6 | 100% | **100%** | 39% | 10% | wave 3 | 23 |
| NAIVE: plain Bolts by the entry as Scrap comes (eight) | 11.8 | 11 | 7–18 | 6 | 100% | **100%** | 53% | 27% | wave 4 | 41 |
| placement learned: three plain Bolts at the choke | 15.6 | 16 | 13–19 | 10 | 100% | 100% | 99% | 50% | wave 10 | 26 |
| forks learned: eight Bolts at the choke, Marksman then Piercing | 26.7 | 27 | 22–32 | 17 | 100% | 100% | 100% | **100%** | wave 23 | 50 |
| the reference (Refinery, Railbore line + Frost + Mortar) | 40.9 | 41 | 41–41 | 37 | 100% | 100% | 100% | 100% | never | 50 |

**The answer to #235 is yes, with the number: 360 naive runs, none lost
before wave 6.** L1 holds on every seed for every naive build; the margin on
the worst seed is one wave, and it is the one-Bolt player who has it.
L2 holds: the know-nothing player dies at 7–11, having seen a body get
through by wave 2–4 — early enough to be told something is wrong, late enough
to have played. L3 holds and is the best thing in this table: **8 → 16 → 27 →
41**, each lesson roughly doubling the run, and placement alone turning a
certain loss into a coin flip.

The "naive" rows needed an instrument the lab did not have: every placement
mode it knew was greedy-optimal ("best road coverage at the choke"), and a
question about a first-time player cannot be read off an optimal one.
`at: 'entry'` builds within six cells of the first entry — where the enemies
appear, one lane of two or three, far from the Core. Session 31 watched a
real first-time player do exactly that.

## Standard — issue #234

| build | mean death | median | 10th–90th | min | holds 5 | holds 10 | holds 15 | **WINS (20)** | first leak | Core left at the win |
|---|---|---|---|---|---|---|---|---|---|---|
| NAIVE: three plain Bolts by the entry | 7.2 | 7 | 5–10 | 4 | 80% | 8% | 1% | **0%** | wave 3 | – |
| forks learned: eight Bolts at the choke | 15.5 | 15 | 12–19 | 12 | 100% | 100% | 48% | **2%** | wave 13 | 23 |
| **the reference, no relics** | **25.1** | 25 | 23–30 | **6** | 100% | 97% | 96% | **94%** | wave 7 | 41 |
| the reference + six common relics | 27.3 | 28 | 24–30 | 22 | 100% | 100% | 100% | **100%** | wave 8 | 41 |
| *for scale — the tree: the Laser line + six relics in the epic band* | 33.1 | 34 | 23–41 | 7 | 100% | 98% | 98% | 93% | wave 29 | 50 |

**The ramp is right as a ladder (L4 holds), and the quoted band is off by one
wave.** What wins Calm every time (eight forked Bolts) wins Standard 2% of
the time; the reference wins it 94%; relics close the rest.

- **The number outside its stated target, as the plan said it would be
  reported:** the reference dies at **25.1**, not 22–24. The band was set on
  four seeds (22.8); a hundred and twenty say 25. **The curve is not moved
  for it.** The band was always standing in for L4, L4 holds with room on
  both sides, and a nudge to ×1.075 to win back one wave of a proxy would
  re-baseline every sweep in this folder for nothing a player would notice —
  the run ends at 20 either way. The target is restated as L4; the band is
  retired.
- **What a player would notice instead:** the reference wins Standard with
  **41 of 50 Core** left. It is not a close win. If Standard should *feel*
  closer for a competent player, the lever is the last five waves (the boss
  at 20), not the growth rate — and that is a feel question, which is his.
- **The relic layer adds about two waves** (25.1 → 27.3) — the band sweep
  read three on four seeds. Session 28's "16–24 with six relics" predates the
  re-curve and is retired with the band; the layer's job now is L4's last 6%
  and L5's margin, and it does both.

### The tail: every early death is a five-entry map

| seed | entries | path floor | Refinery first (the reference) | one Bolt, then the Refinery | the line, no Refinery |
|---|---|---|---|---|---|
| 95041 | 5 | 115 | 9 | 9 | 26 |
| 285097 | 5 | 115 | 13 | 13 | 18 |
| **316773** | 5 | 105 | **6** | **6** | **6** |
| 380125 | 5 | 95 | 7 | 7 | 21 |
| 712723 | 3 | 65 | 10 | 10 | 29 |

| entries the map drew | maps | mean death | min | wins |
|---|---|---|---|---|
| 2 | 30 | 27.6 | 24 | 100% |
| 3 | 30 | 25.2 | 10 | 97% |
| 4 | 30 | 24.8 | 18 | 97% |
| 5 | 30 | 22.6 | 6 | 83% |

- **`entries` is worth five waves across its range on Standard** — more than
  the whole relic layer. That is issue #224's "a knob question", measured.
  Variance between maps is the genre; a knob that outweighs a system is
  worth knowing about.
- **Four of the five early deaths are the Refinery, not the map**: drop it
  and the same seeds read 18–29. A hundred Scrap on a Refinery first, on a
  map with five fronts, is a mistake — the *lab's* mistake, since a player
  would see five fronts and build a gun. The reference plan is
  Refinery-first on every map; a plan that looked at the map would not be.
  The 94% is therefore a floor.
- **Seed 316773 is the one to keep**: five entries, and the reference dies at
  wave 6 on every plan. **L6 is not met on 1 seed of 120.** Filed for
  Calibration I, which owns "no unwinnable seed in ≥ 500 runs" — it is the
  first concrete member of that set. **The cause is not known**: it dies the
  same on all three plans, so the Refinery is not it, and no other five-entry
  map does this, so the entry count alone is not it either. The map is the
  first suspect and nobody has looked at it yet.

## Grim — L5

| build | mean death | median | 10th–90th | min | holds 10 | holds 15 | holds 20 | **WINS (25)** | first leak | Core left at the win |
|---|---|---|---|---|---|---|---|---|---|---|
| the reference, no relics (the base world) | 19.8 | 22 | 9–25 | 5 | 87% | 82% | 58% | **5%** | wave 7 | 26 |
| the reference + six common relics (the base world) | 21.2 | 23 | 11–25 | 5 | 93% | 87% | 71% | **7%** | wave 7 | 24 |
| THE TREE: the Laser line, no relics | 25.9 | 29 | 9–36 | 5 | 87% | 83% | 75% | **61%** | wave 3 | 50 |
| THE TREE: the Laser line + six relics in the epic band | 28.1 | 30 | 19–36 | 5 | 97% | 95% | 86% | **69%** | wave 17 | 50 |

**L5 holds: the base world wins Grim one time in fifteen, the tree two times
in three.** Grim is bimodal, and `entries` is why (it draws 3–6): three
entries wins 17% for the base world, five or six win none. The Laser line
with no relics leaks at wave 3 and still wins 61% — it opens with a Railbore
and a Refinery, and the Lasers arrive late; relics move the first leak to
wave 17.

## A defect found on the way: a stream's first draw is the seed's low bits

Exactly thirty maps per entry count, in every table above. Too neat:

| | measured over 4,000 consecutive seeds |
|---|---|
| a stream's **1st** `int(2, 5)` equals `(seed + c) mod 4 + 2` | **100.0%** — on `map`, `waves`, `relics` and `loot` alike |
| a stream's 1st `int(0, 1)` equals the seed's parity | **100.0%** |
| … its 2nd | **0.0%** (perfectly anti-correlated) |
| … its 3rd, 5th, 10th, 20th | 50.0% (random) |

`xoroshiro128plus(seed ^ hashName(name))` is seeded with no mixing and no
warm-up, so the first two outputs are near-linear in the seed. **A Standard
map's entry count is `seed mod 4`**, and the first roll of its path target
walks up by five per seed. Determinism — invariant 1 — is untouched; what is
wrong is that the first two decisions of every stream are not random *in the
seed*. For a player it is invisible today (seeds come from the clock). It
will not be invisible for **dailies** (PRD §11: consecutive dates would cycle
2-3-4-5 entries) and it silently stratified this corpus — which made these
tables *more* even, not less, so the readings stand.

**Not fixed here, on purpose.** The fix is three lines (mix the seed, or
discard two outputs). The consequence is that every seed deals a different
map and every stream a different run: the golden hash, every seed-pinned
test, every saved run and every number in this folder. That is a decision
about *when*, and it is Daniil's — filed with the evidence. The cheapest
moment is before dailies and before the stranger's round, not after.

## The instrument

- `engine/src/sim/threat.ts` — `THREAT_LEVELS`, `threatKnobs()`: one source.
- `--debt [corpus]` in `buildSweep.ts`: the three tables, with **first leak**
  and **Core left at the win** — what a player feels; the death wave alone
  could not say whether a win was close.
- `TowerPlacement.at: 'entry'` in `lab.ts` — the naive placement.
- `tools/tail-probe.mjs <threat> <corpus> <below>` — every early death with
  its map's knobs and three plans, and the by-entries table.
- In the lab, relics are held from wave 1 (acquisition is not what is
  measured), so every "+ six relics" row is a ceiling on the layer.
