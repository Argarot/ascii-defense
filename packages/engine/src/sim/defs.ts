/**
 * Combat definition shapes, structurally matching the content schemas. The
 * engine cannot import content (layer rule), so the app validates JSON
 * through content's validators and hands the typed results in here.
 *
 * ProjectileSpec is deliberately wider than any current tower uses: homing,
 * pierce, explosion and status effects are scaffolding shipped before the
 * features (Daniil, session A), so that later balance and effects work is
 * data plus small engine additions, never a migration.
 */
export interface EnemyDef {
  id: string;
  name?: string;
  hp: number;
  /** Cells per tick at 20 Hz. */
  speed: number;
  /** Core health lost on breach (PRD sec 4.5). */
  damage: number;
  /** Scrap on kill. */
  bounty?: number;
  /** Flat damage reduction per hit; every hit still deals at least 1. */
  armor?: number;
  /** Absorb pool burned before hp. */
  shield?: number;
  /** First wave this enemy may appear in (waves mode). */
  minWave?: number;
  traits?: readonly string[];
}

export interface ProjectileSpec {
  damage: number;
  /** Cells per tick. Must comfortably outrun enemies (harness rule). */
  speed: number;
  /** Tracks its target; false = straight shot that can miss. */
  homing?: boolean;
  /** Reserved: radians/tick steering limit for slow-turning homers. */
  homingTurnRate?: number;
  /** Reserved: shot continues through pierceCount enemies. */
  pierce?: boolean;
  pierceCount?: number;
  /** AoE on impact (Mortar). */
  explosive?: boolean;
  explodeRadius?: number;
  /** Status effect id applied on hit. 'slow' is live. */
  applyEffect?: string | null;
  /** Speed multiplier while slowed. */
  slowMul?: number;
  /** Slow duration in ticks. */
  slowTicks?: number;
}

/**
 * Resource yield per cycle (Refinery). Ore counts only while the tower stands
 * on an ore cell - PRD sec 5.3. scrap is reserved shape for the foundry relic
 * (PRD sec 7.4): the field exists so the relic is a data change, not a schema
 * migration.
 */
export interface ProductionSpec {
  ore?: number;
  scrap?: number;
  everyTicks: number;
}

/**
 * Relics (PRD sec 7): rule modifiers, structurally matching the relics
 * schema. Effects are NAMED ENGINE KNOBS - the fixed set of seams the sim
 * implements. A new relic combining existing knobs is content; a new knob is
 * an engine change. This is what keeps 190 untested pairs safe to ship: the
 * pairs multiply, the knobs do not.
 */
export interface RelicEffects {
  overkillCarry?: boolean;
  slowedDamageMul?: number;
  killRefundScrap?: number;
  explodeTwice?: boolean;
  buildOnRock?: boolean;
  coreAdjacentRangeMul?: number;
  offVeinScrap?: boolean;
  damageMul?: number;
  fireRateMul?: number;
  rangeAdd?: number;
  orbitalDamage?: number;
  orbitalRadius?: number;
  freezeTicks?: number;
  productionMul?: number;
  boostTicks?: number;
}

export type RelicKind = 'passive' | 'active' | 'consumable';

export interface RelicDef {
  id: string;
  name: string;
  kind: RelicKind;
  /** Player-facing card text; the offer modal renders it. */
  desc: string;
  /** Reserved (D5); the M1 pool is flat. */
  rarity?: 'common' | 'rare' | 'epic';
  /** Actives: ticks between firings. */
  cooldownTicks?: number;
  effects?: RelicEffects;
}

/**
 * The always-on modifiers folded from held relics: passives plus USED
 * consumables (an unused consumable is a promise, not a power). Multipliers
 * stack multiplicatively, adds additively - order-free, so determinism does
 * not depend on acquisition order.
 */
export interface RelicFold {
  overkillCarry: boolean;
  slowedDamageMul: number;
  killRefundScrap: number;
  explodeTwice: boolean;
  buildOnRock: boolean;
  coreAdjacentRangeMul: number;
  offVeinScrap: boolean;
  damageMul: number;
  fireRateMul: number;
  rangeAdd: number;
}

export const EMPTY_FOLD: RelicFold = {
  overkillCarry: false,
  slowedDamageMul: 1,
  killRefundScrap: 0,
  explodeTwice: false,
  buildOnRock: false,
  coreAdjacentRangeMul: 1,
  offVeinScrap: false,
  damageMul: 1,
  fireRateMul: 1,
  rangeAdd: 0,
};

/** Fold the always-on effects of the given relics (see RelicFold). */
export function foldRelics(defs: readonly RelicDef[]): RelicFold {
  const out: RelicFold = { ...EMPTY_FOLD };
  for (const d of defs) {
    const e = d.effects;
    if (!e) continue;
    out.overkillCarry ||= e.overkillCarry ?? false;
    out.slowedDamageMul *= e.slowedDamageMul ?? 1;
    out.killRefundScrap += e.killRefundScrap ?? 0;
    out.explodeTwice ||= e.explodeTwice ?? false;
    out.buildOnRock ||= e.buildOnRock ?? false;
    out.coreAdjacentRangeMul *= e.coreAdjacentRangeMul ?? 1;
    out.offVeinScrap ||= e.offVeinScrap ?? false;
    out.damageMul *= e.damageMul ?? 1;
    out.fireRateMul *= e.fireRateMul ?? 1;
    out.rangeAdd += e.rangeAdd ?? 0;
  }
  return out;
}

/** Additive stat deltas an upgrade choice applies. */
export interface StatMods {
  damage?: number;
  range?: number;
  fireEveryTicks?: number;
  explodeRadius?: number;
  slowTicks?: number;
  production?: number;
  productionEveryTicks?: number;
}

export interface ChoiceDef {
  name: string;
  cost: number;
  mods?: StatMods;
  /** Capability grant: 'prospect' opens rock prospecting (Survey - PRD sec 5.3). */
  unlocks?: 'prospect';
}

/** One tier: an either/or, mutually exclusive choice (Tower Dominion style). */
export interface TowerTierDef {
  choices: readonly ChoiceDef[];
}

export interface TowerDef {
  id: string;
  name?: string;
  cost: number;
  /** Cells. */
  range: number;
  fireEveryTicks: number;
  /** 'projectile' fires shots; 'pulse' hits everything in range on cooldown; 'none' never attacks (producers). */
  attack?: 'projectile' | 'pulse' | 'none';
  /** Absent on attack:'none' producers (Refinery). */
  projectile?: ProjectileSpec;
  production?: ProductionSpec;
  /** 3 tiers x 2 exclusive choices = 14 tower variants (Daniil's redesign). */
  tiers?: readonly TowerTierDef[];
}

/** The stats a tower actually fights with after its choices fold in. */
export interface EffectiveStats {
  damage: number;
  range: number;
  fireEveryTicks: number;
  explodeRadius: number;
  slowTicks: number;
  /** Yield per production cycle; 0 for non-producers. */
  production: number;
  /** Production cycle length in ticks; 0 for non-producers. */
  productionEveryTicks: number;
}

/**
 * Tiered either/or progression: tier t opens once tier t-1 is chosen; a
 * chosen tier is final (mutually exclusive with its sibling). Pure - the
 * HUD's locked/available states come from this same function.
 */
export function canChoose(choices: readonly number[], tier: number): boolean {
  if (tier < 0 || tier >= 3) return false;
  if (choices[tier] !== -1) return false; // already committed
  return tier === 0 || choices[tier - 1] !== -1;
}

/** Fold a tower's base stats and its committed choices. */
export function effectiveStats(def: TowerDef, choices: readonly number[]): EffectiveStats {
  const out: EffectiveStats = {
    damage: def.projectile?.damage ?? 0,
    range: def.range,
    fireEveryTicks: def.fireEveryTicks,
    explodeRadius: def.projectile?.explodeRadius ?? 0,
    slowTicks: def.projectile?.slowTicks ?? 0,
    production: (def.production?.ore ?? 0) + (def.production?.scrap ?? 0),
    productionEveryTicks: def.production?.everyTicks ?? 0,
  };
  def.tiers?.forEach((tierDef, ti) => {
    const pick = choices[ti];
    if (pick === undefined || pick < 0) return;
    const m = tierDef.choices[pick]?.mods;
    if (!m) return;
    out.damage += m.damage ?? 0;
    out.range += m.range ?? 0;
    out.fireEveryTicks += m.fireEveryTicks ?? 0;
    out.explodeRadius += m.explodeRadius ?? 0;
    out.slowTicks += m.slowTicks ?? 0;
    out.production += m.production ?? 0;
    out.productionEveryTicks += m.productionEveryTicks ?? 0;
  });
  out.fireEveryTicks = Math.max(2, out.fireEveryTicks);
  // A producer can be upgraded faster, never into a per-tick firehose.
  if (def.production) out.productionEveryTicks = Math.max(10, out.productionEveryTicks);
  return out;
}
