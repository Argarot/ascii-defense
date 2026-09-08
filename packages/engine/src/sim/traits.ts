/**
 * Enemy traits as RULES (design round 1, 2026-09-03, Daniil's item 5;
 * Enemies II, session 32).
 *
 * The roster carried `traits: ['fast', 'swarm', ...]` as labels the engine
 * never read; armour, shield and speed were the only real fields. Each trait
 * now names one rule, implemented in one place in the sim and looked up
 * through this table, so a future trait (or damage types, WBS 2.8) is a row
 * here plus one seam in the sim - never a scatter of string comparisons.
 *
 *   armoured     immune to slows: Frost is the wrong answer, Bolts and Mortars
 *                are the right one
 *   shielded     the shield REGENERATES after a short pause unhit - focus fire
 *                matters, chip damage does not
 *   fast         slows last half as long
 *   swarm        spawns in packs of three - one queue entry, three bodies
 *
 * Enemies II (session 32, PR 1) - seven more, each a rule the towers answer:
 *
 *   split        dies into two of `splitInto` where it fell - kill it early,
 *                or let a blast take the halves together
 *   heal         mends every body within a cell and a half, a little every
 *                second - kill the mender first (priority WEAKEST finds it)
 *   burrow       untargetable for its first cells of road - the towers at the
 *                entry never see it; the ones deeper in do
 *   charge       runs at double speed once under half hp - finish it, or
 *                slow it before the sprint (Frost)
 *   frontshield  a shield facing the way it walks: hits from ahead do a
 *                third - flank it from beside the road
 *   sprint       runs faster while unhit for two seconds - keep it under fire
 *                (a Tesla's arcs, a Laser's beam)
 *   bulwark      every body within two and a half cells takes 30% less while
 *                it lives - the boss that wants killing first, not last
 */
import type { EnemyDef } from './defs';

export const TRAIT_RULES = {
  armoured: { slowImmune: true },
  shielded: { shieldRegen: true },
  fast: { slowDurationMul: 0.5 },
  swarm: { packSize: 3 },
  split: { count: 2 },
  heal: { every: 20, radius: 1.5, amount: 3 },
  burrow: { cells: 8 },
  charge: { below: 0.5, speedMul: 2 },
  frontshield: { frontMul: 0.35, cos: 0.7 },
  sprint: { unhitTicks: 40, speedMul: 1.6 },
  bulwark: { radius: 2.5, damageMul: 0.7 },
} as const;

export type TraitName = keyof typeof TRAIT_RULES;

export function hasTrait(def: EnemyDef, trait: TraitName): boolean {
  return def.traits !== undefined && def.traits.includes(trait);
}

/** Ticks an enemy must go unhit before its shield starts to regrow. */
export const SHIELD_REGEN_DELAY = 40;
/** Ticks for a shield to regrow from empty to full. */
export const SHIELD_REGEN_TICKS = 100;

/**
 * The speed multiplier a body's traits give it this tick: a charger under
 * half hp doubles, a sprinter unhit for two seconds runs faster. Pure, so
 * the rule is testable without a board.
 */
export function traitSpeedMul(def: EnemyDef, hpFrac: number, ticksUnhit: number): number {
  let m = 1;
  if (hasTrait(def, 'charge') && hpFrac < TRAIT_RULES.charge.below) m *= TRAIT_RULES.charge.speedMul;
  if (hasTrait(def, 'sprint') && ticksUnhit > TRAIT_RULES.sprint.unhitTicks) m *= TRAIT_RULES.sprint.speedMul;
  return m;
}

const DIR_X = [0, 1, 0, -1] as const;
const DIR_Y = [-1, 0, 1, 0] as const;

/**
 * What a hit from a tower at (towerX, towerY) does to a body at (bodyX,
 * bodyY) walking in `walkDir`: a shieldbearer takes a third from anything
 * within about 45 degrees of straight ahead, the whole hit from beside or
 * behind. Pure; 1 for every other body.
 */
export function frontShieldMul(def: EnemyDef, bodyX: number, bodyY: number, walkDir: number, towerX: number, towerY: number): number {
  if (!hasTrait(def, 'frontshield')) return 1;
  const dx = towerX - bodyX;
  const dy = towerY - bodyY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return 1;
  const dot = (dx * DIR_X[walkDir] + dy * DIR_Y[walkDir]) / d;
  return dot >= TRAIT_RULES.frontshield.cos ? TRAIT_RULES.frontshield.frontMul : 1;
}
