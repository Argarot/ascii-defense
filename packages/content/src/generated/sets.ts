// AUTO-GENERATED from schema/sets.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Set effects (session 28, PR 2): held passives and relics count per tag; at `at` of a tag the set lights and its mods fold into every tower like a passive, its econ into the run. Two thresholds per tag, two and three.
 */
export interface SetPool {
  $schema?: string;
  /**
   * @minItems 1
   */
  sets: [
    {
      tag: 'damage' | 'rate' | 'reach' | 'cold' | 'kinetic' | 'energy' | 'support' | 'economy' | 'core';
      at: number;
      name: string;
      desc: string;
      /**
       * Tower mods applied to every tower, the same shape as a tier choice (StatMods). Only fields safe on every tower belong here: a blast radius on a Bolt would make it explode.
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
      econ?: {
        waveScrap?: number;
        bountyMul?: number;
        /**
         * The Core mends this much at every wave launch while the set is lit.
         */
        coreHealPerWave?: number;
      };
    },
    ...{
      tag: 'damage' | 'rate' | 'reach' | 'cold' | 'kinetic' | 'energy' | 'support' | 'economy' | 'core';
      at: number;
      name: string;
      desc: string;
      /**
       * Tower mods applied to every tower, the same shape as a tier choice (StatMods). Only fields safe on every tower belong here: a blast radius on a Bolt would make it explode.
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
      econ?: {
        waveScrap?: number;
        bountyMul?: number;
        /**
         * The Core mends this much at every wave launch while the set is lit.
         */
        coreHealPerWave?: number;
      };
    }[]
  ];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const setsSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/sets.schema.json",
  "title": "SetPool",
  "description": "Set effects (session 28, PR 2): held passives and relics count per tag; at `at` of a tag the set lights and its mods fold into every tower like a passive, its econ into the run. Two thresholds per tag, two and three.",
  "type": "object",
  "required": [
    "sets"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "sets": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "tag",
          "at",
          "name",
          "desc"
        ],
        "additionalProperties": false,
        "properties": {
          "tag": {
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
          "at": {
            "type": "integer",
            "minimum": 2,
            "maximum": 3
          },
          "name": {
            "type": "string"
          },
          "desc": {
            "type": "string"
          },
          "mods": {
            "type": "object",
            "description": "Tower mods applied to every tower, the same shape as a tier choice (StatMods). Only fields safe on every tower belong here: a blast radius on a Bolt would make it explode.",
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
          "econ": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "waveScrap": {
                "type": "integer"
              },
              "bountyMul": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "coreHealPerWave": {
                "type": "integer",
                "description": "The Core mends this much at every wave launch while the set is lit."
              }
            }
          }
        }
      }
    }
  }
} as const;
