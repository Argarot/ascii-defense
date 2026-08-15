// AUTO-GENERATED from schema/tiles.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Terrain tile library. A tile is a 5x5 grid of cell codes (G ground, R road, K rock, O ore, S spawn). Edge connectors are DERIVED from the grid - roads may cross an edge only at its center cell - so there is no conn field to disagree with the drawing. Semantic rules (center-or-nothing, route continuity, interior spawns) are enforced by engine validateTile, run over this file in CI.
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
    },
    ...{
      id: string;
      name?: string;
      /**
       * @minItems 5
       * @maxItems 5
       */
      cells: [string, string, string, string, string];
    }[]
  ];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const tilesSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/tiles.schema.json",
  "title": "TileLibrary",
  "description": "Terrain tile library. A tile is a 5x5 grid of cell codes (G ground, R road, K rock, O ore, S spawn). Edge connectors are DERIVED from the grid - roads may cross an edge only at its center cell - so there is no conn field to disagree with the drawing. Semantic rules (center-or-nothing, route continuity, interior spawns) are enforced by engine validateTile, run over this file in CI.",
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
              "pattern": "^[GRKOS]{5}$"
            }
          }
        }
      }
    }
  }
} as const;
