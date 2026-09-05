// AUTO-GENERATED from schema/sprite.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * @minItems 1
 */
export type Grid = [string, ...string[]];
/**
 * Optional per-glyph BACKGROUND role keys, same shape as ink, resolved through the same inkMap. Absent = the view's default (the terrain shows through under a transparent glyph; a sprite's ground role otherwise).
 *
 * @minItems 1
 */
export type Grid1 = [string, ...string[]];
/**
 * Frames played ONCE from the first, on the world clock (a paused world holds the frame), then the state returns to its idle cycle.
 *
 * @minItems 1
 */
export type Sequence = [Frame, ...Frame[]];

/**
 * Sprite format v2 (session 22, 2026-09-04; kinds and sequences session 25). Glyph-grid art plus parallel INK grids naming colour roles (ASSETS.md sec 3). A sprite is a map of STATES keyed by a string the view chooses: for towers the choice path ('' base, '0', '01', '010' - option index per committed tier, in tier order); for terrain the cell letter; for the Core face top/mid/bot; for enemies and relics '' alone. Each state has base art, optional idle FRAMES (animation, wall clock), optional VARIATIONS (static alternates the view picks by position hash, never by dice), and optional SEQUENCES (charge, fire, cool, hit) played once on an event, on the world clock. What the schema cannot express - grids matching the cell, ink keys in inkMap, roles in the palette, glyphs in the font, the cell matching grid.json per kind - is enforced by the content linter.
 */
export interface Sprite {
  $schema?: string;
  id: string;
  /**
   * What the sprite is drawn AS (session 25); decides the cell rule. tower/terrain/face: the cell equals grid.json (the face is the Core's three stacked cells, states top/mid/bot). enemy: at most 5x3, drawn centred on the walker. relic: exactly 4x3, the inventory slot's interior. Absent = tower.
   */
  kind?: 'tower' | 'terrain' | 'enemy' | 'relic' | 'face';
  /**
   * [width, height] in glyphs. The rule depends on kind (see kind); the linter holds it.
   *
   * @minItems 2
   * @maxItems 2
   */
  cell: [number, number];
  /**
   * Idle-cycle cadence in wall-clock milliseconds (WBS 4.1).
   */
  frameMs?: number;
  /**
   * Provenance: the file under sources/sprites/ this was imported from, and the importer. Regenerate with `node tools/import-sprites.mjs`; never hand-edit an imported sprite.
   */
  source?: string;
  states: {
    [k: string]: State;
  };
  /**
   * Ink key to palette role. 'PATH' resolves to the instance's upgrade-path colour; null is transparent (the glyph is not drawn).
   */
  inkMap: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^.$".
     */
    [k: string]: string | null;
  };
}
export interface State {
  art: Grid;
  ink: Grid;
  bgInk?: Grid;
  /**
   * Additional idle frames beyond the base art (frame 0). The cycle is [base, ...frames], cadence frameMs, on the wall clock; reduced motion pins frame 0.
   *
   * @minItems 1
   */
  frames?: [Frame, ...Frame[]];
  /**
   * Event-keyed animations (session 25): 'charge' while a target is held and the cooldown is nearly out, 'fire' on the tower's fire event, 'cool' right after, 'hit' when an enemy takes damage. A sprite without them gets the view's derived placeholder (a flash and a recoil from the base art).
   */
  sequences?: {
    charge?: Sequence;
    fire?: Sequence;
    cool?: Sequence;
    hit?: Sequence;
  };
  /**
   * Static alternates of this state beyond the base (variation 0). The view picks one per board position with the mixing hash - same cell, same look, no randomness spent. Each may carry its own frames.
   *
   * @minItems 1
   */
  variations?: [
    {
      art: Grid;
      ink: Grid;
      bgInk?: Grid;
      /**
       * @minItems 1
       */
      frames?: [Frame, ...Frame[]];
    },
    ...{
      art: Grid;
      ink: Grid;
      bgInk?: Grid;
      /**
       * @minItems 1
       */
      frames?: [Frame, ...Frame[]];
    }[]
  ];
}
export interface Frame {
  art: Grid;
  ink: Grid;
  bgInk?: Grid1;
  /**
   * This frame's duration in a SEQUENCE, world-clock milliseconds (session 25). Absent = the sprite's frameMs. Ignored on idle frames, whose cadence is frameMs.
   */
  ms?: number;
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const spriteSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/sprite.schema.json",
  "title": "Sprite",
  "description": "Sprite format v2 (session 22, 2026-09-04; kinds and sequences session 25). Glyph-grid art plus parallel INK grids naming colour roles (ASSETS.md sec 3). A sprite is a map of STATES keyed by a string the view chooses: for towers the choice path ('' base, '0', '01', '010' - option index per committed tier, in tier order); for terrain the cell letter; for the Core face top/mid/bot; for enemies and relics '' alone. Each state has base art, optional idle FRAMES (animation, wall clock), optional VARIATIONS (static alternates the view picks by position hash, never by dice), and optional SEQUENCES (charge, fire, cool, hit) played once on an event, on the world clock. What the schema cannot express - grids matching the cell, ink keys in inkMap, roles in the palette, glyphs in the font, the cell matching grid.json per kind - is enforced by the content linter.",
  "type": "object",
  "required": [
    "id",
    "cell",
    "states",
    "inkMap"
  ],
  "additionalProperties": false,
  "definitions": {
    "grid": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "minItems": 1
    },
    "frame": {
      "type": "object",
      "required": [
        "art",
        "ink"
      ],
      "additionalProperties": false,
      "properties": {
        "art": {
          "$ref": "#/definitions/grid"
        },
        "ink": {
          "$ref": "#/definitions/grid"
        },
        "bgInk": {
          "description": "Optional per-glyph BACKGROUND role keys, same shape as ink, resolved through the same inkMap. Absent = the view's default (the terrain shows through under a transparent glyph; a sprite's ground role otherwise).",
          "$ref": "#/definitions/grid"
        },
        "ms": {
          "description": "This frame's duration in a SEQUENCE, world-clock milliseconds (session 25). Absent = the sprite's frameMs. Ignored on idle frames, whose cadence is frameMs.",
          "type": "integer",
          "minimum": 20
        }
      }
    },
    "sequence": {
      "description": "Frames played ONCE from the first, on the world clock (a paused world holds the frame), then the state returns to its idle cycle.",
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/definitions/frame"
      }
    },
    "state": {
      "type": "object",
      "required": [
        "art",
        "ink"
      ],
      "additionalProperties": false,
      "properties": {
        "art": {
          "$ref": "#/definitions/grid"
        },
        "ink": {
          "$ref": "#/definitions/grid"
        },
        "bgInk": {
          "$ref": "#/definitions/grid"
        },
        "frames": {
          "description": "Additional idle frames beyond the base art (frame 0). The cycle is [base, ...frames], cadence frameMs, on the wall clock; reduced motion pins frame 0.",
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/definitions/frame"
          }
        },
        "sequences": {
          "description": "Event-keyed animations (session 25): 'charge' while a target is held and the cooldown is nearly out, 'fire' on the tower's fire event, 'cool' right after, 'hit' when an enemy takes damage. A sprite without them gets the view's derived placeholder (a flash and a recoil from the base art).",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "charge": {
              "$ref": "#/definitions/sequence"
            },
            "fire": {
              "$ref": "#/definitions/sequence"
            },
            "cool": {
              "$ref": "#/definitions/sequence"
            },
            "hit": {
              "$ref": "#/definitions/sequence"
            }
          }
        },
        "variations": {
          "description": "Static alternates of this state beyond the base (variation 0). The view picks one per board position with the mixing hash - same cell, same look, no randomness spent. Each may carry its own frames.",
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": [
              "art",
              "ink"
            ],
            "additionalProperties": false,
            "properties": {
              "art": {
                "$ref": "#/definitions/grid"
              },
              "ink": {
                "$ref": "#/definitions/grid"
              },
              "bgInk": {
                "$ref": "#/definitions/grid"
              },
              "frames": {
                "type": "array",
                "minItems": 1,
                "items": {
                  "$ref": "#/definitions/frame"
                }
              }
            }
          }
        }
      }
    }
  },
  "properties": {
    "$schema": {
      "type": "string"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*$"
    },
    "kind": {
      "description": "What the sprite is drawn AS (session 25); decides the cell rule. tower/terrain/face: the cell equals grid.json (the face is the Core's three stacked cells, states top/mid/bot). enemy: at most 5x3, drawn centred on the walker. relic: exactly 4x3, the inventory slot's interior. Absent = tower.",
      "type": "string",
      "enum": [
        "tower",
        "terrain",
        "enemy",
        "relic",
        "face"
      ]
    },
    "cell": {
      "description": "[width, height] in glyphs. The rule depends on kind (see kind); the linter holds it.",
      "type": "array",
      "items": {
        "type": "integer",
        "minimum": 1
      },
      "minItems": 2,
      "maxItems": 2
    },
    "frameMs": {
      "description": "Idle-cycle cadence in wall-clock milliseconds (WBS 4.1).",
      "type": "integer",
      "minimum": 60
    },
    "source": {
      "description": "Provenance: the file under sources/sprites/ this was imported from, and the importer. Regenerate with `node tools/import-sprites.mjs`; never hand-edit an imported sprite.",
      "type": "string"
    },
    "states": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": {
        "$ref": "#/definitions/state"
      }
    },
    "inkMap": {
      "description": "Ink key to palette role. 'PATH' resolves to the instance's upgrade-path colour; null is transparent (the glyph is not drawn).",
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
