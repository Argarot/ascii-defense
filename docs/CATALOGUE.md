# Catalogue - what is in the game

> **Daniil's reading table** (session 25, 2026-09-05). The sections marked
> *generated* are rendered from content by `node tools/codex.mjs` and CI
> refuses a stale copy; edit the JSON, not the table. The **PROPOSED**
> tables at the end are yours: add a row with a name and what it does, and
> it is a request - when it ships, it appears above by itself.

## Towers *(generated)*

<!-- generated:towers -->
8 towers in `packages/content/assets/towers/roster.json`. Rate is shots per second; DPS is base damage times rate; range is in cells (a cell is one tower's footprint); a beam's range is the road in front of it, to its turn.

| Tower | id | Cost | Type | Range | Rate | Damage | DPS | Shape / production | What it is | Next to the Core |
|---|---|---|---|---|---|---|---|---|---|---|
| **Bolt Turret** | bolt | 20 | kinetic | 6 | 1.43 | 8 | 11.4 | homing shot | Homing single shots at a steady rate. The all-rounder; its tree picks a job. | every shot passes into one more body. |
| **Mortar** | mortar | 35 | kinetic | 7 | 0.50 | 10 | 5 | ballistic shell (aim committed at fire time), blast r1.2, dead zone r2.5 | Lobs a shell at a place and blasts what stands there. Cannot hit its own feet. | no dead zone - it can hit its own feet. |
| **Refinery** | refinery | 30 |  | 0.5 |  |  |  | 1 Ore / 40 s | Mines the ore vein under it. Builds nothing, shoots nothing, pays for everything. | mines from nothing - 1 Ore a cycle with no vein, forever. |
| **Frost Emitter** | frost | 25 | energy | 3.5 | 0.83 |  | 0 | pulse: hits everything in range at once | A cold field around it slows everything inside. Slows from different sources stack: the coldest wins, the longest lasts. | every third pulse freezes the field solid. |
| **Tesla Coil** | tesla | 40 | energy | 4 | 1 | 9 | 9 | chain: arcs to 3 bodies within 2.5 cells of each other, 70% per hop | An arc that jumps body to body through a pack. Short reach, answers crowds. | every arc hits two more bodies. |
| **Missile Rack** | missile | 50 | kinetic | 9 | 0.33 | 30 | 10 | homing shot, blast r1, dead zone r2 | Slow, heavy homing missiles that explode on arrival. Long reach, a dead zone. | two missiles per launch. |
| **Laser Lance** | laser | 45 | energy | the road | 1 | 20 | 20 | beam: down its facing to where the road turns, however far, every body on it, heat to x2 on a held target (R rotates) | A beam down the road it faces to where the road turns, however far that is, through every body on it: a pulse a second, and the damage climbs while it holds one. R rotates it. | the heat climbs one multiple higher. |
| **Bastion** | bastion | 40 |  | 1.5 |  |  |  | aura: neighbours within 1 cell(s) hit x1.15 | Shoots nothing. Every tower touching it hits harder; its tree makes the ring wider and the gift bigger. | the aura reaches one cell further. |

The two ground cells touching the Core face (and the border cells beside it) are the precious ground of PRD §4.5: a tower there gets the gift in the last column, folded like a tier.

#### Bolt Turret - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Marksman** | 25 | Reach: +2.5 range. Covers more road from the same cell. | range +2.5 |
| T1 | **Gatling** | 25 | Throughput: fires twice as often, -1 range. More shots at fewer cells. | fireEveryTicks -7, range -1 |
| T2 | **Piercing** | 55 | Each shot passes through its target into up to 2 more enemies behind it. The answer to a column. | pierceCount +2 |
| T2 | **Shatter** | 55 | Double damage to shields. The answer to shellbacks. | shieldMul +1 |
| T3 | **Railbore** | 120 | One massive round: +22 damage, and armour does nothing against it. The answer to brutes. | damage +22, unlocks ignoreArmor |
| T3 | **Hailstorm** | 120 | Three homing shots per volley at full damage, each at a different enemy when there is one - but the reach drops to close quarters. Point-blank saturation: the answer to a crowd at the choke. | shots +2, range -2.5, spread +0.6 |

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

#### Laser Lance - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Capacitor** | 45 | +14 damage per pulse, cold or hot. The damage path starts steady. | damage +14 |
| T1 | **Chill** | 45 | Every body in the beam moves at 70% while it stands in it; a pulse a second keeps it cold. The control path starts cold. | slowMul -0.3, slowTicks +24 |
| T2 | **Fast Cycle** | 90 | A pulse every 13 ticks instead of 20: half again the output. | fireEveryTicks -7 |
| T2 | **Sear** | 90 | Bodies leave the beam burning: 2 a tick for a second. The beam keeps hurting after they pass. | burnDps +2, burnTicks +20 |
| T3 | **Cutter** | 180 | Every pulse at 150% and the heat climbs one multiple higher. The answer to a column standing in the beam. | damageMul +1.5, beamRampMax +1 |
| T3 | **Deep Sear** | 180 | The burn doubles and lasts two seconds; the chill deepens to 50%. Nothing walks out of this beam unmarked. | burnDps +2, burnTicks +20, slowMul -0.2 |

#### Bastion - the tree

| Tier | Choice | Cost | What it does | Data |
|---|---|---|---|---|
| T1 | **Command** | 40 | Neighbours hit for 30% more instead of 15%. | auraDamage +0.15 |
| T1 | **Logistics** | 40 | Neighbours fire 15% faster, and producers cycle 15% faster. | auraRate +0.15, auraProduction +0.15 |
| T2 | **Reach** | 80 | The ring grows to two cells: twenty-four neighbours instead of eight. | auraReach +1 |
| T2 | **Hardpoint** | 80 | Neighbours gain +1 range. | auraRange +1 |
| T3 | **Warlord** | 160 | Neighbours hit for 30% more on top of everything. | auraDamage +0.3 |
| T3 | **Quartermaster** | 160 | Neighbouring producers cycle 50% faster; neighbours gain +1 range. | auraProduction +0.5, auraRange +1 |

<!-- /generated -->

## Enemies *(generated)*

<!-- generated:enemies -->
7 enemies in `packages/content/assets/enemies/roster.json`. Speed is cells per second; breach is the Core health lost when one arrives; "from wave" is the first wave that may roll it. Every enemy walks the road; there are no flyers (PRD §8).

| Enemy | id | HP | Speed | Breach | Bounty | From wave | Armour | Shield | vs kinetic | vs energy | Traits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **grunt** | grunt | 30 | 1.20 | 1 | 4 | 1 |  |  |  |  |  |
| **skitter** | skitter | 12 | 2.40 | 1 | 3 | 2 |  |  |  |  | fast |
| **swarmling** | swarmling | 6 | 2.80 | 1 | 1 | 3 |  |  | x0.8 | x1.6 | swarm, fast |
| **brute** | brute | 90 | 0.90 | 3 | 8 | 4 | 3 |  | x0.6 | x1.6 | armoured |
| **shellback** | shell | 25 | 1.20 | 2 | 7 | 5 |  | 30 | x1.4 | x0.6 | shielded |
| **husk** | husk | 160 | 0.70 | 5 | 12 | 6 |  |  | x1.4 | x0.6 |  |
| **Juggernaut** | juggernaut | 400 | 0.60 | 12 | 20 | 10 | 6 |  | x0.8 | x1.2 |  |

Damage types decide fights (PRD §8): a tower hits with its type, an enemy multiplies the hit by its entry - x0.5 resists, x1.5 weak, immune takes nothing. Kinetic: Bolt, Mortar, Missiles. Energy: Frost, Tesla.

Statuses show on the body (PRD §8) as the ground under the walker: cold when slowed, ember when burning, ice when frozen, ember over cold when both hold; brackets for a live shield. Slows from different sources stack by one rule: the coldest multiplier wins, the longest duration lasts.

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
41 relics in `packages/content/assets/relics/pool.json`. Passives work while held; actives are clicked in the strip and recharge; consumables are one use. "Stacks" means a second copy adds (a second charge for actives).

| Relic | id | Kind | Base rarity | Tags | Stacks | Recharge | What it does (common) | Data | Rare | Epic |
|---|---|---|---|---|---|---|---|---|---|---|
| **Overflow** | overflow | passive | rare | damage |  |  | Overkill damage chains to the nearest enemy. Chain kills chain again. | overkillCarry true | same | same |
| **Frostbite** | frostbite | passive | common | cold | yes |  | Slowed enemies take +50% damage from everything. Stacks. | slowedDamageMul 1.5 | Slowed enemies take +75% from everything. [slowedDamageMul 1.75] | Slowed enemies take double from everything. [slowedDamageMul 2] |
| **Tithe** | tithe | passive | common | economy | yes |  | Every kill refunds 2 Scrap. Stacks. | killRefundScrap 2 | Every kill refunds 3 Scrap. [killRefundScrap 3] | Every kill refunds 5 Scrap. [killRefundScrap 5] |
| **Splinter** | splinter | passive | epic | damage |  |  | Explosions detonate twice: the same blast, resolved again a beat later - you will see both. | explodeTwice true | same | same |
| **Vein Tap** | vein_tap | passive | rare | core |  |  | You may build on rock. | buildOnRock true | same | same |
| **Loadbearing** | loadbearing | passive | epic | reach |  |  | Towers touching the Core block get triple range. | coreAdjacentRangeMul 3 | same | same |
| **Second Wind** | second_wind | passive | common | core |  |  | The Core mends 2 health every time a wave launches. | coreHealPerWave 2 | The Core mends 4 health every wave. [coreHealPerWave 4] | The Core mends 6 health every wave. [coreHealPerWave 6] |
| **Quarry** | quarry | passive | common | economy |  |  | Rock breaks three times faster - every prospect job, everywhere. | prospectSpeedMul 3 | Prospecting runs four times as fast. [prospectSpeedMul 4] | Prospecting runs six times as fast. [prospectSpeedMul 6] |
| **Toll** | toll | passive | common | economy | yes |  | Every enemy pays 1 Scrap for each cell it walks beside a tower. Stacks. | tollScrap 1 | Every enemy that passes a tower pays 2 Scrap. [tollScrap 2] | Every enemy that passes a tower pays 3 Scrap. [tollScrap 3] |
| **Bounty Board** | bounty_board | passive | common | economy |  |  | Bosses pay half again as much Scrap. | bossBountyMul 1.5 | Boss bounties pay double. [bossBountyMul 2] | Boss bounties pay triple. [bossBountyMul 3] |
| **Orbital Lance** | orbital | active | common | damage | yes | 90 s | Strike anywhere: 400 damage in a 3-cell blast. Recharges slowly. A second copy is a second charge. | orbitalDamage 400, orbitalRadius 3 | Strike anywhere: 550 damage in a 3.5-cell blast. Recharges slowly. [orbitalDamage 550, orbitalRadius 3.5] | Strike anywhere: 800 damage in a 4-cell blast. Recharges slowly. [orbitalDamage 800, orbitalRadius 4] |
| **Stasis Field** | stasis | active | common | cold | yes | 120 s | Freeze every enemy for 4 seconds. Towers keep firing. A second copy is a second charge. | freezeTicks 80 | Freeze every enemy for 6 seconds. Towers keep firing. [freezeTicks 120] | Freeze every enemy for 8 seconds. Towers keep firing. [freezeTicks 160] |
| **Deep Vein** | deep_vein | active | common | economy | yes | 120 s | Refineries produce five-fold for 20 seconds. A second copy is a second charge. | productionMul 5, boostTicks 400 | Refineries produce at six times for 30 seconds. [productionMul 6, boostTicks 600] | Refineries produce at eight times for 40 seconds. [productionMul 8, boostTicks 800] |
| **Sandbags** | sandbags | consumable | common | core | yes |  | Use: the Core gains 15 health, and 15 to its maximum. One use. | coreHpAdd 15 | The Core gains 25 max health, once. [coreHpAdd 25] | The Core gains 40 max health, once. [coreHpAdd 40] |
| **Flashbang** | flashbang | consumable | common | cold | yes |  | Use: every enemy freezes for 2 seconds. One use. | freezeTicks 40 | Freeze every enemy for 3 seconds, once. [freezeTicks 60] | Freeze every enemy for 4 seconds, once. [freezeTicks 80] |
| **Ore Pocket** | ore_pocket | consumable | common | economy | yes |  | Use: 20 Ore, right now. One use. | oreAdd 20 | 35 Ore, once. [oreAdd 35] | 60 Ore, once. [oreAdd 60] |
| **Ricochet** | ricochet | passive | common | damage kinetic |  |  | A killing hit carries half of itself to the nearest body within two cells. | killChainMul 0.5 | A killing hit carries 70% of itself to the nearest body within two cells. [killChainMul 0.7] | A killing hit carries itself whole to the nearest body within two cells. [killChainMul 1] |
| **Cold Snap** | cold_snap | passive | common | cold |  |  | A slowed or frozen body that dies chills everything within a cell and a half for a second. | deathChillTicks 20 | ...for a second and a half. [deathChillTicks 30] | ...for two seconds. [deathChillTicks 40] |
| **Kindling** | kindling | passive | rare | energy damage |  |  | A burning body that dies passes its burn to everything within a cell and a half. | deathSpreadBurn true | same | same |
| **Salvage Rights** | salvage_rights | passive | common | economy |  |  | Sold towers refund 85% instead of 70%. | sellRefundBonus 0.15 | Sold towers refund in full. [sellRefundBonus 0.3] | Sold towers refund in full. [sellRefundBonus 0.3] |
| **Bulk Order** | bulk_order | passive | common | economy | yes |  | Every tower costs 10% less. | buildCostMul 0.9 | Every tower costs 15% less. [buildCostMul 0.85] | Every tower costs 25% less. [buildCostMul 0.75] |
| **Cheap Upgrades** | cheap_upgrades | passive | common | economy | yes |  | Every tier choice costs 15% less. | tierCostMul 0.85 | Every tier choice costs 25% less. [tierCostMul 0.75] | Every tier choice costs 40% less. [tierCostMul 0.6] |
| **Wide Net** | wide_net | passive | common | kinetic | yes |  | Every shot passes into one more body. | pierceAdd 1 | Every shot passes into two more bodies. [pierceAdd 2] | Every shot passes into three more bodies. [pierceAdd 3] |
| **Grounding Rod** | grounding_rod | passive | common | energy | yes |  | Every arc jumps to one more body. | chainAdd 1 | Every arc jumps to two more bodies. [chainAdd 2] | Every arc jumps to three more bodies. [chainAdd 3] |
| **Long Fuse** | long_fuse | passive | common | damage kinetic | yes |  | Every blast reaches half a cell further. | blastAdd 0.5 | Every blast reaches a cell further. [blastAdd 1] | Every blast reaches a cell and a half further. [blastAdd 1.5] |
| **Sniper Nest** | sniper_nest | passive | rare | damage core |  |  | Towers touching the Core face hit for half again. | coreAdjacentDamageMul 1.5 | same | Towers touching the Core face hit for double. [coreAdjacentDamageMul 2] |
| **Bloodstone** | bloodstone | passive | common | core |  |  | Every tenth kill mends the Core by 1. | killHealEvery 10 | Every seventh kill mends the Core by 1. [killHealEvery 7] | Every fifth kill mends the Core by 1. [killHealEvery 5] |
| **Rush Bonus** | rush_bonus | passive | common | economy rate |  |  | Calling a wave early pays double the clock bonus. | callBonusMul 2 | Calling a wave early pays triple the clock bonus. [callBonusMul 3] | Calling a wave early pays four times the clock bonus. [callBonusMul 4] |
| **Scavenger** | scavenger | passive | common | economy |  |  | Caches pay double Scrap. | lootScrapMul 2 | Caches pay triple Scrap. [lootScrapMul 3] | Caches pay four times the Scrap. [lootScrapMul 4] |
| **Prospector's Eye** | prospectors_eye | passive | rare | economy |  |  | Prospecting rock costs nothing. | prospectFree true | same | same |
| **Iron Will** | iron_will | passive | common | core | yes |  | Every breach costs the Core 1 less. | breachReduce 1 | Every breach costs the Core 2 less. [breachReduce 2] | Every breach costs the Core 3 less. [breachReduce 3] |
| **Frost Nova** | frost_nova | active | common | cold | yes | 60 s | Every enemy on the board moves at half speed for 4 seconds. Recharges in a minute. | slowAllMul 0.5, slowAllTicks 80 | Every enemy moves at 40% for 6 seconds. [slowAllMul 0.4, slowAllTicks 120] | Every enemy moves at 30% for 8 seconds. [slowAllMul 0.3, slowAllTicks 160] |
| **Scrap Rain** | scrap_rain | consumable | common | economy | yes |  | 80 Scrap, once. | scrapAdd 80 | 140 Scrap, once. [scrapAdd 140] | 220 Scrap, once. [scrapAdd 220] |
| **Emergency Repair** | emergency_repair | consumable | common | core | yes |  | The Core mends 20 now. | coreHealNow 20 | The Core mends 35 now. [coreHealNow 35] | The Core mends 50 now. [coreHealNow 50] |
| **Foundry** | foundry | passive | rare | economy |  |  | A Refinery standing off any vein produces its yield as Scrap instead. The PRD's rule, broken by a relic. | refineryScrapOffVein true | same | same |
| **Thick Walls** | thick_walls | passive | common | core | yes |  | The Core holds 10 more while this is held. | coreHpMaxAdd 10 | The Core holds 20 more while this is held. [coreHpMaxAdd 20] | The Core holds 35 more while this is held. [coreHpMaxAdd 35] |
| **Permafrost Engine** | permafrost_engine | passive (fusion only) | epic | cold damage |  |  | Slowed enemies take triple from everything. Frostbite and Stasis, fused. | slowedDamageMul 3 | same | same |
| **Tollbooth** | tollbooth | passive (fusion only) | epic | economy |  |  | Every kill refunds 5 Scrap and every enemy pays 3 Scrap for each cell it walks beside a tower. Toll and Tithe, fused. | killRefundScrap 5, tollScrap 3 | same | same |
| **Bunker** | bunker | passive (fusion only) | epic | core |  |  | The Core mends 8 health every wave. Sandbags and Second Wind, fused. | coreHealPerWave 8 | same | same |
| **Quarry Master** | quarry_master | active (fusion only) | epic | economy | yes | 90 s | Refineries produce at ten times for 40 seconds. Quarry and Deep Vein, fused. | productionMul 10, boostTicks 800 | same | same |
| **Doomsday** | doomsday | active (fusion only) | epic | damage cold | yes | 90 s | Strike anywhere: 900 damage in a 4-cell blast, and every enemy freezes for 2 seconds. Orbital Lance and Flashbang, fused. | orbitalDamage 900, orbitalRadius 4, freezeTicks 40 | same | same |

Rarity with teeth (PRD §7.6; session 28, PR 2): every draw rolls a rarity by wave - common 60 minus the wave (floor 30), rare 30, epic 10 plus half the wave - never below the relic's base rarity. A rare or epic copy has the numbers in its column; "same" means the rule does not scale (a boolean).
<!-- /generated -->

## Passives *(generated)*

<!-- generated:passives -->
14 passives in `packages/content/assets/passives/pool.json` (session 28, PR 1; D26). The permanent layer, separate from relics: six slots a run, one pick every second wave from three offered, every one of them on every tower. "Mods" are folded like a tier; "econ" knobs act on the run.

| Passive | id | Tags | What it does | Mods | Econ |
|---|---|---|---|---|---|
| **Iron Sights** | iron_sights | reach | Every tower reaches one cell further. | range 1 |  |
| **Hot Loads** | hot_loads | damage | Every hit does 15% more. | damageMul 1.15 |  |
| **Quick Hands** | quick_hands | rate | Every tower cycles two ticks faster. | fireEveryTicks -2 |  |
| **Deep Cold** | deep_cold | cold | Every slow is 10% colder. | slowMul -0.1 |  |
| **Piercing Rounds** | piercing_rounds | kinetic | Every shot passes into one more body. | pierceCount 1 |  |
| **Long Arc** | long_arc | energy | Every arc jumps to one more body. | chainCount 1 |  |
| **Overclock** | overclock | energy | Every beam heats one multiple higher. | beamRampMax 1 |  |
| **Wide Aura** | wide_aura | support | Every aura reaches one cell further. | auraReach 1 |  |
| **Rich Seam** | rich_seam | economy | Every refinery mines one more Ore a cycle. | production 1 |  |
| **War Chest** | war_chest | economy | Ten Scrap at every wave launch. |  | waveScrap 10 |
| **Bounty Hunter** | bounty_hunter | economy | Every bounty pays 25% more. |  | bountyMul 1.25 |
| **Bulwark** | bulwark | core | The Core holds ten more health. |  | coreHpMaxAdd 10 |
| **Tempered Steel** | tempered_steel | damage reach | Every hit does 10% more and every tower reaches half a cell further. | damageMul 1.1, range 0.5 |  |
| **Shield Breaker** | shield_breaker | kinetic energy | Every hit does half again to shields. | shieldMul 0.5 |  |
<!-- /generated -->

## Sets *(generated)*

<!-- generated:sets -->
18 set effects in `packages/content/assets/sets/pool.json` (session 28, PR 2). Held passives and relics count per tag; at two and at three of a tag the set lights and folds into every tower like a passive (econ knobs into the run). The strip's PASSIVES line names the lit sets.

| Set | Tag | At | What it does | Mods | Econ |
|---|---|---|---|---|---|
| **Sharpened** | damage | 2 | Two of damage: every hit does 5% more. | damageMul 1.05 |  |
| **Honed** | damage | 3 | Three of damage: every hit does 12% more. | damageMul 1.12 |  |
| **Oiled** | rate | 2 | Two of rate: every tower cycles a tick faster. | fireEveryTicks -1 |  |
| **Overwound** | rate | 3 | Three of rate: every tower cycles three ticks faster. | fireEveryTicks -3 |  |
| **Spotter** | reach | 2 | Two of reach: every tower reaches half a cell further. | range 0.5 |  |
| **Watchtower** | reach | 3 | Three of reach: every tower reaches a cell and a half further. | range 1.5 |  |
| **Frost Line** | cold | 2 | Two of cold: every slow is 5% colder. | slowMul -0.05 |  |
| **Permafrost** | cold | 3 | Three of cold: every slow lasts half a second longer. | slowTicks 10 |  |
| **Hardened** | kinetic | 2 | Two of kinetic: every shot passes into one more body. | pierceCount 1 |  |
| **Depleted** | kinetic | 3 | Three of kinetic: every hit does 2 more. | damage 2 |  |
| **Conductive** | energy | 2 | Two of energy: every arc reaches half a cell further. | chainReach 0.5 |  |
| **Superheated** | energy | 3 | Three of energy: every hit leaves a burn of 1 a tick. | burnDps 1 |  |
| **Rally** | support | 2 | Two of support: every aura reaches a cell further. | auraReach 1 |  |
| **Banner** | support | 3 | Three of support: every hit does 5% more and every tower reaches half a cell further. | damageMul 1.05, range 0.5 |  |
| **Ledger** | economy | 2 | Two of economy: 5 Scrap at every wave launch. |  | waveScrap 5 |
| **Treasury** | economy | 3 | Three of economy: every bounty pays 15% more. |  | bountyMul 1.15 |
| **Masonry** | core | 2 | Two of core: the Core mends 1 health every wave. |  | coreHealPerWave 1 |
| **Citadel** | core | 3 | Three of core: the Core mends 3 health every wave. |  | coreHealPerWave 3 |
<!-- /generated -->

## Recipes *(generated)*

<!-- generated:recipes -->
5 duo recipes in `packages/content/assets/recipes/pool.json` (session 28, PR 3; PRD §7.6 fusion). Two held relics, in either order, combine into the result at the higher of their rarities; the result is a relic marked "fusion only" above and never appears in an offer. Two of a KIND at the same rarity combine into the next rarity without a recipe. A held relic salvages for Ore: 10 common, 20 rare, 35 epic.

| Recipe | A | B | Result | What it does |
|---|---|---|---|---|
| **Permafrost Engine** | Frostbite | Stasis Field | permafrost_engine | Cold made permanent: slowed enemies take triple. |
| **Tollbooth** | Toll | Tithe | tollbooth | Every kill and every step pays. |
| **Bunker** | Sandbags | Second Wind | bunker | The Core mends 8 a wave. |
| **Quarry Master** | Quarry | Deep Vein | quarry_master | Ten times production on demand. |
| **Doomsday** | Orbital Lance | Flashbang | doomsday | The strike that also freezes the board. |
<!-- /generated -->

## Loot *(generated)*

<!-- generated:loot -->
3 loot tables in `packages/content/assets/loot/tables.json` (PRD §7.7). Every reward that is not a bounty or a wave's clock comes from one of these: a prospected rock's cache rolls `rock_cache`, a boss drops `boss_drop` where it dies, a void chest (PRD §4.9; session 28, PR 5) pays `void_chest`. A table is a weighted list rolled on the loot stream at claim time, so it rides the input log. "boon" turns the cell into boon ground (ground cells only; elsewhere it pays Scrap); "consumable" and "relic" draw from the unheld pool at a rolled rarity.

#### rock_cache

| Outcome | Chance | Amount |
|---|---|---|
| scrap | 35% | 60-120 |
| ore | 25% | 10-30 |
| boon | 20% | tier 2 |
| consumable | 12% |  |
| relic | 8% |  |

#### boss_drop

| Outcome | Chance | Amount |
|---|---|---|
| scrap | 40% | 80-160 |
| ore | 30% | 15-40 |
| consumable | 18% |  |
| relic | 12% |  |

#### void_chest

| Outcome | Chance | Amount |
|---|---|---|
| scrap | 40% | 30-90 |
| ore | 30% | 10-30 |
| consumable | 18% |  |
| relic | 12% |  |

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
| *(add rows)* | | | |
