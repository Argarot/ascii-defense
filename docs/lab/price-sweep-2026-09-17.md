# Price sweep — one pricing function (2026-09-17; PRD §27, D31)

`node tools/price-sweep.mjs` — not a simulation: a reading of `priceTile()`
against the targets below. The Smith's MINT and the workshop's shop both
charge this function's sum; **no tile price is written in the content file
any more** (`tiles.schema.json` lost its `price` property, and the seven
authored prices with it).

## The targets, stated before fitting

| # | target | source |
|---|---|---|
| P1 | **Flat for plain authoring.** A plain straight road costs no more than the cheapest tile the shop ever sold (25), and each of the five shipped road specials lands within **5 Ore** of its hand-set price | §27: "a generic straight road … costs no more than a shipped tile of similar quality"; the shipped prices are the anchor |
| P2 | **One modest feature is a one-run purchase** — a vein, a weak boon: about a run of income (≈50 tier-1 Ore) or less | §27: "pay a little for a shape you need" |
| P3 | **Steep: the k-th feature costs more than the (k−1)-th**, for every k | §27: the *shape* is the requirement. A kill-zone of boons is worth far more than its sum, because towers concentrate where the ground is good |
| P4 | **Prohibitive at the ceiling**: a tile of all high-tier veins and the strongest boon ground costs more than **a hundred runs** | §27: "exorbitant, prohibitive … the intended ceiling, not a bug to tune away" |
| P5 | **A boon is priced by its power, not its tier number** | §27: "each boon-ground cell by power". Tier 4 is five times tier 1's effect (+50% vs +10%) and must cost far more than five times as much, or it is the only boon anyone mints |
| P6 | **A rare vein costs its own tier's Ore on top**, and the smallest one is within reach of a single lucky find | §26, D30 |
| P7 | **Nothing on a tile is free.** | found while writing it: an ore cell painted *without* an authored vein is dealt 30–90 by the dice and cost nothing at all |

## The function

```
lower purse  = 20                                  a tile
             + 0.9  × road cells                   path length is what a road tile is for
             + 1    × rock cells                   a prospecting roll each
             + (vein Ore / 6)            × crowd   an unauthored ore cell counts as 60
             + Σ boons  power^1.5 / 3    × crowd   power = 10 / 20 / 35 / 50  →  11 / 30 / 69 / 118
own tier     = (tier-N vein Ore / 3)     × crowd   for N = 2, 3 — on top
crowd        = 1 + 0.15 × (features − 1)           features = veins + boons
```

"Lower purse" is the tier below the tile's richest vein (tier 1 otherwise) —
the session-29 rule that a tier-N vein is bought with tier-(N−1) Ore, kept.
`base + road` is the least-squares line through the five shipped road prices
(20.7 + 0.83 × road), rounded to numbers a player can recompute.

## 1. The anchors — the seven tiles the shop sold

| tile | road cells | was | is | moved |
|---|---|---|---|---|
| twin_bend | 10 | 25 | 29 | +4 |
| gen_ns_2 | 13 | 30 | 32 | +2 |
| gen_ns_3 | 7 | 25 | 26 | +1 |
| gen_ne_1 | 7 | 30 | 26 | −4 |
| gen_ne_4 | 13 | 35 | 32 | −3 |
| rich_vein | 0 | 60 | 47 + **46 tier-2** | −13, +46 t2 |
| mother_lode | 0 | 50 tier-2 | 41 tier-2 + **30 tier-3** | −9 t2, +30 t3 |

- **P1 holds**: the road tiles move by at most 4. The hand-set prices were
  not a function of anything (two 7-cell tiles cost 25 and 30); they are now.
- **The two vein tiles are the real change, and it is D30's, not a fitting
  accident.** "A minted tile and a bought tile of the same contents cost the
  same", and a minted tier-2 vein costs tier-2 Ore — so the shop's vein tile
  does too. Before, tier-1 Ore alone bought permanent tier-2 income; now the
  first tier-2 Ore has to come out of the ground. What that does to the
  ladder's timeline is in §4.

## 2. The dial — what a player pays for what

"Runs of income" divides each purse by what a run banks into it — 50 tier-1;
27 tier-2 on the one map in three that has a vein; 20 tier-3 on one in nine
(docs/lab/ore-sweep-2026-09-17.md) — and reports the slowest purse.

| the tile | price | runs |
|---|---|---|
| a plain straight road | 25 | 0.5 |
| the twin bend (10 road cells) | 29 | 0.6 |
| a straight + one ordinary vein (dealt by the dice) | 35 | 0.7 |
| a straight + one rich tier-1 vein (90) | 40 | 0.8 |
| a straight + one small tier-2 vein (30) | 30 + 10 tier-2 | 1.1 |
| a straight + one tier-1 boon (+10%) | 35 | 0.7 |
| a straight + one tier-2 boon (+20%) | 54 | 1.1 |
| a straight + one tier-3 boon (+35%) | 94 | 1.9 |
| a straight + one tier-4 boon (+50%) | 142 | 2.8 |
| a straight + three tier-4 boons | 484 | 9.7 |
| a straight + six tier-4 boons (a kill-zone) | 1,262 | 25 |
| a straight + ten tier-4 boons | 2,794 | 56 |
| four tier-3 veins (90) and nothing else | 107 tier-2 + 174 tier-3 | 78 |
| **the ceiling**: nine tier-3 veins ringed by sixteen tier-4 boons | 9,315 tier-2 + 1,242 tier-3 | **1,035** |

- **P2 holds**: every single modest feature is about a run or less; the
  smallest tier-2 vein (10 tier-2 Ore) is less than half of one lucky find
  (**P6**).
- **P4 holds with room**: the ceiling is a thousand runs. It is meant to be
  a number nobody pays, and it is.
- **P5**: +50% costs **eleven** times what +10% costs, for five times the
  effect. One strong boon is a three-run project; that is the "tile that
  changes a run", priced as one.

## 3. The shape — what the k-th tier-4 boon adds

| k | price with k | the k-th adds |
|---|---|---|
| 1 | 138 | +118 |
| 2 | 291 | +153 |
| 3 | 480 | +189 |
| 4 | 704 | +224 |
| 5 | 963 | +259 |
| 6 | 1,257 | +294 |
| 7 | 1,587 | +330 |
| 8 | 1,953 | +366 |

**P3 holds**: every step is larger than the last (+35 a step at tier 4).
Crowding is the whole mechanism — 15% on *every* feature for each feature
after the first — so the curve is quadratic in the count: gentle at two,
ruinous at ten. It is tested as a property (`tree.test.ts`), not as numbers.

## 4. What this does to the ore ladder's timeline

The ore sweep (written one PR earlier, when `rich_vein` still cost 60 tier-1
Ore) said a loaded vein tile clears the tier-2 tree in about five runs. The
tile now has to be afforded in tier-2 Ore first:

| road to the tier-2 tree (135) | runs |
|---|---|
| the map's luck alone (7.3 tier-2 a run) | ~18 |
| luck until `rich_vein` is affordable (46 tier-2 → ~6 runs), then loaded (27 a run → 5 runs) | **~11** |

Investing is still the fast road (11 against 18) and now it *starts* with a
find, which is D30's sentence exactly: "you must mine some before you can
author with it". Tier 3 is slower again — about fourteen luck runs to the
30 tier-3 Ore `mother_lode` costs, then two loaded runs for the 60 Ore of
tier-3 nodes — sixteen against twenty-seven by luck alone. Each rung longer
than the last; none a wall. **If Daniil's runs say tier 3 drags, the knob is
`ORE_TIER_SPAWN[2]`, not this function.**

## The authoring surface grew with the model

- **The Smith can now author a boon's tier** (B1–B4 in OVERLAYS). Until this
  PR it could paint only tier-1 boons, while the price function already
  charged by tier and §27 is written around "the strongest boon ground" — a
  model its own editor could not produce, hidden because no shipped tile
  carries a boon.
- **The Smith itemises its price**: every line `priceLines()` charged is on
  the page with its purse, including the crowding multiplier. That is what
  makes it a dial: the player sees what a feature costs *before* paying.
- The shop's line shows the whole price, both purses, always — "needs" only
  ever named the first purse that was short.
