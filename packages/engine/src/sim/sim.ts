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
import { isBuildable, type CellType } from '../grid/cells';
import type { GeneratedMap, CellRef } from '../mapgen/mapgen';
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
  interWaveTicks?: number;
  /** The unlocked relic pool (PRD sec 7). Absent = no relic layer (tests). */
  relicDefs?: readonly RelicDef[];
}

/** D4 (closed 2026-08-16): a pick-1-of-3 offer every this many waves. */
export const OFFER_EVERY_WAVES = 3;
/** Ore price of a blind draw from the pool at the Core (PRD sec 7.3 C). */
export const RELIC_DRAW_COST = 15;
/** Ore price of rerolling a standing offer. */
export const OFFER_REROLL_COST = 8;
/** Scrap price of claiming a cache (channel A - PRD sec 4.6, 7.3). */
export const CACHE_CLAIM_COST = 40;
/** Scrap price of prospecting a rock cell (PRD sec 4.6). */
export const PROSPECT_COST = 25;

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
  private readonly slowTicks = new Int16Array(ENEMY_CAP);
  private readonly slowMul = new Float32Array(ENEMY_CAP);
  private readonly gen = new Uint16Array(ENEMY_CAP);
  private readonly tgtX = new Float32Array(ENEMY_CAP);
  private readonly tgtY = new Float32Array(ENEMY_CAP);
  private freeEnemies: number[] = [];
  private enemyHigh = 0;

  // ---- projectiles (SoA), stats snapshotted at fire time ----
  readonly projX = new Float32Array(PROJ_CAP);
  readonly projY = new Float32Array(PROJ_CAP);
  private readonly projVX = new Float32Array(PROJ_CAP);
  private readonly projVY = new Float32Array(PROJ_CAP);
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
  /** Recent pulse emissions for the view's expanding rings. */
  pulses: { x: number; y: number; r: number; tick: number }[] = [];
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
  readonly coreHpMax: number;
  /** 'running' until the Core falls. */
  status: 'running' | 'lost' = 'running';

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
  /** Indices into map.caches already claimed. */
  readonly claimedCaches: number[] = [];

  // ---- waves ----
  wave = 0;
  /** Entries the CURRENT wave uses; next wave's are telegraphed. */
  waveEntries: CellRef[] = [];
  nextWaveEntries: CellRef[] = [];
  private spawnQueue: number[] = []; // enemy defIdx, in spawn order
  private betweenTimer: number;
  private intraTimer = 0;

  private readonly rng: Rng;
  private readonly mode: 'trickle' | 'waves';
  private readonly spawnEvery: number;
  private readonly maxSpawns: number;
  private readonly interWaveTicks: number;
  private spawnTimer = 0;

  constructor(
    seed: number,
    private readonly opts: SimOptions,
  ) {
    if (opts.enemyDefs.length === 0) throw new Error('sim needs at least one enemy def');
    this.rng = createRng(seed);
    this.mode = opts.mode ?? 'trickle';
    this.spawnEvery = opts.spawnEveryTicks ?? TICK_HZ;
    this.maxSpawns = opts.maxSpawns ?? 0;
    this.scrap = opts.startingScrap ?? 100;
    this.ore[0] = opts.startingOre ?? 0;
    this.coreHpMax = opts.coreHp ?? 50;
    this.coreHp = this.coreHpMax;
    this.interWaveTicks = opts.interWaveTicks ?? 160;
    this.betweenTimer = Math.min(this.interWaveTicks, 60); // first wave comes fast
    this.occupancy = new Uint16Array(opts.cellsW * opts.cellsH);
    this.cellsMut = opts.cells.slice();
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
    if (this.mode === 'waves') this.nextWaveEntries = this.pickWaveEntries(1);
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
    if (cell === 'K') return this.fold.buildOnRock; // Vein Tap
    return false; // O is Refinery ground; R and C are never buildable
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
    const hi = this.heldRelics.findIndex((di) => defs[di].id === relicId && defs[di].kind === 'active');
    if (hi === -1 || this.relicCooldowns[hi] > 0) return false;
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
      this.pulses.push({ x: cx, y: cy, r, tick: this.tickCount });
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

  /** Unheld pool indices - what draws and offers may still deal. */
  private unheldPool(): number[] {
    const defs = this.opts.relicDefs ?? [];
    const held = new Set(this.heldRelics);
    const pool: number[] = [];
    for (let i = 0; i < defs.length; i++) if (!held.has(i)) pool.push(i);
    return pool;
  }

  /**
   * The Core's Ore sink (PRD sec 7.3 channel C): pay Ore, draw blind from
   * the pool. The draw spends 'relics'-stream randomness at ACTION time, so
   * it rides the input log like every other decision.
   */
  buyRelic(): boolean {
    if (this.status !== 'running' || !this.opts.relicDefs) return false;
    if (this.ore[0] < RELIC_DRAW_COST) return false;
    const pool = this.unheldPool();
    if (pool.length === 0) return false;
    this.ore[0] -= RELIC_DRAW_COST;
    this.heldRelics.push(this.rng.stream('relics').pick(pool));
    this.relicCooldowns.push(0);
    this.refold();
    this.inputs.push({ tick: this.tickCount, a: { t: 'buyRelic' } });
    return true;
  }

  /** Pay Ore, deal a fresh 3 from the pool in place of the standing offer. */
  rerollOffer(): boolean {
    if (this.status !== 'running' || this.offer === null) return false;
    if (this.ore[0] < OFFER_REROLL_COST) return false;
    const pool = this.unheldPool();
    if (pool.length === 0) return false;
    this.ore[0] -= OFFER_REROLL_COST;
    this.offer = this.rng.stream('relics').shuffle(pool).slice(0, 3);
    this.inputs.push({ tick: this.tickCount, a: { t: 'rerollOffer' } });
    return true;
  }

  /** The unclaimed cache at (x, y), or null. */
  cacheAt(x: number, y: number): { poolIdx: number; cost: number } | null {
    const idx = this.opts.map.caches.findIndex((c) => c.x === x && c.y === y);
    if (idx === -1 || this.claimedCaches.includes(idx)) return null;
    return { poolIdx: this.opts.map.caches[idx].poolIdx, cost: CACHE_CLAIM_COST };
  }

  /**
   * Claim a cache: select and PAY - never build-to-claim, a tower can be
   * sold back (Daniil, PRD sec 14). The relic inside was dealt at
   * generation; a duplicate of something already held simply stacks in the
   * fold (multipliers multiply).
   */
  claimCache(x: number, y: number): boolean {
    if (this.status !== 'running' || !this.opts.relicDefs) return false;
    const idx = this.opts.map.caches.findIndex((c) => c.x === x && c.y === y);
    if (idx === -1 || this.claimedCaches.includes(idx)) return false;
    if (this.scrap < CACHE_CLAIM_COST) return false;
    this.scrap -= CACHE_CLAIM_COST;
    this.claimedCaches.push(idx);
    this.heldRelics.push(this.opts.map.caches[idx].poolIdx % this.opts.relicDefs.length);
    this.relicCooldowns.push(0);
    this.refold();
    this.inputs.push({ tick: this.tickCount, a: { t: 'claimCache', x, y } });
    return true;
  }

  /** Prospecting is unlocked by a committed tower choice that grants it (Survey). */
  prospectUnlocked(): boolean {
    for (const t of this.towers) {
      if (!t) continue;
      const tiers = this.opts.towerDefs[t.defIdx].tiers;
      if (!tiers) continue;
      for (let ti = 0; ti < t.choices.length; ti++) {
        const pick = t.choices[ti];
        if (pick >= 0 && tiers[ti]?.choices[pick]?.unlocks === 'prospect') return true;
      }
    }
    return false;
  }

  /**
   * Break a rock open and REVEAL what generation dealt it (PRD sec 4.6):
   * an ore vein, a relic cache, or nothing but clear ground. Only ever adds
   * off-route buildable land - the flow field cannot change.
   */
  prospect(x: number, y: number): boolean {
    if (this.status !== 'running') return false;
    if (this.cellAt(x, y) !== 'K' || !this.prospectUnlocked()) return false;
    if (this.scrap < PROSPECT_COST) return false;
    this.scrap -= PROSPECT_COST;
    const found = this.opts.map.rockContents.find((r) => r.x === x && r.y === y);
    const yields = found?.yields ?? 'none';
    const t: CellType = yields === 'ore' ? 'O' : 'G';
    this.cellsMut[y * this.opts.cellsW + x] = t;
    this.cellChanges.push({ x, y, t });
    if (yields === 'cache' && this.opts.relicDefs) {
      this.heldRelics.push((found!.poolIdx ?? 0) % this.opts.relicDefs.length);
      this.relicCooldowns.push(0);
      this.refold();
    }
    this.inputs.push({ tick: this.tickCount, a: { t: 'prospect', x, y } });
    return true;
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
  private maybeOffer(): void {
    const defs = this.opts.relicDefs;
    if (!defs || this.offer !== null) return;
    if (this.wave === 0 || this.wave % OFFER_EVERY_WAVES !== 0 || this.offerWave === this.wave) return;
    this.offerWave = this.wave;
    const pool = this.unheldPool();
    if (pool.length === 0) return;
    this.offer = this.rng.stream('relics').shuffle(pool).slice(0, 3);
  }

  setPriority(x: number, y: number, priority: Priority): boolean {
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
      case 'claimCache': return this.claimCache(a.x, a.y);
      case 'prospect': return this.prospect(a.x, a.y);
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
    u32(this.offerWave);
    for (const r of this.heldRelics) u32(r);
    for (const c of this.relicCooldowns) u32(c);
    for (const o of this.offer ?? [-1]) u32(o + 1);
    for (const c of this.claimedCaches) u32(c);
    for (const ch of this.cellChanges) { u32(ch.x); u32(ch.y); u32(ch.t.charCodeAt(0)); }
    u32(this.betweenTimer); u32(this.intraTimer); u32(this.spawnTimer);
    for (const q of this.spawnQueue) u32(q);
    for (const e of this.waveEntries) { u32(e.x); u32(e.y); }
    for (const e of this.nextWaveEntries) { u32(e.x); u32(e.y); }

    const eh = this.enemyHigh;
    f32(this.posX, eh); f32(this.posY, eh); f32(this.hp, eh); f32(this.shield, eh);
    f32(this.slowMul, eh); f32(this.tgtX, eh); f32(this.tgtY, eh);
    i16(this.slowTicks, eh); i16(this.gen, eh);
    for (let i = 0; i < eh; i++) u32((this.alive[i] << 8) | this.enemyDefIdx[i]);
    for (const s of this.freeEnemies) u32(s);

    const ph = this.projHigh;
    f32(this.projX, ph); f32(this.projY, ph); f32(this.projVX, ph); f32(this.projVY, ph);
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

  /** Ticks until the next wave begins; 0 while a wave is in progress. */
  ticksToNextWave(): number {
    if (this.mode !== 'waves') return 0;
    if (this.spawnQueue.length > 0 || this.aliveCount() > 0) return 0;
    return Math.max(0, this.betweenTimer);
  }

  enemyDefOf(slot: number): EnemyDef {
    return this.opts.enemyDefs[this.enemyDefIdx[slot]];
  }

  aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.enemyHigh; i++) n += this.alive[i];
    return n;
  }

  // ---- the tick ------------------------------------------------------------

  tick(): void {
    if (this.status !== 'running') return; // a fallen Core stays fallen
    this.tickCount++;
    for (let i = 0; i < this.relicCooldowns.length; i++) {
      if (this.relicCooldowns[i] > 0) this.relicCooldowns[i]--;
    }
    if (this.mode === 'waves') this.wavePhase();
    else this.tricklePhase();
    this.towerPhase();
    this.productionPhase();
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
      if (oreShare > 0 && onVein) this.ore[0] += Math.round((yielded * oreShare) / total);
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

  private wavePhase(): void {
    if (this.spawnQueue.length === 0 && this.aliveCount() === 0) {
      // Between waves. Wave completion is when offers appear (D4).
      this.maybeOffer();
      if (--this.betweenTimer > 0) return;
      this.wave++;
      this.waveEntries = this.nextWaveEntries.length ? this.nextWaveEntries : this.pickWaveEntries(this.wave);
      this.nextWaveEntries = this.pickWaveEntries(this.wave + 1);
      this.betweenTimer = this.interWaveTicks;
      // Compose the wave: bigger and meaner as numbers grow.
      const waves = this.rng.stream('waves');
      const count = 6 + 4 * (this.wave - 1);
      const available: number[] = [];
      this.opts.enemyDefs.forEach((d, i) => {
        if ((d.minWave ?? 1) <= this.wave) available.push(i);
      });
      this.spawnQueue = [];
      for (let n = 0; n < count; n++) this.spawnQueue.push(available[waves.int(0, available.length - 1)]);
      this.intraTimer = 0;
      return;
    }
    if (this.spawnQueue.length > 0 && --this.intraTimer <= 0) {
      this.intraTimer = 6;
      const defIdx = this.spawnQueue.shift()!;
      const entry = this.waveEntries[(this.spawned + this.wave) % this.waveEntries.length];
      this.spawn(entry, defIdx);
    }
  }

  private spawn(entry: CellRef, defIdx: number): void {
    const i = this.freeEnemies.pop() ?? (this.enemyHigh < ENEMY_CAP ? this.enemyHigh++ : -1);
    if (i === -1) return;
    const def = this.opts.enemyDefs[defIdx];
    this.alive[i] = 1;
    this.gen[i]++;
    this.spawned++;
    this.enemyDefIdx[i] = defIdx;
    // Waves scale hp steeply: holding wave N with wave N-3's firepower must
    // fail (Daniil). Trickle mode stays flat for tests.
    const hpScale = this.mode === 'waves' ? 1 + 0.18 * Math.max(0, this.wave - 1) : 1;
    this.hp[i] = def.hp * hpScale;
    this.shield[i] = def.shield ?? 0;
    this.slowTicks[i] = 0;
    this.slowMul[i] = 1;
    this.posX[i] = entry.x + 0.5;
    this.posY[i] = entry.y + 0.5;
    this.tgtX[i] = entry.x + 0.5;
    this.tgtY[i] = entry.y + 0.5;
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
      const target = this.acquire(tower.cellX + 0.5, tower.cellY + 0.5, eff.range, tower.priority);
      if (target === -1) continue;
      tower.cooldown = eff.fireEveryTicks;
      this.fire(ti, tower, eff, target);
    }
  }

  private acquire(cx: number, cy: number, range: number, priority: Priority): number {
    const { dist, width } = this.flow;
    const rangeSq = range * range;
    const candidates: TargetCandidate[] = [];
    for (let i = 0; i < this.enemyHigh; i++) {
      if (!this.alive[i]) continue;
      const dx = this.posX[i] - cx;
      const dy = this.posY[i] - cy;
      const dSq = dx * dx + dy * dy;
      if (dSq > rangeSq) continue;
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
    const dx = this.posX[target] - sx;
    const dy = this.posY[target] - sy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    this.projVX[p] = (dx / d) * spec.speed;
    this.projVY[p] = (dy / d) * spec.speed;
    this.projTtl[p] = Math.ceil((eff.range * 2) / spec.speed);
  }

  private projectilePhase(): void {
    for (let p = 0; p < this.projHigh; p++) {
      if (!this.projAlive[p]) continue;
      if (--this.projTtl[p] <= 0) {
        this.despawnProj(p);
        continue;
      }
      const t = this.projTarget[p];
      if (this.projHoming[p]) {
        if (!this.alive[t] || this.gen[t] !== this.projTargetGen[p]) {
          this.despawnProj(p);
          continue;
        }
        const dx = this.posX[t] - this.projX[p];
        const dy = this.posY[t] - this.projY[p];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= HIT_RADIUS + this.projSpeed[p]) {
          this.impact(p, t);
          continue;
        }
        this.projVX[p] = (dx / d) * this.projSpeed[p];
        this.projVY[p] = (dy / d) * this.projSpeed[p];
        this.projX[p] += this.projVX[p];
        this.projY[p] += this.projVY[p];
      } else {
        this.projX[p] += this.projVX[p];
        this.projY[p] += this.projVY[p];
        for (let i = 0; i < this.enemyHigh; i++) {
          if (!this.alive[i]) continue;
          const dx = this.posX[i] - this.projX[p];
          const dy = this.posY[i] - this.projY[p];
          if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) {
            this.impact(p, i);
            break;
          }
        }
      }
    }
  }

  /** Resolve a projectile connecting: direct hit, then AoE if it carries any. */
  private impact(p: number, enemy: number): void {
    const radius = this.projRadius[p];
    const ix = this.posX[enemy];
    const iy = this.posY[enemy];
    this.damageEnemy(enemy, p);
    if (radius > 0) {
      // Splinter (relic): the explosion resolves twice.
      const blasts = this.fold.explodeTwice ? 2 : 1;
      for (let rep = 0; rep < blasts; rep++) {
        for (let i = 0; i < this.enemyHigh; i++) {
          if (!this.alive[i] || i === enemy) continue;
          const dx = this.posX[i] - ix;
          const dy = this.posY[i] - iy;
          if (Math.sqrt(dx * dx + dy * dy) <= radius) this.damageEnemy(i, p);
        }
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
    if (slowTicksN > 0) {
      this.slowTicks[enemy] = Math.max(this.slowTicks[enemy], slowTicksN);
      this.slowMul[enemy] = slowMulN;
    }
    if (this.hp[enemy] <= 0) {
      const overkill = -this.hp[enemy];
      this.alive[enemy] = 0;
      this.freeEnemies.push(enemy);
      this.kills++;
      this.scrap += (def.bounty ?? 0) + this.fold.killRefundScrap; // Tithe
      const tower = this.towers[towerIdx];
      if (tower) tower.kills++;
      // Overflow (relic): excess damage chains to the nearest enemy, and a
      // chain kill's excess chains again - kills feed kills. Terminates
      // because every recursion step required a kill.
      if (this.fold.overkillCarry && overkill >= 1) {
        const next = this.nearestAlive(this.posX[enemy], this.posY[enemy]);
        if (next !== -1) this.applyDamage(next, overkill, 0, 0, towerIdx);
      }
    }
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
    this.pulses.push({ x: cx, y: cy, r: eff.range, tick: this.tickCount });
    if (this.pulses.length > 24) this.pulses.shift();
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
    const { dist, width, height } = this.flow;
    for (let i = 0; i < this.enemyHigh; i++) {
      if (!this.alive[i]) continue;
      let speed = this.opts.enemyDefs[this.enemyDefIdx[i]].speed;
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
        const here = dist[cy * width + cx];
        if (here === 0) {
          // Breach: the Core takes this enemy's damage, and can fall.
          this.alive[i] = 0;
          this.freeEnemies.push(i);
          this.breaches++;
          const dealt = this.opts.enemyDefs[this.enemyDefIdx[i]].damage;
          this.coreDamage += dealt;
          this.coreHp -= dealt;
          if (this.coreHp <= 0) {
            this.coreHp = 0;
            this.status = 'lost';
          }
          continue;
        }
        let found = false;
        for (const [ddx, ddy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
          const qx = cx + ddx;
          const qy = cy + ddy;
          if (qx < 0 || qy < 0 || qx >= width || qy >= height) continue;
          if (dist[qy * width + qx] === here - 1) {
            this.tgtX[i] = qx + 0.5;
            this.tgtY[i] = qy + 0.5;
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
