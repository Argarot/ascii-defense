# Variant sweep — 2026-09-05, after the ramp came down a notch

Daniil, after the 8×5 playtest: "dial down the difficulty ramp, with the
smaller map it is almost impossible" and, next morning, "still tune the
difficulty down a bit". Applied: `hpLinear` 0.18 → 0.15 (all threats),
Standard `hpGeometric` 1.06 → 1.05, Grim 1.08 → 1.07. Bolt shots also fly
faster (0.5 → 0.8 cells per tick; a look change with a small timing effect).
Same method as the two 2026-09-04 sweeps.

variant sweep · Standard curve · 5 towers per build · seeds 945046, 12345, 777, 2024 · horizon 40

## board 12x7

| tower | path | death @945046 | death @12345 | death @777 | death @2024 | mean |
|---|---|---|---|---|---|---|
| bolt | Marksman / Piercing / Railbore | 8 | 6 | 9 | 21 | 11.0 |
| bolt | Marksman / Piercing / Hailstorm | 7 | 6 | 8 | 13 | 8.5 |
| bolt | Marksman / Shatter / Railbore | 7 | 6 | 9 | 16 | 9.5 |
| bolt | Marksman / Shatter / Hailstorm | 7 | 6 | 8 | 12 | 8.3 |
| bolt | Gatling / Piercing / Railbore | 7 | 6 | 9 | 24 | 11.5 |
| bolt | Gatling / Piercing / Hailstorm | 7 | 6 | 8 | 16 | 9.3 |
| bolt | Gatling / Shatter / Railbore | 7 | 6 | 9 | 18 | 10.0 |
| bolt | Gatling / Shatter / Hailstorm | 7 | 6 | 7 | 13 | 8.3 |
| mortar | Shaped Charge / Long Barrel / Concussive | 9 | 5 | 7 | 9 | 7.5 |
| mortar | Shaped Charge / Long Barrel / Cluster | 8 | 5 | 7 | 9 | 7.3 |
| mortar | Shaped Charge / Short Fuse / Concussive | 10 | 5 | 7 | 12 | 8.5 |
| mortar | Shaped Charge / Short Fuse / Cluster | 9 | 5 | 7 | 10 | 7.8 |
| mortar | Wide Burst / Long Barrel / Concussive | 10 | 5 | 8 | 12 | 8.8 |
| mortar | Wide Burst / Long Barrel / Cluster | 9 | 5 | 8 | 12 | 8.5 |
| mortar | Wide Burst / Short Fuse / Concussive | 9 | 5 | 7 | 13 | 8.5 |
| mortar | Wide Burst / Short Fuse / Cluster | 9 | 5 | 8 | 12 | 8.5 |
| frost | Deep Chill / Wide Field / Absolute Zero | 6 | 5 | 5 | 6 | 5.5 |
| frost | Deep Chill / Wide Field / Shatterfield | 7 | 13 | 8 | 19 | 11.8 |
| frost | Deep Chill / Brittle / Absolute Zero | 6 | 5 | 5 | 6 | 5.5 |
| frost | Deep Chill / Brittle / Shatterfield | 7 | 12 | 8 | 18 | 11.3 |
| frost | Ice Shards / Wide Field / Absolute Zero | 7 | 10 | 7 | 11 | 8.8 |
| frost | Ice Shards / Wide Field / Shatterfield | 7 | 14 | 8 | 23 | 13.0 |
| frost | Ice Shards / Brittle / Absolute Zero | 7 | 10 | 7 | 11 | 8.8 |
| frost | Ice Shards / Brittle / Shatterfield | 7 | 13 | 8 | 21 | 12.3 |

bolt: no path dominates every seed

mortar: no path dominates every seed

frost: DOMINANT on every seed: Ice Shards / Wide Field / Shatterfield

## board 7x5

| tower | path | death @945046 | death @12345 | death @777 | death @2024 | mean |
|---|---|---|---|---|---|---|
| bolt | Marksman / Piercing / Railbore | 19 | 18 | 9 | 15 | 15.3 |
| bolt | Marksman / Piercing / Hailstorm | 13 | 12 | 8 | 11 | 11.0 |
| bolt | Marksman / Shatter / Railbore | 13 | 12 | 8 | 11 | 11.0 |
| bolt | Marksman / Shatter / Hailstorm | 10 | 9 | 7 | 8 | 8.5 |
| bolt | Gatling / Piercing / Railbore | 19 | 17 | 8 | 16 | 15.0 |
| bolt | Gatling / Piercing / Hailstorm | 13 | 12 | 7 | 11 | 10.8 |
| bolt | Gatling / Shatter / Railbore | 13 | 13 | 8 | 13 | 11.8 |
| bolt | Gatling / Shatter / Hailstorm | 12 | 11 | 6 | 8 | 9.3 |
| mortar | Shaped Charge / Long Barrel / Concussive | 8 | 6 | 6 | 5 | 6.3 |
| mortar | Shaped Charge / Long Barrel / Cluster | 7 | 6 | 6 | 5 | 6.0 |
| mortar | Shaped Charge / Short Fuse / Concussive | 10 | 8 | 6 | 5 | 7.3 |
| mortar | Shaped Charge / Short Fuse / Cluster | 8 | 7 | 6 | 5 | 6.5 |
| mortar | Wide Burst / Long Barrel / Concussive | 9 | 8 | 6 | 5 | 7.0 |
| mortar | Wide Burst / Long Barrel / Cluster | 9 | 7 | 6 | 5 | 6.8 |
| mortar | Wide Burst / Short Fuse / Concussive | 9 | 8 | 6 | 5 | 7.0 |
| mortar | Wide Burst / Short Fuse / Cluster | 9 | 8 | 6 | 5 | 7.0 |
| frost | Deep Chill / Wide Field / Absolute Zero | 5 | 4 | 5 | 4 | 4.5 |
| frost | Deep Chill / Wide Field / Shatterfield | 11 | 13 | 7 | 7 | 9.5 |
| frost | Deep Chill / Brittle / Absolute Zero | 5 | 4 | 5 | 4 | 4.5 |
| frost | Deep Chill / Brittle / Shatterfield | 9 | 11 | 6 | 5 | 7.8 |
| frost | Ice Shards / Wide Field / Absolute Zero | 8 | 8 | 6 | 5 | 6.8 |
| frost | Ice Shards / Wide Field / Shatterfield | 11 | 13 | 7 | 7 | 9.5 |
| frost | Ice Shards / Brittle / Absolute Zero | 6 | 8 | 6 | 5 | 6.3 |
| frost | Ice Shards / Brittle / Shatterfield | 9 | 12 | 6 | 5 | 8.0 |

bolt: no path dominates every seed

mortar: DOMINANT on every seed: Shaped Charge / Short Fuse / Concussive

frost: DOMINANT on every seed: Deep Chill / Wide Field / Shatterfield; Ice Shards / Wide Field / Shatterfield


## Readings against the retune-1 table

- Every build lives about a wave longer on 12×7 and one to two longer on
  7×5 (Railbore lines 15.3 vs 14.0 mean on 7×5; Shatterfield 9.5 vs 9.5).
  A notch, as asked - not a different game.
- The fork verdicts did not move: Hailstorm still loses to Railbore solo,
  Concussive still leads on the Shaped Charge side, Shatterfield still
  dominates solo. The ramp changes the height of the wall, not which tower
  climbs it.
- The board is about to change under all of this (the filled-board mapgen):
  lane lengths and the D18 offset move with it. This table is the "before".
