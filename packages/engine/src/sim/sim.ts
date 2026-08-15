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
import { pickTarget, type Priority, type TargetCandidate } from './targeting';
import { canChoose, effectiveStats, type EffectiveStats, type EnemyDef, type TowerDef } from './defs';

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
  coreHp?: number;
  /** Waves: pause between waves, in ticks. */
  interWaveTicks?: number;
}

export interface Tower {
  cellX: number;
  cellY: number;
  defIdx: number;
  cooldown: number;
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
  coreHp: number;
  readonly coreHpMax: number;
  /** 'running' until the Core falls. */
  status: 'running' | 'lost' = 'running';

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
    this.coreHpMax = opts.coreHp ?? 50;
    this.coreHp = this.coreHpMax;
    this.interWaveTicks = opts.interWaveTicks ?? 160;
    this.betweenTimer = Math.min(this.interWaveTicks, 60); // first wave comes fast
    this.occupancy = new Uint16Array(opts.cellsW * opts.cellsH);
    this.flow = computeFlowField(opts.cells, opts.cellsW, opts.cellsH, opts.map.entries);
    if (this.mode === 'waves') this.nextWaveEntries = this.pickWaveEntries(1);
  }

  // ---- building and upgrading ---------------------------------------------

  canBuildAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.opts.cellsW || y >= this.opts.cellsH) return false;
    const t = this.opts.cells[y * this.opts.cellsW + x];
    return t !== null && isBuildable(t) && this.occupancy[y * this.opts.cellsW + x] === 0;
  }

  canAfford(defId: string): boolean {
    const def = this.opts.towerDefs.find((d) => d.id === defId);
    return def !== undefined && this.scrap >= def.cost;
  }

  buildTower(x: number, y: number, defId: string): boolean {
    if (this.status !== 'running') return false;
    if (!this.canBuildAt(x, y)) return false;
    const defIdx = this.opts.towerDefs.findIndex((d) => d.id === defId);
    if (defIdx === -1) throw new Error(`unknown tower def '${defId}'`);
    const def = this.opts.towerDefs[defIdx];
    if (this.scrap < def.cost) return false;
    this.scrap -= def.cost;
    this.towers.push({ cellX: x, cellY: y, defIdx, cooldown: 0, kills: 0, priority: 'first', choices: [-1, -1, -1] });
    this.occupancy[y * this.opts.cellsW + x] = this.towers.length;
    return true;
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
    return true;
  }

  stats(t: Tower): EffectiveStats {
    return effectiveStats(this.opts.towerDefs[t.defIdx], t.choices);
  }

  setPriority(x: number, y: number, priority: Priority): boolean {
    const t = this.towerAt(x, y);
    if (!t) return false;
    t.priority = priority;
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
    return true;
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
    if (this.mode === 'waves') this.wavePhase();
    else this.tricklePhase();
    this.towerPhase();
    this.projectilePhase();
    this.walkPhase();
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
      // Between waves.
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
      if (--tower.cooldown > 0) continue;
      const eff = this.stats(tower);
      const def = this.opts.towerDefs[tower.defIdx];
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
      for (let i = 0; i < this.enemyHigh; i++) {
        if (!this.alive[i] || i === enemy) continue;
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
      this.alive[enemy] = 0;
      this.freeEnemies.push(enemy);
      this.kills++;
      this.scrap += def.bounty ?? 0;
      const tower = this.towers[towerIdx];
      if (tower) tower.kills++;
    }
  }

  private emitPulse(towerIdx: number, tower: Tower, eff: EffectiveStats): void {
    const spec = this.opts.towerDefs[tower.defIdx].projectile;
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
