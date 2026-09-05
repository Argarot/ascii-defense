# Catalogue - what is in the game

> **Daniil's reading table** (session 25, 2026-09-05). The sections marked
> *generated* are rendered from content by `node tools/codex.mjs` and CI
> refuses a stale copy; edit the JSON, not the table. The **PROPOSED**
> tables at the end are yours: add a row with a name and what it does, and
> it is a request - when it ships, it appears above by itself.

## Towers *(generated)*

<!-- generated:towers -->
6 towers in `packages/content/assets/towers/roster.json`. Rate is shots per second; DPS is base damage times rate; range is in cells (a cell is one tower's footprint).

| Tower | id | Cost | Range | Rate | Damage | DPS | Shape / production |
|---|---|---|---|---|---|---|---|
| **Bolt Turret** | bolt | 20 | 6 | 1.43 | 8 | 11.4 | homing shot |
| **Mortar** | mortar | 35 | 7 | 0.50 | 10 | 5 | ballistic shell (aim committed at fire time), blast r1.2, dead zone r2.5 |
| **Refinery** | refinery | 30 | 0.5 |  |  |  | 1 Ore / 40 s |
| **Frost Emitter** | frost | 25 | 3.5 | 0.83 |  | 0 | pulse: hits everything in range at once |
| **Tesla Coil** | tesla | 40 | 4 | 1 | 9 | 9 | chain: arcs to 3 bodies within 2.5 cells of each other, 70% per hop |
| **Missile Rack** | missile | 50 | 9 | 0.33 | 30 | 10 | homing shot, blast r1, dead zone r2 |

#### Bolt Turret - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Marksman** | 25 | Reach: +2.5 range. Covers more road from the same cell. | range +2.5 |
| T1 | **Gatling** | 25 | Throughput: fires twice as often, -1 range. More shots at fewer cells. | fireEveryTicks -7, range -1 |
| T2 | **Piercing** | 55 | Each shot passes through its target into up to 2 more enemies behind it. The answer to a column. | pierceCount +2 |
| T2 | **Shatter** | 55 | Double damage to shields. The answer to shellbacks. | shieldMul +1 |
| T3 | **Railbore** | 120 | One massive round: +22 damage, and armour does nothing against it. The answer to brutes. | damage +22, unlocks ignoreArmor |
| T3 | **Hailstorm** | 120 | Three homing shots per volley at 60% damage each, each at a different enemy when there is one. More total damage, across the crowd. | shots +2, damageMul +0.6, spread +0.6 |

#### Mortar - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Shaped Charge** | 30 | Focused payload: +12 damage in a blast 0.3 cells smaller. Kills the few. | damage +12, explodeRadius -0.3 |
| T1 | **Wide Burst** | 30 | Wider blast: +0.6 cells of radius at 85% damage. Wounds the many. | explodeRadius +0.6, damageMul +0.85 |
| T2 | **Long Barrel** | 65 | Reach: +2 range, but the dead zone grows by 1. Sit it back from the road. | range +2, minRange +1 |
| T2 | **Short Fuse** | 65 | Close work: the dead zone shrinks by 1.5, range -1. Sit it right on the road. | minRange -1.5, range -1 |
| T3 | **Concussive** | 140 | The blast slows everything it hits to 60% for a second. Control, not just damage. | slowMul -0.4, slowTicks +20 |
| T3 | **Cluster** | 140 | Three shells per volley at 60% damage each, scattered around the aim point. Saturation. | shots +2, damageMul +0.6, explodeRadius -0.3, spread +0.7 |

#### Refinery - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Wide Bore** | 30 | 2 Ore per cycle, but a cycle takes 60 s instead of 40. More Ore sooner; the vein empties sooner. | production +1, productionEveryTicks +400 |
| T1 | **Deep Bore** | 30 | The vein under it grows by half, and every cycle takes 60 s. Less now, more in the end - for the patient. | productionEveryTicks +400, unlocks deepBore50 |
| T2 | **Survey** | 60 | Every Survey refinery speeds up ALL rock-breaking jobs, everywhere. | unlocks surveySpeed |
| T2 | **Automation** | 60 | Prospects nearby rocks by itself, free, one job at a time. | unlocks surveyAuto |
| T3 | **Mother Lode** | 120 | +2 Ore per cycle. The vein pays out fast and runs dry fast. | production +2 |
| T3 | **Deep Shaft** | 120 | The vein under it doubles, and every cycle takes 40 s longer. The long game - only if you can hold this ground. | productionEveryTicks +800, unlocks deepBore100 |

#### Frost Emitter - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Deep Chill** | 25 | Colder: slowed enemies move at 40% instead of 55%, for 10 ticks longer. The slow path. | slowMul -0.15, slowTicks +10 |
| T1 | **Ice Shards** | 25 | The field cuts: +4 damage per pulse to everything inside it. The damage path. | damage +4 |
| T2 | **Wide Field** | 55 | Bigger field: +1.5 range to the chill. More road under the slow. | range +1.5 |
| T2 | **Brittle** | 55 | This field's pulses deal +50% to anything already slowed. Chill first, then cut. | slowedBonusMul +0.5 |
| T3 | **Absolute Zero** | 120 | Every fourth pulse freezes the field solid: enemies stop dead for the slow's duration. | freezeEvery +4 |
| T3 | **Shatterfield** | 120 | +14 damage per pulse. The field becomes a weapon. | damage +14 |

#### Tesla Coil - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Long Arc** | 40 | Reach: +1.5 range. The first arc finds bodies further out. | range +1.5 |
| T1 | **Twin Coil** | 40 | Throughput: arcs every 12 ticks instead of 20. More arcs, the same bite. | fireEveryTicks -8 |
| T2 | **Forked** | 80 | Every arc hits two more bodies. The answer to a column. | chainCount +2 |
| T2 | **Grounding** | 80 | Bodies the arc touches slow to 60% for 15 ticks. Control on a chain. | slowMul -0.4, slowTicks +15 |
| T3 | **Overload** | 160 | +16 damage on the first hop, and every hop after it. The answer to brutes. | damage +16 |
| T3 | **Conductor** | 160 | Three more bodies per arc, hops span two more cells, at 80% damage. The answer to swarms. | chainCount +3, chainReach +2, damageMul +0.8 |

#### Missile Rack - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Warhead** | 50 | +20 damage per missile. Kills the one it was sent for. | damage +20 |
| T1 | **Seeker** | 50 | Reach: +2 range, and a missile every 50 ticks instead of 60. | range +2, fireEveryTicks -10 |
| T2 | **Salvo** | 100 | Two missiles per launch at 75% damage, each homing on a different enemy when there is one. | shots +1, damageMul +0.75 |
| T2 | **Fragmentation** | 100 | Blast +0.6 cells at 85% damage. Wounds the many. | explodeRadius +0.6, damageMul +0.85 |
| T3 | **Bunker Buster** | 200 | +40 damage, and armour does nothing against it. The answer to a Juggernaut. | damage +40, unlocks ignoreArmor |
| T3 | **Barrage** | 200 | Three missiles per launch at 60% damage each. Saturation from range. | shots +2, damageMul +0.6, spread +0.8 |

<!-- /generated -->

## Enemies *(generated)*

<!-- generated:enemies -->
7 enemies in `packages/content/assets/enemies/roster.json`. Speed is cells per second; breach is the Core health lost when one arrives; "from wave" is the first wave that may roll it. Every enemy walks the road; there are no flyers (PRD §8).

| Enemy | id | HP | Speed | Breach | Bounty | From wave | Armour | Shield | Traits |
|---|---|---|---|---|---|---|---|---|---|
| **grunt** | grunt | 30 | 1.20 | 1 | 4 | 1 |  |  |  |
| **skitter** | skitter | 12 | 2.40 | 1 | 3 | 2 |  |  | fast |
| **swarmling** | swarmling | 6 | 2.80 | 1 | 1 | 3 |  |  | swarm, fast |
| **brute** | brute | 90 | 0.90 | 3 | 8 | 4 | 3 |  | armoured |
| **shellback** | shell | 25 | 1.20 | 2 | 7 | 5 |  | 30 | shielded |
| **husk** | husk | 160 | 0.70 | 5 | 12 | 6 |  |  |  |
| **Juggernaut** | juggernaut | 400 | 0.60 | 12 | 20 | 10 | 6 |  |  |

**Traits are rules** (`packages/engine/src/sim/traits.ts`):

| Trait | Rule |
|---|---|
| armoured | immune to slows; armour is subtracted from every hit (Railbore ignores it) |
| shielded | a shield pool burns before hp and REGENERATES after 2 s unhit - focus fire |
| fast | slows last half as long |
| swarm | spawns in packs of three - one queue entry, three bodies |
<!-- /generated -->

## Relics *(generated)*

<!-- generated:relics -->
16 relics in `packages/content/assets/relics/pool.json`. Passives work while held; actives are clicked in the strip and recharge; consumables are one use. "Stacks" means a second copy adds (a second charge for actives).

| Relic | id | Kind | Stacks | Recharge | What it does | Data |
|---|---|---|---|---|---|---|
| **Overflow** | overflow | passive |  |  | Overkill damage chains to the nearest enemy. Chain kills chain again. | overkillCarry true |
| **Frostbite** | frostbite | passive | yes |  | Slowed enemies take +50% damage from everything. Stacks. | slowedDamageMul 1.5 |
| **Tithe** | tithe | passive | yes |  | Every kill refunds 2 Scrap. Stacks. | killRefundScrap 2 |
| **Splinter** | splinter | passive |  |  | Explosions detonate twice. | explodeTwice true |
| **Vein Tap** | vein_tap | passive |  |  | You may build on rock. | buildOnRock true |
| **Loadbearing** | loadbearing | passive |  |  | Towers touching the Core block get triple range. | coreAdjacentRangeMul 3 |
| **Second Wind** | second_wind | passive |  |  | The Core mends 2 health every time a wave launches. | coreHealPerWave 2 |
| **Quarry** | quarry | passive |  |  | Rock breaks three times faster - every prospect job, everywhere. | prospectSpeedMul 3 |
| **Toll** | toll | passive | yes |  | Every enemy pays 1 Scrap for each cell it walks beside a tower. Stacks. | tollScrap 1 |
| **Bounty Board** | bounty_board | passive |  |  | Bosses pay half again as much Scrap. | bossBountyMul 1.5 |
| **Orbital Lance** | orbital | active | yes | 90 s | Strike anywhere: 400 damage in a 3-cell blast. Recharges slowly. A second copy is a second charge. | orbitalDamage 400, orbitalRadius 3 |
| **Stasis Field** | stasis | active | yes | 120 s | Freeze every enemy for 4 seconds. Towers keep firing. A second copy is a second charge. | freezeTicks 80 |
| **Deep Vein** | deep_vein | active | yes | 120 s | Refineries produce five-fold for 20 seconds. A second copy is a second charge. | productionMul 5, boostTicks 400 |
| **Sandbags** | sandbags | consumable | yes |  | Use: the Core gains 15 health, and 15 to its maximum. One use. | coreHpAdd 15 |
| **Flashbang** | flashbang | consumable | yes |  | Use: every enemy freezes for 2 seconds. One use. | freezeTicks 40 |
| **Ore Pocket** | ore_pocket | consumable | yes |  | Use: 20 Ore, right now. One use. | oreAdd 20 |
<!-- /generated -->

## PROPOSED - the request queue *(hand-edited, never touched by the generator)*

One row per thing. "What it does" in a sentence; the numbers can come later.
Status is yours to keep or ignore.

### Towers

| Name | Role / shape | What it does | Status |
|---|---|---|---|
| Laser | line, faces a direction (WBS 2.34) | a beam down a straight run of road, damage ramps while it holds one target | proposed (PRD §5.3) |
| Area tower | short-range area | hits everything in a small ring around itself, no projectile | proposed (PRD §5.3) |
| Support tower | aura | improves the towers around it | proposed (PRD §5.3) |
| Acid Sprayer | DoT, armour shred | Corrosion / Volatility / Saturation | PRD §5.3 (M4) |
| Bastion | buff aura | Command / Logistics / Fortify | PRD §5.3 (M4) |
| Rail Lance | long-range line pierce | Focus / Penetration / Overwatch | PRD §5.3 (M4) |

### Enemies

| Name | What it does | Counter | Status |
|---|---|---|---|
| *(add rows)* | | | |

### Relics

| Name | Kind | What it does | Status |
|---|---|---|---|
| Foundry | consumable | a Refinery off the vein produces Scrap | PRD §7.4, not in the pool |
