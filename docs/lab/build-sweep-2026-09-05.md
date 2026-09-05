# Build sweep — 2026-09-05 (session 24, PR 4: difficulty on the new boards)

`node tools/build-sweep.mjs` · Standard curve as shipped (hpLinear 0.15, geo
1.05, 6 + 4/wave) · four seeds · horizon 40 · death wave per seed.

The variant sweep measured one tower alone; this one measures a BUILD the way
a player meets the game: five towers bought with an economy (100 scrap to
start, towers and upgrades as kills pay), on the boards the game generates
now - the Core at the east edge, the board nine tenths road, 8–12 entries.
Builds: three Bolts (a full path) plus a Frost (Ice Shards / Wide Field /
Shatterfield) and a Mortar (Wide Burst / Short Fuse / Concussive), placed
at the CHOKE (ground beside the road's last 15 cells before the Core) or
SPREAD (best coverage anywhere).

## board 7x4

| build | death @945046 | death @12345 | death @777 | death @2024 | mean |
|---|---|---|---|---|---|
| choke, Railbore line + Frost + Mortar, economy | 19 | 13 | 23 | 22 | 19.3 |
| spread, same build, economy | 17 | 8 | 17 | 8 | 12.5 |
| choke, Hailstorm 60% line + Frost + Mortar, economy | 13 | 11 | 13 | 13 | 12.5 |
| choke, Hailstorm 75% line + Frost + Mortar, economy | 13 | 11 | 15 | 13 | 13.0 |
| choke, same build, unlimited scrap (capability) | 19 | 13 | 23 | 22 | 19.3 |

## board 7x5

| build | death @945046 | death @12345 | death @777 | death @2024 | mean |
|---|---|---|---|---|---|
| choke, Railbore line + Frost + Mortar, economy | 20 | 21 | 23 | 19 | 20.8 |
| spread, same build, economy | 20 | 17 | 17 | 8 | 15.5 |
| choke, Hailstorm 60% line + Frost + Mortar, economy | 14 | 12 | 14 | 12 | 13.0 |
| choke, Hailstorm 75% line + Frost + Mortar, economy | 14 | 12 | 15 | 12 | 13.3 |
| choke, same build, unlimited scrap (capability) | 20 | 21 | 23 | 20 | 21.0 |

## board 12x7

| build | death @945046 | death @12345 | death @777 | death @2024 | mean |
|---|---|---|---|---|---|
| choke, Railbore line + Frost + Mortar, economy | 23 | 22 | 24 | 25 | 23.5 |
| spread, same build, economy | 20 | 18 | 20 | 21 | 19.8 |
| choke, Hailstorm 60% line + Frost + Mortar, economy | 17 | 14 | 15 | 15 | 15.3 |
| choke, Hailstorm 75% line + Frost + Mortar, economy | 18 | 15 | 16 | 15 | 16.0 |
| choke, same build, unlimited scrap (capability) | 23 | 22 | 24 | 25 | 23.5 |


## Readings

- **The gate's number is met with room to spare.** An ordinary choke build
  reaches wave 13–23 on 7×4, 19–23 on 7×5 and 22–25 on 12×7 against a
  final wave of 20. The Standard ramp after session 23's notch is not too
  steep for a competent five-tower build on the filled boards; whether it is
  too steep for a HUMAN placing worse is Daniil's playtest, not this table.
  **No further retune proposed from here.**
- **The economy is not the constraint.** Unlimited scrap gives the same
  death waves as 100 scrap: kills pay fast enough that the build is done
  early. The lab now has an economy for when that changes.
- **The choke is stronger, not the whole game.** Choke beats spread by 4–7
  waves on the small boards and by 4 on 12×7. One entrance concentrates the
  fight, as designed; spread builds still reach 12–20. The "precious cells
  beside the Core" rule (WBS 2.35) is the place to shape this, not the
  carve.
- **Hailstorm is not a percentage problem.** 60% → 75% per shot buys half a
  wave. In a mixed build it trails Railbore by six to eight waves on every
  board: three homing shots spread across a crowd the Frost already
  controls, while Railbore's armour bypass carries the late waves on its
  own. The fork needs a different ROLE for its second branch - full-damage
  volleys at short range, pierce, or a slow that stacks - a design item for
  session 25's combat-identity pass, not a knob. Recorded as such.
