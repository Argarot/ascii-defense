// AUTO-GENERATED from schema/grid.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * The cell geometry content is authored for (session 22, D24): glyphs per cell and the font's glyph pixels. ONE source: the linter checks every sprite's cell against it, and the view reads its cell size from it. Changing it means redrawing every sprite (ARCHITECTURE sec 1).
 */
export interface Grid {
  $schema?: string;
  /**
   * [width, height] in glyphs.
   *
   * @minItems 2
   * @maxItems 2
   */
  cell: [number, number];
  /**
   * [width, height] of one glyph in pixels (the bitmap font's native size).
   *
   * @minItems 2
   * @maxItems 2
   */
  glyphPx: [number, number];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const gridSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/grid.schema.json",
  "title": "Grid",
  "description": "The cell geometry content is authored for (session 22, D24): glyphs per cell and the font's glyph pixels. ONE source: the linter checks every sprite's cell against it, and the view reads its cell size from it. Changing it means redrawing every sprite (ARCHITECTURE sec 1).",
  "type": "object",
  "required": [
    "cell",
    "glyphPx"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
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
    "glyphPx": {
      "description": "[width, height] of one glyph in pixels (the bitmap font's native size).",
      "type": "array",
      "items": {
        "type": "integer",
        "minimum": 1
      },
      "minItems": 2,
      "maxItems": 2
    }
  }
} as const;
