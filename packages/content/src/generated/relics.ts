// AUTO-GENERATED from schema/relics.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Relics (PRD sec 7): rule modifiers acquired mid-run, run-local, held by the Core. Effects are named engine knobs - a relic is data wired to hooks, never code. rarity is reserved shape (D5): present from the first commit, unused until play evidence says how to weight the pool.
 */
export interface RelicPool {
  $schema?: string;
  /**
   * @minItems 1
   */
  relics: [
    {
      id: string;
      name: string;
      /**
       * passive: always on. active: fired from the Core, long cooldown. consumable: one use, effects then permanent for the run.
       */
      kind: 'passive' | 'active' | 'consumable';
      /**
       * Player-facing card text. The offer modal renders this - a relic the player cannot understand is a relic that does not exist.
       */
      desc: string;
      /**
       * The relic's BASE rarity (session 28, PR 2; PRD sec 7.6 'rarity with teeth'): the lowest it is ever dealt at. Every draw rolls a rarity weighted by wave (common 60-wave, rare 30, epic 10+wave/2), never below the base. Rare and epic copies use `tiers`.
       */
      rarity: 'common' | 'rare' | 'epic';
      /**
       * May the pool deal this relic again while it is held? Multipliers and charges stack; a boolean rule held twice is a dead card, so booleans are unstackable and leave the pool once held (design round 1). Absent = false.
       */
      stackable?: boolean;
      /**
       * Actives: ticks between firings at 20 Hz.
       */
      cooldownTicks?: number;
      effects?: Effects;
      /**
       * Set tags (session 28, PR 2): held passives and relics count per tag; sets/pool.json lights a set effect at two and three of a tag.
       */
      tags?: ('damage' | 'rate' | 'reach' | 'cold' | 'kinetic' | 'energy' | 'support' | 'economy' | 'core')[];
      /**
       * What a rare and an epic copy are: the effects (whole, not deltas) and the card text at that rarity. A relic without tiers is the same at every rarity (a boolean rule).
       */
      tiers?: {
        rare?: {
          desc?: string;
          effects: Effects;
        };
        epic?: {
          desc?: string;
          effects: Effects;
        };
      };
      /**
       * Never offered, drawn, bought or found: reached only by combining two held relics by a recipe (recipes/pool.json; session 28, PR 3).
       */
      fusionOnly?: boolean;
    },
    ...{
      id: string;
      name: string;
      /**
       * passive: always on. active: fired from the Core, long cooldown. consumable: one use, effects then permanent for the run.
       */
      kind: 'passive' | 'active' | 'consumable';
      /**
       * Player-facing card text. The offer modal renders this - a relic the player cannot understand is a relic that does not exist.
       */
      desc: string;
      /**
       * The relic's BASE rarity (session 28, PR 2; PRD sec 7.6 'rarity with teeth'): the lowest it is ever dealt at. Every draw rolls a rarity weighted by wave (common 60-wave, rare 30, epic 10+wave/2), never below the base. Rare and epic copies use `tiers`.
       */
      rarity: 'common' | 'rare' | 'epic';
      /**
       * May the pool deal this relic again while it is held? Multipliers and charges stack; a boolean rule held twice is a dead card, so booleans are unstackable and leave the pool once held (design round 1). Absent = false.
       */
      stackable?: boolean;
      /**
       * Actives: ticks between firings at 20 Hz.
       */
      cooldownTicks?: number;
      effects?: Effects;
      /**
       * Set tags (session 28, PR 2): held passives and relics count per tag; sets/pool.json lights a set effect at two and three of a tag.
       */
      tags?: ('damage' | 'rate' | 'reach' | 'cold' | 'kinetic' | 'energy' | 'support' | 'economy' | 'core')[];
      /**
       * What a rare and an epic copy are: the effects (whole, not deltas) and the card text at that rarity. A relic without tiers is the same at every rarity (a boolean rule).
       */
      tiers?: {
        rare?: {
          desc?: string;
          effects: Effects;
        };
        epic?: {
          desc?: string;
          effects: Effects;
        };
      };
      /**
       * Never offered, drawn, bought or found: reached only by combining two held relics by a recipe (recipes/pool.json; session 28, PR 3).
       */
      fusionOnly?: boolean;
    }[]
  ];
}
/**
 * Named engine knobs. Every field is optional; a relic sets the ones it means. Adding a knob is an engine change; adding a relic that uses existing knobs is content.
 */
export interface Effects {
  /**
   * Excess kill damage chains to the nearest enemy, repeatedly.
   */
  overkillCarry?: boolean;
  /**
   * Damage multiplier against slowed enemies (Frostbite).
   */
  slowedDamageMul?: number;
  /**
   * Flat Scrap per kill (Tithe).
   */
  killRefundScrap?: number;
  /**
   * Explosion AoE resolves twice (Splinter).
   */
  explodeTwice?: boolean;
  /**
   * Fighters may build on rock cells (Vein Tap).
   */
  buildOnRock?: boolean;
  /**
   * Range multiplier for towers adjacent to the Core block (Loadbearing).
   */
  coreAdjacentRangeMul?: number;
  /**
   * Global tower damage multiplier.
   */
  damageMul?: number;
  /**
   * Global fire-rate multiplier (>1 = faster).
   */
  fireRateMul?: number;
  /**
   * Global flat range bonus in cells.
   */
  rangeAdd?: number;
  /**
   * Targeted active: damage to everything in the blast.
   */
  orbitalDamage?: number;
  /**
   * Targeted active: blast radius in cells.
   */
  orbitalRadius?: number;
  /**
   * Board-wide active: enemies stop for this long (Stasis).
   */
  freezeTicks?: number;
  /**
   * Timed active: production multiplier while boosted (Deep Vein).
   */
  productionMul?: number;
  /**
   * Timed active: boost duration.
   */
  boostTicks?: number;
  /**
   * Passive: the Core heals this much when a wave launches (Second Wind).
   */
  coreHealPerWave?: number;
  /**
   * Passive: prospect jobs run this much faster (Quarry).
   */
  prospectSpeedMul?: number;
  /**
   * Passive: an enemy pays this Scrap on entering a cell beside a tower (Toll).
   */
  tollScrap?: number;
  /**
   * Passive: boss bounty multiplier (Bounty Board).
   */
  bossBountyMul?: number;
  /**
   * Consumable: raises Core hp and its maximum (Sandbags).
   */
  coreHpAdd?: number;
  /**
   * Consumable: grants tier-1 Ore (Ore Pocket).
   */
  oreAdd?: number;
  /**
   * Passive: a kill by a tower deals this share of the killing hit to the nearest other body within 2 cells (Ricochet). Copies do not stack: the largest holds.
   */
  killChainMul?: number;
  /**
   * Passive: a slowed or frozen body that dies chills every body within 1.5 cells to 70% for this many ticks (Cold Snap). The largest holds.
   */
  deathChillTicks?: number;
  /**
   * Passive: a burning body that dies passes its strongest burn to every body within 1.5 cells (Kindling).
   */
  deathSpreadBurn?: boolean;
  /**
   * Passive: added to the 70% sell refund, capped at 100% (Salvage Rights).
   */
  sellRefundBonus?: number;
  /**
   * Passive: every tower costs this multiple (Bulk Order). Copies multiply.
   */
  buildCostMul?: number;
  /**
   * Passive: every tier choice costs this multiple (Cheap Upgrades). Copies multiply.
   */
  tierCostMul?: number;
  /**
   * Passive: every shot passes into this many more bodies (Wide Net).
   */
  pierceAdd?: number;
  /**
   * Passive: every arc jumps to this many more bodies (Grounding Rod).
   */
  chainAdd?: number;
  /**
   * Passive: every blast radius grows by this many cells - explosive shots only (Long Fuse).
   */
  blastAdd?: number;
  /**
   * Passive: towers touching the Core face hit for this multiple (Sniper Nest).
   */
  coreAdjacentDamageMul?: number;
  /**
   * Passive: every this many kills the Core mends 1 (Bloodstone). Copies take the smallest.
   */
  killHealEvery?: number;
  /**
   * Passive: calling a wave early pays this multiple of the clock bonus (Rush Bonus).
   */
  callBonusMul?: number;
  /**
   * Passive: Scrap from caches is multiplied (Scavenger).
   */
  lootScrapMul?: number;
  /**
   * Passive: prospecting rock costs nothing (Prospector's Eye).
   */
  prospectFree?: boolean;
  /**
   * Passive: every breach costs the Core this much less, never below 0 (Iron Will).
   */
  breachReduce?: number;
  /**
   * Active: every enemy on the board moves at this multiple for slowAllTicks (Frost Nova).
   */
  slowAllMul?: number;
  /**
   * Active: how long slowAllMul holds.
   */
  slowAllTicks?: number;
  /**
   * Consumable: grants this much Scrap (Scrap Rain).
   */
  scrapAdd?: number;
  /**
   * Consumable: the Core mends this much now, up to its maximum (Emergency Repair).
   */
  coreHealNow?: number;
  /**
   * Passive: a Refinery standing off any vein produces its yield as Scrap instead (Foundry; PRD sec 7.4).
   */
  refineryScrapOffVein?: boolean;
  /**
   * Passive: the Core holds this much more while the relic is held (Thick Walls).
   */
  coreHpMaxAdd?: number;
  /**
   * Passive: tower mods applied to every tower like a tier (the former passive layer, folded back into relics 2026-09-06 evening on Daniil's call). Only fields safe on every tower belong here.
   */
  mods?: {
    damage?: number;
    damageMul?: number;
    range?: number;
    fireEveryTicks?: number;
    slowMul?: number;
    slowTicks?: number;
    pierceCount?: number;
    chainCount?: number;
    chainReach?: number;
    beamRampMax?: number;
    auraReach?: number;
    production?: number;
    burnDps?: number;
    shieldMul?: number;
  };
  /**
   * Passive: Scrap paid at every wave launch (War Chest).
   */
  waveScrap?: number;
  /**
   * Passive: multiplies every bounty (Bounty Hunter).
   */
  bountyMul?: number;
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const relicsSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/relics.schema.json",
  "title": "RelicPool",
  "description": "Relics (PRD sec 7): rule modifiers acquired mid-run, run-local, held by the Core. Effects are named engine knobs - a relic is data wired to hooks, never code. rarity is reserved shape (D5): present from the first commit, unused until play evidence says how to weight the pool.",
  "type": "object",
  "required": [
    "relics"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "relics": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "name",
          "kind",
          "desc",
          "rarity"
        ],
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*$"
          },
          "name": {
            "type": "string"
          },
          "kind": {
            "description": "passive: always on. active: fired from the Core, long cooldown. consumable: one use, effects then permanent for the run.",
            "enum": [
              "passive",
              "active",
              "consumable"
            ]
          },
          "desc": {
            "description": "Player-facing card text. The offer modal renders this - a relic the player cannot understand is a relic that does not exist.",
            "type": "string"
          },
          "rarity": {
            "description": "The relic's BASE rarity (session 28, PR 2; PRD sec 7.6 'rarity with teeth'): the lowest it is ever dealt at. Every draw rolls a rarity weighted by wave (common 60-wave, rare 30, epic 10+wave/2), never below the base. Rare and epic copies use `tiers`.",
            "enum": [
              "common",
              "rare",
              "epic"
            ]
          },
          "stackable": {
            "description": "May the pool deal this relic again while it is held? Multipliers and charges stack; a boolean rule held twice is a dead card, so booleans are unstackable and leave the pool once held (design round 1). Absent = false.",
            "type": "boolean"
          },
          "cooldownTicks": {
            "description": "Actives: ticks between firings at 20 Hz.",
            "type": "integer",
            "minimum": 1
          },
          "effects": {
            "$ref": "#/definitions/effects"
          },
          "tags": {
            "description": "Set tags (session 28, PR 2): held passives and relics count per tag; sets/pool.json lights a set effect at two and three of a tag.",
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "damage",
                "rate",
                "reach",
                "cold",
                "kinetic",
                "energy",
                "support",
                "economy",
                "core"
              ]
            },
            "uniqueItems": true
          },
          "tiers": {
            "description": "What a rare and an epic copy are: the effects (whole, not deltas) and the card text at that rarity. A relic without tiers is the same at every rarity (a boolean rule).",
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "rare": {
                "type": "object",
                "required": [
                  "effects"
                ],
                "additionalProperties": false,
                "properties": {
                  "desc": {
                    "type": "string"
                  },
                  "effects": {
                    "$ref": "#/definitions/effects"
                  }
                }
              },
              "epic": {
                "type": "object",
                "required": [
                  "effects"
                ],
                "additionalProperties": false,
                "properties": {
                  "desc": {
                    "type": "string"
                  },
                  "effects": {
                    "$ref": "#/definitions/effects"
                  }
                }
              }
            }
          },
          "fusionOnly": {
            "description": "Never offered, drawn, bought or found: reached only by combining two held relics by a recipe (recipes/pool.json; session 28, PR 3).",
            "type": "boolean"
          }
        }
      }
    }
  },
  "definitions": {
    "effects": {
      "description": "Named engine knobs. Every field is optional; a relic sets the ones it means. Adding a knob is an engine change; adding a relic that uses existing knobs is content.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "overkillCarry": {
          "description": "Excess kill damage chains to the nearest enemy, repeatedly.",
          "type": "boolean"
        },
        "slowedDamageMul": {
          "description": "Damage multiplier against slowed enemies (Frostbite).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "killRefundScrap": {
          "description": "Flat Scrap per kill (Tithe).",
          "type": "number",
          "minimum": 0
        },
        "explodeTwice": {
          "description": "Explosion AoE resolves twice (Splinter).",
          "type": "boolean"
        },
        "buildOnRock": {
          "description": "Fighters may build on rock cells (Vein Tap).",
          "type": "boolean"
        },
        "coreAdjacentRangeMul": {
          "description": "Range multiplier for towers adjacent to the Core block (Loadbearing).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "damageMul": {
          "description": "Global tower damage multiplier.",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "fireRateMul": {
          "description": "Global fire-rate multiplier (>1 = faster).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "rangeAdd": {
          "description": "Global flat range bonus in cells.",
          "type": "number"
        },
        "orbitalDamage": {
          "description": "Targeted active: damage to everything in the blast.",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "orbitalRadius": {
          "description": "Targeted active: blast radius in cells.",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "freezeTicks": {
          "description": "Board-wide active: enemies stop for this long (Stasis).",
          "type": "integer",
          "minimum": 1
        },
        "productionMul": {
          "description": "Timed active: production multiplier while boosted (Deep Vein).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "boostTicks": {
          "description": "Timed active: boost duration.",
          "type": "integer",
          "minimum": 1
        },
        "coreHealPerWave": {
          "description": "Passive: the Core heals this much when a wave launches (Second Wind).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "prospectSpeedMul": {
          "description": "Passive: prospect jobs run this much faster (Quarry).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "tollScrap": {
          "description": "Passive: an enemy pays this Scrap on entering a cell beside a tower (Toll).",
          "type": "number",
          "minimum": 0
        },
        "bossBountyMul": {
          "description": "Passive: boss bounty multiplier (Bounty Board).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "coreHpAdd": {
          "description": "Consumable: raises Core hp and its maximum (Sandbags).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "oreAdd": {
          "description": "Consumable: grants tier-1 Ore (Ore Pocket).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "killChainMul": {
          "description": "Passive: a kill by a tower deals this share of the killing hit to the nearest other body within 2 cells (Ricochet). Copies do not stack: the largest holds.",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "deathChillTicks": {
          "description": "Passive: a slowed or frozen body that dies chills every body within 1.5 cells to 70% for this many ticks (Cold Snap). The largest holds.",
          "type": "number",
          "minimum": 1
        },
        "deathSpreadBurn": {
          "description": "Passive: a burning body that dies passes its strongest burn to every body within 1.5 cells (Kindling).",
          "type": "boolean"
        },
        "sellRefundBonus": {
          "description": "Passive: added to the 70% sell refund, capped at 100% (Salvage Rights).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "buildCostMul": {
          "description": "Passive: every tower costs this multiple (Bulk Order). Copies multiply.",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "tierCostMul": {
          "description": "Passive: every tier choice costs this multiple (Cheap Upgrades). Copies multiply.",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "pierceAdd": {
          "description": "Passive: every shot passes into this many more bodies (Wide Net).",
          "type": "number",
          "minimum": 1
        },
        "chainAdd": {
          "description": "Passive: every arc jumps to this many more bodies (Grounding Rod).",
          "type": "number",
          "minimum": 1
        },
        "blastAdd": {
          "description": "Passive: every blast radius grows by this many cells - explosive shots only (Long Fuse).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "coreAdjacentDamageMul": {
          "description": "Passive: towers touching the Core face hit for this multiple (Sniper Nest).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "killHealEvery": {
          "description": "Passive: every this many kills the Core mends 1 (Bloodstone). Copies take the smallest.",
          "type": "number",
          "minimum": 1
        },
        "callBonusMul": {
          "description": "Passive: calling a wave early pays this multiple of the clock bonus (Rush Bonus).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "lootScrapMul": {
          "description": "Passive: Scrap from caches is multiplied (Scavenger).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "prospectFree": {
          "description": "Passive: prospecting rock costs nothing (Prospector's Eye).",
          "type": "boolean"
        },
        "breachReduce": {
          "description": "Passive: every breach costs the Core this much less, never below 0 (Iron Will).",
          "type": "number",
          "minimum": 1
        },
        "slowAllMul": {
          "description": "Active: every enemy on the board moves at this multiple for slowAllTicks (Frost Nova).",
          "type": "number",
          "exclusiveMinimum": 0,
          "exclusiveMaximum": 1
        },
        "slowAllTicks": {
          "description": "Active: how long slowAllMul holds.",
          "type": "number",
          "minimum": 1
        },
        "scrapAdd": {
          "description": "Consumable: grants this much Scrap (Scrap Rain).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "coreHealNow": {
          "description": "Consumable: the Core mends this much now, up to its maximum (Emergency Repair).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "refineryScrapOffVein": {
          "description": "Passive: a Refinery standing off any vein produces its yield as Scrap instead (Foundry; PRD sec 7.4).",
          "type": "boolean"
        },
        "coreHpMaxAdd": {
          "description": "Passive: the Core holds this much more while the relic is held (Thick Walls).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "mods": {
          "type": "object",
          "description": "Passive: tower mods applied to every tower like a tier (the former passive layer, folded back into relics 2026-09-06 evening on Daniil's call). Only fields safe on every tower belong here.",
          "additionalProperties": false,
          "properties": {
            "damage": {
              "type": "number"
            },
            "damageMul": {
              "type": "number",
              "exclusiveMinimum": 0
            },
            "range": {
              "type": "number"
            },
            "fireEveryTicks": {
              "type": "integer"
            },
            "slowMul": {
              "type": "number"
            },
            "slowTicks": {
              "type": "integer"
            },
            "pierceCount": {
              "type": "integer"
            },
            "chainCount": {
              "type": "integer"
            },
            "chainReach": {
              "type": "number"
            },
            "beamRampMax": {
              "type": "number"
            },
            "auraReach": {
              "type": "integer"
            },
            "production": {
              "type": "number"
            },
            "burnDps": {
              "type": "number"
            },
            "shieldMul": {
              "type": "number"
            }
          }
        },
        "waveScrap": {
          "description": "Passive: Scrap paid at every wave launch (War Chest).",
          "type": "integer",
          "minimum": 1
        },
        "bountyMul": {
          "description": "Passive: multiplies every bounty (Bounty Hunter).",
          "type": "number",
          "exclusiveMinimum": 0
        }
      }
    }
  }
} as const;
