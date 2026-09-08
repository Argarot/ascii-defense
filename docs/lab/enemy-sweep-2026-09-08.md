# Enemies II — the balance pass and the enemy sweep (2026-09-08, session 32, PRs 4-5)

`node tools/build-sweep.mjs --enemies` · `--base` · `--tree` · board 7×5 ·
horizon 40 · the roster of fourteen bodies and the composer's packs
(session 32, PRs 1-2).

**The target (HANDOVER, session 31's plan):** the reference build (Railbore
line + Frost + Mortar + Refinery, no relics) dies between 16 and 24 on
Standard with the new bodies; Calm's plain-Bolt-with-forks line still holds
fifteen; retune the matrix, not the bodies.

## What the composer change did to the curve

Waves compose from packs since PR 2 and the count is BODIES (a swarm entry
counts its three), so a wave has fewer bodies than before - and bodies are
Scrap. On the old Standard curve (6 + 4 a wave, ×1.05) the reference read
20.0 with one seed at 7: with fewer early bodies the Refinery-first build
starved. Six variants of the curve, the reference and the eight-Bolt
builder, four seeds:

| variant | reference (death per seed, mean) | eight Bolts |
|---|---|---|
| 6 + 5 a wave, hp +15% ×1.05 | 30 27 27 27 → 27.8 | 14.0 |
| 6 + 4, +15% ×1.07 | 24 9 18 7 → 14.5 | 14.5 |
| 6 + 5, +20% ×1.05 | 24 22 23 27 → 24.0 | 13.3 |
| 6 + 4, +20% ×1.06 | 24 8 22 7 → 15.3 | 14.5 |
| **6 + 5, +15% ×1.07** | **24 22 23 22 → 22.8** | 13.3 |
| 6 + 4, +25% ×1.05 | 24 8 18 7 → 14.3 | 13.8 |

Every 6 + 4 row collapses on two seeds (the economy, not the towers); every
6 + 5 row holds all four. **Standard is 6 + 5 a wave at +15% ×1.07** - the
reference dies at 22-24 on every seed, inside the band - and **Grim keeps
its two points over it at ×1.09**. Calm is untouched (its own curve since
session 31).

## The base world at the final curve


| build | death @945046 | death @12345 | death @777 | death @2024 | mean | held the run | ore banked |
|---|---|---|---|---|---|---|---|
| three plain Bolts | 9 | 8 | 10 | 10 | 9.3 | 0/4 | 0 · 0 · 0 · 0 |
| two Bolts (Marksman), a Frost, a Refinery | 10 | 9 | 10 | 11 | 10.0 | 0/4 | 20 · 21 · 25 · 25 |
| the reference: Railbore line + Frost + Mortar + Refinery | 28 | 22 | 22 | 18 | 22.5 | 4/4 | 83 · 65 · 65 · 44 |
| eight Bolts, Marksman then Piercing | 16 | 15 | 14 | 13 | 14.5 | 1/4 | 0 · 0 · 0 · 0 |
| Refinery, then 4 Railbores + 2 Frost + Mortar, then 3 more Railbores | 33 | 27 | 32 | 28 | 30.0 | 4/4 | 87 · 65 · 84 · 75 |

## the base world at CALM (session 31: hp +8%/wave x1.03, 6 + 3/wave, the heavier kinds three waves later) knobs on 7x5 - economy 100 scrap, no relics, horizon 40; the run holds at wave 15

| build | death @945046 | death @12345 | death @777 | death @2024 | mean | held the run | ore banked |
|---|---|---|---|---|---|---|---|
| three plain Bolts | 15 | 14 | 12 | 13 | 13.5 | 0/4 | 0 · 0 · 0 · 0 |
| two Bolts (Marksman), a Frost, a Refinery | 16 | 14 | 12 | 15 | 14.3 | 1/4 | 44 · 38 · 27 · 42 |
| the reference: Railbore line + Frost + Mortar + Refinery | 39 | 38 | 37 | 33 | 36.8 | 4/4 | 87 · 65 · 84 · 85 |
| eight Bolts, Marksman then Piercing | 23 | 17 | 22 | 24 | 21.5 | 4/4 | 0 · 0 · 0 · 0 |
| Refinery, then 4 Railbores + 2 Frost + Mortar, then 3 more Railbores | >40 | >40 | >40 | >40 | 41.0 | 4/4 | 87 · 65 · 84 · 85 |

## the base world at STANDARD knobs on 7x5 - economy 100 scrap, no relics, horizon 40; the run holds at wave 20

| build | death @945046 | death @12345 | death @777 | death @2024 | mean | held the run | ore banked |
|---|---|---|---|---|---|---|---|
| three plain Bolts | 10 | 10 | 8 | 6 | 8.5 | 0/4 | 0 · 0 · 0 · 0 |
| two Bolts (Marksman), a Frost, a Refinery | 10 | 10 | 8 | 7 | 8.8 | 0/4 | 15 · 16 · 9 · 7 |
| the reference: Railbore line + Frost + Mortar + Refinery | 24 | 22 | 23 | 22 | 22.8 | 4/4 | 50 · 44 · 46 · 46 |
| eight Bolts, Marksman then Piercing | 17 | 12 | 12 | 12 | 13.3 | 0/4 | 0 · 0 · 0 · 0 |
| Refinery, then 4 Railbores + 2 Frost + Mortar, then 3 more Railbores | 31 | 31 | 33 | 27 | 30.5 | 4/4 | 68 · 66 · 71 · 56 |

## The tree's states at the final curve


| state | death @945046 | death @12345 | death @777 | death @2024 | mean | ore banked per run (t1/t2/t3) | mean t1 ore | towers / relics / slots |
|---|---|---|---|---|---|---|---|---|
| BASE - Bolt, Mortar, Frost, Refinery; 16 relics; 6 slots | 24 | 27 | 26 | 17 | 23.5 | 50/0/0 · 60/0/0 · 60/0/0 · 33/0/0 | 50.8 | 4 / 21 / 6 |
| MID - + Tesla, Bastion; damage, cold, economy branches; 8 slots | 19 | 19 | 18 | 6 | 15.5 | 35/0/0 · 36/0/0 · 36/0/0 · 11/0/0 | 29.5 | 6 / 36 / 8 |
| EVERYTHING - the Laser line, 52 relics, 12 slots | 30 | 38 | 36 | 25 | 32.3 | 66/0/0 · 87/0/0 · 81/0/0 · 56/0/0 | 72.5 | 8 / 52 / 12 |
| MID + rich_vein loaded (tier-2 veins) | 19 | 19 | 18 | 6 | 15.5 | 0/24/0 · 0/21/0 · 0/25/0 · 0/9/0 | 0.0 | 6 / 36 / 8 |
| EVERYTHING + mother_lode loaded (a tier-3 vein) | 30 | 38 | 36 | 25 | 32.3 | 0/0/33 · 0/0/59 · 0/0/53 · 0/0/28 | 0.0 | 8 / 52 / 12 |

## The enemy sweep — every body alone against every line


| body (rule) | Bolt line (Railbore) | Frost + Bolts | Mortars | Tesla | Missiles | Lasers inline + Bolt | Bastion + Bolts |
|---|---|---|---|---|---|---|---|
| **grunt** (plain) | 38 | 40 | 27 | 28 | 35 | >40 | 37 |
| **skitter** (fast) | 36 | >40 | 28 | 30 | 38 | >40 | 34 |
| **swarmling** (swarm, fast) | >40 | >40 | 33 | 33 | >40 | >40 | >40 |
| **brute** (armoured) | 18 | 21 | 4 | 11 | 12 | 34 | 16 |
| **shellback** (shielded) | 37 | 38 | 13 | 10 | 31 | 36 | 37 |
| **husk** (plain) | 21 | 20 | 8 | 7 | 14 | 22 | 18 |
| **Juggernaut** (plain) | 12 | 14 | 4 | 5 | 9 | 20 | 11 |
| **courser** (sprint) | >40 | >40 | 28 | 26 | 36 | >40 | 40 |
| **ram** (charge) | 20 | 24 | 7 | 11 | 13 | 27 | 20 |
| **blob** (split) | 27 | 28 | 9 | 10 | 16 | 29 | 25 |
| **mender** (heal) | 38 | 37 | 6 | 27 | 29 | >40 | 35 |
| **mole** (burrow) | 27 | 32 | 10 | 11 | 17 | 33 | 25 |
| **pavise** (frontshield) | 20 | 22 | 8 | 8 | 13 | 20 | 19 |
| **Warden** (bulwark) | 11 | 12 | 4 | 5 | 8 | 17 | 11 |

What the table says (a low number is a hard body for that line; >40 is a
line that never loses to it):

- **The heavies are the game**: brute, husk, Juggernaut, ram, pavise and the
  Warden end every line between 11 and 34; the Laser line lasts longest
  against all of them, the Bolt line next. Mortars and Teslas alone are
  not a line (the dead zone, the arc's reach) - they are the partner in a
  mixed build, as the reference has always said.
- **The light kinds are the Bolt line's food**: grunt, skitter, swarmling,
  courser and shellback run past 36 against Bolts; a courser (sprint) is
  answered by anything that keeps hitting it; a shellback by focus fire.
- **The mender is Mortars' nightmare (6)**: blasts that do not kill let it
  mend; a Bolt line or a Laser kills it before it mends anything. The card
  says so ("kill the mender first").
- **The mole surfaces past the choke**: 27 for the Bolt line at the choke,
  33 for Lasers inline - a line by the Core sees it; a line at the entry
  would not.
- **The blob's halves** cost the Bolt line about ten waves against a grunt
  (27 vs 38): the split is real; blasts (Missiles 16) take the halves
  together but lose to the parent.
- **The pavise** reads like a husk (20-22) for a line at the choke that
  hits it from beside the road; a line aimed down the road would read
  worse - the matrix is placed at the choke, so the flank is what it
  measures.

## Not read here

Grim; relics against the seven (the tree sweep's rows carry six relics from
each state's pool); the live 31×20 board beyond one playthrough (below);
Calm with the seven (it never meets the Warden; the delay pushes the rest
three waves later).

## The live board, once (31×20, Standard, the debug handle)

Ten towers by the Core built as Scrap came (seven Bolts, two Frost, a
Mortar), every fork taken first option, every offer's first relic taken:
**held the twenty** with six breaches (the Core at 26/50 from wave 9 on)
and 2,835 Scrap unspent at the end. The 7×5 lab's "keep building" plan
reads 30.5 on the same curve; the live board is wider and kinder to a
Core-hugging line. Standard is the second run: a player who forks and
hugs the Core wins it under pressure; a Bolt-only builder who does not
fork (13.3 in the lab) does not.
