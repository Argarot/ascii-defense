# The early game — the base world at Calm and Standard (2026-09-07, session 31, PR 2)

`node tools/build-sweep.mjs --base` · board 7×5 · the BASE world (Bolt, Mortar,
Frost, Refinery; no relics held - the lab grants none, a real run deals one
every second wave) · economy 100 scrap · horizon 40 · the builds a new
player makes.

Daniil, 2026-09-07: "the first pass of rebalancing, especially for early
game of new players, which don't have access to many features the engine
expects the player to have."

## What the sweep found

Every plan died at wave 8–12 on Calm, whatever the hp curve - Calm was the
Standard curve with a slower clock. The wall was **the wave-10 boss**: the
boss is the heaviest body unlocked, the juggernaut (400 hp, armour 6),
multiplied ×6 as a boss and ×3.6 by the wave - about 8,600 hp - against a
base world whose plain Bolt does 8 − 6 = 2 per hit. Three machinery
changes, then the numbers:

- **The armour floor** (`ARMOR_FLOOR` 0.35): armour strips a flat amount
  from a hit but never more than 65% of it. A plain Bolt does 2.8 to a
  juggernaut, not 2; Railbore still ignores armour. This also softens
  Daniil's item 6 (ignore-armour always the pick).
- **The boss multiplier shrinks for heavy bodies** (`bossHpMul`): ×6 for a
  grunt-weight body, down to ×1.5 for a body already boss-sized. A
  juggernaut boss is 600 base hp, not 2,400.
- **Calm has its own curve** (`THREAT_LEVELS[].difficulty`): hp +8% a wave
  and ×1.03, six bodies plus three a wave, and every kind above wave 1
  unlocks **three waves later** (`unlockDelay`). Standard and Grim keep
  their curves; Grim its ×1.07.

## Calm before session 31 (the Standard curve, the 55 s clock)

| build | death @945046 | death @12345 | death @777 | death @2024 | mean | held 15 |
|---|---|---|---|---|---|---|
| three plain Bolts | 9 | 9 | 8 | 8 | 8.5 | 0/4 |
| two Bolts (Marksman), a Frost, a Refinery | 10 | 9 | 8 | 8 | 8.8 | 0/4 |
| the reference: Railbore line + Frost + Mortar + Refinery | 11 | 10 | 9 | 9 | 9.8 | 0/4 |
| eight Bolts, Marksman then Piercing | 12 | 11 | 11 | 11 | 11.3 | 0/4 |
| Refinery, then 4 Railbores + 2 Frost + Mortar, then 3 more Railbores | 13 | 12 | 11 | 11 | 11.8 | 0/4 |

## Calm since session 31 (the armour floor and the boss rule are in every row below)

| build | death @945046 | death @12345 | death @777 | death @2024 | mean | held 15 | ore banked |
|---|---|---|---|---|---|---|---|
| three plain Bolts | 12 | 11 | 11 | 10 | 11.0 | 0/4 | 0 · 0 · 0 · 0 |
| two Bolts (Marksman), a Frost, a Refinery | 12 | 12 | 11 | 12 | 11.8 | 0/4 | 30 · 30 · 29 · 26 |
| the reference: Railbore line + Frost + Mortar + Refinery | 27 | 23 | 22 | 19 | 22.8 | 4/4 | 79 · 63 · 57 · 48 |
| eight Bolts, Marksman then Piercing | 16 | 14 | 15 | 16 | 15.3 | 2/4 | 0 · 0 · 0 · 0 |
| Refinery, then 4 Railbores + 2 Frost + Mortar, then 3 more Railbores | 36 | 34 | 32 | 28 | 32.5 | 4/4 | 87 · 65 · 84 · 73 |

## Standard (unchanged curve; the armour floor and the boss rule apply)

| build | death @945046 | death @12345 | death @777 | death @2024 | mean | held 20 | ore banked |
|---|---|---|---|---|---|---|---|
| three plain Bolts | 9 | 8 | 8 | 8 | 8.3 | 0/4 | 0 · 0 · 0 · 0 |
| two Bolts (Marksman), a Frost, a Refinery | 10 | 9 | 9 | 8 | 9.0 | 0/4 | 16 · 14 · 14 · 14 |
| the reference: Railbore line + Frost + Mortar + Refinery | 11 | 9 | 10 | 8 | 9.5 | 0/4 | 12 · 10 · 14 · 8 |
| eight Bolts, Marksman then Piercing | 12 | 11 | 11 | 9 | 10.8 | 0/4 | 0 · 0 · 0 · 0 |
| Refinery, then 4 Railbores + 2 Frost + Mortar, then 3 more Railbores | 12 | 12 | 12 | 9 | 11.3 | 0/4 | 13 · 14 · 14 · 9 |

## What the numbers say

- **A new player who learns Railbore holds Calm.** The reference line
  holds fifteen on every seed and banks 50–80 Ore; a player who only ever
  builds Bolts and takes their first fork holds it on half the seeds and
  reaches wave 14–16 on the rest - with six relics on top in a real run,
  most of those hold. Three plain Bolts with no upgrade still die at
  wave 11: the game asks for upgrades, and the tutorial says so.
- **Standard stays the game** (the base world without relics dies at
  9–12; with six relics session 29's tree sweep read 13.5): a second run
  with a couple of tower nodes bought is where Standard belongs, and the
  tutorial's first run is Calm.
- The Standard rows moved little under the armour floor and the boss rule
  (the reference 9.8 → 9.5 with the plan's Refinery first; the boss at
  wave 10 is still the wall for a kinetic-only world without Railbore).
- **Not read here**: relics in the base world (the lab grants none in this
  sweep), Grim, the tower nodes' effect on a second run - the tree sweep's
  MID row is the nearest.
