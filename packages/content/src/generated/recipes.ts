// AUTO-GENERATED from schema/recipes.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Duo recipes (session 28, PR 3; PRD sec 7.6 fusion): two held relics, in either order, combine into a third at the higher of their rarities. The result is a relic in relics/pool.json marked fusionOnly.
 */
export interface RecipePool {
  $schema?: string;
  /**
   * @minItems 1
   */
  recipes: [
    {
      a: string;
      b: string;
      result: string;
      desc: string;
    },
    ...{
      a: string;
      b: string;
      result: string;
      desc: string;
    }[]
  ];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const recipesSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/recipes.schema.json",
  "title": "RecipePool",
  "description": "Duo recipes (session 28, PR 3; PRD sec 7.6 fusion): two held relics, in either order, combine into a third at the higher of their rarities. The result is a relic in relics/pool.json marked fusionOnly.",
  "type": "object",
  "required": [
    "recipes"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "recipes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "a",
          "b",
          "result",
          "desc"
        ],
        "additionalProperties": false,
        "properties": {
          "a": {
            "type": "string"
          },
          "b": {
            "type": "string"
          },
          "result": {
            "type": "string"
          },
          "desc": {
            "type": "string"
          }
        }
      }
    }
  }
} as const;
