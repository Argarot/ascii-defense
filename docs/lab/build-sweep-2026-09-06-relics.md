# Build sweep — the relic sets, and the inline instrument's distance term (2026-09-06, session 28 PR 6)

`node tools/build-sweep.mjs --relics` and `node tools/build-sweep.mjs` ·
Standard curve · seeds 945046, 12345, 777, 2024 · horizon 40 waves · 100
starting scrap. Death wave means.

## Read this first: the boards moved

Every row below is measured on **different boards** from this morning's
tables (`build-sweep-2026-09-06-laser-cadence.md` and earlier). The map
generator takes the relic pool's size as a knob (`relicPoolSize` decides
the boon cells), and session 28 PR 4 grew the pool from 16 to 41. Rows
whose towers stood on boon ground changed; rows that did not, did not
(the Bastion row is 16.3 in both). The reference build, Railbore line +
Frost + Mortar at the choke, reads **13.8** on the new boards against
16.3 on the old. Compare rows within this file, not across files.

## The relic sets (7×5, the 1080p board)

The reference build with six held relics, drawn by a seeded generator
from the pool minus consumables (the lab never uses one) and fusion-only
relics, at a rarity that cycles common, rare, epic across the sets.

| set | relics (rarity) | death mean |
|---|---|---|
| ref | no relics | 13.8 |
| 1 | cold_snap (c), thick_walls (c), frostbite (c), cheap_upgrades (c), splinter (e), salvage_rights (c) | 19.3 |
| 2 | bulk_order (r), grounding_rod (r), quarry (r), foundry (r), bloodstone (r), long_fuse (r) | 18.8 |
| 3 | salvage_rights (e), overflow (e), orbital (e), ricochet (e), bounty_board (e), toll (e) | 17.8 |
| 4 | kindling (r), cold_snap (c), vein_tap (r), wide_net (c), grounding_rod (c), frost_nova (c) | 16.5 |
| 5 | cold_snap (r), frost_nova (r), scavenger (r), long_fuse (r), overflow (r), ricochet (r) | 17.8 |
| 6 | bulk_order (e), stasis (e), kindling (e), iron_will (e), tithe (e), second_wind (e) | 18.8 |
| 7 | salvage_rights (c), foundry (r), loadbearing (e), tithe (c), prospectors_eye (r), cheap_upgrades (c) | 17.3 |
| 8 | kindling (r), deep_vein (r), thick_walls (r), toll (r), second_wind (r), quarry (r) | 19.0 |

**Spread across eight sets: 16.5 to 19.3**, reference 13.8. Daniil's
target band (2026-09-06) was 16 to 24 for a reference build with six
random relics; every set lands in it, none passes 24 on every seed. Six
relics are worth three to five and a half waves over none, and the set's
composition is worth under three waves — the layer is bounded. What the
lab cannot see: actives fired well (it never fires one), consumables,
combining, and the passive layer (the lab holds no passives).

## The instruments sweep, rerun with the distance term

`inline` now scores road covered **minus a quarter of the corridor's
route distance** to the Core, so a Laser goes to the choke instead of the
longest empty run (the debt entry from the instruments sweep).

| build | death mean | crowd kills | all kills |
|---|---|---|---|
| **Laser line, aimed + Frost + Railbore** | **27.0** *(18.5 this morning, on the old boards; 13.8 in session 27)* | 1015 | 1969 |
| Railbore, then Bastion (adjacent), then three Railbores | 16.3 | 381 | 675 |
| both types | 15.8 | 385 | 675 |
| KINETIC only | 14.8 | 314 | 544 |
| ENERGY only | 14.3 | 325 | 566 |
| Tesla + Bastion (adjacent) + Frost | 14.0 | 325 | 550 |
| Railbore line + Frost + Mortar (reference) | 13.8 | 295 | 505 |
| Missiles + Bastion (adjacent) + Railbore | 12.8 | 251 | 425 |
| Hailstorm (close quarters) line + Frost + Mortar | 12.3 | 237 | 399 |

**The Laser at the choke is the strongest thing in the game by a wide
margin**: 27 against 16 for the next build, and it clears three times the
crowd bodies. Three things stacked: no range (the whole straight run),
the burst pulse (a body dies inside the corridor instead of walking out
of a stream), and now the placement instrument that puts it where every
lane ends. This is Daniil's call, said this morning and repeated here
with the bigger number — the honest knobs are the pulse's damage (20 →
14 would put the card at 14 dps) or the heat ceiling (×2 → ×1.5), and
the lab is the ruler for either.
