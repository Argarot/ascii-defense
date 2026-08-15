/**
 * The simulation: a fixed 20 Hz tick moving walkers from the entries down the
 * flow field to the Core, with towers firing projectiles at them (Phase 4
 * session A: no economy yet - building is free, dying is final).
 *
 * Invariant 6: nothing here knows about frames or wall-clock time. The app
 * calls tick() as many times as its speed setting dictates; a tick is a tick.
 *
 * Determinism notes, learned and enforced:
 *  - sqrt(dx*dx+dy*dy), never Math.hypot - hypot's precision is
 *    implementation-defined and would eventually split replay hashes across
 *    engines. sqrt is IEEE-exact.
 *  - every tie is broken by fixed scan order, spending no randomness.
 *  - enemy slots recycle, so projectiles remember (slot, generation) and
 *    despawn if their target's slot was reused.
 *
 * Storage is SoA typed arrays for the numerous kinds (enemies, projectiles)
 * and plain objects for towers (dozens, rich state) - ARCHITECTURE sec 7.
 */
import { createRng, type Rng } from '../rng/rng';
import { isBuildable, type CellType } from '../grid/cells';
import type { GeneratedMap } from '../mapgen/mapgen';
import { computeFlowField, type FlowField } from './flow';
import type { EnemyDef, TowerDef } from './defs';

export const TICK_HZ = 20;

export interface SimOptions {
  /** Resolved cell grid (from resolveCells) and its dimensions. */
  cells: readonly (CellType | null)[];
  cellsW: number;
  cellsH: number;
  map: GeneratedMap;
  enemyDefs: readonly EnemyDef[];
  towerDefs: readonly TowerDef[];
  /** Ticks between spawns. 20 = one enemy per second. */
  spawnEveryTicks?: number;
  /** Stop spawning after this many; 0 = endless. */
  maxSpawns?: number;
}

export interface Tower {
  cellX: number;
  cellY: number;
  defIdx: number;
  cooldown: number;
  kills: number;
}

const ENEMY_CAP = 1024;
const PROJ_CAP = 2048;
/** A projectile within this distance of its target has hit (cells). */
const HIT_RADIUS = 0.35;

export class Sim {
  readonly flow: FlowField;

  // ---- enemies (SoA) ----
  readonly posX = new Float32Array(ENEMY_CAP);
  readonly posY = new Float32Array(ENEMY_CAP);
  readonly hp = new Float32Array(ENEMY_CAP);
  readonly enemyDefIdx = new Uint8Array(ENEMY_CAP);
  readonly alive = new Uint8Array(ENEMY_CAP);
  private readonly gen = new Uint16Array(ENEMY_CAP); // slot reuse counter
  private readonly tgtX = new Float32Array(ENEMY_CAP);
  private readonly tgtY = new Float32Array(ENEMY_CAP);
  private freeEnemies: number[] = [];
  private enemyHigh = 0;

  // ---- projectiles (SoA) ----
  readonly projX = new Float32Array(PROJ_CAP);
  readonly projY = new Float32Array(PROJ_CAP);
  private readonly projVX = new Float32Array(PROJ_CAP);
  private readonly projVY = new Float32Array(PROJ_CAP);
  readonly projAlive = new Uint8Array(PROJ_CAP);
  private readonly projTarget = new Int32Array(PROJ_CAP);
  private readonly projTargetGen = new Uint16Array(PROJ_CAP);
  private readonly projTowerIdx = new Int16Array(PROJ_CAP);
  private readonly projTtl = new Int16Array(PROJ_CAP);
  private freeProj: number[] = [];
  private projHigh = 0;

  // ---- towers ----
  /** Sparse: sold slots stay null so occupancy indices remain stable. */
  readonly towers: (Tower | null)[] = [];
  /** Cell -> tower index + 1; 0 = empty. One tower, one cell (invariant 7). */
  readonly occupancy: Uint16Array;

  tickCount = 0;
  breaches = 0;
  /** Total Core damage taken (sum of breached enemies' damage params). */
  coreDamage = 0;
  spawned = 0;
  kills = 0;

  private readonly rng: Rng;
  private readonly spawnEvery: number;
  private readonly maxSpawns: number;
  private spawnTimer = 0;

  constructor(
    seed: number,
    private readonly opts: SimOptions,
  ) {
    if (opts.enemyDefs.length === 0) throw new Error('sim needs at least one enemy def');
    this.rng = createRng(seed);
    this.spawnEvery = opts.spawnEveryTicks ?? TICK_HZ;
    this.maxSpawns = opts.maxSpawns ?? 0;
    this.occupancy = new Uint16Array(opts.cellsW * opts.cellsH);
    this.flow = computeFlowField(opts.cells, opts.cellsW, opts.cellsH, opts.map.entries);
  }

  // ---- building ------------------------------------------------------------

  canBuildAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.opts.cellsW || y >= this.opts.cellsH) return false;
    const t = this.opts.cells[y * this.opts.cellsW + x];
    return t !== null && isBuildable(t) && this.occupancy[y * this.opts.cellsW + x] === 0;
  }

  buildTower(x: number, y: number, defId: string): boolean {
    if (!this.canBuildAt(x, y)) return false;
    const defIdx = this.opts.towerDefs.findIndex((d) => d.id === defId);
    if (defIdx === -1) throw new Error(`unknown tower def '${defId}'`);
    this.towers.push({ cellX: x, cellY: y, defIdx, cooldown: 0, kills: 0 });
    this.occupancy[y * this.opts.cellsW + x] = this.towers.length; // idx + 1
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
    this.towers[idx - 1] = null; // slot stays; occupancy indices stay valid
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
    this.tickCount++;
    this.spawnPhase();
    this.towerPhase();
    this.projectilePhase();
    this.walkPhase();
  }

  private spawnPhase(): void {
    if (--this.spawnTimer > 0) return;
    if (this.maxSpawns !== 0 && this.spawned >= this.maxSpawns) return;
    this.spawnTimer = this.spawnEvery;
    const waves = this.rng.stream('waves');
    const entry = waves.pick(this.opts.map.entries);
    const defIdx = waves.int(0, this.opts.enemyDefs.length - 1);
    const i = this.freeEnemies.pop() ?? (this.enemyHigh < ENEMY_CAP ? this.enemyHigh++ : -1);
    if (i === -1) return; // capacity: drop the spawn, never crash
    this.alive[i] = 1;
    this.gen[i]++;
    this.spawned++;
    this.enemyDefIdx[i] = defIdx;
    this.hp[i] = this.opts.enemyDefs[defIdx].hp;
    this.posX[i] = entry.x + 0.5;
    this.posY[i] = entry.y + 0.5;
    this.tgtX[i] = entry.x + 0.5;
    this.tgtY[i] = entry.y + 0.5;
  }

  private towerPhase(): void {
    for (let ti = 0; ti < this.towers.length; ti++) {
      const tower = this.towers[ti];
      if (!tower) continue;
      if (--tower.cooldown > 0) continue;
      const def = this.opts.towerDefs[tower.defIdx];
      const target = this.acquire(tower.cellX + 0.5, tower.cellY + 0.5, def.range);
      if (target === -1) continue;
      tower.cooldown = def.fireEveryTicks;
      this.fire(ti, tower, target);
    }
  }

  /**
   * "First" targeting: the in-range enemy closest to the Core (lowest flow
   * distance at its current cell), ties to the lowest slot. Priority
   * strategies (last/closest/weakest) arrive with the HUD in session B.
   */
  private acquire(cx: number, cy: number, range: number): number {
    const { dist, width } = this.flow;
    let best = -1;
    let bestFlow = Infinity;
    for (let i = 0; i < this.enemyHigh; i++) {
      if (!this.alive[i]) continue;
      const dx = this.posX[i] - cx;
      const dy = this.posY[i] - cy;
      if (Math.sqrt(dx * dx + dy * dy) > range) continue;
      const f = dist[Math.floor(this.posY[i]) * width + Math.floor(this.posX[i])];
      if (f < bestFlow) {
        bestFlow = f;
        best = i;
      }
    }
    return best;
  }

  private fire(towerIdx: number, tower: Tower, target: number): void {
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
    // Straight-shot velocity toward where the target is NOW; homing shots
    // re-aim every tick anyway. TTL bounds any projectile's life to its
    // range plus slack, so nothing flies forever.
    const dx = this.posX[target] - sx;
    const dy = this.posY[target] - sy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    this.projVX[p] = (dx / d) * spec.speed;
    this.projVY[p] = (dy / d) * spec.speed;
    this.projTtl[p] = Math.ceil((this.opts.towerDefs[tower.defIdx].range * 2) / spec.speed);
  }

  private projectilePhase(): void {
    for (let p = 0; p < this.projHigh; p++) {
      if (!this.projAlive[p]) continue;
      if (--this.projTtl[p] <= 0) {
        this.despawnProj(p);
        continue;
      }
      const spec = this.projSpec(p);
      const t = this.projTarget[p];

      if (spec.homing !== false && spec.homing !== undefined) {
        // Target gone or slot recycled: the shot fizzles. Deterministic and
        // honest - homing without a target is a heat-seeker in a void.
        if (!this.alive[t] || this.gen[t] !== this.projTargetGen[p]) {
          this.despawnProj(p);
          continue;
        }
        const dx = this.posX[t] - this.projX[p];
        const dy = this.posY[t] - this.projY[p];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= HIT_RADIUS + spec.speed) {
          this.hit(p, t, spec.damage);
          continue;
        }
        this.projVX[p] = (dx / d) * spec.speed;
        this.projVY[p] = (dy / d) * spec.speed;
        this.projX[p] += this.projVX[p];
        this.projY[p] += this.projVY[p];
      } else {
        // Straight shot: fly, and hit the first live enemy within radius.
        this.projX[p] += this.projVX[p];
        this.projY[p] += this.projVY[p];
        for (let i = 0; i < this.enemyHigh; i++) {
          if (!this.alive[i]) continue;
          const dx = this.posX[i] - this.projX[p];
          const dy = this.posY[i] - this.projY[p];
          if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) {
            this.hit(p, i, spec.damage);
            break;
          }
        }
      }
    }
  }

  private projSpec(p: number) {
    const tower = this.towers[this.projTowerIdx[p]];
    // Tower may have been sold mid-flight; the shot keeps its def via index.
    return this.opts.towerDefs[tower ? tower.defIdx : 0].projectile;
  }

  private hit(p: number, enemy: number, damage: number): void {
    this.despawnProj(p);
    this.hp[enemy] -= damage;
    if (this.hp[enemy] <= 0) {
      this.alive[enemy] = 0;
      this.freeEnemies.push(enemy);
      this.kills++;
      const tower = this.towers[this.projTowerIdx[p]];
      if (tower) tower.kills++;
    }
  }

  private despawnProj(p: number): void {
    this.projAlive[p] = 0;
    this.freeProj.push(p);
  }

  private walkPhase(): void {
    const { dist, width, height } = this.flow;
    for (let i = 0; i < this.enemyHigh; i++) {
      if (!this.alive[i]) continue;
      const speed = this.opts.enemyDefs[this.enemyDefIdx[i]].speed;
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
          // Breach: the Core takes this enemy's damage. Health/game-over
          // arrive with session C; both numbers are counted from day one.
          this.alive[i] = 0;
          this.freeEnemies.push(i);
          this.breaches++;
          this.coreDamage += this.opts.enemyDefs[this.enemyDefIdx[i]].damage;
          continue;
        }
        // Fixed scan order keeps ties deterministic without randomness.
        let nx = cx;
        let ny = cy;
        let found = false;
        for (const [ddx, ddy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
          const qx = cx + ddx;
          const qy = cy + ddy;
          if (qx < 0 || qy < 0 || qx >= width || qy >= height) continue;
          if (dist[qy * width + qx] === here - 1) {
            nx = qx;
            ny = qy;
            found = true;
            break;
          }
        }
        if (!found) throw new Error(`no downhill neighbour at ${cx},${cy} (dist ${here})`);
        this.tgtX[i] = nx + 0.5;
        this.tgtY[i] = ny + 0.5;
      } else {
        this.posX[i] += (dx / d) * speed;
        this.posY[i] += (dy / d) * speed;
      }
    }
  }
}
