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
  /** Scrap on kill. Economy lands in session B; carried through now. */
  bounty?: number;
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
  /** Reserved: AoE on impact (Mortar). */
  explosive?: boolean;
  explodeRadius?: number;
  /** Reserved: status effect id applied on hit (slow, burn, ...). */
  applyEffect?: string | null;
}

export interface TowerDef {
  id: string;
  name?: string;
  cost: number;
  /** Cells. */
  range: number;
  fireEveryTicks: number;
  projectile: ProjectileSpec;
}
