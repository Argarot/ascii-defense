/**
 * Enemy traits as RULES (design round 1, 2026-09-03, Daniil's item 5).
 *
 * The roster carried `traits: ['fast', 'swarm', ...]` as labels the engine
 * never read; armour, shield and speed were the only real fields. Each trait
 * now names one rule, implemented in one place in the sim and looked up
 * through this table, so a future trait (or damage types, WBS 2.8) is a row
 * here plus one seam in the sim - never a scatter of string comparisons.
 *
 *   armoured  immune to slows: Frost is the wrong answer, Bolts and Mortars
 *             are the right one
 *   shielded  the shield REGENERATES after a short pause unhit - focus fire
 *             matters, chip damage does not
 *   fast      slows last half as long
 *   swarm     spawns in packs of three - one queue entry, three bodies
 */
import type { EnemyDef } from './defs';

export const TRAIT_RULES = {
  armoured: { slowImmune: true },
  shielded: { shieldRegen: true },
  fast: { slowDurationMul: 0.5 },
  swarm: { packSize: 3 },
} as const;

export type TraitName = keyof typeof TRAIT_RULES;

export function hasTrait(def: EnemyDef, trait: TraitName): boolean {
  return def.traits !== undefined && def.traits.includes(trait);
}

/** Ticks an enemy must go unhit before its shield starts to regrow. */
export const SHIELD_REGEN_DELAY = 40;
/** Ticks for a shield to regrow from empty to full. */
export const SHIELD_REGEN_TICKS = 100;
