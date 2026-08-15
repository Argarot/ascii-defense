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

/** Additive stat deltas an upgrade tier applies. */
export interface StatMods {
  damage?: number;
  range?: number;
  fireEveryTicks?: number;
  explodeRadius?: number;
  slowTicks?: number;
}

export interface TierDef {
  cost: number;
  mods?: StatMods;
}

export interface TowerPathDef {
  name: string;
  tiers: readonly TierDef[];
}

export interface TowerDef {
  id: string;
  name?: string;
  cost: number;
  /** Cells. */
  range: number;
  fireEveryTicks: number;
  projectile: ProjectileSpec;
  /** Three upgrade paths of five tiers (PRD 5.2). */
  paths?: readonly TowerPathDef[];
}

/** The stats a tower actually fights with after its upgrades fold in. */
export interface EffectiveStats {
  damage: number;
  range: number;
  fireEveryTicks: number;
  explodeRadius: number;
  slowTicks: number;
}

/**
 * PRD 5.2 crosspathing: one path may reach tier 5, a second tier 2, the
 * third stays at 0. Pure - the HUD greys out exactly what this refuses.
 */
export function canUpgrade(tiers: readonly [number, number, number], path: number): boolean {
  if (path < 0 || path > 2) return false;
  const next: [number, number, number] = [...tiers] as [number, number, number];
  next[path]++;
  if (next[path] > 5) return false;
  const sorted = [...next].sort((a, b) => b - a);
  return sorted[1] <= 2 && sorted[2] === 0;
}

/** Fold a tower's base stats and its taken tiers into what it fights with. */
export function effectiveStats(def: TowerDef, tiers: readonly [number, number, number]): EffectiveStats {
  const out: EffectiveStats = {
    damage: def.projectile.damage,
    range: def.range,
    fireEveryTicks: def.fireEveryTicks,
    explodeRadius: def.projectile.explodeRadius ?? 0,
    slowTicks: def.projectile.slowTicks ?? 0,
  };
  def.paths?.forEach((p, pi) => {
    for (let t = 0; t < tiers[pi]; t++) {
      const m = p.tiers[t]?.mods;
      if (!m) continue;
      out.damage += m.damage ?? 0;
      out.range += m.range ?? 0;
      out.fireEveryTicks += m.fireEveryTicks ?? 0;
      out.explodeRadius += m.explodeRadius ?? 0;
      out.slowTicks += m.slowTicks ?? 0;
    }
  });
  out.fireEveryTicks = Math.max(2, out.fireEveryTicks);
  return out;
}
