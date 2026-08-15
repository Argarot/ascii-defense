import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { TILE_SIZE, validateTileCells } from '../tiles/tile';
import { TileLibrary, resolveCells, slotAt } from '../tiles/board';
import { generateMap } from './mapgen';

// The same tile shapes the shipped library provides, inline so engine tests
// stay hermetic (engine may not import content).
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
  { id: 'ore_pocket', cells: g('GGGGG', 'GOOGG', 'GOOOG', 'KGOGG', 'GGGGG') },
]);

// Edge-biased: tiny boards where the walker gets cornered, up to demo size.
const CASES = [
  { width: 3, height: 3, entries: 1, targetPathLength: 2 },
  { width: 3, height: 3, entries: 4, targetPathLength: 2 },
  { width: 5, height: 4, entries: 2, targetPathLength: 6 },
  { width: 8, height: 5, entries: 3, targetPathLength: 10 },
  { width: 14, height: 7, entries: 3, targetPathLength: 12 },
  { width: 14, height: 7, entries: 6, targetPathLength: 5 },
];

describe('map generation', () => {
  it('is deterministic per seed', () => {
    const gen = () => generateMap(createRng(99).stream('map'), LIB, CASES[4]);
    expect(gen()).toEqual(gen());
  });

  it('produces the requested entries, all road cells on the board edge', () => {
    for (const opts of CASES) {
      for (let seed = 1; seed <= 5; seed++) {
        const map = generateMap(createRng(seed).stream('map'), LIB, opts);
        const cells = resolveCells(map.board, LIB);
        const W = opts.width * TILE_SIZE;
        const H = opts.height * TILE_SIZE;

        expect(map.entries.length, JSON.stringify(opts)).toBe(opts.entries);
        for (const e of map.entries) {
          const onBoundary = e.x === 0 || e.y === 0 || e.x === W - 1 || e.y === H - 1;
          expect(onBoundary, `entry ${e.x},${e.y} must sit on the board boundary`).toBe(true);
          expect(cells[e.y * W + e.x]).toBe('R');
        }
        // Entries are distinct cells.
        expect(new Set(map.entries.map((e) => `${e.x},${e.y}`)).size).toBe(opts.entries);
      }
    }
  });

  it('every entry reaches the Core on foot (BFS over route cells)', () => {
    for (const opts of CASES) {
      for (let seed = 1; seed <= 5; seed++) {
        const map = generateMap(createRng(seed * 7).stream('map'), LIB, opts);
        const cells = resolveCells(map.board, LIB);
        const W = opts.width * TILE_SIZE;
        const H = opts.height * TILE_SIZE;

        expect(cells[map.core.y * W + map.core.x]).toBe('C');

        const route = new Set<number>();
        for (let i = 0; i < cells.length; i++) if (cells[i] === 'R' || cells[i] === 'C') route.add(i);
        const start = map.core.y * W + map.core.x;
        const seen = new Set<number>([start]);
        const stack = [start];
        while (stack.length) {
          const i = stack.pop()!;
          const x = i % W;
          const y = (i / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) continue;
            const ni = (y + dy) * W + x + dx;
            if (route.has(ni) && !seen.has(ni)) {
              seen.add(ni);
              stack.push(ni);
            }
          }
        }
        for (const e of map.entries) {
          expect(seen.has(e.y * W + e.x), `entry ${e.x},${e.y} unreachable from Core`).toBe(true);
        }
      }
    }
  });

  it('fills every slot with a valid tile and agreeing interior seams', () => {
    const opts = CASES[4];
    const map = generateMap(createRng(31).stream('map'), LIB, opts);
    const cells = resolveCells(map.board, LIB);
    const W = opts.width * TILE_SIZE;

    expect(cells.every((c) => c !== null)).toBe(true);
    for (let ty = 0; ty < opts.height; ty++)
      for (let tx = 0; tx < opts.width; tx++) {
        const p = slotAt(map.board, tx, ty)!;
        expect(validateTileCells(LIB.resolved(p.tileId, p.rotation).cells)).toEqual([]);
        // Horizontal seam: both road (matched centers) or both non-road.
        if (tx + 1 < opts.width)
          for (let cy = 0; cy < TILE_SIZE; cy++) {
            const yy = ty * TILE_SIZE + cy;
            expect(cells[yy * W + tx * TILE_SIZE + TILE_SIZE - 1] === 'R').toBe(
              cells[yy * W + (tx + 1) * TILE_SIZE] === 'R',
            );
          }
        if (ty + 1 < opts.height)
          for (let cx = 0; cx < TILE_SIZE; cx++) {
            const xx = tx * TILE_SIZE + cx;
            expect(cells[(ty * TILE_SIZE + TILE_SIZE - 1) * W + xx] === 'R').toBe(
              cells[(ty + 1) * TILE_SIZE * W + xx] === 'R',
            );
          }
      }
  });

  it('ore appears, and the core sits in the middle third of the board', () => {
    let oreSeen = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const opts = { width: 14, height: 7, entries: 2, targetPathLength: 8 };
      const map = generateMap(createRng(seed).stream('map'), LIB, opts);
      const cells = resolveCells(map.board, LIB);
      if (cells.some((c) => c === 'O')) oreSeen++;
      const W = opts.width * TILE_SIZE;
      const H = opts.height * TILE_SIZE;
      expect(map.core.x).toBeGreaterThanOrEqual(W / 3 - TILE_SIZE);
      expect(map.core.x).toBeLessThanOrEqual((2 * W) / 3 + TILE_SIZE);
      expect(map.core.y).toBeGreaterThanOrEqual(H / 3 - TILE_SIZE);
      expect(map.core.y).toBeLessThanOrEqual((2 * H) / 3 + TILE_SIZE);
    }
    expect(oreSeen).toBeGreaterThan(5); // ore-far-from-road is the norm, not a fluke
  });

  it('rejects zero entries', () => {
    expect(() =>
      generateMap(createRng(1).stream('map'), LIB, { width: 5, height: 5, entries: 0, targetPathLength: 3 }),
    ).toThrow(/at least one entry/);
  });
});
