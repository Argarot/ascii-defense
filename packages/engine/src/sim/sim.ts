/**
 * The simulation: a fixed 20 Hz tick. Waves of enemies march the flow field
 * from telegraphed entries toward the Core; towers with upgrade trees fire
 * projectiles that explode, slow, and are blunted by armor and shields; the
 * Core has health, and losing it ends the run (Phase 4 session C).
 *
 * Invariant 6: nothing here knows about frames or wall-clock time.
 *
 * Determinism notes, learned and enforced:
 *  - sqrt(dx*dx+dy*dy), never Math.hypot (implementation-defined precision).
 *  - every tie is broken by fixed scan order, spending no randomness.
 *  - enemy slots recycle, so projectiles remember (slot, generation).
 *  - projectiles snapshot their tower's EFFECTIVE stats at fire time, so a
 *    mid-flight upgrade or sale never rewrites history.
 *
 * Storage is SoA typed arrays for the numerous kinds (enemies, projectiles)
 * and plain objects for towers (dozens, rich state) - ARCHITECTURE sec 7.
 */
import { createRng, type Rng } from '../rng/rng';
import { isBuildable, strandEntered, strandPorts, type CellType } from '../grid/cells';
import type { BoonRef, GeneratedMap, CellRef } from '../mapgen/mapgen';
import { SHIELD_REGEN_DELAY, SHIELD_REGEN_TICKS, TRAIT_RULES, hasTrait } from './traits';
import { computeFlowField, type FlowField } from './flow';
import { PRIORITIES, pickTarget, type Priority, type TargetCandidate } from './targeting';
import {
  EMPTY_FOLD,
  canChoose,
  effectiveStats,
  foldRelics,
  type EffectiveStats,
  type EnemyDef,
  type RelicDef,
  type RelicFold,
  type TowerDef,
  type LootTable,
} from './defs';
import type { ReplayAction, ReplayInput } from './replay';

export const TICK_HZ = 20;

export interface SimOptions {
  cells: readonly (CellType | null)[];
  cellsW: number;
  cellsH: number;
  map: GeneratedMap;
  enemyDefs: readonly EnemyDef[];
  towerDefs: readonly TowerDef[];
  /** 'trickle' spawns steadily (tests/demos); 'waves' is the game. */
  mode?: 'trickle' | 'waves';
  /** Trickle: ticks between spawns. */
  spawnEveryTicks?: number;
  /** Trickle: stop after this many; 0 = endless. */
  maxSpawns?: number;
  startingScrap?: number;
  /** Ore carried in from a previous run (tier-1; the demo's 3-reroll carry). */
  startingOre?: number;
  coreHp?: number;
  /** Waves: pause between waves, in ticks. */
  /**
   * Wave tempo (design round 1, 2026-09-03): ticks from one wave's LAUNCH to
   * the next auto-launch. The clock never waits for the last enemy to die -
   * killing faster buys quiet, dawdling stacks waves (Daniil's item 10).
   */
  interWaveTicks?: number;
  /**
   * Wave 1 waits for the player's CALL (default in waves mode): a fresh map
   * deserves a look before the first front opens. Tests and the lab that
   * want an autonomous run either set this false or call callWave().
   */
  firstWaveWaits?: boolean;
  /** Loot tables caches roll (PRD sec 7.7); absent = caches cannot open. */
  lootTables?: readonly LootTable[];
  /** The unlocked relic pool (PRD sec 7). Absent = no relic layer (tests). */
  relicDefs?: readonly RelicDef[];
  /** Wave scaling knobs; DEFAULT_DIFFICULTY when absent. */
  difficulty?: DifficultySpec;
  /** Hold this wave and the run is WON (D6). 0 = endless (tests, demos). */
  finalWave?: number;
}

/**
 * Wave scaling as DATA (WBS 1.7.3): the lab sweeps candidates, calibration
 * commits the winner. hp(w) = base * (1 + hpLinear*(w-1)) * hpGeometric^(w-1);
 * count(w) = round((countBase + countLinear*(w-1)) * countGeometric^(w-1)).
 * Geometric terms computed by repeated multiplication, never Math.pow -
 * pow's precision is implementation-defined and would split replay hashes
 * across engines, the same reason hypot is banned.
 */
export interface DifficultySpec {
  hpLinear: number;
  hpGeometric: number;
  countBase: number;
  countLinear: number;
  countGeometric: number;
}

/**
 * Chosen by the balance lab 2026-08-16 (see harness/src/lab). The old curve
 * was hpLinear 0.18 with NO geometric term - threat grew linearly while
 * player power compounded, so a five-tower build coasted past wave 100
 * (Daniil's screenshots). The geometric term guarantees every build's
 * throughput is eventually outgrown: there is no stable state (PRD sec 9.1).
 */
export const DEFAULT_DIFFICULTY: DifficultySpec = {
  hpLinear: 0.18,
  hpGeometric: 1.06,
  countBase: 6,
  countLinear: 4,
  countGeometric: 1,
};

/** wave >= 1. Deterministic: geometric term by repeated multiplication. */
export function waveHpScale(d: DifficultySpec, wave: number): number {
  let geo = 1;
  for (let i = 1; i < wave; i++) geo *= d.hpGeometric;
  return (1 + d.hpLinear * (wave - 1)) * geo;
}

export function waveCount(d: DifficultySpec, wave: number): number {
  let geo = 1;
  for (let i = 1; i < wave; i++) geo *= d.countGeometric;
  return Math.max(1, Math.round((d.countBase + d.countLinear * (wave - 1)) * geo));
}

/**
 * Sim -> view events (WBS 4.1). The sim narrates what HAPPENED as plain data;
 * the view decides what any of it looks like. One-way by construction: the
 * sim never reads this list, nothing here is hashed, and emission spends no
 * randomness - so effects can never move the golden replay hash. `Sim.pulses`
 * was the accidental prototype of this shape; it is now event kind 'pulse'.
 *
 * Coordinates are continuous cell units, same space as posX/posY.
 */
export type SimEvent =
  | { kind: 'pulse'; x: number; y: number; r: number }
  | { kind: 'impact'; x: number; y: number; r: number } // r 0 = plain hit, >0 = blast radius
  | { kind: 'death'; x: number; y: number }
  | { kind: 'breach'; x: number; y: number; dmg: number }
  | { kind: 'build'; x: number; y: number }
  | { kind: 'sell'; x: number; y: number }
  | { kind: 'waveStart'; wave: number }
  | { kind: 'reveal'; x: number; y: number; found: 'ore' | 'cache' | 'none' }
  | { kind: 'loot'; x: number; y: number; text: string };

export type StampedSimEvent = SimEvent & { seq: number; tick: number };

/**
 * Ring cap. `seq` stays monotonic across drops, so a consumer tracking the
 * last seq it handled survives the shift; a view that falls 256 events
 * behind loses eye candy, never correctness.
 */
export const EVENT_CAP = 256;

/** D4 (closed 2026-08-16): a pick-1-of-3 offer every this many waves. */
export const OFFER_EVERY_WAVES = 3;
/**
 * Ore price of the FIRST blind draw at the Core (PRD sec 7.3 C). Every
 * purchase this run multiplies the next by RELIC_COST_GROWTH (Daniil,
 * design round 1): 50, 75, 113, 169... - relics get dearer, non-linearly.
 */
export const RELIC_DRAW_COST = 50;
/** Ore price of the first reroll of a standing offer; escalates the same way. */
export const OFFER_REROLL_COST = 15;
export const RELIC_COST_GROWTH = 1.5;

/** base * growth^n by repeated multiplication (pow is banned - determinism). */
function escalated(base: number, growth: number, n: number): number {
  let c = base;
  for (let i = 0; i < n; i++) c *= growth;
  return Math.round(c);
}
/** A cache spot on the board (design round 1): opened free, rolls its table. */
export interface CacheSpot {
  x: number;
  y: number;
  /** Loot table id: 'rock_cache' from prospecting, 'boss_drop' off a boss. */
  table: string;
  opened: boolean;
}
/** Scrap an opened cache pays when its rolled outcome cannot apply here. */
const LOOT_FALLBACK_SCRAP = 60;
/** Scrap price of prospecting a rock cell (PRD sec 4.6). */
export const PROSPECT_COST = 25;
/** Base prospect duration: breaking rock is a COMMITMENT, not a purchase. */
export const PROSPECT_TICKS = 600;
/** Scrap paid per second still on the wave clock when the player CALLS early. */
export const CALL_BONUS_PER_SEC = 1;
/** Boss waves: every this-many waves, and always the final wave (D17). */
export const BOSS_EVERY_WAVES = 5;
/** A boss is the heaviest unlocked enemy, scaled: hp, bounty, Core damage. */
export const BOSS_HP_MUL = 6;
export const BOSS_BOUNTY_MUL = 5;
export const BOSS_DAMAGE_MUL = 3;
/** Queue encoding: a boss entry is its defIdx OR this flag. */
const BOSS_QUEUE_FLAG = 1 << 8;

export interface Tower {
  cellX: number;
  cellY: number;
  defIdx: number;
  cooldown: number;
  /** Ticks until the next production cycle completes; producers only. */
  prodCooldown: number;
  kills: number;
  priority: Priority;
  /** Committed choice per tier; -1 = not yet chosen (either/or tree). */
  choices: [number, number, number];
}

export const SELL_REFUND = 0.7;

const ENEMY_CAP = 1024;
const PROJ_CAP = 2048;
const HIT_RADIUS = 0.35;

export class Sim {
  readonly flow: FlowField;

  // ---- enemies (SoA) ----
  readonly posX = new Float32Array(ENEMY_CAP);
  readonly posY = new Float32Array(ENEMY_CAP);
  readonly hp = new Float32Array(ENEMY_CAP);
  readonly shield = new Float32Array(ENEMY_CAP);
  readonly enemyDefIdx = new Uint8Array(ENEMY_CAP);
  readonly alive = new Uint8Array(ENEMY_CAP);
  /**
   * HP at spawn, for the view's health marks (2.14). Display bookkeeping,
   * not evolution state: nothing in the sim reads it back, so it stays out
   * of hashState the same way events do.
   */
  readonly spawnHp = new Float32Array(ENEMY_CAP);
  /**
   * Direction of travel (0=N 1=E 2=S 3=W), set at spawn and on every
   * retarget. On a bridge cell it names the strand the enemy is riding -
   * both strands are straight, so direction IS strand. Derived state
   * (fully determined by hashed positions/targets), deliberately not
   * hashed so bridge-free replays keep their hash.
   */
  private readonly walkDir = new Uint8Array(ENEMY_CAP);
  /** Slow timer, public read-only so the view can mark chilled enemies. */
  readonly slowTicks = new Int16Array(ENEMY_CAP);
  private readonly slowMul = new Float32Array(ENEMY_CAP);
  private readonly gen = new Uint16Array(ENEMY_CAP);
  private readonly tgtX = new Float32Array(ENEMY_CAP);
  private readonly tgtY = new Float32Array(ENEMY_CAP);
  private freeEnemies: number[] = [];
  private enemyHigh = 0;

  // ---- projectiles (SoA), stats snapshotted at fire time ----
  readonly projX = new Float32Array(PROJ_CAP);
  readonly projY = new Float32Array(PROJ_CAP);
  // Velocity is public read-only like position: the view draws trails from
  // it (WBS 4.1). Same one-way seam as posX/posY - the view reads, never writes.
  readonly projVX = new Float32Array(PROJ_CAP);
  readonly projVY = new Float32Array(PROJ_CAP);
  // The AIM POINT, committed at fire time (WBS 2.19 - Daniil: a shell is
  // thrown at a PLACE). Ballistic shots detonate here no matter what happens
  // to the world in flight; homing shots keep it updated as a fallback so a
  // shot whose every target died still resolves somewhere real.
  private readonly projAimX = new Float32Array(PROJ_CAP);
  private readonly projAimY = new Float32Array(PROJ_CAP);
  readonly projAlive = new Uint8Array(PROJ_CAP);
  private readonly projTarget = new Int32Array(PROJ_CAP);
  private readonly projTargetGen = new Uint16Array(PROJ_CAP);
  private readonly projTowerIdx = new Int16Array(PROJ_CAP);
  private readonly projTtl = new Int16Array(PROJ_CAP);
  private readonly projDamage = new Float32Array(PROJ_CAP);
  private readonly projSpeed = new Float32Array(PROJ_CAP);
  private readonly projHoming = new Uint8Array(PROJ_CAP);
  private readonly projRadius = new Float32Array(PROJ_CAP);
  private readonly projSlowMul = new Float32Array(PROJ_CAP);
  private readonly projSlowTicks = new Int16Array(PROJ_CAP);
  private freeProj: number[] = [];
  private projHigh = 0;

  // ---- towers ----
  readonly towers: (Tower | null)[] = [];
  readonly occupancy: Uint16Array;

  tickCount = 0;
  /** Sim->view event feed (see SimEvent). Append-only, capped, never read back. */
  readonly events: StampedSimEvent[] = [];
  private eventSeq = 0;
  breaches = 0;
  coreDamage = 0;
  spawned = 0;
  kills = 0;
  scrap = 0;
  /**
   * Ore, stored per tier (invariant 9) with one tier live in M1. Index 0 is
   * tier 1 - what Refineries mine and the Core will spend (PRD sec 6).
   */
  readonly ore: number[] = [0];
  coreHp: number;
  coreHpMax: number; // Sandbags (consumable) raise it
  /** 'running' until the Core falls - or the final wave is held (D6). */
  status: 'running' | 'lost' | 'won' = 'running';

  /**
   * The run's input log, recorded inside the mutation methods themselves -
   * the ONLY mutation surface - so the log cannot drift from what happened.
   * {seed, this} is the whole run (PRD sec 12).
   */
  readonly inputs: ReplayInput[] = [];

  // ---- relics (PRD sec 7) ----
  /** Indices into opts.relicDefs, in acquisition order. */
  readonly heldRelics: number[] = [];
  /** Ticks until each held active may fire again; 0 for non-actives. */
  readonly relicCooldowns: number[] = [];
  /** Pending pick-1-of-3, as pool indices; null when no offer is up. */
  offer: number[] | null = null;
  /** Wave the last offer was generated for - one offer per eligible wave. */
  private offerWave = 0;
  /** Purchases this run; each one makes the next dearer (escalating costs). */
  private relicsBought = 0;
  private rerollsBought = 0;
  private fold: RelicFold = EMPTY_FOLD;
  private freezeUntil = 0;
  private prodBoostUntil = 0;
  private prodBoostMul = 1;
  /** Cells adjacent to (or part of) the Core block, for Loadbearing. */
  private readonly nearCore: Uint8Array;
  /**
   * The LIVE cell map. Starts as a copy of opts.cells; prospecting mutates
   * it (K to O or G - never anything on the route, so the flow field is
   * untouched by construction). The view reads changes via cellChanges.
   */
  private readonly cellsMut: (CellType | null)[];
  /** Every cell mutation, in order - the view's terrain overrides. */
  readonly cellChanges: { x: number; y: number; t: CellType }[] = [];
  /** Cache spots the run produced - prospected rock, boss drops. Hashed. */
  readonly caches: CacheSpot[] = [];
  /** Boon ground an opened cache created; boonAt reads the map's and these. */
  readonly extraBoons: BoonRef[] = [];
  /** What caches gave, newest last (capped). Presentation only, not hashed. */
  readonly lootLog: { tick: number; x: number; y: number; text: string }[] = [];
  /** Active prospect jobs: cell index -> ticks remaining. */
  readonly prospectJobs = new Map<number, number>();
  /** Remaining ore per vein cell (key = cell index). Finite: PRD sec 6. */
  private readonly depositLeft = new Map<number, number>();
  private readonly depositInit = new Map<number, number>();
  private readonly depositTier = new Map<number, number>();

  // ---- waves ----
  wave = 0;
  /** Entries the CURRENT wave uses; next wave's are telegraphed. */
  waveEntries: CellRef[] = [];
  nextWaveEntries: CellRef[] = [];
  /** Enemies still to spawn this wave: defIdx, OR BOSS_QUEUE_FLAG for the boss. */
  private spawnQueue: number[] = [];
  /** The NEXT wave, composed one wave ahead so the HUD can show it (item 11). */
  private nextQueue: number[] = [];
  /** Ticks until the next auto-launch; -1 = waiting for the player's call. */
  private waveTimer = -1;
  /** 1 for a boss body - bounty and Core damage read it; hashed. */
  readonly bossFlag = new Uint8Array(ENEMY_CAP);
  /** Tick of the last hit taken; shielded enemies regrow after a pause. */
  private readonly lastHit = new Int32Array(ENEMY_CAP);
  /**
   * Path-length offset (PRD sec 9, item 4): enemy hp scales by
   * sqrt(mean lane / the threat's floor) so a long road is time under fire
   * that the waves pay back, not a gift. 1 when the map states no floor.
   */
  private lengthMul = 1;
  private intraTimer = 0;

  private readonly rng: Rng;
  private readonly mode: 'trickle' | 'waves';
  private readonly spawnEvery: number;
  private readonly maxSpawns: number;
  private readonly interWaveTicks: number;
  private readonly difficulty: DifficultySpec;
  private readonly finalWave: number;
  private spawnTimer = 0;

  constructor(
    seed: number,
    private readonly opts: SimOptions,
  ) {
    if (opts.enemyDefs.length === 0) throw new Error('sim needs at least one enemy def');
    // Wave composition draws from the defs unlocked by wave 1; a roster whose
    // every minWave is later would crash on the first wave, so refuse it
    // here with a sentence instead of a TypeError mid-run.
    if ((opts.mode ?? 'trickle') === 'waves' && !opts.enemyDefs.some((d) => (d.minWave ?? 1) <= 1)) {
      throw new Error('sim needs at least one enemy def with minWave 1 (or none) - nothing could spawn on wave 1');
    }
    this.rng = createRng(seed);
    this.mode = opts.mode ?? 'trickle';
    this.spawnEvery = opts.spawnEveryTicks ?? TICK_HZ;
    this.maxSpawns = opts.maxSpawns ?? 0;
    this.scrap = opts.startingScrap ?? 100;
    this.ore[0] = opts.startingOre ?? 0;
    this.coreHpMax = opts.coreHp ?? 50;
    this.coreHp = this.coreHpMax;
    this.interWaveTicks = opts.interWaveTicks ?? 800; // 40 s launch-to-launch (design round 1)
    this.difficulty = opts.difficulty ?? DEFAULT_DIFFICULTY;
    this.finalWave = opts.finalWave ?? 0;
    this.waveTimer = (opts.firstWaveWaits ?? true) ? -1 : Math.min(this.interWaveTicks, 60);
    this.occupancy = new Uint16Array(opts.cellsW * opts.cellsH);
    this.cellsMut = opts.cells.slice();
    for (const d of opts.map.deposits ?? []) {
      const k = d.y * opts.cellsW + d.x;
      this.depositLeft.set(k, d.amount);
      this.depositInit.set(k, d.amount);
      this.depositTier.set(k, d.tier);
    }
    this.flow = computeFlowField(opts.cells, opts.cellsW, opts.cellsH, opts.map.entries);
    // Loadbearing's "adjacent to the Core": chebyshev-1 ring around C cells.
    this.nearCore = new Uint8Array(opts.cellsW * opts.cellsH);
    for (let y = 0; y < opts.cellsH; y++)
      for (let x = 0; x < opts.cellsW; x++) {
        if (opts.cells[y * opts.cellsW + x] !== 'C') continue;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < opts.cellsW && ny < opts.cellsH) this.nearCore[ny * opts.cellsW + nx] = 1;
          }
      }
    if (this.mode === 'waves') {
      this.nextWaveEntries = this.pickWaveEntries(1);
      this.nextQueue = this.composeWave(1);
      const floor = opts.map.pathFloorCells;
      if (floor !== undefined && floor > 0 && opts.map.entries.length > 0) {
        let sum = 0;
        for (const e of opts.map.entries) sum += this.flow.dist[e.y * opts.cellsW + e.x];
        const mean = sum / opts.map.entries.length;
        // sqrt, not pow: exponent 0.5 is the PRD's value and pow is banned
        // for cross-engine determinism. Never below 1 - a lane shorter than
        // the floor is impossible by construction (spec sec 12 Tier 1).
        this.lengthMul = Math.max(1, Math.sqrt(mean / floor));
      }
    }
  }

  // ---- building and upgrading ---------------------------------------------

  canBuildAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.opts.cellsW || y >= this.opts.cellsH) return false;
    const t = this.cellsMut[y * this.opts.cellsW + x];
    return t !== null && isBuildable(t) && this.occupancy[y * this.opts.cellsW + x] === 0;
  }

  canAfford(defId: string): boolean {
    const def = this.opts.towerDefs.find((d) => d.id === defId);
    return def !== undefined && this.scrap >= def.cost;
  }

  /**
   * Per-def placement legality (Daniil, 2026-08-16): ore producers go ON ore
   * nodes and nowhere else; every other tower stays OFF them - an ore node is
   * Refinery ground, not premium tower ground. Derived from the def's
   * production block, so it is content-driven with no extra schema field.
   * Phase 6's buildLegality hook (relics like Vein Tap / Foundry) widens
   * exactly this function.
   */
  canBuildDefAt(x: number, y: number, defId: string): boolean {
    const cell = this.cellAt(x, y);
    if (cell === null || this.occupancy[y * this.opts.cellsW + x] !== 0) return false;
    const def = this.opts.towerDefs.find((d) => d.id === defId);
    if (!def) return false;
    // An unclaimed cache blocks building outright: the claim card is the only
    // interaction (Daniil - a tower on a cache would just be sold back).
    if (this.cacheAt(x, y) !== null) return false;
    const minesOre = (def.production?.ore ?? 0) > 0;
    if (minesOre) return cell === 'O'; // refineries live on veins, full stop
    if (cell === 'G') return true;
    if (cell === 'R') return this.fold.buildOnRock; // Vein Tap
    return false; // O is Refinery ground; road and C are never buildable
  }

  buildTower(x: number, y: number, defId: string): boolean {
    if (this.status !== 'running') return false;
    const defIdx = this.opts.towerDefs.findIndex((d) => d.id === defId);
    if (defIdx === -1) throw new Error(`unknown tower def '${defId}'`);
    if (!this.canBuildDefAt(x, y, defId)) return false;
    const def = this.opts.towerDefs[defIdx];
    if (this.scrap < def.cost) return false;
    this.scrap -= def.cost;
    // Producers earn their first yield after one full cycle, not on placement.
    const prodCooldown = def.production ? effectiveStats(def, [-1, -1, -1]).productionEveryTicks : 0;
    this.towers.push({ cellX: x, cellY: y, defIdx, cooldown: 0, prodCooldown, kills: 0, priority: 'first', choices: [-1, -1, -1] });
    this.occupancy[y * this.opts.cellsW + x] = this.towers.length;
    this.emit({ kind: 'build', x, y });
    this.inputs.push({ tick: this.tickCount, a: { t: 'build', x, y, defId } });
    return true;
  }

  /** The map's cell under (x, y), or null off-board/void. */
  cellAt(x: number, y: number): CellType | null {
    if (x < 0 || y < 0 || x >= this.opts.cellsW || y >= this.opts.cellsH) return null;
    return this.cellsMut[y * this.opts.cellsW + x];
  }

  /** Cost of taking a tier's option, or null when locked/committed/absent. */
  choiceCost(t: Tower, tier: number, option: number): number | null {
    const def = this.opts.towerDefs[t.defIdx];
    if (!def.tiers || !canChoose(t.choices, tier)) return null;
    return def.tiers[tier]?.choices[option]?.cost ?? null;
  }

  chooseTier(x: number, y: number, tier: number, option: number): boolean {
    if (this.status !== 'running') return false;
    const t = this.towerAt(x, y);
    if (!t) return false;
    const cost = this.choiceCost(t, tier, option);
    if (cost === null || this.scrap < cost) return false;
    this.scrap -= cost;
    t.choices[tier] = option;
    this.inputs.push({ tick: this.tickCount, a: { t: 'choose', x, y, tier, option } });
    return true;
  }

  /**
   * A tower's stats under HYPOTHETICAL tier choices, through the same relic
   * fold as the live number. Powers the upgrade preview; computing the
   * preview from base stats while the display was folded is how a range-18
   * tower once previewed 8.5 (the 1.7.1 bug).
   */
  statsWith(t: Tower, choices: readonly number[]): EffectiveStats {
    return this.foldStats({ ...t, choices: [...choices] as [number, number, number] });
  }

  /** The boon under (x, y), or null (PRD sec 4.7) - dealt or cache-made. */
  boonAt(x: number, y: number): { boon: 'range' | 'damage' | 'rate'; tier: number } | null {
    for (const b of this.opts.map.boons ?? []) if (b.x === x && b.y === y) return { boon: b.boon, tier: b.tier ?? 1 };
    for (const b of this.extraBoons) if (b.x === x && b.y === y) return { boon: b.boon, tier: b.tier ?? 1 };
    return null;
  }

  /** What a boon does, exactly - one source for HUD text and the fold. */
  static boonEffect(boon: 'range' | 'damage' | 'rate', tier: number): { text: string; rangeAdd: number; damageMul: number; rateMul: number } {
    if (boon === 'range') return { text: `+${tier} range`, rangeAdd: tier, damageMul: 1, rateMul: 1 };
    if (boon === 'damage') {
      const mul = [1.1, 1.2, 1.35, 1.5][tier - 1] ?? 1.1;
      return { text: `+${Math.round((mul - 1) * 100)}% damage`, rangeAdd: 0, damageMul: mul, rateMul: 1 };
    }
    const mul = [1.1, 1.2, 1.35, 1.5][tier - 1] ?? 1.1;
    return { text: `+${Math.round((mul - 1) * 100)}% fire rate`, rangeAdd: 0, damageMul: 1, rateMul: mul };
  }

  /** Tier fold, then the relic fold on top - the ONE place relics touch stats. */
  stats(t: Tower): EffectiveStats {
    return this.foldStats(t);
  }

  private foldStats(t: Tower): EffectiveStats {
    const out = effectiveStats(this.opts.towerDefs[t.defIdx], t.choices);
    const f = this.fold;
    if (f !== EMPTY_FOLD) {
      out.damage *= f.damageMul;
      out.fireEveryTicks = Math.max(2, Math.round(out.fireEveryTicks / f.fireRateMul));
      out.range += f.rangeAdd;
      if (f.coreAdjacentRangeMul !== 1 && this.nearCore[t.cellY * this.opts.cellsW + t.cellX]) {
        out.range *= f.coreAdjacentRangeMul;
      }
    }
    // Boon ground (PRD sec 4.7): the CELL buffs whoever stands on it, after
    // every other fold - the map's own contribution to a build.
    const boon = this.boonAt(t.cellX, t.cellY);
    if (boon) {
      const e = Sim.boonEffect(boon.boon, boon.tier);
      out.range += e.rangeAdd;
      out.damage *= e.damageMul;
      out.fireEveryTicks = Math.max(2, Math.round(out.fireEveryTicks / e.rateMul));
    }
    return out;
  }

  // ---- relics (PRD sec 7) --------------------------------------------------

  private refold(): void {
    const defs = this.opts.relicDefs ?? [];
    // Passives fold; actives and consumables act when fired/used instead.
    const live = this.heldRelics.filter((di) => defs[di].kind === 'passive').map((di) => defs[di]);
    this.fold = live.length === 0 ? EMPTY_FOLD : foldRelics(live);
  }

  /** The pending offer as defs, for the modal; null when none. */
  offerDefs(): RelicDef[] | null {
    return this.offer ? this.offer.map((di) => this.opts.relicDefs![di]) : null;
  }

  /** Held relics with their live state, for the inventory panel. */
  heldRelicInfo(): { def: RelicDef; cooldown: number }[] {
    const defs = this.opts.relicDefs ?? [];
    return this.heldRelics.map((di, i) => ({ def: defs[di], cooldown: this.relicCooldowns[i] }));
  }

  pickRelic(option: number): boolean {
    if (this.status !== 'running') return false;
    if (!this.offer || option < 0 || option >= this.offer.length) return false;
    this.heldRelics.push(this.offer[option]);
    this.relicCooldowns.push(0); // actives arrive ready - the first firing is the sales pitch
    this.offer = null;
    this.refold();
    this.inputs.push({ tick: this.tickCount, a: { t: 'pickRelic', option } });
    return true;
  }

  fireActive(relicId: string, x?: number, y?: number): boolean {
    if (this.status !== 'running') return false;
    const defs = this.opts.relicDefs ?? [];
    // Duplicates are equippable, so fire the first READY copy (playtest 12):
    // always taking the first copy locked every duplicate behind one
    // cooldown. Deterministic - acquisition order - and replay-compatible,
    // since any previously-recorded success had its first copy ready.
    let hi = -1;
    for (let i = 0; i < this.heldRelics.length; i++) {
      const d = defs[this.heldRelics[i]];
      if (d.id === relicId && d.kind === 'active' && this.relicCooldowns[i] === 0) {
        hi = i;
        break;
      }
    }
    if (hi === -1) return false;
    const def = defs[this.heldRelics[hi]];
    const e = def.effects ?? {};
    if (e.orbitalDamage !== undefined) {
      if (x === undefined || y === undefined) return false; // targeted active needs a target
      const cx = x + 0.5;
      const cy = y + 0.5;
      const r = e.orbitalRadius ?? 1;
      for (let i = 0; i < this.enemyHigh; i++) {
        if (!this.alive[i]) continue;
        const dx = this.posX[i] - cx;
        const dy = this.posY[i] - cy;
        if (Math.sqrt(dx * dx + dy * dy) <= r) this.applyDamage(i, e.orbitalDamage, 0, 0, -1);
      }
      this.emit({ kind: 'pulse', x: cx, y: cy, r });
    }
    if (e.freezeTicks !== undefined) this.freezeUntil = this.tickCount + e.freezeTicks;
    if (e.productionMul !== undefined) {
      this.prodBoostUntil = this.tickCount + (e.boostTicks ?? 0);
      this.prodBoostMul = e.productionMul;
    }
    this.relicCooldowns[hi] = def.cooldownTicks ?? 0;
    this.inputs.push({ tick: this.tickCount, a: { t: 'fireActive', relicId, x, y } });
    return true;
  }

  /**
   * The whole pool - duplicates are EQUIPPABLE (Daniil, playtest 5): the
   * fold already stacks multiplicatively, and rebalancing offenders is a
   * separate session's job. Offers stay duplicate-free WITHIN one deal.
   */
  private unheldPool(): number[] {
    const defs = this.opts.relicDefs ?? [];
    const pool: number[] = [];
    for (let i = 0; i < defs.length; i++) {
      // A held UNSTACKABLE relic leaves the pool: a second Vein Tap is a
      // dead card, a second Frostbite is a bigger one (design round 1).
      if (!(defs[i].stackable ?? false) && this.heldRelics.includes(i)) continue;
      pool.push(i);
    }
    return pool;
  }

  /** Ore price of the next blind draw - escalates per purchase this run. */
  drawCost(): number {
    return escalated(RELIC_DRAW_COST, RELIC_COST_GROWTH, this.relicsBought);
  }

  /** Ore price of the next reroll - escalates per reroll this run. */
  rerollCost(): number {
    return escalated(OFFER_REROLL_COST, RELIC_COST_GROWTH, this.rerollsBought);
  }

  /**
   * The Core's Ore sink (PRD sec 7.3 channel C): pay Ore, draw blind from
   * the pool. The draw spends 'relics'-stream randomness at ACTION time, so
   * it rides the input log like every other decision.
   */
  buyRelic(): boolean {
    if (this.status !== 'running' || !this.opts.relicDefs) return false;
    const cost = this.drawCost();
    if (this.ore[0] < cost) return false;
    const pool = this.unheldPool();
    if (pool.length === 0) return false;
    this.ore[0] -= cost;
    this.relicsBought++;
    this.heldRelics.push(this.rng.stream('relics').pick(pool));
    this.relicCooldowns.push(0);
    this.refold();
    this.inputs.push({ tick: this.tickCount, a: { t: 'buyRelic' } });
    return true;
  }

  /** Pay Ore, deal a fresh 3 from the pool in place of the standing offer. */
  rerollOffer(): boolean {
    if (this.status !== 'running' || this.offer === null) return false;
    const cost = this.rerollCost();
    if (this.ore[0] < cost) return false;
    const pool = this.unheldPool();
    if (pool.length === 0) return false;
    this.ore[0] -= cost;
    this.rerollsBought++;
    this.offer = this.rng.stream('relics').shuffle(pool).slice(0, 3);
    this.inputs.push({ tick: this.tickCount, a: { t: 'rerollOffer' } });
    return true;
  }

  /** Remaining/initial vein at (x, y); null when not an ore cell. */
  depositAt(x: number, y: number): { left: number; initial: number; tier: number } | null {
    const k = y * this.opts.cellsW + x;
    if (!this.depositInit.has(k)) return null;
    return { left: this.depositLeft.get(k) ?? 0, initial: this.depositInit.get(k)!, tier: this.depositTier.get(k) ?? 1 };
  }

  /** The unopened cache at (x, y), or null. */
  cacheAt(x: number, y: number): CacheSpot | null {
    for (const c of this.caches) if (!c.opened && c.x === x && c.y === y) return c;
    return null;
  }

  /**
   * Open a cache (design round 1, Daniil): free - select it, click OPEN.
   * The cache names a loot table; the table is rolled on the 'loot' stream
   * NOW, so the outcome rides the input log like every other decision.
   * What a cache can hold is content (PRD sec 7.7); this method only knows
   * how to apply each outcome kind.
   */
  openCache(x: number, y: number): boolean {
    if (this.status !== 'running') return false;
    const spot = this.cacheAt(x, y);
    if (!spot) return false;
    const table = (this.opts.lootTables ?? []).find((t) => t.id === spot.table);
    if (!table) throw new Error(`cache at (${x},${y}) names loot table '${spot.table}', which content does not carry`);
    spot.opened = true;
    const text = this.rollLoot(table, x, y);
    this.lootLog.push({ tick: this.tickCount, x, y, text });
    if (this.lootLog.length > 8) this.lootLog.shift();
    this.emit({ kind: 'loot', x: x + 0.5, y: y + 0.5, text });
    this.inputs.push({ tick: this.tickCount, a: { t: 'openCache', x, y } });
    return true;
  }

  /** Weighted pick, then apply. Returns the player-facing line. */
  private rollLoot(table: LootTable, x: number, y: number): string {
    const loot = this.rng.stream('loot');
    // Weights quantised to hundredths so a fractional weight still draws an
    // integer (the stream has no float pick); order is the table's order.
    const total = table.outcomes.reduce((a, o) => a + Math.round(o.weight * 100), 0);
    let roll = loot.int(0, Math.max(0, total - 1));
    let pick = table.outcomes[0];
    for (const o of table.outcomes) {
      const w = Math.round(o.weight * 100);
      if (roll < w) { pick = o; break; }
      roll -= w;
    }
    const fallback = (): string => { this.scrap += LOOT_FALLBACK_SCRAP; return `+${LOOT_FALLBACK_SCRAP} scrap`; };
    switch (pick.kind) {
      case 'scrap': {
        const n = loot.int(pick.min ?? 0, Math.max(pick.min ?? 0, pick.max ?? 0));
        this.scrap += n;
        return `+${n} scrap`;
      }
      case 'ore': {
        const n = loot.int(pick.min ?? 0, Math.max(pick.min ?? 0, pick.max ?? 0));
        this.ore[0] += n;
        return `+${n} ore`;
      }
      case 'boon': {
        // The cache's own cell becomes boon ground - a place worth defending.
        // Only ground can carry a boon (spec tier 3); a boss drop on the road
        // never rolls this table, but the rule holds regardless of content.
        if (this.cellAt(x, y) !== 'G' || this.boonAt(x, y) !== null) return fallback();
        const kinds: BoonRef['boon'][] = ['range', 'damage', 'rate'];
        const boon = kinds[loot.int(0, kinds.length - 1)];
        const tier = Math.max(1, Math.min(4, pick.tier ?? 1)) as BoonRef['tier'];
        this.extraBoons.push({ x, y, boon, tier });
        return `boon ground: ${Sim.boonEffect(boon, tier).text}`;
      }
      case 'consumable': {
        const defs = this.opts.relicDefs ?? [];
        const idx: number[] = [];
        defs.forEach((d, i) => { if (d.kind === 'consumable') idx.push(i); });
        if (idx.length === 0) return fallback();
        const di = idx[loot.int(0, idx.length - 1)];
        this.heldRelics.push(di);
        this.relicCooldowns.push(0);
        this.refold();
        return `relic: ${defs[di].name}`;
      }
      case 'relic': {
        const defs = this.opts.relicDefs ?? [];
        const pool = this.unheldPool().filter((i) => defs[i].kind !== 'consumable');
        if (pool.length === 0) return fallback();
        const di = pool[loot.int(0, pool.length - 1)];
        this.heldRelics.push(di);
        this.relicCooldowns.push(0);
        this.refold();
        return `relic: ${defs[di].name}`;
      }
      case 'nothing':
        return 'empty';
      default:
        pick.kind satisfies never;
        return fallback();
    }
  }

  /** Towers holding a given survey capability. */
  private surveyCount(cap: 'surveySpeed' | 'surveyAuto'): number {
    let n = 0;
    for (const t of this.towers) {
      if (!t) continue;
      const tiers = this.opts.towerDefs[t.defIdx].tiers;
      if (!tiers) continue;
      for (let ti = 0; ti < t.choices.length; ti++) {
        const pick = t.choices[ti];
        if (pick >= 0 && tiers[ti]?.choices[pick]?.unlocks === cap) n++;
      }
    }
    return n;
  }

  /**
   * Every Survey tower speeds EVERY job - global and stacking (Daniil,
   * playtest 4), capped so five refineries do not make rock free.
   */
  prospectSpeed(): number {
    return Math.min(5, 1 + this.surveyCount('surveySpeed')) * this.fold.prospectSpeedMul; // Quarry multiplies past the cap
  }

  /** The active prospect job at (x, y), for the rock card's progress bar. */
  prospectJobAt(x: number, y: number): { remaining: number; total: number } | null {
    const r = this.prospectJobs.get(y * this.opts.cellsW + x);
    return r === undefined ? null : { remaining: r, total: PROSPECT_TICKS };
  }

  /**
   * START breaking a rock open (PRD sec 4.6, revised: no unlock - anyone may
   * prospect, paying Scrap AND TIME). The reveal happens when the job
   * completes; Survey refineries nearby speed it up and start jobs of their
   * own for free.
   */
  prospect(x: number, y: number): boolean {
    if (this.status !== 'running') return false;
    if (this.cellAt(x, y) !== 'R') return false;
    const k = y * this.opts.cellsW + x;
    if (this.prospectJobs.has(k)) return false;
    if (this.scrap < PROSPECT_COST) return false;
    this.scrap -= PROSPECT_COST;
    this.prospectJobs.set(k, PROSPECT_TICKS);
    this.inputs.push({ tick: this.tickCount, a: { t: 'prospect', x, y } });
    return true;
  }

  /** Jobs tick down (Survey towers accelerate); completion reveals the deal. */
  private prospectPhase(): void {
    const speed = this.prospectSpeed();
    for (const [k, remaining] of this.prospectJobs) {
      const x = k % this.opts.cellsW;
      const y = Math.floor(k / this.opts.cellsW);
      void x; void y;
      const next = remaining - speed;
      if (next > 0) {
        this.prospectJobs.set(k, next);
        continue;
      }
      this.prospectJobs.delete(k);
      const found = this.opts.map.rockContents.find((r) => r.x === x && r.y === y);
      const yields = found?.yields ?? 'none';
      const t: CellType = yields === 'ore' ? 'O' : 'G';
      this.cellsMut[k] = t;
      this.cellChanges.push({ x, y, t });
      this.emit({ kind: 'reveal', x, y, found: yields });
      if (yields === 'ore') {
        const amount = found?.depositAmount ?? 30;
        this.depositLeft.set(k, amount);
        this.depositInit.set(k, amount);
        this.depositTier.set(k, 1);
      }
      // A sealed cache is REVEALED, not granted: it sits on the opened ground
      // until the player clicks OPEN (design round 1).
      if (yields === 'cache') this.caches.push({ x, y, table: 'rock_cache', opened: false });
    }
    // AUTOMATION towers prospect their surroundings autonomously (free):
    // one job at a time each, nearest rock first, deterministic scan. A
    // PARALLEL capability to Survey's speed, not the same switch (Daniil).
    for (const t of this.towers) {
      if (!t) continue;
      const tiers = this.opts.towerDefs[t.defIdx].tiers;
      if (!tiers) continue;
      let hasSurvey = false;
      for (let ti = 0; ti < t.choices.length; ti++) {
        const pick = t.choices[ti];
        if (pick >= 0 && tiers[ti]?.choices[pick]?.unlocks === 'surveyAuto') hasSurvey = true;
      }
      if (!hasSurvey) continue;
      let busy = false;
      for (const [k] of this.prospectJobs) {
        const jx = k % this.opts.cellsW;
        const jy = Math.floor(k / this.opts.cellsW);
        if (Math.max(Math.abs(t.cellX - jx), Math.abs(t.cellY - jy)) <= 2) busy = true;
      }
      if (busy) continue;
      outer: for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const rx = t.cellX + dx;
          const ry = t.cellY + dy;
          if (this.cellAt(rx, ry) !== 'R') continue;
          const rk = ry * this.opts.cellsW + rx;
          if (this.prospectJobs.has(rk)) continue;
          this.prospectJobs.set(rk, PROSPECT_TICKS);
          break outer;
        }
    }
  }

  /**
   * Spend a consumable: its effects apply ONCE (same knobs actives use, minus
   * targeting), and the slot is vacated - a spent consumable freeing its slot
   * is the point of carrying one (Daniil, 2026-08-16; it previously sat as a
   * dead [--] marker forever).
   */
  useConsumable(relicId: string): boolean {
    if (this.status !== 'running') return false;
    const defs = this.opts.relicDefs ?? [];
    const hi = this.heldRelics.findIndex((di) => defs[di].id === relicId && defs[di].kind === 'consumable');
    if (hi === -1) return false;
    const e = defs[this.heldRelics[hi]].effects ?? {};
    if (e.freezeTicks !== undefined) this.freezeUntil = this.tickCount + e.freezeTicks;
    if (e.productionMul !== undefined) {
      this.prodBoostUntil = this.tickCount + (e.boostTicks ?? 0);
      this.prodBoostMul = e.productionMul;
    }
    if (e.killRefundScrap !== undefined) this.scrap += e.killRefundScrap; // flat grant when used as a one-shot
    if (e.coreHpAdd !== undefined) { this.coreHpMax += e.coreHpAdd; this.coreHp += e.coreHpAdd; } // Sandbags
    if (e.oreAdd !== undefined) this.ore[0] += e.oreAdd; // Ore Pocket
    this.heldRelics.splice(hi, 1);
    this.relicCooldowns.splice(hi, 1);
    this.refold();
    this.inputs.push({ tick: this.tickCount, a: { t: 'useConsumable', relicId } });
    return true;
  }

  /**
   * Every OFFER_EVERY_WAVES-th completed wave puts up a pick-1-of-3 from the
   * pool, minus what is already held (no duplicates - stacking comes from
   * COMBINATIONS, not copies). Draws on the 'relics' stream, so map, waves
   * and combat draws are untouched by the relic layer existing.
   */
  private maybeOffer(atLaunch: boolean): void {
    const defs = this.opts.relicDefs;
    if (!defs || this.offer !== null) return;
    if (this.wave === 0 || this.wave % OFFER_EVERY_WAVES !== 0 || this.offerWave === this.wave) return;
    void atLaunch; // both call sites share the rule; the flag documents intent
    this.offerWave = this.wave;
    const pool = this.unheldPool();
    if (pool.length === 0) return;
    this.offer = this.rng.stream('relics').shuffle(pool).slice(0, 3);
  }

  setPriority(x: number, y: number, priority: Priority): boolean {
    if (this.status !== 'running') return false;
    const t = this.towerAt(x, y);
    if (!t) return false;
    t.priority = priority;
    this.inputs.push({ tick: this.tickCount, a: { t: 'priority', x, y, priority } });
    return true;
  }

  towerAt(x: number, y: number): Tower | null {
    if (x < 0 || y < 0 || x >= this.opts.cellsW || y >= this.opts.cellsH) return null;
    const idx = this.occupancy[y * this.opts.cellsW + x];
    return idx === 0 ? null : this.towers[idx - 1];
  }

  towerDef(t: Tower): TowerDef {
    return this.opts.towerDefs[t.defIdx];
  }

  sellTower(x: number, y: number): boolean {
    if (this.status !== 'running') return false;
    // Bounds first: an unchecked index here aliased (-1, 1) onto (w-1, 0),
    // sold THAT tower and logged the bogus coordinate as a replay input.
    if (x < 0 || y < 0 || x >= this.opts.cellsW || y >= this.opts.cellsH) return false;
    const idx = this.occupancy[y * this.opts.cellsW + x];
    if (idx === 0) return false;
    const tower = this.towers[idx - 1];
    if (tower) {
      // Refund the base cost plus everything sunk into tiers.
      const def = this.opts.towerDefs[tower.defIdx];
      let sunk = def.cost;
      def.tiers?.forEach((tierDef, ti) => {
        const pick = tower.choices[ti];
        if (pick >= 0) sunk += tierDef.choices[pick].cost;
      });
      // +epsilon: 90*0.7 is 62.999... in IEEE; the player is owed 63.
      this.scrap += Math.floor(sunk * SELL_REFUND + 1e-6);
    }
    this.towers[idx - 1] = null;
    this.occupancy[y * this.opts.cellsW + x] = 0;
    this.emit({ kind: 'sell', x, y });
    this.inputs.push({ tick: this.tickCount, a: { t: 'sell', x, y } });
    return true;
  }

  /**
   * Playback dispatcher: one recorded action in, the same mutation out.
   * Reserved Phase 6 actions return false until their features exist - a
   * replay carrying them is from a newer REPLAY_VERSION and never gets here.
   */
  applyAction(a: ReplayAction): boolean {
    switch (a.t) {
      case 'build': return this.buildTower(a.x, a.y, a.defId);
      case 'choose': return this.chooseTier(a.x, a.y, a.tier, a.option);
      case 'priority': return this.setPriority(a.x, a.y, a.priority);
      case 'sell': return this.sellTower(a.x, a.y);
      case 'pickRelic': return this.pickRelic(a.option);
      case 'fireActive': return this.fireActive(a.relicId, a.x, a.y);
      case 'useConsumable': return this.useConsumable(a.relicId);
      case 'buyRelic': return this.buyRelic();
      case 'rerollOffer': return this.rerollOffer();
      case 'openCache': return this.openCache(a.x, a.y);
      case 'prospect': return this.prospect(a.x, a.y);
      case 'callWave': return this.callWave();
      default: return a satisfies never; // the union is fully implemented
    }
  }

  /**
   * FNV-1a over the full mutable state: every SoA lane to its high-water
   * mark, counters, timers, queues, towers, occupancy. Two sims with equal
   * hashes evolved identically; the golden replay test freezes one such hash
   * as the regression anchor (WBS 1.4.8). Float lanes hash by IEEE bit
   * pattern - determinism rules (sqrt-not-hypot, fixed tie-breaks) are what
   * make those bits reproducible cross-machine.
   */
  hashState(): number {
    let h = 0x811c9dc5;
    const u32 = (v: number): void => {
      h ^= v & 0xff; h = Math.imul(h, 0x01000193);
      h ^= (v >>> 8) & 0xff; h = Math.imul(h, 0x01000193);
      h ^= (v >>> 16) & 0xff; h = Math.imul(h, 0x01000193);
      h ^= (v >>> 24) & 0xff; h = Math.imul(h, 0x01000193);
    };
    const f32 = (arr: Float32Array, n: number): void => {
      const bits = new Uint32Array(arr.buffer, 0, n);
      for (let i = 0; i < n; i++) u32(bits[i]);
    };
    const i16 = (arr: Int16Array | Uint16Array, n: number): void => {
      for (let i = 0; i < n; i++) u32(arr[i]);
    };

    u32(this.tickCount); u32(this.scrap); u32(this.coreHp); u32(this.coreDamage);
    u32(this.wave); u32(this.kills); u32(this.breaches); u32(this.spawned);
    u32(this.status === 'running' ? 1 : 0);
    for (const o of this.ore) u32(o);
    u32(this.freezeUntil); u32(this.prodBoostUntil); u32(Math.round(this.prodBoostMul * 1000));
    u32(this.offerWave); u32(this.relicsBought); u32(this.rerollsBought); u32(this.coreHpMax);
    for (const r of this.heldRelics) u32(r);
    for (const c of this.relicCooldowns) u32(c);
    for (const o of this.offer ?? [-1]) u32(o + 1);
    for (const c of this.caches) { u32(c.x); u32(c.y); u32(c.opened ? 1 : 0); for (let i = 0; i < c.table.length; i++) u32(c.table.charCodeAt(i)); }
    for (const b of this.extraBoons) { u32(b.x); u32(b.y); u32(b.tier ?? 1); u32(b.boon.charCodeAt(0)); }
    for (const ch of this.cellChanges) { u32(ch.x); u32(ch.y); u32(ch.t.charCodeAt(0)); }
    u32(this.status === 'won' ? 1 : 0);
    for (const [k, v] of this.depositLeft) { u32(k); u32(v); }
    for (const [k, v] of this.prospectJobs) { u32(k); u32(v); }
    u32(this.waveTimer + 1); u32(this.intraTimer); u32(this.spawnTimer);
    u32(Math.round(this.lengthMul * 1000));
    for (const q of this.spawnQueue) u32(q);
    for (const q of this.nextQueue) u32(q + 0x10000);
    for (const e of this.waveEntries) { u32(e.x); u32(e.y); }
    for (const e of this.nextWaveEntries) { u32(e.x); u32(e.y); }

    const eh = this.enemyHigh;
    f32(this.posX, eh); f32(this.posY, eh); f32(this.hp, eh); f32(this.shield, eh);
    f32(this.slowMul, eh); f32(this.tgtX, eh); f32(this.tgtY, eh);
    i16(this.slowTicks, eh); i16(this.gen, eh);
    for (let i = 0; i < eh; i++) u32((this.bossFlag[i] << 16) | (this.alive[i] << 8) | this.enemyDefIdx[i]);
    for (let i = 0; i < eh; i++) u32(this.lastHit[i]);
    for (const s of this.freeEnemies) u32(s);

    const ph = this.projHigh;
    f32(this.projX, ph); f32(this.projY, ph); f32(this.projVX, ph); f32(this.projVY, ph);
    f32(this.projAimX, ph); f32(this.projAimY, ph);
    f32(this.projDamage, ph); f32(this.projSpeed, ph); f32(this.projRadius, ph); f32(this.projSlowMul, ph);
    i16(this.projTtl, ph); i16(this.projTargetGen, ph); i16(this.projSlowTicks, ph); i16(this.projTowerIdx, ph);
    for (let i = 0; i < ph; i++) { u32(this.projAlive[i]); u32(this.projTarget[i]); u32(this.projHoming[i]); }
    for (const s of this.freeProj) u32(s);

    i16(this.occupancy, this.occupancy.length);
    for (const t of this.towers) {
      if (!t) { u32(0xdead); continue; }
      u32(t.cellX); u32(t.cellY); u32(t.defIdx); u32(t.cooldown); u32(t.prodCooldown); u32(t.kills);
      u32(PRIORITIES.indexOf(t.priority));
      for (const c of t.choices) u32(c + 1);
    }
    return h >>> 0;
  }

  /** Enemies still queued to spawn in the current wave. */
  spawnRemaining(): number {
    return this.spawnQueue.length;
  }

  /** Ticks until the next wave auto-launches; 0 when waiting for a call or done. */
  ticksToNextWave(): number {
    if (this.mode !== 'waves') return 0;
    return Math.max(0, this.waveTimer);
  }

  /** Wave 1 has not been called yet. */
  waitingForCall(): boolean {
    return this.mode === 'waves' && this.wave === 0 && this.waveTimer < 0;
  }

  /** True when the final wave has been launched (nothing more will come). */
  private lastWaveLaunched(): boolean {
    return this.finalWave > 0 && this.wave >= this.finalWave;
  }

  /**
   * The player may CALL the next wave once the current one has finished
   * SPAWNING - overlapping waves is the bet, stacking five in a second is
   * not - and never past the final wave.
   */
  canCallWave(): boolean {
    if (this.status !== 'running' || this.mode !== 'waves') return false;
    if (this.lastWaveLaunched()) return false;
    return this.spawnQueue.length === 0;
  }

  /** Scrap the player would earn by calling right now (item 9's bonus). */
  callBonus(): number {
    if (this.waveTimer <= 0) return 0;
    return Math.ceil(this.waveTimer / TICK_HZ) * CALL_BONUS_PER_SEC;
  }

  /** Launch the next wave now, banking the remaining clock as Scrap. */
  callWave(): boolean {
    if (!this.canCallWave()) return false;
    this.scrap += this.callBonus();
    this.launchWave();
    this.inputs.push({ tick: this.tickCount, a: { t: 'callWave' } });
    return true;
  }

  /** What the next wave holds, for the HUD (composed one wave ahead). */
  nextWavePreview(): { wave: number; boss: boolean; kinds: { id: string; count: number }[] } | null {
    if (this.mode !== 'waves' || this.lastWaveLaunched()) return null;
    const counts = new Map<number, number>();
    let boss = false;
    for (const q of this.nextQueue) {
      if ((q & BOSS_QUEUE_FLAG) !== 0) { boss = true; continue; }
      counts.set(q, (counts.get(q) ?? 0) + 1);
    }
    const kinds: { id: string; count: number }[] = [];
    for (const [idx, n] of counts) {
      const def = this.opts.enemyDefs[idx];
      kinds.push({ id: def.id, count: n * (hasTrait(def, 'swarm') ? TRAIT_RULES.swarm.packSize : 1) });
    }
    return { wave: this.wave + 1, boss, kinds };
  }

  static isBossWave(wave: number, finalWave: number): boolean {
    return wave > 0 && (wave % BOSS_EVERY_WAVES === 0 || (finalWave > 0 && wave === finalWave));
  }

  enemyDefOf(slot: number): EnemyDef {
    return this.opts.enemyDefs[this.enemyDefIdx[slot]];
  }

  aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.enemyHigh; i++) n += this.alive[i];
    return n;
  }

  private emit(e: SimEvent): void {
    this.events.push({ ...e, seq: this.eventSeq++, tick: this.tickCount });
    if (this.events.length > EVENT_CAP) this.events.shift();
  }

  // ---- the tick ------------------------------------------------------------

  tick(): void {
    if (this.status !== 'running') return; // a fallen Core stays fallen; a won run stays won
    this.tickCount++;
    for (let i = 0; i < this.relicCooldowns.length; i++) {
      if (this.relicCooldowns[i] > 0) this.relicCooldowns[i]--;
    }
    if (this.mode === 'waves') this.wavePhase();
    else this.tricklePhase();
    this.towerPhase();
    this.productionPhase();
    this.prospectPhase();
    this.projectilePhase();
    this.walkPhase();
  }

  // ---- production ----------------------------------------------------------

  /**
   * Refineries mine. Ore counts ONLY while the tower stands on an ore cell
   * (PRD sec 5.3) - off the vein the cycle timer holds rather than ticking
   * toward nothing, so when prospecting (1.6.6) turns rock to ore mid-run, an
   * adjacent idle Refinery resumes instead of instantly paying out a stalled
   * timer. scrap production is reserved shape and pays unconditionally
   * when content ever carries it.
   */
  private productionPhase(): void {
    for (const tower of this.towers) {
      if (!tower) continue;
      const def = this.opts.towerDefs[tower.defIdx];
      const prod = def.production;
      if (!prod) continue;
      const onVein = this.cellAt(tower.cellX, tower.cellY) === 'O';
      const oreShare = prod.ore ?? 0;
      const scrapShare = prod.scrap ?? 0;
      if ((oreShare === 0 || !onVein) && scrapShare === 0) continue; // idle: timer holds
      if (--tower.prodCooldown > 0) continue;
      const eff = this.stats(tower);
      tower.prodCooldown = eff.productionEveryTicks;
      // Deep Vein (relic active): a timed multiplier on every yield.
      const boost = this.tickCount < this.prodBoostUntil ? this.prodBoostMul : 1;
      const yielded = eff.production * boost;
      // A def mixing ore and scrap splits the folded yield by its base ratio;
      // shipped content never does (ore-only), but the shape must not lie.
      const total = oreShare + scrapShare;
      if (oreShare > 0 && onVein) {
        const k = tower.cellY * this.opts.cellsW + tower.cellX;
        const left = this.depositLeft.get(k) ?? 0;
        const mined = Math.min(left, Math.round((yielded * oreShare) / total));
        const tier = this.depositTier.get(k) ?? 1;
        this.ore[tier - 1] = (this.ore[tier - 1] ?? 0) + mined;
        this.depositLeft.set(k, left - mined);
        if (left - mined <= 0) {
          // The vein is spent: ordinary ground remains (PRD sec 6), and the
          // refinery above it goes idle - which vein, how long, when to move.
          this.cellsMut[k] = 'G';
          this.cellChanges.push({ x: tower.cellX, y: tower.cellY, t: 'G' });
        }
      }
      if (scrapShare > 0) this.scrap += Math.round((yielded * scrapShare) / total);
    }
  }

  // ---- spawning ------------------------------------------------------------

  private tricklePhase(): void {
    if (--this.spawnTimer > 0) return;
    if (this.maxSpawns !== 0 && this.spawned >= this.maxSpawns) return;
    this.spawnTimer = this.spawnEvery;
    const waves = this.rng.stream('waves');
    this.spawn(waves.pick(this.opts.map.entries), waves.int(0, this.opts.enemyDefs.length - 1));
  }

  private pickWaveEntries(wave: number): CellRef[] {
    const all = this.opts.map.entries;
    const count = Math.min(all.length, 1 + Math.floor((wave - 1) / 2));
    return this.rng.stream('waves').shuffle(all).slice(0, count);
  }

  /**
   * Compose wave `w` on the waves stream: bigger and meaner as numbers grow.
   * Composition escalates in KIND, not only count (PRD sec 9.1): each
   * enemy's weight grows with waves since it unlocked, so late waves are
   * heavies-with-escort instead of a bigger version of wave 1. Boss waves
   * (every BOSS_EVERY_WAVES-th and the final wave, D17) add ONE boss behind
   * the escort - the old elite surge made the victory wave a coincidence of
   * two constants; this makes it a rule.
   */
  private composeWave(w: number): number[] {
    const waves = this.rng.stream('waves');
    const count = waveCount(this.difficulty, w);
    const available: { idx: number; w: number }[] = [];
    this.opts.enemyDefs.forEach((d, i) => {
      const mw = d.minWave ?? 1;
      if (mw <= w) available.push({ idx: i, w: 1 + (w - mw) });
    });
    const totalW = available.reduce((a, b) => a + b.w, 0);
    // Unreachable given the constructor's minWave check (minWave never
    // rises mid-run), kept as the invariant's local witness.
    if (available.length === 0 || totalW <= 0) throw new Error(`wave ${w}: no enemy def is unlocked`);
    const queue: number[] = [];
    for (let n = 0; n < count; n++) {
      let roll = waves.int(0, totalW - 1);
      let pick = available[0].idx;
      for (const a of available) {
        if (roll < a.w) { pick = a.idx; break; }
        roll -= a.w;
      }
      queue.push(pick);
    }
    if (Sim.isBossWave(w, this.finalWave)) {
      let heavy = available[0].idx;
      for (const a of available) if (this.opts.enemyDefs[a.idx].hp > this.opts.enemyDefs[heavy].hp) heavy = a.idx;
      queue.push(heavy | BOSS_QUEUE_FLAG);
    }
    return queue;
  }

  /** The next wave starts NOW: by the clock or by the player's call. */
  private launchWave(): void {
    // An offer owed by the wave just ending is dealt at the latest here, so
    // a straggler can never withhold it (D4 cadence, item 10's clock).
    this.maybeOffer(true);
    this.wave++;
    // Second Wind (relic): the Core mends a little with every front opened.
    if (this.fold.coreHealPerWave > 0) this.coreHp = Math.min(this.coreHpMax, this.coreHp + this.fold.coreHealPerWave);
    this.emit({ kind: 'waveStart', wave: this.wave });
    this.waveEntries = this.nextWaveEntries.length ? this.nextWaveEntries : this.pickWaveEntries(this.wave);
    this.nextWaveEntries = this.pickWaveEntries(this.wave + 1);
    this.spawnQueue = this.nextQueue;
    this.nextQueue = this.lastWaveLaunched() ? [] : this.composeWave(this.wave + 1);
    this.waveTimer = this.lastWaveLaunched() ? 0 : this.interWaveTicks;
    this.intraTimer = 0;
  }

  private wavePhase(): void {
    // Surviving the final wave IS the win (D6: a run ends).
    if (this.lastWaveLaunched() && this.spawnQueue.length === 0 && this.aliveCount() === 0) {
      this.status = 'won';
      return;
    }
    // A cleared offer wave deals its offer as soon as the board is quiet.
    if (this.spawnQueue.length === 0 && this.aliveCount() === 0) this.maybeOffer(false);
    // The clock runs from the previous launch, whoever is still walking.
    if (this.waveTimer > 0 && --this.waveTimer === 0) this.launchWave();
    if (this.spawnQueue.length > 0 && --this.intraTimer <= 0) {
      this.intraTimer = 6;
      const q = this.spawnQueue.shift()!;
      const defIdx = q & ~BOSS_QUEUE_FLAG;
      const entry = this.waveEntries[(this.spawned + this.wave) % this.waveEntries.length];
      const boss = (q & BOSS_QUEUE_FLAG) !== 0;
      // Swarm (traits.ts): one queue entry, a pack of bodies from one entry.
      const pack = hasTrait(this.opts.enemyDefs[defIdx], 'swarm') ? TRAIT_RULES.swarm.packSize : 1;
      for (let n = 0; n < pack; n++) this.spawn(entry, defIdx, boss);
    }
  }

  private spawn(entry: CellRef, defIdx: number, boss = false): void {
    const i = this.freeEnemies.pop() ?? (this.enemyHigh < ENEMY_CAP ? this.enemyHigh++ : -1);
    if (i === -1) return;
    const def = this.opts.enemyDefs[defIdx];
    this.alive[i] = 1;
    this.gen[i]++;
    this.spawned++;
    this.enemyDefIdx[i] = defIdx;
    // Waves scale hp by the difficulty data. Trickle mode stays flat for tests.
    const hpScale = this.mode === 'waves' ? waveHpScale(this.difficulty, Math.max(1, this.wave)) * this.lengthMul : 1;
    this.hp[i] = def.hp * hpScale * (boss ? BOSS_HP_MUL : 1);
    this.bossFlag[i] = boss ? 1 : 0;
    this.lastHit[i] = this.tickCount;
    this.spawnHp[i] = this.hp[i];
    this.shield[i] = def.shield ?? 0;
    this.slowTicks[i] = 0;
    this.slowMul[i] = 1;
    this.posX[i] = entry.x + 0.5;
    this.posY[i] = entry.y + 0.5;
    this.tgtX[i] = entry.x + 0.5;
    this.tgtY[i] = entry.y + 0.5;
    // Facing inward from the board edge - so if the entry cell itself is a
    // bridge, the walker already knows which strand it arrived on.
    this.walkDir[i] = entry.y === 0 ? 2 : entry.x === 0 ? 1 : entry.x === this.opts.cellsW - 1 ? 3 : 0;
  }

  // ---- combat --------------------------------------------------------------

  private towerPhase(): void {
    for (let ti = 0; ti < this.towers.length; ti++) {
      const tower = this.towers[ti];
      if (!tower) continue;
      const def = this.opts.towerDefs[tower.defIdx];
      if (def.attack === 'none') continue; // producers fight in productionPhase
      if (--tower.cooldown > 0) continue;
      const eff = this.stats(tower);
      if (def.attack === 'pulse') {
        // No projectile: the tower IS the payload. Fires only when someone
        // is inside the field; hits everyone inside it at once.
        const any = this.acquire(tower.cellX + 0.5, tower.cellY + 0.5, eff.range, 'closest');
        if (any === -1) continue;
        tower.cooldown = eff.fireEveryTicks;
        this.emitPulse(ti, tower, eff);
        continue;
      }
      const target = this.acquire(tower.cellX + 0.5, tower.cellY + 0.5, eff.range, tower.priority, eff.minRange);
      if (target === -1) continue;
      tower.cooldown = eff.fireEveryTicks;
      this.fire(ti, tower, eff, target);
    }
  }

  private acquire(cx: number, cy: number, range: number, priority: Priority, minRange = 0): number {
    const { dist, width } = this.flow;
    const rangeSq = range * range;
    // The dead zone (design round 1, item 2): a Mortar cannot lob at its
    // own feet. Pulses pass 0 - a field with a hole makes no sense.
    const minSq = minRange * minRange;
    const candidates: TargetCandidate[] = [];
    for (let i = 0; i < this.enemyHigh; i++) {
      if (!this.alive[i]) continue;
      const dx = this.posX[i] - cx;
      const dy = this.posY[i] - cy;
      const dSq = dx * dx + dy * dy;
      if (dSq > rangeSq || dSq < minSq) continue;
      candidates.push({
        slot: i,
        flowDist: dist[Math.floor(this.posY[i]) * width + Math.floor(this.posX[i])],
        distSq: dSq,
        hp: this.hp[i],
      });
    }
    return pickTarget(candidates, priority);
  }

  private fire(towerIdx: number, tower: Tower, eff: EffectiveStats, target: number): void {
    const spec = this.opts.towerDefs[tower.defIdx].projectile;
    if (!spec) return; // producers never reach here (attack 'none' skips)
    const p = this.freeProj.pop() ?? (this.projHigh < PROJ_CAP ? this.projHigh++ : -1);
    if (p === -1) return;
    const sx = tower.cellX + 0.5;
    const sy = tower.cellY + 0.5;
    this.projAlive[p] = 1;
    this.projX[p] = sx;
    this.projY[p] = sy;
    this.projTarget[p] = target;
    this.projTargetGen[p] = this.gen[target];
    this.projTowerIdx[p] = towerIdx;
    this.projDamage[p] = eff.damage;
    this.projSpeed[p] = spec.speed;
    this.projHoming[p] = spec.homing ? 1 : 0;
    this.projRadius[p] = spec.explosive ? eff.explodeRadius : 0;
    this.projSlowMul[p] = spec.applyEffect === 'slow' ? (spec.slowMul ?? 0.6) : 0;
    this.projSlowTicks[p] = spec.applyEffect === 'slow' ? eff.slowTicks : 0;
    this.projAimX[p] = this.posX[target];
    this.projAimY[p] = this.posY[target];
    const dx = this.posX[target] - sx;
    const dy = this.posY[target] - sy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    this.projVX[p] = (dx / d) * spec.speed;
    this.projVY[p] = (dy / d) * spec.speed;
    this.projTtl[p] = Math.ceil((eff.range * 2) / spec.speed);
  }

  /**
   * A fired shot ALWAYS resolves (WBS 2.19, Daniil): ballistic shells fly to
   * their committed aim point and detonate there whether or not anyone is
   * still standing on it - missing is a real outcome. Homing shots whose
   * target dies re-acquire the nearest living enemy; with nobody left they
   * fall ballistic to their last aim. Nothing ever silently evaporates.
   */
  private projectilePhase(): void {
    for (let p = 0; p < this.projHigh; p++) {
      if (!this.projAlive[p]) continue;
      if (--this.projTtl[p] <= 0) {
        // Backstop, not a rule: arrival logic below resolves shots exactly;
        // if the TTL somehow wins, the shot still detonates where it is.
        this.detonate(p, this.projX[p], this.projY[p]);
        continue;
      }
      if (this.projHoming[p]) {
        let t = this.projTarget[p];
        if (!this.alive[t] || this.gen[t] !== this.projTargetGen[p]) {
          t = this.nearestAlive(this.projX[p], this.projY[p]);
          if (t === -1) {
            this.projHoming[p] = 0; // nobody left to chase: fall ballistic
          } else {
            this.projTarget[p] = t;
            this.projTargetGen[p] = this.gen[t];
          }
        }
        if (this.projHoming[p]) {
          this.projAimX[p] = this.posX[t];
          this.projAimY[p] = this.posY[t];
        }
      }
      const dx = this.projAimX[p] - this.projX[p];
      const dy = this.projAimY[p] - this.projY[p];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= this.projSpeed[p]) {
        this.detonate(p, this.projAimX[p], this.projAimY[p]);
        continue;
      }
      this.projVX[p] = (dx / d) * this.projSpeed[p];
      this.projVY[p] = (dy / d) * this.projSpeed[p];
      this.projX[p] += this.projVX[p];
      this.projY[p] += this.projVY[p];
    }
  }

  /**
   * ONE detonation rule for every projectile (WBS 2.19): the shot resolves
   * at a POINT, and everything within its radius is struck - the radius that
   * deals the damage is the radius the effects layer draws and the inspector
   * prints. Radius-0 shots strike within HIT_RADIUS, so a homing bolt
   * arriving at its target still connects.
   */
  private detonate(p: number, ix: number, iy: number): void {
    const radius = Math.max(this.projRadius[p], HIT_RADIUS);
    this.emit({ kind: 'impact', x: ix, y: iy, r: this.projRadius[p] });
    // Splinter (relic): the explosion resolves twice.
    const blasts = this.projRadius[p] > 0 && this.fold.explodeTwice ? 2 : 1;
    for (let rep = 0; rep < blasts; rep++) {
      for (let i = 0; i < this.enemyHigh; i++) {
        if (!this.alive[i]) continue;
        const dx = this.posX[i] - ix;
        const dy = this.posY[i] - iy;
        if (Math.sqrt(dx * dx + dy * dy) <= radius) this.damageEnemy(i, p);
      }
    }
    this.despawnProj(p);
  }

  /** Armor blunts, shields burn first, slows apply, deaths pay bounties. */
  private damageEnemy(enemy: number, p: number): void {
    this.applyDamage(enemy, this.projDamage[p], this.projSlowMul[p], this.projSlowTicks[p], this.projTowerIdx[p]);
  }

  private applyDamage(enemy: number, raw: number, slowMulN: number, slowTicksN: number, towerIdx: number): void {
    if (!this.alive[enemy]) return;
    const def = this.opts.enemyDefs[this.enemyDefIdx[enemy]];
    // Zero-damage attacks are pure control (Frost's base): effects land,
    // health does not move, armor's min-1 rule only applies to real hits.
    let dmg = raw <= 0 ? 0 : Math.max(1, raw - (def.armor ?? 0));
    // Frostbite (relic): slowed enemies take extra from EVERYTHING - the
    // relic that turns Frost from utility into a damage amplifier.
    if (dmg > 0 && this.slowTicks[enemy] > 0) dmg *= this.fold.slowedDamageMul;
    if (this.shield[enemy] > 0) {
      const absorbed = Math.min(this.shield[enemy], dmg);
      this.shield[enemy] -= absorbed;
      dmg -= absorbed;
    }
    this.hp[enemy] -= dmg;
    if (dmg > 0) this.lastHit[enemy] = this.tickCount;
    // Traits (traits.ts): armoured shrugs slows off entirely, fast shakes
    // them off in half the time.
    if (slowTicksN > 0 && !hasTrait(def, 'armoured')) {
      const ticks = hasTrait(def, 'fast') ? Math.ceil(slowTicksN * TRAIT_RULES.fast.slowDurationMul) : slowTicksN;
      this.slowTicks[enemy] = Math.max(this.slowTicks[enemy], ticks);
      this.slowMul[enemy] = slowMulN;
    }
    if (this.hp[enemy] <= 0) {
      const overkill = -this.hp[enemy];
      this.alive[enemy] = 0;
      this.freeEnemies.push(enemy);
      this.emit({ kind: 'death', x: this.posX[enemy], y: this.posY[enemy] });
      this.kills++;
      // Bounty Board (relic) multiplies boss bounty only; rounded so Scrap
      // stays integral (the state hash truncates its lanes to integers).
      this.scrap += Math.round((def.bounty ?? 0) * (this.bossFlag[enemy] ? BOSS_BOUNTY_MUL * this.fold.bossBountyMul : 1)) + this.fold.killRefundScrap; // Tithe
      const tower = this.towers[towerIdx];
      if (tower) tower.kills++;
      // A boss drops a cache where it falls (design round 1, Daniil: "where
      // it dies") - on the road, usually; opened like any other.
      if (this.bossFlag[enemy]) {
        this.caches.push({ x: Math.floor(this.posX[enemy]), y: Math.floor(this.posY[enemy]), table: 'boss_drop', opened: false });
      }
      // Overflow (relic): excess damage chains to the nearest enemy, and a
      // chain kill's excess chains again - kills feed kills. Terminates
      // because every recursion step required a kill.
      if (this.fold.overkillCarry && overkill >= 1) {
        const next = this.nearestAlive(this.posX[enemy], this.posY[enemy]);
        if (next !== -1) this.applyDamage(next, overkill, 0, 0, towerIdx);
      }
    }
  }

  /** Any tower in the eight cells around (x, y)? */
  private towerTouches(x: number, y: number): boolean {
    const W = this.opts.cellsW;
    const H = this.opts.cellsH;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (this.occupancy[ny * W + nx] !== 0) return true;
      }
    return false;
  }

  /** Nearest living enemy to a point; scan order breaks ties (determinism). */
  private nearestAlive(x: number, y: number): number {
    let best = -1;
    let bestSq = Infinity;
    for (let i = 0; i < this.enemyHigh; i++) {
      if (!this.alive[i]) continue;
      const dx = this.posX[i] - x;
      const dy = this.posY[i] - y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestSq) {
        bestSq = dSq;
        best = i;
      }
    }
    return best;
  }

  private emitPulse(towerIdx: number, tower: Tower, eff: EffectiveStats): void {
    const spec = this.opts.towerDefs[tower.defIdx].projectile;
    if (!spec) return; // producers never reach here (attack 'none' skips)
    const cx = tower.cellX + 0.5;
    const cy = tower.cellY + 0.5;
    const r2 = eff.range * eff.range;
    for (let i = 0; i < this.enemyHigh; i++) {
      if (!this.alive[i]) continue;
      const dx = this.posX[i] - cx;
      const dy = this.posY[i] - cy;
      if (dx * dx + dy * dy > r2) continue;
      this.applyDamage(
        i,
        eff.damage,
        spec.applyEffect === 'slow' ? (spec.slowMul ?? 0.6) : 0,
        spec.applyEffect === 'slow' ? eff.slowTicks : 0,
        towerIdx,
      );
    }
    this.emit({ kind: 'pulse', x: cx, y: cy, r: eff.range });
  }

  private despawnProj(p: number): void {
    this.projAlive[p] = 0;
    this.freeProj.push(p);
  }

  // ---- movement ------------------------------------------------------------

  private walkPhase(): void {
    // Stasis (relic active): the board freezes - nothing moves, slow timers
    // hold, towers keep firing. The get-out-of-jail card.
    if (this.tickCount < this.freezeUntil) return;
    const { nodeDist, width } = this.flow;
    for (let i = 0; i < this.enemyHigh; i++) {
      if (!this.alive[i]) continue;
      const edef = this.opts.enemyDefs[this.enemyDefIdx[i]];
      let speed = edef.speed;
      // Shielded (traits.ts): the shield regrows after a pause unhit, so
      // focus fire breaks it and chip damage never does.
      const shieldMax = edef.shield ?? 0;
      if (shieldMax > 0 && hasTrait(edef, 'shielded') && this.shield[i] < shieldMax && this.tickCount - this.lastHit[i] > SHIELD_REGEN_DELAY) {
        this.shield[i] = Math.min(shieldMax, this.shield[i] + shieldMax / SHIELD_REGEN_TICKS);
      }
      if (this.slowTicks[i] > 0) {
        this.slowTicks[i]--;
        speed *= this.slowMul[i];
      }
      const dx = this.tgtX[i] - this.posX[i];
      const dy = this.tgtY[i] - this.posY[i];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= speed) {
        this.posX[i] = this.tgtX[i];
        this.posY[i] = this.tgtY[i];
        const cx = Math.floor(this.posX[i]);
        const cy = Math.floor(this.posY[i]);
        // Strand identity (4.9): on a bridge, direction of travel names the
        // strand - N/S rides the underpass, E/W the deck.
        const cell = this.cellAt(cx, cy)!;
        const s = cell === 'B' && (this.walkDir[i] === 0 || this.walkDir[i] === 2) ? 1 : 0;
        const here = nodeDist[(cy * width + cx) * 2 + s];
        if (here === 0) {
          // Breach: the Core takes this enemy's damage, and can fall.
          this.alive[i] = 0;
          this.freeEnemies.push(i);
          this.breaches++;
          const dealt = this.opts.enemyDefs[this.enemyDefIdx[i]].damage * (this.bossFlag[i] ? BOSS_DAMAGE_MUL : 1);
          this.emit({ kind: 'breach', x: this.posX[i], y: this.posY[i], dmg: dealt });
          this.coreDamage += dealt;
          this.coreHp -= dealt;
          if (this.coreHp <= 0) {
            this.coreHp = 0;
            this.status = 'lost';
          }
          continue;
        }
        // Toll (relic): stepping into a cell that touches a tower costs the
        // enemy Scrap - roads lined with towers become toll roads.
        if (this.fold.tollScrap > 0 && this.towerTouches(cx, cy)) this.scrap += this.fold.tollScrap;
        let found = false;
        const mask = this.flow.allowed[cy * width + cx];
        for (let d = 0; d < 4; d++) {
          // The allowed mask is the route GRAPH (session 14): a numerically
          // downhill neighbour on a different lane is not a legal step -
          // enemies never change lanes. On a bridge the walker also keeps
          // to its own strand's ports: it crosses straight, never turns.
          if ((mask & (1 << d)) === 0) continue;
          if (cell === 'B' && (strandPorts(cell)[s] & (1 << d)) === 0) continue;
          const qx = cx + [0, 1, 0, -1][d];
          const qy = cy + [-1, 0, 1, 0][d];
          const qs = strandEntered(this.cellAt(qx, qy)!, 1 << d);
          if (nodeDist[(qy * width + qx) * 2 + qs] === here - 1) {
            this.tgtX[i] = qx + 0.5;
            this.tgtY[i] = qy + 0.5;
            this.walkDir[i] = d;
            found = true;
            break;
          }
        }
        if (!found) throw new Error(`no downhill neighbour at ${cx},${cy} (dist ${here})`);
      } else {
        this.posX[i] += (dx / d) * speed;
        this.posY[i] += (dy / d) * speed;
      }
    }
  }
}
