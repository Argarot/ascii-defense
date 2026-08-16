// AUTO-GENERATED from schema/towers.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Tower definitions. The projectile block is deliberately wider than any current tower uses (homing, pierce, explosion, effects) - the scaffolding ships before the features so that balancing and effects later are data changes, not migrations. range is in cells; fireEveryTicks at 20 Hz.
 */
export interface TowerRoster {
  $schema?: string;
  /**
   * @minItems 1
   */
  towers: [
    {
      id: string;
      name?: string;
      cost: number;
      range: number;
      fireEveryTicks: number;
      /**
       * Required for attacking towers; absent on attack:none producers (Refinery).
       */
      projectile?: {
        damage: number;
        /**
         * Cells per tick. Must comfortably outrun enemies.
         */
        speed: number;
        /**
         * Tracks its target. false = straight shot that can miss.
         */
        homing?: boolean;
        /**
         * Radians per tick of steering when homing. Reserved.
         */
        homingTurnRate?: number;
        pierce?: boolean;
        /**
         * Enemies a piercing shot passes through. Reserved.
         */
        pierceCount?: number;
        explosive?: boolean;
        /**
         * AoE radius in cells on impact. Reserved (Mortar).
         */
        explodeRadius?: number;
        /**
         * Status effect id applied on hit (slow, burn, ...). Reserved.
         */
        applyEffect?: string | null;
        /**
         * Speed multiplier while slowed (applyEffect slow).
         */
        slowMul?: number;
        /**
         * Slow duration in ticks.
         */
        slowTicks?: number;
      };
      /**
       * projectile fires shots; pulse hits everything in range on cooldown (no projectile); none never attacks (producers).
       */
      attack?: 'projectile' | 'pulse' | 'none';
      /**
       * Resource yield per cycle (Refinery). Ore counts only while the tower stands on an ore cell - engine rule, PRD sec 5.3. scrap is reserved shape for the foundry relic (PRD sec 7.4); no shipped tower uses it.
       */
      production?: {
        ore?: number;
        scrap?: number;
        /**
         * Cycle length in ticks at 20 Hz.
         */
        everyTicks: number;
      };
      /**
       * Tower Dominion-style tree: 3 tiers, each an either/or choice, mutually exclusive, unlocked in order. 2+4+8 = 14 tower variants.
       *
       * @minItems 3
       * @maxItems 3
       */
      tiers?: [
        {
          /**
           * @minItems 2
           * @maxItems 2
           */
          choices: [
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            },
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            }
          ];
        },
        {
          /**
           * @minItems 2
           * @maxItems 2
           */
          choices: [
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            },
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            }
          ];
        },
        {
          /**
           * @minItems 2
           * @maxItems 2
           */
          choices: [
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            },
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            }
          ];
        }
      ];
    },
    ...{
      id: string;
      name?: string;
      cost: number;
      range: number;
      fireEveryTicks: number;
      /**
       * Required for attacking towers; absent on attack:none producers (Refinery).
       */
      projectile?: {
        damage: number;
        /**
         * Cells per tick. Must comfortably outrun enemies.
         */
        speed: number;
        /**
         * Tracks its target. false = straight shot that can miss.
         */
        homing?: boolean;
        /**
         * Radians per tick of steering when homing. Reserved.
         */
        homingTurnRate?: number;
        pierce?: boolean;
        /**
         * Enemies a piercing shot passes through. Reserved.
         */
        pierceCount?: number;
        explosive?: boolean;
        /**
         * AoE radius in cells on impact. Reserved (Mortar).
         */
        explodeRadius?: number;
        /**
         * Status effect id applied on hit (slow, burn, ...). Reserved.
         */
        applyEffect?: string | null;
        /**
         * Speed multiplier while slowed (applyEffect slow).
         */
        slowMul?: number;
        /**
         * Slow duration in ticks.
         */
        slowTicks?: number;
      };
      /**
       * projectile fires shots; pulse hits everything in range on cooldown (no projectile); none never attacks (producers).
       */
      attack?: 'projectile' | 'pulse' | 'none';
      /**
       * Resource yield per cycle (Refinery). Ore counts only while the tower stands on an ore cell - engine rule, PRD sec 5.3. scrap is reserved shape for the foundry relic (PRD sec 7.4); no shipped tower uses it.
       */
      production?: {
        ore?: number;
        scrap?: number;
        /**
         * Cycle length in ticks at 20 Hz.
         */
        everyTicks: number;
      };
      /**
       * Tower Dominion-style tree: 3 tiers, each an either/or choice, mutually exclusive, unlocked in order. 2+4+8 = 14 tower variants.
       *
       * @minItems 3
       * @maxItems 3
       */
      tiers?: [
        {
          /**
           * @minItems 2
           * @maxItems 2
           */
          choices: [
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            },
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            }
          ];
        },
        {
          /**
           * @minItems 2
           * @maxItems 2
           */
          choices: [
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            },
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            }
          ];
        },
        {
          /**
           * @minItems 2
           * @maxItems 2
           */
          choices: [
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            },
            {
              name: string;
              cost: number;
              mods?: {
                damage?: number;
                range?: number;
                fireEveryTicks?: number;
                explodeRadius?: number;
                slowTicks?: number;
                /**
                 * Additive yield per cycle.
                 */
                production?: number;
                /**
                 * Additive cycle-length delta (negative = faster).
                 */
                productionEveryTicks?: number;
              };
              /**
               * Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.
               */
              unlocks?: 'surveySpeed' | 'surveyAuto';
            }
          ];
        }
      ];
    }[]
  ];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const towersSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/towers.schema.json",
  "title": "TowerRoster",
  "description": "Tower definitions. The projectile block is deliberately wider than any current tower uses (homing, pierce, explosion, effects) - the scaffolding ships before the features so that balancing and effects later are data changes, not migrations. range is in cells; fireEveryTicks at 20 Hz.",
  "type": "object",
  "required": [
    "towers"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "towers": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "cost",
          "range",
          "fireEveryTicks"
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
          "cost": {
            "type": "number",
            "minimum": 0
          },
          "range": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "fireEveryTicks": {
            "type": "integer",
            "minimum": 1
          },
          "projectile": {
            "description": "Required for attacking towers; absent on attack:none producers (Refinery).",
            "type": "object",
            "required": [
              "damage",
              "speed"
            ],
            "additionalProperties": false,
            "properties": {
              "damage": {
                "type": "number",
                "minimum": 0
              },
              "speed": {
                "description": "Cells per tick. Must comfortably outrun enemies.",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "homing": {
                "description": "Tracks its target. false = straight shot that can miss.",
                "type": "boolean",
                "default": false
              },
              "homingTurnRate": {
                "description": "Radians per tick of steering when homing. Reserved.",
                "type": "number",
                "minimum": 0
              },
              "pierce": {
                "type": "boolean",
                "default": false
              },
              "pierceCount": {
                "description": "Enemies a piercing shot passes through. Reserved.",
                "type": "integer",
                "minimum": 1
              },
              "explosive": {
                "type": "boolean",
                "default": false
              },
              "explodeRadius": {
                "description": "AoE radius in cells on impact. Reserved (Mortar).",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "applyEffect": {
                "description": "Status effect id applied on hit (slow, burn, ...). Reserved.",
                "type": [
                  "string",
                  "null"
                ],
                "default": null
              },
              "slowMul": {
                "description": "Speed multiplier while slowed (applyEffect slow).",
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 1
              },
              "slowTicks": {
                "description": "Slow duration in ticks.",
                "type": "integer",
                "minimum": 1
              }
            }
          },
          "attack": {
            "description": "projectile fires shots; pulse hits everything in range on cooldown (no projectile); none never attacks (producers).",
            "enum": [
              "projectile",
              "pulse",
              "none"
            ],
            "default": "projectile"
          },
          "production": {
            "description": "Resource yield per cycle (Refinery). Ore counts only while the tower stands on an ore cell - engine rule, PRD sec 5.3. scrap is reserved shape for the foundry relic (PRD sec 7.4); no shipped tower uses it.",
            "type": "object",
            "required": [
              "everyTicks"
            ],
            "additionalProperties": false,
            "properties": {
              "ore": {
                "type": "number",
                "minimum": 0
              },
              "scrap": {
                "type": "number",
                "minimum": 0
              },
              "everyTicks": {
                "description": "Cycle length in ticks at 20 Hz.",
                "type": "integer",
                "minimum": 1
              }
            }
          },
          "tiers": {
            "description": "Tower Dominion-style tree: 3 tiers, each an either/or choice, mutually exclusive, unlocked in order. 2+4+8 = 14 tower variants.",
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
              "type": "object",
              "required": [
                "choices"
              ],
              "additionalProperties": false,
              "properties": {
                "choices": {
                  "type": "array",
                  "minItems": 2,
                  "maxItems": 2,
                  "items": {
                    "type": "object",
                    "required": [
                      "name",
                      "cost"
                    ],
                    "additionalProperties": false,
                    "properties": {
                      "name": {
                        "type": "string"
                      },
                      "cost": {
                        "type": "number",
                        "minimum": 0
                      },
                      "mods": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "damage": {
                            "type": "number"
                          },
                          "range": {
                            "type": "number"
                          },
                          "fireEveryTicks": {
                            "type": "number"
                          },
                          "explodeRadius": {
                            "type": "number"
                          },
                          "slowTicks": {
                            "type": "number"
                          },
                          "production": {
                            "description": "Additive yield per cycle.",
                            "type": "number"
                          },
                          "productionEveryTicks": {
                            "description": "Additive cycle-length delta (negative = faster).",
                            "type": "number"
                          }
                        }
                      },
                      "unlocks": {
                        "description": "Capability grant: surveySpeed accelerates all prospect jobs (stacking per tower); surveyAuto prospects nearby rock autonomously.",
                        "enum": [
                          "surveySpeed",
                          "surveyAuto"
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;
