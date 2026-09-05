# Build sweep — damage types with resistances (2026-09-05, session 26 PR 1)

`node tools/build-sweep.mjs` · Standard curve · seeds 945046, 12345, 777, 2024 ·
horizon 24 waves · 100 starting scrap, the lab buying towers then tiers ·
placement at the choke. Death wave per seed; higher is later.

Three new builds sit beside the session-24 set: **kinetic only** (three
Railbore Bolts, a Mortar, a Missile Rack), **energy only** (three Teslas,
two Frosts on the Shatterfield path) and **both types** (two Railbores, a
Tesla, a Frost, a Mortar).

## Run 1 — the first matrix (resists ×0.5, weak ×1.5, juggernaut ×0.75 both)

| board | kinetic only | energy only | both types | Railbore + Frost + Mortar (session 24's reference) |
|---|---|---|---|---|
| 7×4 | 10.5 | 11.5 | 12.8 | 10.5 |
| 7×5 | 12.0 | 11.5 | 12.5 | 13.5 |
| 12×7 | 14.0 | 16.0 | 17.3 | 15.0 |

The reference build had reached **19–23** on the 1080p boards the day
before. A ×0.5 on brutes and swarmlings against a kinetic-heavy build, and
a boss that resisted both types, took five to nine waves off every build
without giving the right answer anything back. A finding, not a fix: the
first matrix was a nerf wearing a matrix's clothes.

## Run 2 — the shipped matrix (resists ×0.6, weak ×1.4–1.6, juggernaut ×0.8 kinetic / ×1.2 energy)

| build | 7×4 | 7×5 | 12×7 |
|---|---|---|---|
| kinetic only | 15.3 | 15.0 | 19.0 |
| energy only | 14.3 | 14.5 | 17.3 |
| both types | 14.8 | 15.8 | 19.5 |
| Railbore + Frost + Mortar (reference) | 15.3 | 16.3 | 20.5 |
| spread, reference build | 10.3 | 12.3 | 15.5 |
| Hailstorm 60% / 75% | 11.8 / 11.8 | 11.8 / 11.8 | 15.0 / 15.0 |
| unlimited scrap (capability) | 18.5 | 19.0 | 21.5 |

Per seed on 7×5: kinetic only 19 · 12 · 17 · 12; energy only 18 · 15 · 17 · 8;
both types 19 · 18 · 17 · 9; reference 19 · 12 · 22 · 12.

## Readings

- **No single type clears wave 15 on the 1080p boards** on average (15.0
  and 14.5), though one seed lets a kinetic line reach 19: the gate as
  stated is met on the mean, not on every seed.
- **A mixed build beats a solo one by about one wave**, not five. The
  waves are mostly grunts and skitters, which take every type at ×1; the
  typed bodies (brute, shellback, husk, swarmling, juggernaut) are a
  minority of any wave until late. Types decide *those* fights; they do
  not yet decide the run. Making them decide the run means either
  immunities (a brute that kinetic cannot touch) or waves composed around
  a type — a design question for Daniil, and a 10-second sweep per answer.
- **The ramp is about three waves harder than yesterday** for the same
  build (16.3 vs 19–23 on 7×5). Resistances subtract more than weaknesses
  add because the wrong answer is what a build usually has most of. If
  Daniil wants yesterday's feel back, the knob is the Standard ramp
  (`protocol.ts` hpGeometric), not the matrix.
- **Hailstorm is still a role problem** (2.37): both multipliers tie at
  11.8 behind Railbore's 16.3.
