// AUTO-GENERATED from schema/terrain.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * The art surface for cells (playtest 14, Daniil's principle: visuals slot onto the backend like clothing). Each cell letter names its glyph pool - the characters terrain texture draws from - plus the water and shore pools. A graphics pack replaces THIS FILE (and the palette); no code changes. Colours come from palette roles, never from here.
 */
export interface TerrainAppearance {
  $schema?: string;
  /**
   * Glyph pool per cell letter. Every letter of the cell alphabet must be present - the loader refuses a pack with missing cells.
   */
  pools: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^.$".
     */
    [k: string]: string;
  };
  waterPool: string;
  sandPool: string;
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const terrainSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/terrain.schema.json",
  "title": "TerrainAppearance",
  "description": "The art surface for cells (playtest 14, Daniil's principle: visuals slot onto the backend like clothing). Each cell letter names its glyph pool - the characters terrain texture draws from - plus the water and shore pools. A graphics pack replaces THIS FILE (and the palette); no code changes. Colours come from palette roles, never from here.",
  "type": "object",
  "required": [
    "pools",
    "waterPool",
    "sandPool"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "pools": {
      "description": "Glyph pool per cell letter. Every letter of the cell alphabet must be present - the loader refuses a pack with missing cells.",
      "type": "object",
      "minProperties": 1,
      "additionalProperties": false,
      "patternProperties": {
        "^.$": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "waterPool": {
      "type": "string",
      "minLength": 1
    },
    "sandPool": {
      "type": "string",
      "minLength": 1
    }
  }
} as const;
