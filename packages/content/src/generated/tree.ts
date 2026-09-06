// AUTO-GENERATED from schema/tree.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * The meta tree (PRD sec 11; session 29): what banked Ore buys between runs. `base` is what every player starts with; each node is bought once, with Ore of one tier, after its `requires`, and GRANTS content, capacity or access. Relics unlock by TAG (a branch: every common of the tag); rarer relics of an unlocked tag are earned by wins (PRD sec 19 item 3). Nothing here is a stat multiplier - the tree owns the pool and the capacity, never the power (PRD sec 7.5).
 */
export interface TechTree {
  $schema?: string;
  base: Grant;
  nodes: {
    id: string;
    name: string;
    branch: 'arsenal' | 'reliquary' | 'capacity' | 'threat' | 'ore';
    desc: string;
    cost: {
      /**
       * Which Ore tier pays: higher nodes want rarer Ore (Daniil, 2026-09-06).
       */
      tier: number;
      ore: number;
    };
    /**
     * Node ids that must be bought first - the branches of the tree.
     */
    requires?: string[];
    grants: Grant;
  }[];
}
export interface Grant {
  /**
   * Tower ids that may be built.
   */
  towers?: string[];
  /**
   * Relic ids that may be offered, whatever their rarity.
   */
  relics?: string[];
  /**
   * A BRANCH: every common relic carrying the tag may be offered; its rarer relics are earned by wins.
   */
  relicTags?: string[];
  /**
   * Relic slots the Core holds; nodes ADD to the base.
   */
  relicSlots?: number;
  /**
   * The highest Threat index the setup page offers.
   */
  threat?: number;
  /**
   * Special tiles a loadout may carry; nodes ADD to the base.
   */
  tileSlots?: number;
  /**
   * The highest Ore tier whose vein tiles the workshop sells.
   */
  oreTier?: number;
  /**
   * Endless mode may be chosen at setup (PRD sec 19 item 22).
   */
  endless?: boolean;
  /**
   * Reserved: the Tile Smith opens by buying every tile, not by a node (Daniil, answer 6).
   */
  tileSmith?: boolean;
  /**
   * Special tile ids the workshop may sell.
   */
  tiles?: string[];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const treeSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/tree.schema.json",
  "title": "TechTree",
  "description": "The meta tree (PRD sec 11; session 29): what banked Ore buys between runs. `base` is what every player starts with; each node is bought once, with Ore of one tier, after its `requires`, and GRANTS content, capacity or access. Relics unlock by TAG (a branch: every common of the tag); rarer relics of an unlocked tag are earned by wins (PRD sec 19 item 3). Nothing here is a stat multiplier - the tree owns the pool and the capacity, never the power (PRD sec 7.5).",
  "type": "object",
  "required": [
    "base",
    "nodes"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "base": {
      "$ref": "#/definitions/grant"
    },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "name",
          "branch",
          "desc",
          "cost",
          "grants"
        ],
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z0-9_]+$"
          },
          "name": {
            "type": "string"
          },
          "branch": {
            "enum": [
              "arsenal",
              "reliquary",
              "capacity",
              "threat",
              "ore"
            ]
          },
          "desc": {
            "type": "string"
          },
          "cost": {
            "type": "object",
            "required": [
              "tier",
              "ore"
            ],
            "additionalProperties": false,
            "properties": {
              "tier": {
                "type": "integer",
                "minimum": 1,
                "maximum": 3,
                "description": "Which Ore tier pays: higher nodes want rarer Ore (Daniil, 2026-09-06)."
              },
              "ore": {
                "type": "integer",
                "minimum": 1
              }
            }
          },
          "requires": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Node ids that must be bought first - the branches of the tree."
          },
          "grants": {
            "$ref": "#/definitions/grant"
          }
        }
      }
    }
  },
  "definitions": {
    "grant": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "towers": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Tower ids that may be built."
        },
        "relics": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Relic ids that may be offered, whatever their rarity."
        },
        "relicTags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "A BRANCH: every common relic carrying the tag may be offered; its rarer relics are earned by wins."
        },
        "relicSlots": {
          "type": "integer",
          "minimum": 0,
          "description": "Relic slots the Core holds; nodes ADD to the base."
        },
        "threat": {
          "type": "integer",
          "minimum": 0,
          "description": "The highest Threat index the setup page offers."
        },
        "tileSlots": {
          "type": "integer",
          "minimum": 0,
          "description": "Special tiles a loadout may carry; nodes ADD to the base."
        },
        "oreTier": {
          "type": "integer",
          "minimum": 1,
          "maximum": 3,
          "description": "The highest Ore tier whose vein tiles the workshop sells."
        },
        "endless": {
          "type": "boolean",
          "description": "Endless mode may be chosen at setup (PRD sec 19 item 22)."
        },
        "tileSmith": {
          "type": "boolean",
          "description": "Reserved: the Tile Smith opens by buying every tile, not by a node (Daniil, answer 6)."
        },
        "tiles": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Special tile ids the workshop may sell."
        }
      }
    }
  }
} as const;
