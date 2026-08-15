// AUTO-GENERATED from schema/sprite.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Glyph-grid art plus a parallel ink grid naming colour roles (ASSETS.md sec 3). What the schema cannot express - art/ink dimensions matching the declared cell, every ink key existing in inkMap - is enforced by the content linter.
 */
export interface Sprite {
  $schema?: string;
  id: string;
  /**
   * [width, height] in glyphs.
   *
   * @minItems 2
   * @maxItems 2
   */
  cell: [number, number];
  tiers: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[0-9]+$".
     */
    [k: string]: {
      /**
       * @minItems 1
       */
      art: [string, ...string[]];
      /**
       * @minItems 1
       */
      ink: [string, ...string[]];
    };
  };
  /**
   * Ink key to palette role. 'PATH' resolves to the instance's upgrade-path colour; null is transparent.
   */
  inkMap: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^.$".
     */
    [k: string]: string | null;
  };
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const spriteSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/sprite.schema.json",
  "title": "Sprite",
  "description": "Glyph-grid art plus a parallel ink grid naming colour roles (ASSETS.md sec 3). What the schema cannot express - art/ink dimensions matching the declared cell, every ink key existing in inkMap - is enforced by the content linter.",
  "type": "object",
  "required": [
    "id",
    "cell",
    "tiers",
    "inkMap"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*$"
    },
    "cell": {
      "description": "[width, height] in glyphs.",
      "type": "array",
      "items": {
        "type": "integer",
        "minimum": 1
      },
      "minItems": 2,
      "maxItems": 2
    },
    "tiers": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": false,
      "patternProperties": {
        "^[0-9]+$": {
          "type": "object",
          "required": [
            "art",
            "ink"
          ],
          "additionalProperties": false,
          "properties": {
            "art": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "minItems": 1
            },
            "ink": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "minItems": 1
            }
          }
        }
      }
    },
    "inkMap": {
      "description": "Ink key to palette role. 'PATH' resolves to the instance's upgrade-path colour; null is transparent.",
      "type": "object",
      "minProperties": 1,
      "patternProperties": {
        "^.$": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "additionalProperties": false
    }
  }
} as const;
