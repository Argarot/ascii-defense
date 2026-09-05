# Build sweep — the three instruments (2026-09-06, session 27 PR 6)

`node tools/build-sweep.mjs` · Standard curve · seeds 945046, 12345, 777, 2024 ·
horizon 24 waves · 100 starting scrap (the "capability" row unlimited).
Death wave means; **crowd kills** = swarmlings and skitters killed, mean
over seeds; **all kills** likewise.

## What changed in the lab

- **`at: 'adjacent'`** — the tower goes on the best-coverage cell touching
  the LAST tower placed. How a Bastion is used; the earlier rows placed it
  for road coverage and it buffed nobody.
- **`at: 'inline'`** — the cell and facing whose straight corridor covers
  the most road (the sim's own reach rule mirrored), and the tower is
  turned to it. How a Laser is aimed; the earlier rows never rotated one.
- **`killsByDef`** on every report: kills per enemy kind, so a crowd role
  can be read off the crowd bodies instead of the death wave.

## Readings (7×5, the 1080p board)

| build | death mean | crowd kills | all kills |
|---|---|---|---|
| Railbore line + Frost + Mortar (reference) | 16.3 | 414 | 729 |
| Railbore, then Bastion (adjacent), then three Railbores | 16.3 | 381 | 675 |
| both types (2 Railbore + Tesla + Frost + Mortar) | 15.8 | 388 | 678 |
| Tesla + Bastion (adjacent) + Frost | 14.3 *(was 11.8 with the Bastion placed for coverage)* | 338 | 578 |
| Laser line, aimed + Frost + Railbore | 13.8 *(was 11.5 unaimed)* | 307 | 557 |
| Missiles + Bastion (adjacent) + Railbore | 13.0 | 263 | 446 |
| Hailstorm (close quarters) line + Frost + Mortar | 11.8 | 224 | 376 |
| Hailstorm, unlimited scrap | 13.3 | 281 | 482 |

7×4 and 12×7 tell the same story (the tool prints them); on 12×7 the
aimed Laser line reaches 25 on one seed and 9 on another.

## What the instruments say

- **A Bastion beside a Railbore is worth exactly a Frost and a Mortar**:
  the Bastion build ties the reference at 16.3 with one fewer damage
  tower. The aura is real; it is not yet better than another gun. The
  Tesla build gained two and a half waves from being placed right.
- **Aiming a Laser gains two waves** and still leaves a 5 on one seed:
  the cell with the most road under its corridor can be far from the
  choke, so the first laser watches an empty run while the first wave
  leaks elsewhere. "Inline near the choke" is the placement a player
  makes; the instrument needs a distance term (recorded as debt).
- **Hailstorm at close quarters kills FEWER crowd bodies than the Railbore
  line** (224 vs 414; per wave survived 19 vs 25). The reach it gave up
  costs more than the third shot returns. The role as shipped is not
  measured as a crowd answer even on the instrument built for it — the
  numbers are Daniil's to read; the honest options are a bigger range
  give-back (−1 instead of −2.5) or a different job for the second tier-3.
- **Types**: the both-types build still trails the reference by half a
  wave. The matrix decides typed fights; the reference build is already
  kinetic + energy (Frost). Nothing here changes PR 1's reading.
