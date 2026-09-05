# Build sweep — eight towers, Hailstorm as a role (2026-09-05, session 26 PR 5)

`node tools/build-sweep.mjs` · Standard curve · seeds 945046, 12345, 777, 2024 ·
horizon 24 waves · 100 starting scrap unless marked "capability" (unlimited).
Death wave means; the per-seed rows are in the tool's output.

## The new builds beside the session-24 and session-26 sets

| build (choke, economy) | 7×4 | 7×5 | 12×7 |
|---|---|---|---|
| Laser line (Focus, Overheat, Cutter) + Frost + Railbore | 13.3 | 11.5 | 19.0 |
| Missiles + Bastion + Railbore | 11.0 | 12.8 | 17.0 |
| Tesla + Bastion + Frost | 9.8 | 11.8 | 13.5 |
| Bastion + four Railbores | 11.8 | 12.0 | 16.0 |
| Hailstorm (close quarters) line + Frost + Mortar | 11.8 | 11.8 | 15.0 |
| Hailstorm 60% / 75% (the old role, for reference) | 11.8 / 11.8 | 11.8 / 11.8 | 15.0 / 15.0 |
| Railbore line + Frost + Mortar (the reference) | 15.3 | 16.3 | 20.5 |
| both types (2 Railbore + Tesla + Frost + Mortar) | 15.0 | 15.8 | 19.5 |

| build (choke, unlimited scrap) | 7×4 | 7×5 | 12×7 |
|---|---|---|---|
| Railbore line + Frost + Mortar | 18.5 | 19.0 | 21.5 |
| Hailstorm (close quarters) line + Frost + Mortar | 13.0 | 13.3 | 15.8 |

## Hailstorm's new role (WBS 2.37)

Shipped: **three homing shots per volley at full damage, each at a
different enemy when there is one, at close quarters** (range −2.5, spread
0.6). The percentage never made a job; the reach does — point-blank
saturation at the choke, the answer to a crowd.

**What the sweep says, honestly:** with 100 scrap the Hailstorm build dies
on exactly the waves the 60% and 75% builds did (the economy rarely
reaches tier 3 before the death wave); fully funded it trails the Railbore
line by six waves. The death wave is decided by the heaviest bodies —
brutes at ×0.6 kinetic with armour 3 take 1.8 per Hailstorm shot and 18
per Railbore round — and survival is the only thing this sweep measures. A
crowd role's value (kills per scrap on swarm waves, time-to-clear a pack)
is not on this ruler. **The role is a design decision, not a measured
win**; the instrument that could measure it is a per-wave-type reading in
the lab (recorded as debt).

## The new towers in the lab's hands

- **The lab cannot use a Bastion.** Its choke placement picks the cell
  with the best road coverage for every tower; a Bastion placed for
  coverage buffs nobody. The three Bastion rows measure a wasted 40
  scrap, not the aura. The lab needs an "adjacent to the last tower"
  placement before any Bastion number means anything.
- **The lab cannot aim a Laser.** Facing is chosen on build toward the
  most road in reach, which at a bend can point across the road instead
  of along it; the lab never rotates. The Laser line's 5s on two seeds are
  that. On the wide board, where corridors are long, the same build
  reaches 19.
- The Tesla + Frost rows are the energy-only reading from PR 1 with a
  Bastion in place of a coil: worse by the wasted tower.

## Readings for Daniil

- Eight towers exist and every one has a job on paper; the sweep proves
  survival for Railbore-centred builds and cannot yet see the value of
  support, aim or crowd control. Two lab placements (adjacent, aimed) and
  one per-wave-type measure are the next instruments.
- The ramp after types is about three waves harder than yesterday (PR 1's
  doc); nothing in this PR moved it.
