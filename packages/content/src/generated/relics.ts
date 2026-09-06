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
        }
      }
    }
  }
} as const;
