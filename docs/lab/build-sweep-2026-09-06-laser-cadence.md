# Build sweep — the Laser at a pulse a second, no range (2026-09-06, feedback items 3 and 4)

`node tools/build-sweep.mjs` · Standard curve · seeds 945046, 12345, 777, 2024 ·
horizon 24 waves · 100 starting scrap. Same builds and instruments as
`build-sweep-2026-09-06-instruments.md`; only the Laser changed.

## What changed

- **No range** (Daniil: "it doesn't have a fixed range - all the way until
  the bend in the road, regardless of the length"). The corridor runs to
  the road's turn or the board's edge; the 12-cell cap is gone from the
  roster, the schema and the lab's mirror.
- **A pulse a second** (Daniil: "needs to be firing much slower"): 20
  damage every 20 ticks instead of 3 every 3 - the same 20 dps on the
  card. The heat step is 0.5 a pulse (x2 on the third pulse, as before in
  wall time); Capacitor +14 (the same 70%); Chill's slow lasts 24 ticks so
  a pulse a second keeps it cold; Fast Cycle is a pulse every 13 ticks.

## Readings (7×5, the 1080p board)

| build | death mean | crowd kills | all kills |
|---|---|---|---|
| Laser line, aimed + Frost + Railbore | **18.5** *(was 13.8)* | 548 *(307)* | 1047 *(557)* |
| Railbore line + Frost + Mortar (reference) | 16.3 | 414 | 729 |
| Railbore, then Bastion (adjacent), then three Railbores | 16.3 | 381 | 675 |
| both types | 15.8 | 388 | 678 |

Every other row is unchanged to the decimal (the seeds and builds are the
same; only the Laser's numbers moved).

## What it says

The aimed Laser line is now the strongest line build in the lab by two
waves over the reference, and the change was meant to be
damage-neutral. Two things did it, and the sweep cannot split them:
the **reach** (a corridor that used to stop at 12 cells now runs the
whole straight, so a laser on a long run holds bodies for its full
length) and the **burst** (20 in one pulse kills a body that 3-a-pulse
would have left walking out of the corridor; a slow stream leaks, a
burst does not). The 12×7 board tells the same story (21.8, from 25/9
split seeds before).

**Daniil's call, not retuned here**: the reach is the requirement and
stays; if the Laser should sit level with the reference, the honest
knob is the pulse's damage (20 → 16 puts the card at 16 dps) or the
heat ceiling (x2 → x1.5). Recorded as a reading, the numbers as read.
