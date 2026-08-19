// AUTO-GENERATED from schema/tiles.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Terrain tile library. A tile is a 5x5 grid of cell codes (G ground, R rock, O ore, C core; roads as port segments - | L J F 7 T U E 3, X omni crossroads, B bridge). Edge connectors are DERIVED from the grid - roads may cross an edge only at its center cell - so there is no conn field to disagree with the drawing. Semantic rules (center-or-nothing, route continuity, interior spawns) are enforced by engine validateTile, run over this file in CI.
 */
export interface TileLibrary {
  $schema?: string;
  /**
   * @minItems 1
   */
  tiles: [
    {
      id: string;
      name?: string;
      /**
       * @minItems 5
       * @maxItems 5
       */
      cells: [string, string, string, string, string];
      /**
       * Relative pick weight in generation pools (default 1). Rare specials go low, staples high.
       */
      weight?: number;
      /**
       * A SPECIAL tile (2.21, extended 2026-08-19): selectable in the loadout, guaranteed on the map when chosen, never rolled from the random pools. Shipped tiles whose roads touch without merging, or carry two disconnected road segments, carry this flag.
       */
      special?: boolean;
      /**
       * Authored ore veins (2.18): richness placed by the tile's author, overriding the generator's dice for these cells. Must sit on O cells.
       */
      deposits?: {
        x: number;
        y: number;
        amount: number;
        tier?: number;
      }[];
      /**
       * Authored boon cells (2.18): the tile, not the dice, places the power. Must sit on G cells.
       */
      boons?: {
        x: number;
        y: number;
        boon: 'range' | 'damage' | 'rate';
        tier: number;
      }[];
    },
    ...{
      id: string;
      name?: string;
      /**
       * @minItems 5
       * @maxItems 5
       */
      cells: [string, string, string, string, string];
      /**
       * Relative pick weight in generation pools (default 1). Rare specials go low, staples high.
       */
      weight?: number;
      /**
       * A SPECIAL tile (2.21, extended 2026-08-19): selectable in the loadout, guaranteed on the map when chosen, never rolled from the random pools. Shipped tiles whose roads touch without merging, or carry two disconnected road segments, carry this flag.
       */
      special?: boolean;
      /**
       * Authored ore veins (2.18): richness placed by the tile's author, overriding the generator's dice for these cells. Must sit on O cells.
       */
      deposits?: {
        x: number;
        y: number;
        amount: number;
        tier?: number;
      }[];
      /**
       * Authored boon cells (2.18): the tile, not the dice, places the power. Must sit on G cells.
       */
      boons?: {
        x: number;
        y: number;
        boon: 'range' | 'damage' | 'rate';
        tier: number;
      }[];
    }[]
  ];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const tilesSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/tiles.schema.json",
  "title": "TileLibrary",
  "description": "Terrain tile library. A tile is a 5x5 grid of cell codes (G ground, R rock, O ore, C core; roads as port segments - | L J F 7 T U E 3, X omni crossroads, B bridge). Edge connectors are DERIVED from the grid - roads may cross an edge only at its center cell - so there is no conn field to disagree with the drawing. Semantic rules (center-or-nothing, route continuity, interior spawns) are enforced by engine validateTile, run over this file in CI.",
  "type": "object",
  "required": [
    "tiles"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "tiles": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "cells"
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
          "cells": {
            "type": "array",
            "minItems": 5,
            "maxItems": 5,
            "items": {
              "type": "string",
              "pattern": "^[GXBROCTUE3\\-|LJF7]{5}$"
            }
          },
          "weight": {
            "description": "Relative pick weight in generation pools (default 1). Rare specials go low, staples high.",
            "type": "number",
            "exclusiveMinimum": 0
          },
          "special": {
            "description": "A SPECIAL tile (2.21, extended 2026-08-19): selectable in the loadout, guaranteed on the map when chosen, never rolled from the random pools. Shipped tiles whose roads touch without merging, or carry two disconnected road segments, carry this flag.",
            "type": "boolean"
          },
          "deposits": {
            "description": "Authored ore veins (2.18): richness placed by the tile's author, overriding the generator's dice for these cells. Must sit on O cells.",
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "x",
                "y",
                "amount"
              ],
              "additionalProperties": false,
              "properties": {
                "x": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 4
                },
                "y": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 4
                },
                "amount": {
                  "type": "number",
                  "exclusiveMinimum": 0
                },
                "tier": {
                  "type": "integer",
                  "minimum": 1
                }
              }
            }
          },
          "boons": {
            "description": "Authored boon cells (2.18): the tile, not the dice, places the power. Must sit on G cells.",
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "x",
                "y",
                "boon",
                "tier"
              ],
              "additionalProperties": false,
              "properties": {
                "x": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 4
                },
                "y": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 4
                },
                "boon": {
                  "enum": [
                    "range",
                    "damage",
                    "rate"
                  ]
                },
                "tier": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 4
                }
              }
            }
          }
        }
      }
    }
  }
} as const;
