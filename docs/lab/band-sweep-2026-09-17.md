# Band sweep — what a rarity band buys (2026-09-17; PRD §28.1, D34)

`node tools/build-sweep.mjs --bands` · board 7×5 · Standard curve · economy
100 Scrap · the reference build (Railbore line + Frost + Mortar at the choke)
with **six held relics** · eight seeded sets per band × seeds 945046, 12345,
777, 2024 · horizon 40.

The reliquary sells two things now — the RARE band and the EPIC band — and
"what should a band cost" is a question the lab can answer (CONTRIBUTING §6
rule 7), so it was asked of the lab and not of Daniil.

## The target

**A band is priced like the power it buys, against the nodes beside it.** The
arsenal is the yardstick: the Laser, the most a tower node costs, is 40
tier-1 Ore. A band worth about a wave or two belongs at one to two runs of
income; a band worth less should cost less, in whatever purse.

## The reading

Each set is drawn from the pool the band allows (no rare-only relic before
the rare band) and held two ways: every relic **at** the band's rarity — the
ceiling a band can buy — and at **the offer's own mix** capped by the band
(`Sim.rollRarity` read at wave 10: common 50, rare 30, epic 15 of 95).

| band bought | reading | mean death wave | min – max over sets | vs no band |
|---|---|---|---|---|
| none (commons only) | every relic common | 26.7 | 24.8 – 29.5 | – |
| RARE | the offer's mix, capped | 27.9 | 25.3 – 29.8 | +1.2 |
| RARE | every relic rare (ceiling) | 28.6 | 25.8 – 31.3 | +1.9 |
| EPIC | the offer's mix, capped | 27.3 | 24.8 – 29.8 | +0.7 |
| EPIC | every relic epic (ceiling) | 28.4 | 24.8 – 34.0 | +1.8 |

## What it says

- **The rare band is worth a wave or two** (+1.2 as dealt, +1.9 at the
  ceiling). Priced at **60 tier-1 Ore**: about one and a half runs of income,
  half again the Laser. It is the first reliquary purchase and the one a
  player feels.
- **The epic band adds almost nothing on average and a great deal
  sometimes.** Its mean sits *inside* the rare band's (27.3 / 28.4 against
  27.9 / 28.6 — the sets differ, so the difference is noise), but its best
  set reaches **34.0** where rare's best is 31.3. It buys variance: the run
  where three epics line up. Priced at **20 tier-2 Ore** — one lucky find, or
  about three average runs after Rich veins — and it is the first thing
  tier-2 Ore buys that is not more Ore.
- **A finding for the balance pass, not for this PR:** the reference build
  with six *common* relics dies at **26.7**. Session 28 bounded the relic
  layer at 16.5–19.3 against a target band of 16–24; session 32 then re-curved
  Standard so the *bare* reference dies at 22–24, and nobody re-read the relic
  layer on top of it. Six relics are worth about three waves over the bare
  reference here. PR 5 of this session re-measures the reference and states
  the target again.

## The instrument

`--bands` in `packages/harness/src/lab/buildSweep.ts`: `bandSet(n, band,
mixed)` draws six relics by the relic sweep's own seeded LCG from the pool a
band allows, and sets each one's rarity to the band or to the capped mix.
