// AUTO-GENERATED from schema/enemies.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Enemy definitions. hp/speed/damage are the M1 surface; traits and bounty are reserved shape for the trait matrix (PRD sec 7) and the Scrap economy. speed is cells per tick at 20 Hz.
 */
export interface EnemyRoster {
  $schema?: string;
  /**
   * @minItems 1
   */
  enemies: [
    {
      id: string;
      name?: string;
      hp: number;
      speed: number;
      /**
       * Core health lost on breach (PRD sec 4.5).
       */
      damage: number;
      /**
       * Scrap on kill. Reserved; economy lands in session B.
       */
      bounty?: number;
      traits?: ('armoured' | 'shielded' | 'fast' | 'swarm')[];
      /**
       * Damage multipliers by type (session 26, PRD sec 8): 0 immune, 0.5 resists, 1.5 weak; absent = 1. Applied before armour; an immune body takes nothing.
       */
      resist?: {
        kinetic?: number;
        energy?: number;
      };
      /**
       * Flat damage reduction per hit; hits always deal at least 1.
       */
      armor?: number;
      /**
       * Absorb pool burned before hp.
       */
      shield?: number;
      /**
       * First wave this enemy may appear in.
       */
      minWave?: number;
    },
    ...{
      id: string;
      name?: string;
      hp: number;
      speed: number;
      /**
       * Core health lost on breach (PRD sec 4.5).
       */
      damage: number;
      /**
       * Scrap on kill. Reserved; economy lands in session B.
       */
      bounty?: number;
      traits?: ('armoured' | 'shielded' | 'fast' | 'swarm')[];
      /**
       * Damage multipliers by type (session 26, PRD sec 8): 0 immune, 0.5 resists, 1.5 weak; absent = 1. Applied before armour; an immune body takes nothing.
       */
      resist?: {
        kinetic?: number;
        energy?: number;
      };
      /**
       * Flat damage reduction per hit; hits always deal at least 1.
       */
      armor?: number;
      /**
       * Absorb pool burned before hp.
       */
      shield?: number;
      /**
       * First wave this enemy may appear in.
       */
      minWave?: number;
    }[]
  ];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const enemiesSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/enemies.schema.json",
  "title": "EnemyRoster",
  "description": "Enemy definitions. hp/speed/damage are the M1 surface; traits and bounty are reserved shape for the trait matrix (PRD sec 7) and the Scrap economy. speed is cells per tick at 20 Hz.",
  "type": "object",
  "required": [
    "enemies"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "enemies": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "hp",
          "speed",
          "damage"
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
          "hp": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "speed": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          },
          "damage": {
            "description": "Core health lost on breach (PRD sec 4.5).",
            "type": "number",
            "minimum": 0
          },
          "bounty": {
            "description": "Scrap on kill. Reserved; economy lands in session B.",
            "type": "number",
            "minimum": 0
          },
          "traits": {
            "type": "array",
            "items": {
              "enum": [
                "armoured",
                "shielded",
                "fast",
                "swarm"
              ]
            },
            "uniqueItems": true
          },
          "resist": {
            "description": "Damage multipliers by type (session 26, PRD sec 8): 0 immune, 0.5 resists, 1.5 weak; absent = 1. Applied before armour; an immune body takes nothing.",
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "kinetic": {
                "type": "number",
                "minimum": 0
              },
              "energy": {
                "type": "number",
                "minimum": 0
              }
            }
          },
          "armor": {
            "description": "Flat damage reduction per hit; hits always deal at least 1.",
            "type": "number",
            "minimum": 0
          },
          "shield": {
            "description": "Absorb pool burned before hp.",
            "type": "number",
            "minimum": 0
          },
          "minWave": {
            "description": "First wave this enemy may appear in.",
            "type": "integer",
            "minimum": 1
          }
        }
      }
    }
  }
} as const;
