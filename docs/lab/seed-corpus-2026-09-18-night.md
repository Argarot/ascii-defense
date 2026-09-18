# The seed corpus on the new game — raw read, 2026-09-18 (night)

`node tools/seed-corpus.mjs 500` · bundle built at `5811f16` plus the wrap's
documents (no lab, engine or content file differs) · the players are the
lab's one table (`mixedDeep`, `mixedDeepNoVein`, `rails`, `naive1`), depth
first, on the app's own maps · it replaces
[seed-corpus-2026-09-18.md](seed-corpus-2026-09-18.md), which was read before
D37 with plain-Bolt width as its last resort — the 3% line now.

**This is the read, not the analysis** — it finished as the night's wrap was
being written, and the analysis is PR 2 of the next session's plan. What it
says at a glance, so nobody has to re-derive it:

- **Calm: no unwinnable seed** (499 of 500 won by the first plan, the last by
  the second). **Three seeds break L1** — one plain Bolt is dead by wave 5 —
  768156, 2787501, 3642753; the morning's corpus listed two.
- **Standard: 9 seeds of 500 (1.8%) are lost by all three plans**, where the
  morning's corpus found none. Every one dies at wave 12–20, most at 17–20:
  near-wins, not broken maps — and the morning's "none" was Bolt width
  winning whatever the careful plans lost, which D37 ended on purpose. Whether
  1.8% is a defect depends on a target nobody has stated for the new game
  (L6 said "none unwinnable" of a game with a dominant line in it). **State
  it before reading this again.** 150474 is on the list: session 38 knew it.
- **Grim's table is not a finding**: the base world is MEANT to lose Grim
  (S4), so "unwinnable for all three" reads 97.8% by design. **On Grim the
  corpus must play the tree** (`treeBaseDeep`) as the intended build — the
  tool does not do that yet.
- One Grim seed is refused by the carve (#367).

---

# the seed corpus - 500 seeds per Threat, the app's own maps (7x5), the base world, no relics held, 200 Scrap

A run is played to the Threat's final wave. Three plans from the one table of the lab (plans.ts), each tried only where the one before lost: the mixed line bought DEPTH FIRST and going on (`mixedDeep`); the same line with no Refinery (`mixedDeepNoVein`); nothing but Railbores, each finished before the next (`rails`). **Unwinnable** = none of the three holds it. **Trivial** = one plain Bolt by the entry, then nothing, holds it.

## Calm - won by holding wave 15

| | seeds | share |
|---|---|---|
| dealt (the carve refused 0) | 500 | |
| the mixed line, depth first and going on, WINS | 499 | 99.8% |
| ...it loses, and the same line with NO Refinery wins | 1 | 0.2% |
| ...both lose, and Railbores alone win (a HARD OPENING, not a bad seed) | 0 | 0.0% |
| **UNWINNABLE for all three** | **0** | 0.0% |
| **TRIVIAL**: one plain Bolt, then nothing, wins | **0** | 0.0% |
| **L1 broken**: one plain Bolt, then nothing, is dead by wave 5 | **3** | 0.6% |

| entries the map drew | maps | the mixed line loses | both careful plans lose | trivial |
|---|---|---|---|---|
| 2 | 237 | 0.0% | 0.0% | 0.0% |
| 3 | 263 | 0.4% | 0.0% | 0.0% |

### Calm: a know-nothing is dead by wave 5 (L1)

| seed | entries | path floor (cells) | carve attempts | mixed line dies | no Refinery dies | Railbores die | one plain Bolt dies |
|---|---|---|---|---|---|---|---|
| 768156 | 3 | 145 | 1 | wins | - | - | 5 |
| 2787501 | 3 | 100 | 2 | wins | - | - | 5 |
| 3642753 | 3 | 85 | 1 | wins | - | - | 5 |

## Standard - won by holding wave 20

| | seeds | share |
|---|---|---|
| dealt (the carve refused 0) | 500 | |
| the mixed line, depth first and going on, WINS | 475 | 95.0% |
| ...it loses, and the same line with NO Refinery wins | 16 | 3.2% |
| ...both lose, and Railbores alone win (a HARD OPENING, not a bad seed) | 0 | 0.0% |
| **UNWINNABLE for all three** | **9** | 1.8% |
| **TRIVIAL**: one plain Bolt, then nothing, wins | **0** | 0.0% |

| entries the map drew | maps | the mixed line loses | both careful plans lose | trivial |
|---|---|---|---|---|
| 2 | 118 | 1.7% | 0.8% | 0.0% |
| 3 | 122 | 4.9% | 2.5% | 0.0% |
| 4 | 119 | 5.9% | 0.0% | 0.0% |
| 5 | 141 | 7.1% | 3.5% | 0.0% |

### Standard: unwinnable seeds

| seed | entries | path floor (cells) | carve attempts | mixed line dies | no Refinery dies | Railbores die | one plain Bolt dies |
|---|---|---|---|---|---|---|---|
| 150474 | 5 | 55 | 1 | 13 | 18 | 17 | 6 |
| 490991 | 5 | 120 | 1 | 17 | 17 | 17 | 5 |
| 1108673 | 5 | 95 | 1 | 12 | 17 | 17 | 4 |
| 1678841 | 3 | 100 | 1 | 19 | 19 | 19 | 6 |
| 1734274 | 3 | 125 | 1 | 18 | 19 | 19 | 5 |
| 1765950 | 5 | 90 | 1 | 17 | 17 | 17 | 5 |
| 2534093 | 5 | 90 | 1 | 17 | 18 | 17 | 5 |
| 2787501 | 3 | 80 | 1 | 20 | 20 | 19 | 6 |
| 3460616 | 2 | 55 | 1 | 20 | 20 | 19 | 6 |

## Grim - won by holding wave 25

| | seeds | share |
|---|---|---|
| dealt (the carve refused 1) | 499 | |
| the mixed line, depth first and going on, WINS | 8 | 1.6% |
| ...it loses, and the same line with NO Refinery wins | 3 | 0.6% |
| ...both lose, and Railbores alone win (a HARD OPENING, not a bad seed) | 0 | 0.0% |
| **UNWINNABLE for all three** | **488** | 97.8% |
| **TRIVIAL**: one plain Bolt, then nothing, wins | **0** | 0.0% |

| entries the map drew | maps | the mixed line loses | both careful plans lose | trivial |
|---|---|---|---|---|
| 3 | 118 | 97.5% | 96.6% | 0.0% |
| 4 | 122 | 98.4% | 97.5% | 0.0% |
| 5 | 119 | 97.5% | 96.6% | 0.0% |
| 6 | 140 | 100.0% | 100.0% | 0.0% |

### Grim: unwinnable seeds

| seed | entries | path floor (cells) | carve attempts | mixed line dies | no Refinery dies | Railbores die | one plain Bolt dies |
|---|---|---|---|---|---|---|---|
| 7932 | 4 | 110 | 1 | 22 | 25 | 15 | 6 |
| 15851 | 5 | 95 | 1 | 23 | 25 | 23 | 6 |
| 23770 | 4 | 65 | 1 | 14 | 19 | 17 | 6 |
| 31689 | 4 | 85 | 1 | 22 | 22 | 23 | 6 |
| 39608 | 3 | 95 | 1 | 14 | 20 | 19 | 6 |
| 47527 | 6 | 70 | 1 | 20 | 22 | 19 | 6 |
| 55446 | 4 | 85 | 2 | 19 | 19 | 18 | 5 |
| 63365 | 4 | 110 | 1 | 17 | 18 | 18 | 6 |
| 71284 | 5 | 105 | 1 | 14 | 15 | 14 | 5 |
| 79203 | 3 | 85 | 1 | 21 | 22 | 20 | 7 |
| 87122 | 6 | 90 | 1 | 14 | 14 | 13 | 6 |
| 95041 | 6 | 95 | 1 | 19 | 19 | 18 | 5 |
| 102960 | 3 | 115 | 2 | 16 | 18 | 15 | 7 |
| 110879 | 4 | 105 | 1 | 25 | 25 | 25 | 6 |
| 118798 | 5 | 80 | 1 | 24 | 24 | 13 | 7 |
| 126717 | 3 | 95 | 1 | 20 | 22 | 21 | 6 |
| 134636 | 6 | 50 | 1 | 25 | 25 | 21 | 5 |
| 142555 | 4 | 70 | 1 | 20 | 20 | 14 | 7 |
| 150474 | 6 | 40 | 1 | 17 | 20 | 18 | 5 |
| 158393 | 6 | 70 | 1 | 14 | 15 | 13 | 5 |
| 166312 | 4 | 80 | 1 | 15 | 19 | 18 | 5 |
| 174231 | 4 | 110 | 1 | 18 | 18 | 13 | 5 |
| 182150 | 4 | 50 | 1 | 21 | 21 | 21 | 5 |
| 190069 | 5 | 80 | 1 | 16 | 16 | 16 | 7 |
| 197988 | 5 | 115 | 1 | 20 | 23 | 14 | 6 |
| 205907 | 4 | 95 | 1 | 16 | 17 | 16 | 6 |
| 213826 | 3 | 75 | 1 | 23 | 22 | 21 | 5 |
| 221745 | 6 | 75 | 1 | 18 | 18 | 17 | 5 |
| 229664 | 3 | 85 | 1 | 23 | 23 | 21 | 7 |
| 237583 | 5 | 100 | 1 | 14 | 18 | 18 | 6 |
| 245502 | 6 | 105 | 1 | 20 | 21 | refused | 5 |
| 253421 | 3 | 90 | 1 | 17 | 16 | 16 | 6 |
| 261340 | 5 | 95 | 1 | 14 | 14 | 14 | 4 |
| 269259 | 6 | 35 | 1 | 18 | 19 | 14 | 5 |
| 277178 | 4 | 100 | 1 | 15 | 17 | 17 | 6 |
| 285097 | 3 | 65 | 1 | 15 | 19 | 15 | 7 |
| 293016 | 5 | 105 | 1 | 14 | 14 | 14 | 5 |
| 300935 | 3 | 55 | 1 | 19 | 19 | 19 | 6 |
| 308854 | 5 | 100 | 1 | 14 | 18 | 17 | 5 |
| 324692 | 5 | 85 | 1 | 19 | 21 | 18 | 5 |

...and 448 more.

