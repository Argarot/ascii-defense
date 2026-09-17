# The economy — what it is, what it measures as, and how to balance it (2026-09-17)

`node tools/scrap-flow.mjs 80 [--threat=0|1|2] [--tree]` · the app's 7×5 board ·
80 seeds per Threat · generator v4, the curve in `engine/src/sim/threat.ts`.

Daniil asked for research on the in-game economy and how to balance it. This
is that: the model as built, three things other people have written that
apply to it, a measurement nobody had taken (the **purse**, not the death
wave), and what follows — each item tagged **defect**, **scope** or **call**.

**The short version.** The economy is sounder than it looks and the lab is
less sound than it looked. Every balance table this project has measures a
player who **stops spending at wave 12** and dies on a pile of Scrap. Give
the same player five more towers and Grim — which the balance doc of this
same day says the base world wins 5% of the time — is won **79%** of the
time, with nothing from the tree. The ladder's top rung is compressed, and
the instrument hid it.

## 1. The model, as built

Two currencies, on purpose (PRD §4): **Scrap** lives and dies inside a run;
**Ore** is what a run leaves behind.

### Scrap

| | what | shape |
|---|---|---|
| source | the starting purse, 100 | capped |
| source | **bounties** — 1 to 30 a body, flat at every wave; a boss pays ×5 | grind; grows with the wave's *bodies and kinds*, not its health |
| source | a Refinery's Scrap share; calling a wave early (1 a second left on the clock); void chests; relics (War Chest, Toll, Tithe, Scrap Rain) | trickle / random |
| sink | a tower: 20–110 | fixed, flat — the tenth Bolt costs what the first did |
| sink | its three tiers: 25–90, 55–180, 120–320 | fixed, flat |
| sink | prospecting a rock cell, 25 | fixed |
| refund | selling returns 70% | — |

The wave curve is where the shape comes from. Bodies grow by five a wave and
**cap at 60 from wave 12**; health grows ×1.07 a wave on Standard (×1.09 on
Grim) on top of a linear term — by wave 20 a body has **13.9×** its wave-1
health and pays the same bounty. So Scrap *per point of enemy health* falls
every wave, and no price ever rises. The run is a race between a purse that
grows linearly and then flattens, and a health curve that does not.

### Ore

| | what | shape |
|---|---|---|
| source | a Refinery on a vein — about **51 tier-1 Ore a run** with one Refinery, or **27 tier-2** on the map in three that carries a blue vein (docs/lab/ore-sweep-2026-09-17.md) | grind, capped by the vein |
| source | the Ore Pocket relic; a retired node's refund | random / one-off |
| sink | the workshop tree: **330 tier-1, 155 tier-2, 60 tier-3** across 17 nodes | fixed — it ends |
| sink | the tile shop: five road tiles (145 tier-1) and two vein tiles | fixed — it ends |
| sink | a second copy of a tile, ×(1 + 0.5 × copies) in every purse | repeatable, rising |
| sink | the Tile Smith, priced by contents, steep in boons (docs/lab/price-sweep-2026-09-17.md) | repeatable, steep — the long tail |

Arithmetic on tonight's numbers, not a new sweep: the tier-1 tree and shop
together are about 520 Ore, **ten or eleven runs** of one-Refinery income.
After that, tier-1 Ore has exactly two places to go — copies and the Smith.

## 2. What other people have written, and what it says about this game

Three sources, each opened and read tonight; a fourth (a Medium piece on
tower-defense balance) returned 403 and is not cited.

**Daniel Cook, "Value chains"** — https://lostgarden.com/2021/12/12/value-chains/
Sources and sinks have *shapes* (capped, trickle, grind; fixed, repeatable,
exponential), and a currency is healthy when the power of its sinks matches
the power of its sources. A growing source into fixed sinks ends as a **dead
currency**: a number that climbs with nothing to mean.
→ Scrap is a growing source into fixed, flat sinks. By Cook's reading it
should die — and §3 shows that inside a run it mostly does not, because the
run ends first. Ore is the one to watch: both its big sinks *end*, and the
Smith is the only thing standing between a finished tree and a dead purse.
That is a reason the Smith's steepness (D31) matters more than it looked.

**Ernest Adams, "Machinations"** —
https://www.gamedeveloper.com/design/the-designer-s-notebook-machinations-a-new-way-to-design-game-mechanics
Draw the economy as sources, drains and converters, and look for the loops.
A positive loop (resource buys the thing that earns the resource) snowballs
unless something drains it.
→ This game's loop is *kills → Scrap → towers → kills*, and its drain is the
health curve. There is no second positive loop on Scrap worth the name: the
Refinery's Scrap share is small and a vein runs out. That is healthy. The
one place a snowball can form is **Ore → a vein tile → more Ore a run**, and
D31 priced that door in the tier it opens — the right instinct, per this.

**The Slay the Spire metrics talk, as written up by Game Developer** —
https://www.gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder
Balance from what players pick and what is present in wins, not from theory;
the metric can mislead; and a single-player game can afford combinations
that are too strong, because finding one is the fun.
→ Two things. The lab is this project's metrics, and §3 is a case of the
metric misleading — not because the numbers were wrong but because the
*player they describe does not exist*. And "too strong is allowed" is an
argument against sanding down every dominant build the sweeps find (the
Railbore line has been one since session 31); what is not allowed is a rung
of the ladder that sells nothing, which is what §4 finds.

## 3. The measurement — the purse, not the death wave

Three plans in the base world, no tree, no chosen relics. Towers are bought
first and upgrades after, the next thing the moment it is affordable.

- **the reference** — a Refinery and five towers, fully upgraded: list price
  1,395. *The build every balance table uses.* A plan that **ends**.
- **keeps building** — the reference, then a Frost and four more Railbores:
  eleven towers, 2,500.
- **never stops** — the reference, then twenty-four more Railbores anywhere
  they fit: thirty towers, 6,675.

### What a run earns (Standard; the same within 3% on Grim)

| by wave | 5 | 10 | 15 | 20 | 25 |
|---|---|---|---|---|---|
| Scrap earned, cumulative | 225 | 1,090 | 2,960 | 5,070 | 7,370 |
| … a wave, over the five before | 45 | 173 | 374 | 422 | 460 |

Income grows **ninefold** between the first five waves and the fourth five,
then flattens where the body count caps. Calm earns about two thirds of it
(765 by wave 10, 3,940 by wave 20).

### What is left in hand

| Standard | after wave 5 | 10 | 15 | 20 | death wave, mean | wins |
|---|---|---|---|---|---|---|
| the reference (ends) | 21 | 101 | **1,691** | **3,802** | 24.7 | 93% |
| keeps building | 12 | 47 | 735 | 2,827 | 32.6 | 93% |
| never stops | 9 | 18 | 42 | 361 | 36.0 | 85% |

| Grim | after wave 5 | 10 | 15 | 20 | death wave, mean | **wins (25)** |
|---|---|---|---|---|---|---|
| the reference (ends) | 22 | 106 | 1,674 | 3,751 | 21.1 | **9%** |
| keeps building | 14 | 40 | 736 | 2,810 | 27.5 | **79%** |
| never stops | 10 | 20 | 59 | 447 | 29.2 | 65% |
| *the tree:* the Laser line (ends) | 54 | 81 | 571 | 2,573 | 26.2 | 64% |
| *the tree:* the Laser line, then two Lasers and four Railbores | 56 | 42 | 166 | 897 | 32.7 | **86%** |

Calm: every plan holds the 40 waves the lab runs on all but a seed or two
(mean death 40.7–41.0); the purse is the only thing that differs.

### What it says

1. **Scrap is scarce for ten waves and then it is not.** Through wave 10
   every plan holds under 110 Scrap — each purchase is a choice. From wave
   12 a wave pays 370–460, and the dearest upgrade in the base world costs
   140. After that the question is never *whether* to buy, only *where*.
2. **Scrap does not die inside a run — for a player who keeps building.**
   The board takes thirty towers and about 6,700 Scrap of them; a Standard
   run earns 5,070 by its final wave. The sink outlasts the run. Cook's dead
   currency arrives only past wave 22 on a full board, which is Endless's
   problem and not the campaign's.
3. **The reference build is a player who stops at wave 12.** It is fully
   bought there, and sits on 1,691 Scrap at wave 15 and 3,802 at wave 20 —
   more than twice its own price, unspent, while it dies. **Every balance
   table in this folder uses it.** The death waves are true; what they
   describe is not a player.
4. **L5 is not met, and the balance doc of the same day says it is.**
   "Grim is lost by the base world and won by the tree" was read off plans
   that end: 5% against 61%. With plans that go on it is **79% against
   86%**. Eleven forked base-world towers are worth as much as the Laser
   line; the tree buys seven points on the rung it exists to open.
   docs/lab/balance-debt-2026-09-17.md is amended to say so.
5. **Wide-first is a real mistake, and the game punishes it correctly.**
   "Never stops" places thirty plain Railbores before its first upgrade: it
   loses more seeds by wave 15 than either other plan (70 of 80 alive on
   Standard, against 74) and wins fewer — then outlasts both. Depth before
   width is a lesson the curve teaches without being told to. Nothing to fix.
6. **The lower rungs are probably sound, and unproven.** L1–L3 read naive
   plans that end *on purpose* (a first-time player does stop). L4's lower
   half — "eight forked Bolts win Standard 2%" — is a plan that ends, and
   has the same flaw as L5 in a milder form.

Caveats, so the numbers are not over-read: the lab auto-accepts the first
relic of every offer (the same in every plan, so differences stand; the
absolute win rates carry a relic layer); a Refinery goes down first on every
map, which the tail probe already showed is wrong on five-entry maps; and
"alive at wave N" thins the late columns — the count is printed by the tool.

## 4. What follows

| # | finding | bucket | what to do |
|---|---|---|---|
| E1 (#348) | The lab's reference plan ends at wave 12 | **defect** (instrument) | Give `TowerPlacement` plans a tail — "then keep buying X" — and make the spending plan the reference. Every ladder table is re-read with it |
| E2 (#349) | L5 is not met: the base world wins Grim 79% | **defect** (balance; rule 7 — a number the lab derives, not a call) | Re-fit Grim's curve against spending plans: target base world ≤ 20%, tree ≥ 60%. **After the RNG fix (#339), not before** — that fix re-deals every seed and would make this fit be done twice |
| E3 | What the tree sells is thin at the top | **scope** | If re-fitting Grim cannot open a gap — if eleven Railbores simply *are* as good as three Lasers — the lever is the arsenal, not the curve: the tree's towers need to out-scale the base world's per cell, since cells are the one thing a spending player runs out of |
| E4 | Flat prices: the thirtieth Bolt costs 20 | **scope**, recorded not proposed | The genre's usual answer is a rising price per copy. It is *not* recommended here: finding 5 shows depth-before-width already emerges, and the board's cells already cap width. Written down so the next person does not rediscover it as an idea |
| E5 | Tier-1 Ore's fixed sinks end after about eleven runs | **scope**, watch | The Smith is the whole long tail. Worth a purse reading once real saves exist: if finished-tree players sit on hundreds of tier-1 Ore, the Smith is not pulling |
| E6 | Endless has a dead currency past a full board | **scope**, for the session that builds Endless | A repeatable sink belongs there (Cook's "exponential sink"): an overcharge, a re-roll, anything priced to rise |

**Nothing here is a call.** E2 has a target and a lever; E3 is a design
direction that only matters if E2's fit fails, and is asked then, with the
fit's evidence.

**Why Grim was not re-fitted tonight.** The instrument was found at the end
of the session, the RNG defect (#339) re-deals every map when it is fixed,
and a curve fitted on tonight's seeds would be fitted again next week. The
honest deliverable is the finding, the tool that reads it, and the
correction to the document that said otherwise.

## The instrument

- `WaveRow.scrapEnd`, `.spentEnd`, `.towersEnd` in `lab.ts` — the purse, what
  the plan has paid, and the towers standing, at the end of every wave.
- `tools/scrap-flow.mjs [corpus] [--threat=N] [--tree]` →
  `packages/harness/src/lab/scrapFlow.ts`: the in-hand table, the earned
  table with its alive-count, the win rate per plan.
