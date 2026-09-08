# The tile library's breadth — the enumerator and the map sweep (2026-09-08, session 33, PR 6)

`node tools/tilegen.mjs` (the library) · `node tools/map-sweep.mjs 40` (the
guard). The plan asked for "the generator's hundred": about eighty new
5×5 road shapes by partition class, named by family, with a carve sweep on
forty seeds as the guard.

## What the enumerator found

The 5×5 grid holds **nine legal routing shapes** under the one law that
decides what is special (a road that touches itself without merging, or
two segments in a tile, is a SPECIAL - chosen, never rolled): every
self-avoiding, non-touching path between edge ports was walked
exhaustively (51 north-south paths, 83 north-east; the validator keeps
five and ten; mirror and rotation fold them to three and six), and the
junction classes add nothing the hand-authored tee and cross do not
already carry. Four of the nine were already in the library; **five are
new** (all meanders). A hundred routing shapes on a 5×5 tile is not a
thing the law allows; the old wander found the same nine by luck.

So the breadth is **the land**: forty filler tiles (scree, outcrops, veins
in many shapes, ore inside the rock) and twenty decorated roads (every
routing shape with rock and a vein beside it - a cliff bend for every
bend), all deduped by mirror and rotation, all validated, ids stable
(`t_<sig>_<n>`, `f_<n>`, `<base>r<k>`) and the generator idempotent. The
library goes from seventeen tiles to **eighty-two**; the hand tiles and
the old wander's `gen_` tiles (which saves may own) are untouched.

## The map sweep — forty seeds per Threat on the app's 7×5 board


| threat | carved | coverage mean (min) | entries mean (min-max) | path floor mean (cells) | tile ids used | failures |
|---|---|---|---|---|---|---|
| Calm | 40/40 | 0.86 (0.69) | 7.60 (3-9) | 0.00 | 75 | 0 |
| Standard | 40/40 | 0.85 (0.71) | 8.88 (3-11) | 1.75 | 75 | 0 |
| Grim | 40/40 | 0.83 (0.69) | 10.15 (4-12) | 0.00 | 75 | 0 |

Before this PR the same sweep used **15 distinct tile ids** per Threat;
now **75**. Coverage and entries are the carve's and did not move (the
road shapes are the same nine); no seed failed on any Threat. The path
floor reads 0 where the carve reports best-effort (the board clamp), as
before.

## What it means for "two runs do not resemble each other"

The road's SHAPES are a closed set of nine, so the eye's variety must
come from the land and from the carve: where the roads run (the walk),
what stands beside them (sixty new land tiles), and the specials a player
chooses. The register's next lever is the carve itself (lane length and
turn preference by Threat), not the shape count.
