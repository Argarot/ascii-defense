/**
 * The simulation skeleton: a fixed 20 Hz tick moving walkers from the entries
 * down the flow field to the Core. No combat, no health yet - this is the
 * chassis the game bolts onto (WBS 1.3.11).
 *
 * Invariant 6: nothing here knows about frames or wall-clock time. The app
 * calls tick() as many times as its speed setting dictates; a tick is a tick.
 *
 * Positions are SUBCELL: continuous cell units (1.0 = one cell), the
 * reservation ARCHITECTURE sec 4 insists ships now. Enemies are stored SoA
 * (typed arrays + freelist) per ARCHITECTURE sec 7 - hundreds alive, and the
 * layout is the part that cannot be retrofitted quietly.
 */
import { createRng, type Rng } from '../rng/rng';
import type { CellType } from '../grid/cells';
import type { GeneratedMap, CellRef } from '../mapgen/mapgen';
import { computeFlowField, type FlowField } from './flow';

export const TICK_HZ = 20;

export interface SimOptions {
  /** Resolved cell grid (from resolveCells) and its dimensions. */
  cells: readonly (CellType | null)[];
  cellsW: number;
  cellsH: number;
  map: GeneratedMap;
  /** Ticks between spawns. 20 = one enemy per second. */
  spawnEveryTicks?: number;
  /** Walking speed in cells per tick. 0.08 = 1.6 cells/second. */
  speed?: number;
  /** Stop spawning after this many; 0 = endless. */
  maxSpawns?: number;
}

const CAPACITY = 1024;

export class Sim {
  readonly flow: FlowField;

  // SoA enemy storage. alive is a u8 mask; freelist recycles slots.
  readonly posX = new Float32Array(CAPACITY);
  readonly posY = new Float32Array(CAPACITY);
  private readonly tgtX = new Float32Array(CAPACITY);
  private readonly tgtY = new Float32Array(CAPACITY);
  readonly alive = new Uint8Array(CAPACITY);
  private free: number[] = [];
  private high = 0;

  tickCount = 0;
  breaches = 0;
  spawned = 0;

  private readonly rng: Rng;
  private readonly spawnEvery: number;
  private readonly speed: number;
  private readonly maxSpawns: number;
  private spawnTimer = 0;

  constructor(
    seed: number,
    private readonly opts: SimOptions,
  ) {
    this.rng = createRng(seed);
    this.spawnEvery = opts.spawnEveryTicks ?? TICK_HZ;
    this.speed = opts.speed ?? 0.08;
    this.maxSpawns = opts.maxSpawns ?? 0;
    this.flow = computeFlowField(opts.cells, opts.cellsW, opts.cellsH, opts.map.entries);
  }

  aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.high; i++) n += this.alive[i];
    return n;
  }

  tick(): void {
    this.tickCount++;

    // -- spawn --------------------------------------------------------------
    if (--this.spawnTimer <= 0 && (this.maxSpawns === 0 || this.spawned < this.maxSpawns)) {
      this.spawnTimer = this.spawnEvery;
      const entry = this.rng.stream('waves').pick(this.opts.map.entries);
      this.spawn(entry);
    }

    // -- walk ---------------------------------------------------------------
    const { dist, width } = this.flow;
    for (let i = 0; i < this.high; i++) {
      if (!this.alive[i]) continue;
      const dx = this.tgtX[i] - this.posX[i];
      const dy = this.tgtY[i] - this.posY[i];
      const d = Math.hypot(dx, dy);
      if (d <= this.speed) {
        // Arrived at the target cell center: pick the next downhill cell.
        this.posX[i] = this.tgtX[i];
        this.posY[i] = this.tgtY[i];
        const cx = Math.floor(this.posX[i]);
        const cy = Math.floor(this.posY[i]);
        const here = dist[cy * width + cx];
        if (here === 0) {
          // The Core. Breach and despawn; damage arrives with Phase 4.
          this.alive[i] = 0;
          this.free.push(i);
          this.breaches++;
          continue;
        }
        const next = this.downhillFrom(cx, cy, here);
        this.tgtX[i] = next.x + 0.5;
        this.tgtY[i] = next.y + 0.5;
      } else {
        this.posX[i] += (dx / d) * this.speed;
        this.posY[i] += (dy / d) * this.speed;
      }
    }
  }

  private spawn(entry: CellRef): void {
    const i = this.free.pop() ?? (this.high < CAPACITY ? this.high++ : -1);
    if (i === -1) return; // capacity exhausted: drop the spawn, never crash
    this.alive[i] = 1;
    this.spawned++;
    this.posX[i] = entry.x + 0.5;
    this.posY[i] = entry.y + 0.5;
    // First target: the entry cell's own center (walkers spawn ON it), which
    // resolves immediately to the first downhill step next tick.
    this.tgtX[i] = entry.x + 0.5;
    this.tgtY[i] = entry.y + 0.5;
  }

  /**
   * The neighbouring route cell one step closer to the Core. Fixed scan
   * order (N,E,S,W) keeps ties deterministic without spending randomness.
   */
  private downhillFrom(cx: number, cy: number, here: number): CellRef {
    const { dist, width, height } = this.flow;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (dist[ny * width + nx] === here - 1) return { x: nx, y: ny };
    }
    // Unreachable by construction: every route cell has a downhill neighbour.
    throw new Error(`no downhill neighbour at ${cx},${cy} (dist ${here})`);
  }
}
