import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { TILE_SIZE, deriveConnectors, validateTileCells } from '../tiles/tile';
import { TileLibrary, resolveCells, slotAt, type Board } from '../tiles/board';
import { FILL_RADIUS, ORE_REACH, generateMap } from './mapgen';

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

// Edge-biased: tiny boards where the walker gets cornered, up to demo scale
// with long winding paths.
const CASES = [
  { width: 3, height: 3, entries: 1, targetPathLength: 1 },
  { width: 3, height: 3, entries: 4, targetPathLength: 1 },
  { width: 5, height: 4, entries: 2, targetPathLength: 6 },
  { width: 8, height: 5, entries: 3, targetPathLength: 8 },
  { width: 14, height: 7, entries: 3, targetPathLength: 20 },
  { width: 14, height: 7, entries: 6, targetPathLength: 6 },
];

/** Slot-level road graph: which slots carry road, and which seams join them. */
function roadGraph(board: Board, lib: TileLibrary, width: number, height: number) {
  const nodes = new Set<number>();
  const edges: [number, number][] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = slotAt(board, x, y);
      if (!p) continue;
      const r = lib.resolved(p.tileId, p.rotation);
      const conn = deriveConnectors(r.cells);
      const isRoad = conn.n || conn.e || conn.s || conn.w || r.cells.some((row) => row.includes('C'));
      if (!isRoad) continue;
      nodes.add(y * width + x);
      if (conn.e && x + 1 < width) {
        const nb = slotAt(board, x + 1, y);
        if (nb && deriveConnectors(lib.resolved(nb.tileId, nb.rotation).cells).w) {
          edges.push([y * width + x, y * width + x + 1]);
        }
      }
      if (conn.s && y + 1 < height) {
        const nb = slotAt(board, x, y + 1);
        if (nb && deriveConnectors(lib.resolved(nb.tileId, nb.rotation).cells).n) {
          edges.push([y * width + x, (y + 1) * width + x]);
        }
      }
    }
  return { nodes, edges };
}

describe('map generation v2 - trees, void, spread', () => {
  it('is deterministic per seed', () => {
    const gen = () => generateMap(createRng(99).stream('map'), LIB, CASES[4]);
    expect(gen()).toEqual(gen());
  });

  it('produces the requested distinct entries, road cells on the board edge', () => {
    for (const opts of CASES) {
      for (let seed = 1; seed <= 5; seed++) {
        const map = generateMap(createRng(seed).stream('map'), LIB, opts);
        const cells = resolveCells(map.board, LIB);
        const W = opts.width * TILE_SIZE;
        const H = opts.height * TILE_SIZE;

        expect(map.entries.length, JSON.stringify(opts)).toBe(opts.entries);
        for (const e of map.entries) {
          expect(e.x === 0 || e.y === 0 || e.x === W - 1 || e.y === H - 1).toBe(true);
          expect(cells[e.y * W + e.x]).toBe('R');
        }
        expect(new Set(map.entries.map((e) => `${e.x},${e.y}`)).size).toBe(opts.entries);
      }
    }
  });

  it('the road is a TREE: every entry has exactly one route, no loops anywhere', () => {
    for (const opts of CASES) {
      for (let seed = 1; seed <= 5; seed++) {
        const map = generateMap(createRng(seed * 13).stream('map'), LIB, opts);
        const { nodes, edges } = roadGraph(map.board, LIB, opts.width, opts.height);

        // A connected graph is a tree iff |E| = |V| - 1. Connectivity is
        // checked below; acyclicity is this line.
        expect(edges.length, `${JSON.stringify(opts)} seed ${seed * 13}`).toBe(nodes.size - 1);

        // Connected: BFS from any node reaches all.
        const adj = new Map<number, number[]>();
        for (const [a, b] of edges) {
          adj.set(a, [...(adj.get(a) ?? []), b]);
          adj.set(b, [...(adj.get(b) ?? []), a]);
        }
        const start = [...nodes][0];
        const seen = new Set([start]);
        const stack = [start];
        while (stack.length) {
          for (const nb of adj.get(stack.pop()!) ?? []) {
            if (!seen.has(nb)) {
              seen.add(nb);
              stack.push(nb);
            }
          }
        }
        expect(seen.size).toBe(nodes.size);
      }
    }
  });

  it('every entry reaches the Core on foot (cell-level BFS)', () => {
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
        for (const e of map.entries) expect(seen.has(e.y * W + e.x)).toBe(true);
      }
    }
  });

  it('terrain hugs the road: plain fill near, ore-only ring, void beyond', () => {
    for (const opts of [CASES[3], CASES[4], CASES[5]]) {
      for (let seed = 1; seed <= 4; seed++) {
        const map = generateMap(createRng(seed * 3).stream('map'), LIB, opts);
        const { width, height } = opts;

        // Slot distance from the road network.
        const isRoadSlot: boolean[] = [];
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const p = slotAt(map.board, x, y);
            if (!p) {
              isRoadSlot.push(false);
              continue;
            }
            const r = LIB.resolved(p.tileId, p.rotation);
            const c = deriveConnectors(r.cells);
            isRoadSlot.push(c.n || c.e || c.s || c.w || r.cells.some((row) => row.includes('C')));
          }
        const dist = new Array<number>(width * height).fill(-1);
        const queue: number[] = [];
        isRoadSlot.forEach((v, k) => {
          if (v) {
            dist[k] = 0;
            queue.push(k);
          }
        });
        for (let qi = 0; qi < queue.length; qi++) {
          const k = queue[qi];
          const x = k % width;
          const y = (k / width) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
            const nk = (y + dy) * width + x + dx;
            if (dist[nk] === -1) {
              dist[nk] = dist[k] + 1;
              queue.push(nk);
            }
          }
        }

        for (let k = 0; k < width * height; k++) {
          const p = map.board.slots[k];
          if (isRoadSlot[k]) continue;
          if (p) {
            expect(dist[k], `filled slot ${k} too far from road`).toBeLessThanOrEqual(ORE_REACH);
            if (dist[k] > FILL_RADIUS) {
              // The outer ring is resources-or-nothing.
              const cells = LIB.resolved(p.tileId, p.rotation).cells;
              expect(cells.some((row) => row.includes('O')), `outer-ring slot ${k} must carry ore`).toBe(true);
            }
          } else {
            expect(dist[k], `void slot ${k} should have been filled`).toBeGreaterThan(FILL_RADIUS);
          }
        }
      }
    }
  });

  it('sector spreading: with 4+ entries the road reaches all four board halves', () => {
    const opts = { width: 14, height: 7, entries: 4, targetPathLength: 10 };
    for (let seed = 1; seed <= 6; seed++) {
      const map = generateMap(createRng(seed).stream('map'), LIB, opts);
      const halves = { left: false, right: false, top: false, bottom: false };
      for (let y = 0; y < opts.height; y++)
        for (let x = 0; x < opts.width; x++) {
          const p = slotAt(map.board, x, y);
          if (!p) continue;
          const r = LIB.resolved(p.tileId, p.rotation);
          const c = deriveConnectors(r.cells);
          if (!(c.n || c.e || c.s || c.w)) continue;
          if (x < opts.width / 2) halves.left = true;
          else halves.right = true;
          if (y < opts.height / 2) halves.top = true;
          else halves.bottom = true;
        }
      expect(halves, `seed ${seed}`).toEqual({ left: true, right: true, top: true, bottom: true });
    }
  });

  it('fills only valid tiles with agreeing interior seams (spot check)', () => {
    const opts = CASES[4];
    const map = generateMap(createRng(31).stream('map'), LIB, opts);
    const cells = resolveCells(map.board, LIB);
    const W = opts.width * TILE_SIZE;
    for (let ty = 0; ty < opts.height; ty++)
      for (let tx = 0; tx < opts.width; tx++) {
        const p = slotAt(map.board, tx, ty);
        if (!p) continue;
        expect(validateTileCells(LIB.resolved(p.tileId, p.rotation).cells)).toEqual([]);
        const east = slotAt(map.board, tx + 1, ty);
        if (tx + 1 < opts.width && east)
          for (let cy = 0; cy < TILE_SIZE; cy++) {
            const yy = ty * TILE_SIZE + cy;
            expect(cells[yy * W + tx * TILE_SIZE + TILE_SIZE - 1] === 'R').toBe(
              cells[yy * W + (tx + 1) * TILE_SIZE] === 'R',
            );
          }
      }
  });

  it('rejects zero entries', () => {
    expect(() =>
      generateMap(createRng(1).stream('map'), LIB, { width: 5, height: 5, entries: 0, targetPathLength: 3 }),
    ).toThrow(/at least one entry/);
  });
});
