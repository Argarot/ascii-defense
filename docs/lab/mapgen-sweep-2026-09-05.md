# Mapgen sweep — 2026-09-05 (session 24, PR 2: the board fills)

`node tools/mapgen-sweep.mjs 30` · Standard knobs · the app's exact reroll loop
(60 seed rerolls before a genError) · 30 seeds per cell. Boards: the old 12×7
and the three a 1080p-class screen actually gets since D24.

Columns: failures the player would see; seed rerolls mean/max; generation
time; road coverage (share of slots); entries per map; share of maps whose
shortest lane is within LANE_BAND (0.7) of the longest; mean shortest/longest
lane ratio in cells.

## Before — the centre-Core carve, measured 2026-09-04

| board | loadout | fails/30 | mean rerolls | max rerolls |
|---|---|---|---|---|
| 12×7 | none / 1 special / 3 shipped | 0 | 0 | 0 |
| 12×7 | 5 minted | 0 | 2.4 | 10 |
| 7×5 | 1 special | 0 | 0 | 0 |
| 7×5 | 3 shipped | 0 | 0.1 | 1 |
| 7×5 | 5 minted | **30** | 60 | 60 |
| 7×5 | 5 shipped | **14** | 42 | 60 |
| 7×4 | 3 shipped | 0 | 3.8 | 19 |
| 7×4 | 5 minted / 5 shipped | **30 / 30** | 60 | 60 |
| 6×4 | 3 shipped | 0 | 12.2 | 46 |
| 6×4 | 5 minted / 5 shipped | **30 / 30** | 60 | 60 |

## After — carve v4 (the Core at the edge, specials first, walks to one lane length, the board fills)

| board | loadout | fails | rerolls mean/max | ms | coverage | entries | in band | lane ratio | sample error |
|---|---|---|---|---|---|---|---|---|---|
| 12x7 | none | 0/30 | 0.0/0 | 6 | 0.80 | 9.1 | 87% | 0.76 |  |
| 12x7 | sp_x | 0/30 | 0.0/0 | 5 | 0.71 | 12.4 | 77% | 0.73 |  |
| 12x7 | sp_bridge | 0/30 | 0.0/0 | 5 | 0.74 | 11.5 | 90% | 0.77 |  |
| 12x7 | sp_twin | 0/30 | 0.0/0 | 8 | 0.76 | 11.5 | 87% | 0.75 |  |
| 12x7 | twin_bend | 0/30 | 0.0/0 | 7 | 0.78 | 11.4 | 83% | 0.74 |  |
| 12x7 | 3 shipped | 0/30 | 0.0/0 | 6 | 0.71 | 13.2 | 17% | 0.60 |  |
| 12x7 | 5 minted | 0/30 | 0.0/0 | 6 | 0.64 | 16.0 | 0% | 0.40 |  |
| 12x7 | 5 shipped | 0/30 | 0.0/0 | 5 | 0.70 | 15.0 | 0% | 0.48 |  |
| 7x5 | none | 0/30 | 0.0/0 | 2 | 0.88 | 8.7 | 83% | 0.76 |  |
| 7x5 | sp_x | 0/30 | 0.0/0 | 2 | 0.84 | 11.9 | 3% | 0.55 |  |
| 7x5 | sp_bridge | 0/30 | 0.0/0 | 3 | 0.86 | 11.0 | 23% | 0.60 |  |
| 7x5 | sp_twin | 0/30 | 0.0/0 | 4 | 0.89 | 10.8 | 30% | 0.62 |  |
| 7x5 | twin_bend | 0/30 | 0.0/0 | 3 | 0.88 | 10.9 | 27% | 0.61 |  |
| 7x5 | 3 shipped | 0/30 | 0.0/0 | 3 | 0.87 | 12.0 | 0% | 0.45 |  |
| 7x5 | 5 minted | 0/30 | 0.0/0 | 3 | 0.79 | 13.1 | 0% | 0.30 |  |
| 7x5 | 5 shipped | 0/30 | 0.0/0 | 3 | 0.85 | 11.7 | 0% | 0.35 |  |
| 7x4 | none | 0/30 | 0.0/0 | 1 | 0.88 | 9.1 | 73% | 0.72 |  |
| 7x4 | sp_x | 0/30 | 0.0/0 | 2 | 0.87 | 12.0 | 3% | 0.52 |  |
| 7x4 | sp_bridge | 0/30 | 0.0/0 | 2 | 0.88 | 10.6 | 13% | 0.57 |  |
| 7x4 | sp_twin | 0/30 | 0.0/0 | 2 | 0.87 | 10.4 | 17% | 0.61 |  |
| 7x4 | twin_bend | 0/30 | 0.0/0 | 2 | 0.88 | 10.6 | 13% | 0.59 |  |
| 7x4 | 3 shipped | 0/30 | 0.0/0 | 2 | 0.89 | 11.3 | 0% | 0.37 |  |
| 7x4 | 5 minted | 0/30 | 0.0/0 | 2 | 0.87 | 13.0 | 0% | 0.29 |  |
| 7x4 | 5 shipped | 0/30 | 0.0/0 | 2 | 0.88 | 11.0 | 0% | 0.33 |  |
| 6x4 | none | 0/30 | 0.0/0 | 1 | 0.90 | 8.2 | 60% | 0.72 |  |
| 6x4 | sp_x | 0/30 | 0.0/0 | 1 | 0.89 | 11.5 | 0% | 0.49 |  |
| 6x4 | sp_bridge | 0/30 | 0.0/0 | 1 | 0.90 | 10.3 | 7% | 0.55 |  |
| 6x4 | sp_twin | 0/30 | 0.0/0 | 2 | 0.91 | 9.9 | 20% | 0.56 |  |
| 6x4 | twin_bend | 0/30 | 0.0/0 | 2 | 0.90 | 10.1 | 13% | 0.57 |  |
| 6x4 | 3 shipped | 0/30 | 0.0/0 | 2 | 0.90 | 9.3 | 0% | 0.36 |  |
| 6x4 | 5 minted | 0/30 | 0.0/0 | 4 | 0.92 | 11.8 | 0% | 0.35 |  |
| 6x4 | 5 shipped | 0/30 | 0.0/0 | 3 | 0.93 | 10.1 | 0% | 0.31 |  |

## Readings

- **Item 3 is answered.** Every board × loadout generates on the first seed:
  zero failures, zero rerolls, in single-digit milliseconds. Five specials on
  a 6×4 board were impossible yesterday and are routine today.
- **Coverage lands at 0.8–0.9** on the small boards (the target is 0.9; the
  carve reports what it reached and the verifier holds the map to that). The
  old 12×7 fills less (0.7–0.8): its fair-share lanes are long and the extra
  walks run out before the corners do.
- **Entries are many.** 8–9 fronts on a 7×5 board with no loadout, 12–16
  with five specials (each spare arm is an entry by construction). This is
  the emergent count D28 asked for; whether it is the right number of fronts
  is a difficulty question, and PR 4's mixed-build lab measures it.
- **Balance holds without specials and not with them.** No loadout: 60–87%
  of maps inside the band, mean lane ratio ~0.75. With specials the arm-grown
  entries are the short lanes (ratio 0.3–0.5): an anchor sits where it fits,
  and its arms take the nearest border once they clear the floor. Making the
  arms wander to L* is exactly what made yesterday's carve fail, so this is
  the trade as designed (tree > specials > floor > balance > coverage). The
  band is reported honestly per map (`laneBand` 0 when missed).
- The mapgen floor (D13) still binds every lane, arm-grown and border-anchor
  entries included; where the board cannot hold it the plan reports 0 and
  the sim's offset falls back to no offset, as before.
