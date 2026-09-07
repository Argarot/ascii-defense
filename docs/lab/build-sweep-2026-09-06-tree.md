# Build sweep — the tree's states (2026-09-06, session 29, PR 6)

`node tools/build-sweep.mjs --tree` · board 7×5 · Standard curve · economy 100 scrap ·
a Refinery on the richest vein · six relics from the state's own pool · horizon 40.

PRD §11 stage 3 warned that the tree multiplies player power under the
curves the lab measures, and that every tree state re-baselines the
sweeps. This is the first reading at three states. **The build differs per
state** (each plays the towers its tree allows), so the rows compare
*worlds*, not one build across worlds.

| state | death @945046 | death @12345 | death @777 | death @2024 | mean | ore banked per run (t1/t2/t3) | mean t1 ore | towers / relics / slots |
|---|---|---|---|---|---|---|---|---|
| BASE - Bolt, Mortar, Frost, Refinery; 16 relics; 6 slots | 11 | 18 | 17 | 8 | 13.5 | 12/0/0 · 36/0/0 · 32/0/0 · 10/0/0 | 22.5 | 4 / 21 / 6 |
| MID - + Tesla, Bastion; damage, cold, economy branches; 8 slots | 11 | 9 | 17 | 8 | 11.3 | 12/0/0 · 11/0/0 · 36/0/0 · 14/0/0 | 18.3 | 6 / 36 / 8 |
| EVERYTHING - the Laser line, 52 relics, 12 slots | 19 | 33 | 28 | 25 | 26.3 | 34/0/0 · 87/0/0 · 65/0/0 · 56/0/0 | 60.5 | 8 / 52 / 12 |

## What the numbers say

- **A base run banks about 22 tier-1 Ore** (one Refinery on the richest
  tier-1 vein, an economy build, dying around wave 13). That number priced
  the tree: the arsenal's four towers cost **105** tier-1 Ore together
  (Tesla 20, Bastion 20, Missiles 25, Laser 40), so "about five runs to all
  the towers" (Daniil's answer 4) holds for a player who dies at the base
  world's mean. Every tier-1 node together costs 420 (about nineteen base
  runs, fewer once the better worlds bank 60 a run); the tier-2 nodes 135
  and the tier-3 nodes 60 want the vein tiles first.
- **The everything world is twice the base world** (26.3 vs 13.5). That is
  the Laser line plus twelve slots plus the full pool; it is the gap the
  tree is supposed to open, and it is also the reason every later sweep
  states its tree state in its header.
- **The MID row is not "between"** (11.3): a Tesla + Bastion build with six
  relics from a 36-relic pool played worse than the base's Railbore line.
  A world with more towers is not a stronger world unless the build uses
  them; the base row is the honest floor for a new player.
- **No tier-2 or tier-3 Ore banked** in any state: no state loads a vein
  tile, and the sweep's loadout is empty. The vein tiles are bought in the
  workshop and loaded by the player; a sweep with `rich_vein` in the
  loadout is the next reading once the lab takes a loadout.

## The instrument

- `LabSpec.unlocks` (node ids, or `['*']`) with `LabContent.tree` resolves
  the world the way the worker does: the towers the strip offers, the relic
  pool, the slots. Absent, the sweeps before the tree keep their world.
- `TowerPlacement.at: 'vein'` puts a producer on the richest vein it may
  stand on (highest tier, then most Ore left); a plan whose vein is missing
  skips the producer rather than stalling.
- `LabReport.oreEnd` is the purse at the end, by tier; `world` is what the
  tree allowed.
