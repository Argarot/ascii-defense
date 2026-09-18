# The energy door — armour's mirror (2026-09-18, D38)

`node tools/fit.mjs [--patch=file.json] [--seeds=N] [--plans=...]` · the app's
own maps, 7×5 · 80 seeds a row while searching, 120 for the confirmation.
The sequel to [damage-model-2026-09-18.md](damage-model-2026-09-18.md), written
the same evening.

**The question.** D37's damage model gave KINETIC a flat per-hit counter —
armour, and plating on every body from wave 6 — and sent every ENERGY hit
through both untouched. It proved plain-Bolt spam dead on sixteen rungs and
never played one rung of energy width. Daniil named the hole in one reading
(D38): *"there need to be foes that do opposite - ignore significant amount of
energy damage, while physical one is effective against it. So
tesla/laser/chill spam is not as effective."*

**The answer, in one table** (120 seeds, shipped as of this document; the
"before" column is 80 seeds):

| | before | after |
|---|---|---|
| Ice Shards spam, no relics — Standard / Grim | 21% / 3% | **2% / 0%** |
| plain Bolt spam, the same rungs *(unchanged — the kinetic twin)* | 4% / 0% | 3% / 0% |
| Ice Shards spam holding the tree's six epics — Grim | 94% | **25%** |
| plain Bolt spam holding the same — Grim | 0% | 2% |
| Tesla spam / Laser spam — Standard | 0% / 5% | 0% / 4% |
| the mixed line, depth first — Standard | 96% | **89%** |
| mono-Frost, depth first, base world — Standard / Grim | 76% / 29% | 32% / 5% |
| the base world's mixed line — Grim | 13% | 10% |
| tree: mono-energy against the mixed line — Grim | 95% : 99% | **84% : 98%** |
| the same two lines holding nothing — Grim | 9% : 25% | **2% : 18%** |

## Targets, stated before any number was measured

They are the plan's (docs/ROADMAP.md, "The next session", PR 0), written on
2026-09-18 before the first rung was played.

| # | target | reads |
|---|---|---|
| E1 | Energy spam: Standard ≤ 10%, Grim never — like plain Bolts | **2% / 0%** (Ice Shards), 0% / 0% (Tesla), 4% / 0% (Laser). **Met** |
| E2 | The mixed line still wins Standard 85–95% | **89%. Met** — mid-band, where D37 had fitted it to the top (93%) on purpose. Not re-fitted: see "Not done" |
| E3 | A mono-energy tree build loses to a mixed one on Grim | **84% against 98%** holding six epics; **2% against 18%** holding nothing. **Met** |

One reading that is **not** a target, and is recorded so nobody mistakes it
for one: Ice Shards width holding six epic relics still wins Grim **25%**. Its
kinetic twin wins 2%. What is left is a slow field seventy towers deep under
an epic Deep Cold, and the rule that a hit is never below 1. It is a band in
the gate (E2-tree-frost-spam) so that it cannot drift back up unseen.

## The rungs — what was never played

All in `packages/harness/src/lab/fit.ts`, with their story in the comment:

- `frostSpam` — Ice Shards and no further (75 + 15 Scrap, a 4-damage energy
  hit and a slow), as many as Scrap allows. The base world's own rung.
- `teslaSpam`, `laserSpam` — a Tesla (210) and a Laser (330) cost more than
  the purse, so the plan opens the way a person would — three plain Bolts —
  and every Scrap after that goes wide on the one tower.
- `treeSpam`, `treeFrostSpam`, `treeTeslaSpam`, `treeLaserSpam` — the same
  width holding the tree's six epic relics. `treeSpam` is the kinetic twin:
  without it, the tree rows have nothing to be read against.
- `frostDeep`, `treeEnergyDeep` — mono-energy played depth first, like the
  `*Deep` plans, so that only the towers differ and not the order.
- `bareEnergyDeep`, `bareMixedDeep` — the same two tree lines holding
  **nothing**. On Grim six epic relics win for whatever stands under them
  (every line that upgrades reads 98–99%), so "mono-energy loses to mixed" can
  only be read where the towers are all there is.

**The number before the fix.** Tesla and Laser spam were already dead (0–5%) —
but from their *price*, a 210-Scrap chassis for a 9-damage hit, not from any
counter; that is #366's subject, not this one's. **The door was Frost-shaped:**
Ice Shards spam won Standard five times as often as Bolt spam (21% : 4%), and
holding the tree's relics it won Grim 94% where Bolts won none. Mono-Frost won
the base world's Grim 29% — more than the reference line D37 had just fitted to
lose it (13%).

## How it was found — five rounds, one kind of change each

| | shipped | 1 kinds | 2 twin | 3 both | 4 heavy kinds | **5 no harrier** |
|---|---|---|---|---|---|---|
| Standard, Ice Shards spam | 21% | 10% | 3% | 1% | 10% | **3%** |
| Standard, mono-Frost deep | 76% | 65% | 70% | 32% | 25% | **37%** |
| Standard, the mixed line | 96% | 95% | 89% | 89% | 95% | **90%** |
| Grim, Ice Shards spam + epics | 94% | 70% | 28% | 28% | 70% | **28%** |
| Grim, mono-energy : mixed, + epics | 95 : 99 | 93 : 99 | 90 : 98 | 85 : 98 | 88 : 99 | **84 : 98** |
| Grim, mono-energy : mixed, bare | 9 : 25 | – | 1 : 19 | 1 : 20 | 1 : 25 | **1 : 19** |

1. **Kinds alone** — insulation on the four bodies kinetic is effective
   against (shellback 2, harrier 2, husk 4, buckler 4). It halves Standard's
   spam and leaves the tree's at 70%: those four already resist energy ×0.4–0.6,
   so a 4-damage hit was 1.6 on them before and is 1 now. Spam was never
   winning *through* them; it wins through everything else.
2. **The twin alone** — `insulating`, plating's own ramp, for energy hits. It
   does what plating did to Bolts, for the same reason.
3. **Both.** What the kinds add is not against spam but against *depth*:
   mono-Frost falls 70% → 32% on Standard, which is D38's sentence — a body
   that energy is the wrong answer to, however finished the tower.
4. **Heavier kinds, no twin** (4 / 3 / 8 / 8). Identical to round 1 against
   spam — a 4-damage hit is already at the floor — so the kinds cannot close
   the door at any value. The twin is not optional.
5. **The harrier stays as it was.** Its trait is *sprints while unhit*, and its
   answer on the panel is "keep it under fire - arcs, a beam": an insulated
   harrier would contradict its own card. The table barely notices (round 3
   against round 5).

**The shipped game was then diffed against round 5 through the harness with no
patch: 18 rows, 0 differ.**

## What shipped

- `COMBAT_RULES.insulating = { from: 6, every: 3, add: 1 }` — plating's twin,
  the same steps. `EnemyDef.insulation` — armour's mirror: a flat amount off
  every ENERGY hit, after the resistance, under the same floor (15%, never
  below 1). Kinetic never meets it; energy still goes through a body's own
  *armour* (brute, Juggernaut, Warden).
- **husk 4, buckler 4, shellback 2.** A content test holds the mirror: an
  insulated body wears no armour and does not resist kinetic; an armoured one
  does not resist energy.
- **The game says so.** Because the two ramps are the same ramp, the player
  reads ONE number: the panel says *"PLATED +2: every hit loses 2 more - hit
  big"* (it said *"every kinetic hit … or use energy"*), and the strip's
  header is unchanged. An insulated kind shows `insulated` / `%%` on the
  strip, its answer is *"energy slides off; hit big, or use kinetic"*, its
  card and codex page print the number and the rule, and the catalogue has
  the column. The codex still READS the rules from the engine's source.
- The authoring surface, in the same PR: `enemies.schema.json`, the generated
  types, the fit harness's patch (`"enemies": { "husk": { "insulation": 4 } }`,
  `"rules": { "insulating": … }`).
- Four new bands in the gate (E1 ×2, E2, E3); both thermometers moved (one of
  the probe's six towers is a Frost with Shatterfield).
- The golden replay hash did **not** move (its world wears no insulation and
  is over before wave 6).

## Not done, said plainly

- **Standard's mixed line reads 89%, not 93%.** D37 fitted it to the top of
  its band on purpose ("a person buys later and places worse"). It is inside
  the band the plan held this PR to, and it was not re-fitted here because the
  arsenal (#366) moves the same number next and a curve fitted twice is a
  curve fitted once too often. If #366 leaves it under 90%, Standard's rate
  comes down a hundredth.
- **Ice Shards width with six epics, 25% on Grim** — above. If that is too
  much, the lever is the relic (Deep Cold's epic tier), not the damage model.
- **Tesla and Laser were not touched.** Their spam is dead from price; whether
  their *finished* forms earn their Ore under a rule that now blunts them is
  #366, and is why this PR came first.
- **A burn is a hit.** A Laser's Sear ticks 2 a tick through `applyDamage`, so
  from wave 6 plating takes it to 1 (the floor of "never below 1"): halved,
  never less. Kinetic burns have met armour the same way since they existed.
  Read again under #366.
- **The human offset**, still: every rate here is the lab's player.
