// AUTO-GENERATED from schema/relics.schema.json - do not edit.
// Regenerate: node tools/build-content-types.mjs

/**
 * Relics (PRD sec 7): rule modifiers acquired mid-run, run-local, held by the Core. Effects are named engine knobs - a relic is data wired to hooks, never code. rarity is reserved shape (D5): present from the first commit, unused until play evidence says how to weight the pool.
 */
export interface RelicPool {
  $schema?: string;
  /**
   * @minItems 1
   */
  relics: [
    {
      id: string;
      name: string;
      /**
       * passive: always on. active: fired from the Core, long cooldown. consumable: one use, effects then permanent for the run.
       */
      kind: 'passive' | 'active' | 'consumable';
      /**
       * Player-facing card text. The offer modal renders this - a relic the player cannot understand is a relic that does not exist.
       */
      desc: string;
      /**
       * Reserved (D5). The M1 pool is flat.
       */
      rarity?: 'common' | 'rare' | 'epic';
      /**
       * Actives: ticks between firings at 20 Hz.
       */
      cooldownTicks?: number;
      /**
       * Named engine knobs. Every field is optional; a relic sets the ones it means. Adding a knob is an engine change; adding a relic that uses existing knobs is content.
       */
      effects?: {
        /**
         * Excess kill damage chains to the nearest enemy, repeatedly.
         */
        overkillCarry?: boolean;
        /**
         * Damage multiplier against slowed enemies (Frostbite).
         */
        slowedDamageMul?: number;
        /**
         * Flat Scrap per kill (Tithe).
         */
        killRefundScrap?: number;
        /**
         * Explosion AoE resolves twice (Splinter).
         */
        explodeTwice?: boolean;
        /**
         * Fighters may build on rock cells (Vein Tap).
         */
        buildOnRock?: boolean;
        /**
         * Range multiplier for towers adjacent to the Core block (Loadbearing).
         */
        coreAdjacentRangeMul?: number;
        /**
         * Refineries place anywhere and produce Scrap off the vein (Foundry).
         */
        offVeinScrap?: boolean;
        /**
         * Global tower damage multiplier.
         */
        damageMul?: number;
        /**
         * Global fire-rate multiplier (>1 = faster).
         */
        fireRateMul?: number;
        /**
         * Global flat range bonus in cells.
         */
        rangeAdd?: number;
        /**
         * Targeted active: damage to everything in the blast.
         */
        orbitalDamage?: number;
        /**
         * Targeted active: blast radius in cells.
         */
        orbitalRadius?: number;
        /**
         * Board-wide active: enemies stop for this long (Stasis).
         */
        freezeTicks?: number;
        /**
         * Timed active: production multiplier while boosted (Deep Vein).
         */
        productionMul?: number;
        /**
         * Timed active: boost duration.
         */
        boostTicks?: number;
      };
    },
    ...{
      id: string;
      name: string;
      /**
       * passive: always on. active: fired from the Core, long cooldown. consumable: one use, effects then permanent for the run.
       */
      kind: 'passive' | 'active' | 'consumable';
      /**
       * Player-facing card text. The offer modal renders this - a relic the player cannot understand is a relic that does not exist.
       */
      desc: string;
      /**
       * Reserved (D5). The M1 pool is flat.
       */
      rarity?: 'common' | 'rare' | 'epic';
      /**
       * Actives: ticks between firings at 20 Hz.
       */
      cooldownTicks?: number;
      /**
       * Named engine knobs. Every field is optional; a relic sets the ones it means. Adding a knob is an engine change; adding a relic that uses existing knobs is content.
       */
      effects?: {
        /**
         * Excess kill damage chains to the nearest enemy, repeatedly.
         */
        overkillCarry?: boolean;
        /**
         * Damage multiplier against slowed enemies (Frostbite).
         */
        slowedDamageMul?: number;
        /**
         * Flat Scrap per kill (Tithe).
         */
        killRefundScrap?: number;
        /**
         * Explosion AoE resolves twice (Splinter).
         */
        explodeTwice?: boolean;
        /**
         * Fighters may build on rock cells (Vein Tap).
         */
        buildOnRock?: boolean;
        /**
         * Range multiplier for towers adjacent to the Core block (Loadbearing).
         */
        coreAdjacentRangeMul?: number;
        /**
         * Refineries place anywhere and produce Scrap off the vein (Foundry).
         */
        offVeinScrap?: boolean;
        /**
         * Global tower damage multiplier.
         */
        damageMul?: number;
        /**
         * Global fire-rate multiplier (>1 = faster).
         */
        fireRateMul?: number;
        /**
         * Global flat range bonus in cells.
         */
        rangeAdd?: number;
        /**
         * Targeted active: damage to everything in the blast.
         */
        orbitalDamage?: number;
        /**
         * Targeted active: blast radius in cells.
         */
        orbitalRadius?: number;
        /**
         * Board-wide active: enemies stop for this long (Stasis).
         */
        freezeTicks?: number;
        /**
         * Timed active: production multiplier while boosted (Deep Vein).
         */
        productionMul?: number;
        /**
         * Timed active: boost duration.
         */
        boostTicks?: number;
      };
    }[]
  ];
}

/** The schema itself, for runtime validation. Same source as the type above. */
export const relicsSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "ascii-defense/relics.schema.json",
  "title": "RelicPool",
  "description": "Relics (PRD sec 7): rule modifiers acquired mid-run, run-local, held by the Core. Effects are named engine knobs - a relic is data wired to hooks, never code. rarity is reserved shape (D5): present from the first commit, unused until play evidence says how to weight the pool.",
  "type": "object",
  "required": [
    "relics"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "relics": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "name",
          "kind",
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
          "kind": {
            "description": "passive: always on. active: fired from the Core, long cooldown. consumable: one use, effects then permanent for the run.",
            "enum": [
              "passive",
              "active",
              "consumable"
            ]
          },
          "desc": {
            "description": "Player-facing card text. The offer modal renders this - a relic the player cannot understand is a relic that does not exist.",
            "type": "string"
          },
          "rarity": {
            "description": "Reserved (D5). The M1 pool is flat.",
            "enum": [
              "common",
              "rare",
              "epic"
            ]
          },
          "cooldownTicks": {
            "description": "Actives: ticks between firings at 20 Hz.",
            "type": "integer",
            "minimum": 1
          },
          "effects": {
            "description": "Named engine knobs. Every field is optional; a relic sets the ones it means. Adding a knob is an engine change; adding a relic that uses existing knobs is content.",
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "overkillCarry": {
                "description": "Excess kill damage chains to the nearest enemy, repeatedly.",
                "type": "boolean"
              },
              "slowedDamageMul": {
                "description": "Damage multiplier against slowed enemies (Frostbite).",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "killRefundScrap": {
                "description": "Flat Scrap per kill (Tithe).",
                "type": "number",
                "minimum": 0
              },
              "explodeTwice": {
                "description": "Explosion AoE resolves twice (Splinter).",
                "type": "boolean"
              },
              "buildOnRock": {
                "description": "Fighters may build on rock cells (Vein Tap).",
                "type": "boolean"
              },
              "coreAdjacentRangeMul": {
                "description": "Range multiplier for towers adjacent to the Core block (Loadbearing).",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "offVeinScrap": {
                "description": "Refineries place anywhere and produce Scrap off the vein (Foundry).",
                "type": "boolean"
              },
              "damageMul": {
                "description": "Global tower damage multiplier.",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "fireRateMul": {
                "description": "Global fire-rate multiplier (>1 = faster).",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "rangeAdd": {
                "description": "Global flat range bonus in cells.",
                "type": "number"
              },
              "orbitalDamage": {
                "description": "Targeted active: damage to everything in the blast.",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "orbitalRadius": {
                "description": "Targeted active: blast radius in cells.",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "freezeTicks": {
                "description": "Board-wide active: enemies stop for this long (Stasis).",
                "type": "integer",
                "minimum": 1
              },
              "productionMul": {
                "description": "Timed active: production multiplier while boosted (Deep Vein).",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "boostTicks": {
                "description": "Timed active: boost duration.",
                "type": "integer",
                "minimum": 1
              }
            }
          }
        }
      }
    }
  }
} as const;
