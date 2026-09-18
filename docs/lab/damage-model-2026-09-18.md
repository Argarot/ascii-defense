# The damage model — what bounds a build (2026-09-18, D37)

`node tools/fit.mjs [--patch=file.json] [--seeds=N] [--plans=...]` · the app's
own maps, 7×5 · 80 seeds a row while searching, 120 for the confirmation · a
whole-ladder read in three to four minutes.

**The question.** Plain Bolts at the choke, never upgraded, as many as Scrap
allowed, won Calm 100%, Standard 99% and Grim 84%
([ladder-2026-09-18.md](ladder-2026-09-18.md)). Daniil refused a cap on towers
and refused a price that rises per copy (D37): *"Rebalance of the damage/DPS,
or making damage types much more relevant is a better way to go."* A
Bolt-only build is welcome **when relics carry it**; brainless spam winning by
default is not.

**The answer, in one table** (120 seeds, shipped as of this document):

| | before | after |
|---|---|---|
| plain Bolts, never upgraded — Standard / Grim | 99% / 84% | **3% / 0%** |
| Railbores only, depth first — Standard / Grim | 100% / not read | 84% / 2% |
| the mixed line, depth first — Standard | 100% | **93%** |
| the base world on Grim (no relics – six commons) | 91 – 97% | **11 – 18%** |
| the tree on Grim (the same line, epic-band relics) | 99% | **99%** |
| a know-nothing holds Calm's wave 5 | 99% | 99% |

## Targets, stated before any number was measured

| # | target | reads |
|---|---|---|
| S1 | Plain Bolts, no relics: Standard ≤ 10%, Grim never; Calm may still be won about half the time | **3%, 0%** — and Calm **99%**: *not* about half. Placement alone still wins Calm |
| S2 | An upgrade is worth more than another tower | Railbores 84% against plain Bolts 3% on Standard. **Met.** (Bolts forked but never taken to tier 3 win 1%: a fork that stops at a small hit is still a small hit) |
| S3 | The reference wins Standard 85–95%; what wins Calm loses Standard | **93%**; Bolt spam wins Calm and loses Standard. **Met**, at the upper end on purpose |
| S4 | Grim: base world ≤ 20%, tree ≥ 60%, and the tree's *towers* carry part of it | **11–18% against 99%. Met** — the first half. The second is **not shown**: the tree's best build is still the base line holding epic relics (99%); the mixed tree line is level with it (99%), the Laser line 84%, Tesla 16%, Missiles 9% |
| S5 | Bolts only, with relics that support them, win Standard ≥ 70% | **1%. Not met.** The six commons that suit a Bolt (damage ×1.15, faster fire, +1 pierce, ricochet, range, bounty) do not carry it past plating. It needs a relic that adds *flat* damage or pierces armour — the next PR |
| S6 | The early game and L6 hold | Calm know-nothing: holds wave 5 on 99%, wins 1% — as before. Standard's three-plain-Bolts player holds wave 5 on 74% (78% before) |

## How it was found — five rounds, each table a whole ladder

**1. Armour alone is not enough.** Plating (every body +1 armour per 3 waves
from wave 6), a floor of 15% instead of 35%, energy through plate:

| | shipped | + light plating | + heavy plating (every 2 from 5, floor 10%) |
|---|---|---|---|
| Standard, plain Bolts | 100% | 58% | 46% |
| Grim, plain Bolts | 91% | 13% | 6% |

At heavy plating a Bolt does 1 damage a hit by wave 17 — an eighth of itself —
and 226 of them still win Standard half the time. **The count is the problem,
and the count is a price**: a plain Bolt was 0.57 damage-per-second per Scrap,
a Railbore 0.20, a Tesla 0.13, a Missile Rack 0.12. No rule about hits fixes a
chassis that is three to five times the value of anything else.

**2. The chassis is the expensive part.** Every tower ×3, every tier ×0.6, the
purse 100 → 200 (three guns at the start, as before):

| | shipped | prices alone | prices + light plating |
|---|---|---|---|
| Standard, plain Bolts | 100% | 46% | **6%** |
| Grim, plain Bolts | 91% | 19% | **1%** |
| Calm, know-nothing holds wave 5 | 100% | 100% | 100% |

A fully bought Railbore costs 180 where it cost 220 (60 + 15 + 35 + 70): a
bare tower tripled and a finished one got a little cheaper — the *upgraded*
game barely moves, which is why no damage number had to change.

**3. The lab was playing the mixed line badly.** At this point Railbores-only
won 100% and the mixed reference 76%, which looked like a new dominant line.
It was the ORDER: the lab laid all six chassis before the first upgrade — the
mistake an expensive chassis punishes — while the Railbore plan bought one
tower, finished it, and bought the next. Played depth first, the mixed line
wins what Railbores win, and with wide resistances it beats them on Grim
(94% against 71%): **mixing types finally pays.**

**4. Railbore stops ignoring armour; resistances widen.** A Railbore is 30 a
hit against plating of 1–5: the big hit is already the answer, and "ignores
armour" on top of it made the one tower the answer to everything. Resists
×0.6–0.8 → ×0.4–0.7, weak ×1.2–1.6 → ×1.4–2.

**5. Then, and only then, the curves.** With spam gone every build that
upgraded won both Threats outright at the shipped rates:

| growth a wave (Standard : Grim) | Standard: mixed / Railbores / spam | Grim: base / + commons / tree |
|---|---|---|
| 1.07 : 1.09 *(were shipped)* | 99% / 100% / 5% | 94% / 100% / 100% |
| 1.09 : 1.12 | 99% / 100% / 5% | 65% / 89% / 100% |
| 1.11 : 1.15 | 98% / 93% / 4% | 25% / 41% / 100% |
| **1.12 : 1.17** *(shipped)* | **93% / 84% / 3%** | **11% / 18% / 99%** |
| 1.13 : 1.18 | 83% / 71% / 3% | 13% / 14% / 99% |

**Yesterday no growth rate could open Grim's gap** — the tree was worth 33
points at every rate and L5 wanted 40. Today ×1.17 opens eighty. Nothing about
the tree changed: what changed is that the base world can no longer go as
wide as it likes.

## What shipped

- `COMBAT_RULES = { armorFloor: 0.15, armorBlunts: 'kinetic', plating: { from: 6, every: 3, add: 1 } }`
  (engine; a run may override them, and only the lab does).
- `STARTING_SCRAP = 200` — one number; nine lab files had typed `100`.
- All fifty-six tower prices by one rule (`tools/reprice-towers.mjs 3 0.6`).
- Railbore and Bunker Buster lose `ignoreArmor`; ten bodies' resistances widen.
- Standard ×1.12, Grim ×1.17.
- **The game says so**: the next-wave panel reads *"PLATED +2: every kinetic hit
  loses 2 more - hit big, or use energy"*, the strip *"NEXT 10 BOSS PLATED +2"*,
  the codex and the catalogue state the armour rule **from the engine's
  source**, the tutorial's upgrade step says why to upgrade. Both new lines
  were cut off mid-sentence the first time they were looked at in the running
  game, and were fixed there; a test now holds every trait answer to two lines.
- The balance bands all moved, each with its reason
  (`packages/harness/balance/targets.json`); two are new and are this
  document's point: *plain Bolts lose Standard*, *plain Bolts lose Grim*.
- The golden replay hash did **not** move (its world wears no armour and buys
  nothing from the roster).

## Not done, said plainly

- **Energy was never read, and has no armour** (D38, #370 — Daniil's, the same
  evening). Every table here has a plain-Bolt rung and no Tesla, Laser or
  Frost-shard one. This model gave kinetic a flat per-hit counter and sent
  energy through it untouched; energy's only counter is a multiplier on four
  kinds, which does not single out a swarm of small hits. "Energy goes through
  armour" is half a rule until something stops energy the way plate stops a
  Bolt. First PR of the next session, rungs before fix.
- **S5** — no relic set carries a Bolt-only build. Next PR.
- **S4's second half** — the tree's towers are not shown to carry Grim; its
  relics do. Tesla (16%) and Missile (9%) lines are weak under the new model
  and want their own reading.
- **Calm** is still won by placement alone (99%). Left: Calm is where
  placement is learned, plating starts at its wave 6 of 15, and the early game
  was the thing not to disturb. It is a judgement, and his.
- **The human offset.** 93% is the lab's player. It was fitted high because a
  person buys later and places worse; by how much, nobody has measured.
- One or two seeds in eighty are refused by the lab for the spam plan (the run
  throws while placing); they are left out of the rate, and not yet explained.
