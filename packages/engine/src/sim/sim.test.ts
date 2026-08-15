import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { TILE_SIZE } from '../tiles/tile';
import { TileLibrary, resolveCells } from '../tiles/board';
import { generateMap } from '../mapgen/mapgen';
import { computeFlowField } from './flow';
import { Sim, TICK_HZ } from './sim';

const g = (...rows: string[]): string[] => rows;
const LIB = new TileLibrary([
  { id: 'core_end', cells: g('GGGGG', 'GCCCG', 'GCCCR', 'GCCCG', 'GGGGG') },
  { id: 'core_l', cells: g('GGGGG', 'GCCCG', 'GCCCR', 'GCCCG', 'GGRGG') },
  { id: 'core_i', cells: g('GGGGG', 'GCCCG', 'RCCCR', 'GCCCG', 'GGGGG') },
  { id: 'core_t', cells: g('GGRGG', 'GCCCG', 'RCCCR', 'GCCCG', 'GGGGG') },
  { id: 'core_x', cells: g('GGRGG', 'GCCCG', 'RCCCR', 'GCCCG', 'GGRGG') },
  { id: 'straight', cells: g('GGGGG', 'GGGGG', 'RRRRR', 'GGGGG', 'GGGGG') },
  { id: 'corner', cells: g('GGGGG', 'GGGGG', 'RRRGG', 'GGRGG', 'GGRGG') },
  { id: 'tee', cells: g('GGGGG', 'GGGGG', 'RRRRR', 'GGRGG', 'GGRGG') },
  { id: 'cross', cells: g('GGRGG', 'GGRGG', 'RRRRR', 'GGRGG', 'GGRGG') },
  { id: 'meadow', cells: g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG') },
]);

function makeWorld(seed: number, entries = 3) {
  const opts = { width: 10, height: 6, entries, targetPathLength: 8 };
  const map = generateMap(createRng(seed).stream('map'), LIB, opts);
  const cellsW = opts.width * TILE_SIZE;
  const cellsH = opts.height * TILE_SIZE;
  const cells = resolveCells(map.board, LIB);
  return { map, cells, cellsW, cellsH };
}

describe('flow field', () => {
  it('is zero at the Core, positive at entries, downhill everywhere on-route', () => {
    const { map, cells, cellsW, cellsH } = makeWorld(5);
    const flow = computeFlowField(cells, cellsW, cellsH, map.entries);

    expect(flow.dist[map.core.y * cellsW + map.core.x]).toBe(0);
    expect(flow.L).toBeGreaterThanOrEqual(TILE_SIZE); // paths wander >= 1 tile

    for (let i = 0; i < flow.dist.length; i++) {
      const d = flow.dist[i];
      if (d <= 0) continue; // core or off-route
      const x = i % cellsW;
      const y = (i / cellsW) | 0;
      const hasDownhill = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cellsW || ny >= cellsH) return false;
        return flow.dist[ny * cellsW + nx] === d - 1;
      });
      expect(hasDownhill, `route cell ${x},${y} (dist ${d}) has no downhill neighbour`).toBe(true);
    }
  });

  it('off-route cells are -1', () => {
    const { map, cells, cellsW, cellsH } = makeWorld(6);
    const flow = computeFlowField(cells, cellsW, cellsH, map.entries);
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === 'G' || cells[i] === 'K' || cells[i] === 'O') expect(flow.dist[i]).toBe(-1);
    }
  });
});

describe('sim walkers', () => {
  it('spawned enemies march the road and every one eventually breaches', () => {
    const { map, cells, cellsW, cellsH } = makeWorld(11);
    const sim = new Sim(11, { cells, cellsW, cellsH, map, maxSpawns: 10, spawnEveryTicks: 5, speed: 0.2 });

    // Long enough for the slowest walker: L cells at 0.2 cells/tick + spawn lead time.
    const budget = (sim.flow.L / 0.2 + 10 * 5 + 100) | 0;
    for (let t = 0; t < budget; t++) {
      sim.tick();
      // No walker ever leaves the route.
      for (let i = 0; i < 64; i++) {
        if (!sim.alive[i]) continue;
        const cell = cells[Math.floor(sim.posY[i]) * cellsW + Math.floor(sim.posX[i])];
        expect(cell === 'R' || cell === 'C', `walker ${i} on ${cell}`).toBe(true);
      }
    }
    expect(sim.spawned).toBe(10);
    expect(sim.breaches).toBe(10);
    expect(sim.aliveCount()).toBe(0);
  });

  it('is deterministic: same seed, same world, same story', () => {
    const run = () => {
      const { map, cells, cellsW, cellsH } = makeWorld(21);
      const sim = new Sim(21, { cells, cellsW, cellsH, map, maxSpawns: 20, spawnEveryTicks: 3 });
      for (let t = 0; t < 600; t++) sim.tick();
      return { breaches: sim.breaches, spawned: sim.spawned, x: [...sim.posX.slice(0, 32)], y: [...sim.posY.slice(0, 32)] };
    };
    expect(run()).toEqual(run());
  });

  it('a tick is a tick: 20 Hz is declared, wall time is nobody', () => {
    // The constant is exported so the APP owns frame pacing; the sim must not.
    expect(TICK_HZ).toBe(20);
  });

  it('slot recycling: capacity is never exceeded, spawns drop instead of crash', () => {
    const { map, cells, cellsW, cellsH } = makeWorld(31);
    const sim = new Sim(31, { cells, cellsW, cellsH, map, spawnEveryTicks: 1, speed: 0.01 });
    for (let t = 0; t < 2000; t++) sim.tick();
    expect(sim.aliveCount()).toBeLessThanOrEqual(1024);
  });
});
