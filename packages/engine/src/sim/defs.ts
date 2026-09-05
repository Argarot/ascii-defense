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
/** The two damage types (PRD sec 8): what a tower deals, what an enemy resists. */
export type DamageType = 'kinetic' | 'energy';
export const DAMAGE_TYPES: readonly DamageType[] = ['kinetic', 'energy'];

/** An enemy's multiplier against a type: 1 when it names none (0 = immune, <1 resists, >1 weak). */
export function resistMul(def: EnemyDef, type: DamageType | undefined): number {
  if (!type) return 1;
  return def.resist?.[type] ?? 1;
}

export interface EnemyDef {
  id: string;
  name?: string;
  /** Damage multipliers by type (session 26, WBS 2.8): 0 immune, 0.5 resists, 1.5 weak. Absent = 1. */
  resist?: Partial<Record<DamageType, number>>;
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
 * on an ore cell - PRD sec 5.3. scrap remains reserved shape for future
 * content; nothing shipped uses it (the foundry relic was cut 2026-08-16 -
 * a relic that deletes the Refinery siting decision, Daniil).
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
  damageMul?: number;
  fireRateMul?: number;
  rangeAdd?: number;
  orbitalDamage?: number;
  orbitalRadius?: number;
  freezeTicks?: number;
  productionMul?: number;
  boostTicks?: number;
  // ---- design round 1 (2026-09-03) knobs ----
  /** Passive: the Core heals this much when a wave launches (Second Wind). */
  coreHealPerWave?: number;
  /** Passive: prospect jobs run this much faster (Quarry). */
  prospectSpeedMul?: number;
  /** Passive: an enemy pays this Scrap on entering a cell beside a tower (Toll). */
  tollScrap?: number;
  /** Passive: boss bounty multiplier (Bounty Board). */
  bossBountyMul?: number;
  /** Consumable: raises Core hp AND its maximum by this much (Sandbags). */
  coreHpAdd?: number;
  /** Consumable: grants this much tier-1 Ore (Ore Pocket). */
  oreAdd?: number;
}

export type RelicKind = 'passive' | 'active' | 'consumable';

/**
 * Loot tables (PRD sec 7.7, design round 1): a named, weighted outcome list,
 * structurally matching the loot schema. A cache names a table; the sim
 * rolls it on the 'loot' stream at OPEN time, so the result rides the input
 * log like every other decision. Sources never carry payout code.
 */
export type LootKind = 'scrap' | 'ore' | 'boon' | 'consumable' | 'relic' | 'nothing';

export interface LootOutcome {
  kind: LootKind;
  weight: number;
  /** scrap/ore: uniform amount in [min, max]. */
  min?: number;
  max?: number;
  /** boon: the tier the cache's cell becomes. */
  tier?: number;
}

export interface LootTable {
  id: string;
  outcomes: readonly LootOutcome[];
}

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
  /**
   * May the pool deal this relic again while it is held? Multipliers and
   * charges stack (Frostbite, Orbital); a boolean rule held twice is a dead
   * card (Vein Tap) - so booleans are unstackable and leave the pool once
   * held (design round 1, item 1). Absent = false.
   */
  stackable?: boolean;
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
  damageMul: number;
  fireRateMul: number;
  rangeAdd: number;
  coreHealPerWave: number;
  prospectSpeedMul: number;
  tollScrap: number;
  bossBountyMul: number;
}

export const EMPTY_FOLD: RelicFold = {
  overkillCarry: false,
  slowedDamageMul: 1,
  killRefundScrap: 0,
  explodeTwice: false,
  buildOnRock: false,
  coreAdjacentRangeMul: 1,
  damageMul: 1,
  fireRateMul: 1,
  rangeAdd: 0,
  coreHealPerWave: 0,
  prospectSpeedMul: 1,
  tollScrap: 0,
  bossBountyMul: 1,
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
    out.damageMul *= e.damageMul ?? 1;
    out.fireRateMul *= e.fireRateMul ?? 1;
    out.rangeAdd += e.rangeAdd ?? 0;
    out.coreHealPerWave += e.coreHealPerWave ?? 0;
    out.prospectSpeedMul *= e.prospectSpeedMul ?? 1;
    out.tollScrap += e.tollScrap ?? 0;
    out.bossBountyMul *= e.bossBountyMul ?? 1;
  }
  return out;
}

/** Additive stat deltas an upgrade choice applies. */
export interface StatMods {
  damage?: number;
  range?: number;
  minRange?: number;
  fireEveryTicks?: number;
  explodeRadius?: number;
  slowTicks?: number;
  production?: number;
  productionEveryTicks?: number;
  // ---- tower rework (design round 1, item 8) ----
  /** Multiplies damage after every additive mod. */
  damageMul?: number;
  /** Additive delta to the applied speed multiplier (negative = colder). */
  slowMul?: number;
  /** Additional projectiles per volley. */
  shots?: number;
  /** Cells of aim scatter for extra shots. */
  spread?: number;
  /** Additional enemies a shot passes into after its target. */
  pierceCount?: number;
  /** Additive bonus to damage dealt to shields (base 1). */
  shieldMul?: number;
  /** Additive bonus vs already-slowed enemies, this tower only (base 1). */
  slowedBonusMul?: number;
  /** Pulse towers: every Nth pulse freezes instead of slowing. */
  freezeEvery?: number;
  /** Chain towers (session 25): additional bodies an arc jumps to. */
  chainCount?: number;
  /** Chain towers: additional cells a hop may span. */
  chainReach?: number;
  /** Beam towers (session 26): additional cells of beam width. */
  beamWidth?: number;
  /** Beam towers: additional multiplier at full heat (base 2 = double while it holds one target). */
  beamRampMax?: number;
}

export interface ChoiceDef {
  name: string;
  cost: number;
  /** One written sentence: what the choice DOES, in play terms (2.10). */
  desc?: string;
  mods?: StatMods;
  /** Capability grants (PRD sec 5.3): surveySpeed towers each speed EVERY
   *  prospect job (global, stacking); surveyAuto towers start free jobs on
   *  rock near themselves. Parallel choices, not one boolean. */
  unlocks?: 'surveySpeed' | 'surveyAuto' | 'ignoreArmor' | 'deepBore50' | 'deepBore100' | 'sweep';
}

/** One tier: an either/or, mutually exclusive choice (Tower Dominion style). */
export interface TowerTierDef {
  choices: readonly ChoiceDef[];
}

export interface TowerDef {
  id: string;
  name?: string;
  /** The name a button can afford (up to nine glyphs); the strip shows it under the sprite. */
  short?: string;
  /** One sentence: what it is and what it answers (the build card, the catalogue). */
  desc?: string;
  /** What its hits are (session 26, WBS 2.8); absent = untyped, every enemy takes it at 1. */
  damageType?: DamageType;
  cost: number;
  /** Cells. */
  range: number;
  /** Cells: the dead zone - nothing closer is ever targeted (design round 1, item 2). */
  minRange?: number;
  fireEveryTicks: number;
  /** 'projectile' fires shots; 'pulse' hits everything in range on cooldown; 'chain' arcs through bodies (session 25); 'none' never attacks (producers). */
  attack?: 'projectile' | 'pulse' | 'chain' | 'beam' | 'none';
  /** Absent on attack:'none' producers (Refinery). For 'chain' the damage is the first hop's; speed is unused. */
  projectile?: ProjectileSpec;
  /** Chain towers (session 25): the arc hits `count` bodies, each within `reach` cells of the last, at `falloff` of the previous hop's damage. */
  chain?: { count: number; reach: number; falloff: number };
  /**
   * Beam towers (session 26, WBS 2.34): a corridor `width` cells wide down
   * the tower's FACING for `range` cells; every body in it takes the
   * damage each fire; holding one lead target heats the beam by
   * `rampStep` per fire up to `rampMax` times the damage.
   */
  beam?: { width: number; rampStep: number; rampMax: number };
  production?: ProductionSpec;
  /** 3 tiers x 2 exclusive choices = 14 tower variants (Daniil's redesign). */
  tiers?: readonly TowerTierDef[];
}

/** The stats a tower actually fights with after its choices fold in. */
export interface EffectiveStats {
  damage: number;
  range: number;
  /** The dead zone in cells; 0 = none. Always below range. */
  minRange: number;
  fireEveryTicks: number;
  explodeRadius: number;
  slowTicks: number;
  /** Yield per production cycle; 0 for non-producers. */
  production: number;
  /** Production cycle length in ticks; 0 for non-producers. */
  productionEveryTicks: number;
  // ---- tower rework (design round 1, item 8) ----
  /** Speed multiplier a hit applies while slowed; 1 = no slow. */
  slowMul: number;
  /** Projectiles per volley (1 + extra). */
  shots: number;
  /** Aim scatter in cells for extra shots. */
  spread: number;
  /** Enemies a shot passes into after its target. */
  pierceCount: number;
  /** Damage multiplier against shields. */
  shieldMul: number;
  /** Damage multiplier against already-slowed enemies (this tower). */
  slowedBonusMul: number;
  /** Every Nth pulse freezes (0 = never). */
  freezeEvery: number;
  /** Hits ignore armour (Railbore). */
  ignoreArmor: boolean;
  /** Chain towers (session 25): bodies per arc, cells per hop, damage kept per hop. */
  chainCount: number;
  chainReach: number;
  chainFalloff: number;
  /** Beam towers (session 26): corridor width in cells, heat per fire, the ceiling. */
  beamWidth: number;
  beamRampStep: number;
  beamRampMax: number;
  /** Sweep (the Laser's tier 3): the beam re-faces toward the most bodies every second. */
  sweep: boolean;
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
    minRange: def.minRange ?? 0,
    fireEveryTicks: def.fireEveryTicks,
    explodeRadius: def.projectile?.explodeRadius ?? 0,
    slowTicks: def.projectile?.slowTicks ?? 0,
    production: (def.production?.ore ?? 0) + (def.production?.scrap ?? 0),
    productionEveryTicks: def.production?.everyTicks ?? 0,
    slowMul: def.projectile?.applyEffect === 'slow' ? (def.projectile.slowMul ?? 0.6) : 1,
    shots: 1,
    spread: 0,
    pierceCount: def.projectile?.pierceCount ?? 0,
    shieldMul: 1,
    slowedBonusMul: 1,
    freezeEvery: 0,
    ignoreArmor: false,
    chainCount: def.chain?.count ?? 0,
    chainReach: def.chain?.reach ?? 0,
    chainFalloff: def.chain?.falloff ?? 1,
    beamWidth: def.beam?.width ?? 0,
    beamRampStep: def.beam?.rampStep ?? 0,
    beamRampMax: def.beam?.rampMax ?? 1,
    sweep: false,
  };
  let damageMul = 1;
  def.tiers?.forEach((tierDef, ti) => {
    const pick = choices[ti];
    if (pick === undefined || pick < 0) return;
    const choice = tierDef.choices[pick];
    if (choice?.unlocks === 'ignoreArmor') out.ignoreArmor = true;
    if (choice?.unlocks === 'sweep') out.sweep = true;
    const m = choice?.mods;
    if (!m) return;
    damageMul *= m.damageMul ?? 1;
    out.slowMul += m.slowMul ?? 0;
    out.shots += m.shots ?? 0;
    out.spread += m.spread ?? 0;
    out.pierceCount += m.pierceCount ?? 0;
    out.shieldMul += m.shieldMul ?? 0;
    out.slowedBonusMul += m.slowedBonusMul ?? 0;
    out.freezeEvery += m.freezeEvery ?? 0;
    out.chainCount += m.chainCount ?? 0;
    out.chainReach += m.chainReach ?? 0;
    out.beamWidth += m.beamWidth ?? 0;
    out.beamRampMax += m.beamRampMax ?? 0;
    out.damage += m.damage ?? 0;
    out.range += m.range ?? 0;
    out.minRange += m.minRange ?? 0;
    out.fireEveryTicks += m.fireEveryTicks ?? 0;
    out.explodeRadius += m.explodeRadius ?? 0;
    out.slowTicks += m.slowTicks ?? 0;
    out.production += m.production ?? 0;
    out.productionEveryTicks += m.productionEveryTicks ?? 0;
  });
  out.damage *= damageMul;
  out.slowMul = Math.max(0, Math.min(1, out.slowMul));
  out.shots = Math.max(1, out.shots);
  out.fireEveryTicks = Math.max(2, out.fireEveryTicks);
  // A dead zone can shrink to nothing but never swallow the whole range.
  out.minRange = Math.max(0, Math.min(out.minRange, Math.max(0, out.range - 0.5)));
  // A producer can be upgraded faster, never into a per-tick firehose.
  if (def.production) out.productionEveryTicks = Math.max(10, out.productionEveryTicks);
  return out;
}
