// AUTO-GENERATED from schema/palette.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Role name to colour. Sprites never contain hex values (ASSETS.md sec 4): they name roles, the palette decides. A biome re-tint is a palette swap, never an art rewrite.
 */
export interface Palette {
  $schema?: string;
  roles: {
    /**
     * 24-bit hex colour, always 6 digits.
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z][a-zA-Z0-9._]*$".
     */
    [k: string]: string;
  };
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const paletteSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/palette.schema.json",
  "title": "Palette",
  "description": "Role name to colour. Sprites never contain hex values (ASSETS.md sec 4): they name roles, the palette decides. A biome re-tint is a palette swap, never an art rewrite.",
  "type": "object",
  "required": [
    "roles"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "roles": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": false,
      "patternProperties": {
        "^[a-z][a-zA-Z0-9._]*$": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "24-bit hex colour, always 6 digits."
        }
      }
    }
  }
} as const;
