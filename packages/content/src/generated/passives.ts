// AUTO-GENERATED from schema/passives.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Passives (PRD sec 7.8, D26 decided 2026-09-06): the permanent modifier layer, separate from relics. A passive is a set of tower mods folded into EVERY tower like a tier, plus economy knobs; six slots a run, one pick every second wave from three offered. Tags feed the set effects of session 28 PR 2.
 */
export interface PassivePool {
  $schema?: string;
  /**
   * @minItems 1
   */
  passives: [
    {
      id: string;
      name: string;
      /**
       * Player-facing card text.
       */
      desc: string;
      tags?: ('damage' | 'rate' | 'reach' | 'cold' | 'kinetic' | 'energy' | 'support' | 'economy' | 'core')[];
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
        /**
         * Scrap paid at every wave launch.
         */
        waveScrap?: number;
        /**
         * Multiplies every bounty (rounded).
         */
        bountyMul?: number;
        /**
         * Added to the Core max hp (and current hp) when picked.
         */
        coreHpMaxAdd?: number;
      };
    },
    ...{
      id: string;
      name: string;
      /**
       * Player-facing card text.
       */
      desc: string;
      tags?: ('damage' | 'rate' | 'reach' | 'cold' | 'kinetic' | 'energy' | 'support' | 'economy' | 'core')[];
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
        /**
         * Scrap paid at every wave launch.
         */
        waveScrap?: number;
        /**
         * Multiplies every bounty (rounded).
         */
        bountyMul?: number;
        /**
         * Added to the Core max hp (and current hp) when picked.
         */
        coreHpMaxAdd?: number;
      };
    }[]
  ];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const passivesSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/passives.schema.json",
  "title": "PassivePool",
  "description": "Passives (PRD sec 7.8, D26 decided 2026-09-06): the permanent modifier layer, separate from relics. A passive is a set of tower mods folded into EVERY tower like a tier, plus economy knobs; six slots a run, one pick every second wave from three offered. Tags feed the set effects of session 28 PR 2.",
  "type": "object",
  "required": [
    "passives"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "passives": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "name",
          "desc"
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
          "desc": {
            "type": "string",
            "description": "Player-facing card text."
          },
          "tags": {
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
                "type": "integer",
                "description": "Scrap paid at every wave launch."
              },
              "bountyMul": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "Multiplies every bounty (rounded)."
              },
              "coreHpMaxAdd": {
                "type": "integer",
                "description": "Added to the Core max hp (and current hp) when picked."
              }
            }
          }
        }
      }
    }
  }
} as const;
