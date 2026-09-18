# The seed corpus — 1,500 seeds, no unwinnable one (2026-09-18)

`node tools/seed-corpus.mjs 500` · 500 seeds a Threat · **the app's own
maps** (a seed listed here is a seed a player can type in) · the base world,
no relics, 100 Scrap · under two minutes on fourteen cores.

Target L6 (docs/lab/ladder-2026-09-18.md): *no seed is unwinnable for the
build its Threat is meant for.* WBS 3.4 asked for it across at least five
hundred runs. Also read: target L1 on Calm, and the trivial seeds.

## What it found

| | Calm | Standard | Grim |
|---|---|---|---|
| the reference, going on buying its line, wins | 100% | 97.4% | 93.6% |
| …loses, and wins **without the Refinery first** | 0 | 11 seeds (2.2%) | 29 seeds (5.8%) |
| …both lose, and **plain Bolts at the choke win** | 0 | 2 seeds | 3 seeds |
| **unwinnable for all three** | **0** | **0** | **0** |
| trivial: one plain Bolt, then nothing, wins | 9 seeds (1.8%) | 0 | 0 |
| **L1 broken**: that know-nothing is dead by wave 5 | **2 seeds (0.4%)** | – | – |

1. **L6 holds: no unwinnable seed in 1,500.** Five looked it — dead at waves
   7–9 for both careful plans — and every one is won by plain Bolts at the
   choke. They are *hard openings*: two streams of lanes meet only at the
   Core's door, the first five towers split between them, an armoured pack
   arrives at wave 6 and the income starves. Listed below; worth a look by
   eye, not worth a generator rule. **Issue #340 closes on this**: its seed
   (316773, on the deal before D35) died at wave 6 on every plan in exactly
   this way, read through a placement rule that has since been fixed.
2. **The Refinery first is the lab's commonest mistake**, not the map's: 2.2%
   of Standard seeds and 5.8% of Grim's are lost by opening with a Refinery
   and won by opening with guns. It scales with the entry count (Grim's
   six-entry maps: 11% lost with the Refinery first). A player who looks at
   the map does not make it. The win rates above are floors for that reason.
3. **L1 misses by two seeds in five hundred.** Seeds 768156 and 2787501 kill
   a player who builds one Bolt by the first entry and nothing else *at*
   wave 5 — Calm's first boss wave — where every other seed lets them reach
   wave 6 or later. Both have three entries; the single Bolt guards one.
   **Not changed**: it is 0.4%, the stranger test's player builds more than
   one tower, and Calm's curve should not move while call #357 is open.
   The gate (tools/balance-check.mjs) holds the rate where it is.
4. **Nine Calm seeds are trivial** — one plain Bolt wins the whole run. All
   have two or three entries and long roads (path floor 85–150 cells). At
   1.8% that is variance, and a first run that is won by accident is a small
   sin; recorded, not fixed.

## What it cannot say

The lab's player buys the instant it can afford and places by arithmetic. A
seed "won by the reference" is won by *that* player; a person's win rate is
lower by an amount nobody has measured (WBS 3.3 needs Daniil's replays).
The five hard openings are the seeds to hand a person first.

## The instrument

- `packages/harness/src/lab/seedCorpus.ts` — one shard: three plans, each
  tried only where the one before lost, plus the know-nothing; one JSON line
  a seed with its map's knobs and the carve's attempt count.
- `tools/seed-corpus.mjs [seeds] [--threat=N] [--jobs=N]` — bundles once,
  runs the shards in parallel, writes the report below.
- It stands on `LabSpec.map: { threat }` (the app's map for a seed) and
  `LabSpec.tail` (a player who keeps buying), both new this session.

## The report, as written by the tool


## Calm - won by holding wave 15

| | seeds | share |
|---|---|---|
| dealt (the carve refused 0) | 500 | |
| the reference, going on, WINS | 500 | 100.0% |
| ...it loses, and the same line WITHOUT the Refinery first wins | 0 | 0.0% |
| ...both lose, and plain Bolts at the choke, never upgraded, win (a HARD OPENING, not a bad seed) | 0 | 0.0% |
| **UNWINNABLE for all three** | **0** | 0.0% |
| **TRIVIAL**: one plain Bolt, then nothing, wins | **9** | 1.8% |
| **L1 broken**: one plain Bolt, then nothing, is dead by wave 5 | **2** | 0.4% |

| entries the map drew | maps | the reference loses | both careful plans lose | trivial |
|---|---|---|---|---|
| 2 | 237 | 0.0% | 0.0% | 2.1% |
| 3 | 263 | 0.0% | 0.0% | 1.5% |

### Calm: a know-nothing is dead by wave 5 (L1)

| seed | entries | path floor (cells) | carve attempts | reference dies | guns first dies | Bolts wide dies | one plain Bolt dies |
|---|---|---|---|---|---|---|---|
| 768156 | 3 | 145 | 1 | wins | - | - | 5 |
| 2787501 | 3 | 100 | 2 | wins | - | - | 5 |

### Calm: trivial seeds

| seed | entries | path floor (cells) | carve attempts | reference dies | guns first dies | Bolts wide dies | one plain Bolt dies |
|---|---|---|---|---|---|---|---|
| 918617 | 2 | 150 | 1 | wins | - | - | wins |
| 1045321 | 2 | 115 | 1 | wins | - | - | wins |
| 1607570 | 3 | 125 | 1 | wins | - | - | wins |
| 1694679 | 3 | 125 | 1 | wins | - | - | wins |
| 1908492 | 3 | 85 | 1 | wins | - | - | wins |
| 2700392 | 2 | 145 | 1 | wins | - | - | wins |
| 3112180 | 2 | 125 | 1 | wins | - | - | wins |
| 3310155 | 2 | 120 | 1 | wins | - | - | wins |
| 3634834 | 3 | 100 | 1 | wins | - | - | wins |

## Standard - won by holding wave 20

| | seeds | share |
|---|---|---|
| dealt (the carve refused 0) | 500 | |
| the reference, going on, WINS | 487 | 97.4% |
| ...it loses, and the same line WITHOUT the Refinery first wins | 11 | 2.2% |
| ...both lose, and plain Bolts at the choke, never upgraded, win (a HARD OPENING, not a bad seed) | 2 | 0.4% |
| **UNWINNABLE for all three** | **0** | 0.0% |
| **TRIVIAL**: one plain Bolt, then nothing, wins | **0** | 0.0% |

| entries the map drew | maps | the reference loses | both careful plans lose | trivial |
|---|---|---|---|---|
| 2 | 118 | 0.8% | 0.0% | 0.0% |
| 3 | 122 | 1.6% | 0.0% | 0.0% |
| 4 | 119 | 2.5% | 0.8% | 0.0% |
| 5 | 141 | 5.0% | 0.7% | 0.0% |

### Standard: hard openings - both careful plans lose, Bolts wide wins

| seed | entries | path floor (cells) | carve attempts | reference dies | guns first dies | Bolts wide dies | one plain Bolt dies |
|---|---|---|---|---|---|---|---|
| 498910 | 4 | 85 | 1 | 7 | 8 | wins | 5 |
| 578100 | 5 | 120 | 1 | 9 | 9 | wins | 5 |

## Grim - won by holding wave 25

| | seeds | share |
|---|---|---|
| dealt (the carve refused 0) | 500 | |
| the reference, going on, WINS | 468 | 93.6% |
| ...it loses, and the same line WITHOUT the Refinery first wins | 29 | 5.8% |
| ...both lose, and plain Bolts at the choke, never upgraded, win (a HARD OPENING, not a bad seed) | 3 | 0.6% |
| **UNWINNABLE for all three** | **0** | 0.0% |
| **TRIVIAL**: one plain Bolt, then nothing, wins | **0** | 0.0% |

| entries the map drew | maps | the reference loses | both careful plans lose | trivial |
|---|---|---|---|---|
| 3 | 118 | 5.1% | 0.0% | 0.0% |
| 4 | 122 | 4.1% | 0.8% | 0.0% |
| 5 | 119 | 4.2% | 0.0% | 0.0% |
| 6 | 141 | 11.3% | 1.4% | 0.0% |

### Grim: hard openings - both careful plans lose, Bolts wide wins

| seed | entries | path floor (cells) | carve attempts | reference dies | guns first dies | Bolts wide dies | one plain Bolt dies |
|---|---|---|---|---|---|---|---|
| 1203701 | 4 | 105 | 1 | 8 | 8 | wins | 5 |
| 3793214 | 6 | 110 | 1 | 8 | 8 | wins | 5 |
| 3872404 | 6 | 70 | 1 | 7 | 7 | wins | 5 |

