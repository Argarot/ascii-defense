import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { TILE_SIZE, deriveConnectors, validateTileCells } from '../tiles/tile';
import { TileLibrary, resolveCells, slotAt, type Board } from '../tiles/board';
import { FILL_RADIUS, ORE_FLOOR, ORE_REACH, generateMap } from './mapgen';
import { computeFlowField } from '../sim/flow';

// The same tile shapes the shipped library provides, inline so engine tests
// stay hermetic (engine may not import content).
const g = (...rows: string[]): string[] => rows;
const LIB = new TileLibrary([
  { id: 'core_end', cells: g('GGGGG', 'GCCCG', 'GCCCX', 'GCCCG', 'GGGGG') },
  { id: 'core_l', cells: g('GGGGG', 'GCCCG', 'GCCCX', 'GCCCG', 'GGXGG') },
  { id: 'core_i', cells: g('GGGGG', 'GCCCG', 'XCCCX', 'GCCCG', 'GGGGG') },
  { id: 'core_t', cells: g('GGXGG', 'GCCCG', 'XCCCX', 'GCCCG', 'GGGGG') },
  { id: 'core_x', cells: g('GGXGG', 'GCCCG', 'XCCCX', 'GCCCG', 'GGXGG') },
  { id: 'straight', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGGGG', 'GGGGG') },
  { id: 'corner', cells: g('GGGGG', 'GGGGG', 'XXXGG', 'GGXGG', 'GGXGG') },
  { id: 'tee', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'cross', cells: g('GGXGG', 'GGXGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'meadow', cells: g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG') },
  { id: 'ore_pocket', cells: g('GGGGG', 'GOOGG', 'GOOOG', 'RGOGG', 'GGGGG') },
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
          expect(cells[e.y * W + e.x]).toBe('X');
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
        for (let i = 0; i < cells.length; i++) if (cells[i] === 'X' || cells[i] === 'C') route.add(i);
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
            // Since playtest 4 the outer ring may also carry plain ground
            // (enclosed voids read as bugs); the void-beyond rule remains.
          } else {
            expect(dist[k], `void slot ${k} should have been filled`).toBeGreaterThan(FILL_RADIUS);
          }
        }
      }
    }
  });

  it('ore floor: every map guarantees buildable ore cells (PRD sec 4.3)', () => {
    // The floor is what makes the Ore economy a certainty rather than a
    // draw - a map without ore has no Refinery play and no Core purchases.
    // Boards from CASES[2] up always have >= ORE_FLOOR fillable slots.
    for (const opts of CASES.slice(2)) {
      for (let seed = 1; seed <= 8; seed++) {
        const map = generateMap(createRng(seed * 7 + 1).stream('map'), LIB, opts);
        const cells = resolveCells(map.board, LIB);
        const oreCells = cells.filter((c) => c === 'O').length;
        // Each guaranteed slot carries a tile with >= 1 ore cell.
        expect(
          oreCells,
          `seed ${seed * 7 + 1} on ${opts.width}x${opts.height}: no ore economy`,
        ).toBeGreaterThanOrEqual(ORE_FLOOR);
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
            expect(cells[yy * W + tx * TILE_SIZE + TILE_SIZE - 1] === 'X').toBe(
              cells[yy * W + (tx + 1) * TILE_SIZE] === 'X',
            );
          }
      }
  });

  it('never fails across 200 seeds at the demo knob extremes', () => {
    // The player-facing guarantee: whatever the demo's randomized knobs draw,
    // a map comes out. 5 entries + long paths on 14x7 is the worst case that
    // reached a player once - it must not again.
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(createRng(seed).stream('map'), LIB, {
        width: 14,
        height: 7,
        entries: 5,
        targetPathLength: 26,
      });
      expect(map.entries.length).toBe(5);
    }
  });

  it('rejects zero entries', () => {
    expect(() =>
      generateMap(createRng(1).stream('map'), LIB, { width: 5, height: 5, entries: 0, targetPathLength: 3 }),
    ).toThrow(/at least one entry/);
  });
});

describe('lane tiles vs the generator (session 14)', () => {
  it('a valid multi-lane tile never lands on a road slot - maps stay connected', () => {
    // twin_stub presents n and s crossings on SEPARATE lanes: legal as a
    // tile, but placed as a straight it would sever the carved path (found
    // live - the boot crashed). The index must refuse it road duty.
    const withLanes = new TileLibrary([
      ...LIB.ids().map((id) => ({ id, cells: [...LIB.resolved(id, 0).cells] })),
      { id: 'twin_stub', cells: ['GGXGG', 'GGXGG', 'GGGGG', 'GGBGG', 'GGBGG'] },
    ]);
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap(createRng(seed * 11).stream('map'), withLanes, { width: 8, height: 5, entries: 3, targetPathLength: 8 });
      const cells = resolveCells(map.board, withLanes);
      // The real assertion: every entry reaches the Core through the graph.
      const flow = computeFlowField(cells, 8 * TILE_SIZE, 5 * TILE_SIZE, map.entries);
      expect(flow.L).toBeGreaterThan(0);
    }
  });
});

describe('void placement rules (playtest 12)', () => {
  it('void stays far, outside, and bounded - never a hole, never near the road', () => {
    for (const opts of [CASES[3], CASES[4], CASES[5]]) {
      for (let seed = 1; seed <= 6; seed++) {
        const map = generateMap(createRng(seed * 17).stream('map'), LIB, opts);
        const { width, height } = opts;
        // Slot distance from the road network, exactly as generation sees it.
        const isRoadSlot = map.board.slots.map((p) => {
          if (!p) return false;
          const r = LIB.resolved(p.tileId, p.rotation);
          const c = deriveConnectors(r.cells);
          return c.n || c.e || c.s || c.w || r.cells.some((row) => row.includes('C'));
        });
        const dist = new Array<number>(width * height).fill(-1);
        const q: number[] = [];
        isRoadSlot.forEach((v, k) => { if (v) { dist[k] = 0; q.push(k); } });
        for (let qi = 0; qi < q.length; qi++) {
          const k = q[qi];
          const x = k % width;
          const y = Math.floor(k / width);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
            const nk = (y + dy) * width + x + dx;
            if (dist[nk] === -1) { dist[nk] = dist[k] + 1; q.push(nk); }
          }
        }
        const voidK: number[] = [];
        for (let k = 0; k < width * height; k++) if (map.board.slots[k] === null) voidK.push(k);
        // (7) never near the road: everything within ORE_REACH is land.
        for (const k of voidK) expect(dist[k], `seed ${seed * 17} slot ${k}`).toBeGreaterThan(ORE_REACH);
        // (6) bounded share: the cap plus nothing sneaking around it.
        expect(voidK.length).toBeLessThanOrEqual(Math.floor(width * height * 0.22));
        // no holes: every void slot reaches the border through void.
        const reach = new Set<number>();
        const vq: number[] = [];
        for (const k of voidK) {
          const x = k % width;
          const y = Math.floor(k / width);
          if (x === 0 || y === 0 || x === width - 1 || y === height - 1) { reach.add(k); vq.push(k); }
        }
        const voidSet = new Set(voidK);
        for (let qi = 0; qi < vq.length; qi++) {
          const k = vq[qi];
          const x = k % width;
          const y = Math.floor(k / width);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
            const nk = (y + dy) * width + x + dx;
            if (voidSet.has(nk) && !reach.has(nk)) { reach.add(nk); vq.push(nk); }
          }
        }
        for (const k of voidK) expect(reach.has(k), `enclosed void at slot ${k}, seed ${seed * 17}`).toBe(true);
      }
    }
  });
});

describe('special tiles (2.21) - chosen, guaranteed, never rolled', () => {
  const SPECIAL_ORE = {
    id: 'sp_vein',
    cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG'),
    // The authored overlay (2.18): a distinctive amount no dice can roll.
    deposits: [{ x: 1, y: 1, amount: 777 }],
  };
  const SPECIAL_ROAD = { id: 'sp_road', cells: g('GG|GG', 'GG|GG', 'GG|GG', 'GG|GG', 'GG|GG') };
  const OPTS = { width: 8, height: 5, entries: 3, targetPathLength: 8 };
  const libWith = (): TileLibrary =>
    new TileLibrary([...LIB.ids().map((id) => ({ id, cells: [...LIB.resolved(id, 0).cells] })), SPECIAL_ORE, SPECIAL_ROAD]);

  it('a loaded special is on the map, its authored overlay honoured', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const map = generateMap(createRng(seed * 5).stream('map'), libWith(), { ...OPTS, specials: ['sp_vein', 'sp_road'] });
      const placed = map.board.slots.filter(Boolean).map((p) => p!.tileId);
      expect(placed.filter((id) => id === 'sp_vein').length).toBe(1);
      expect(placed.filter((id) => id === 'sp_road').length).toBe(1);
      // The authored vein keeps its author's numbers - 777 is unrollable.
      expect(map.deposits.some((d) => d.amount === 777)).toBe(true);
      // And the map still routes.
      const flow = computeFlowField(resolveCells(map.board, libWith()), OPTS.width * TILE_SIZE, OPTS.height * TILE_SIZE, map.entries);
      expect(flow.L).toBeGreaterThan(0);
    }
  });

  // "An unloaded special never appears" is the CALLER's half of the deal:
  // the worker builds each run's library as basics + the loadout, so a
  // special that was not loaded is not in the library at all. The
  // generator's half - a loaded special is never ALSO rolled from the
  // pools - is the exactly-once assertion above.

  it('an empty loadout changes nothing - same seed, same map', () => {
    const a = generateMap(createRng(4242).stream('map'), libWith(), OPTS);
    const b = generateMap(createRng(4242).stream('map'), libWith(), { ...OPTS, specials: [] });
    expect(a).toEqual(b);
  });

  it('a special carrying the Core is refused loudly', () => {
    const withCore = new TileLibrary([
      ...LIB.ids().map((id) => ({ id, cells: [...LIB.resolved(id, 0).cells] })),
      { id: 'sp_core', cells: g('GGGGG', 'GCCCG', 'GCCCX', 'GCCCG', 'GGGGG') },
    ]);
    expect(() => generateMap(createRng(7).stream('map'), withCore, { ...OPTS, specials: ['sp_core'] })).toThrow(/carries the Core/);
  });
});

describe('the bridge in the flow field (4.9)', () => {
  it('two roads cross a bridge cell without merging - distances stay per strand', () => {
    // One tile-column, two tiles tall. The deck road runs west-to-Core in
    // row 2; the underpass road runs down column 2 to its own Core in the
    // south tile. They cross at the bridge (2,2).
    const rows = [
      'GG|GG',
      'GG|GG',
      '--B-C',
      'GG|GG',
      'GG|GG',
      'GG|GG',
      'GG|GG',
      'GGCGG',
      'GGGGG',
      'GGGGG',
    ];
    const W = 5;
    const H = 10;
    const cells = rows.join('').split('') as ('G' | '|' | '-' | 'B' | 'C')[];
    const flow = computeFlowField(cells, W, H, [{ x: 0, y: 2 }, { x: 2, y: 0 }]);

    const node = (x: number, y: number, s: number): number => (y * W + x) * 2 + s;
    // Deck strand: two steps from the east Core. Underpass strand: five
    // steps from the south Core. One cell, two truths.
    expect(flow.nodeDist[node(2, 2, 0)]).toBe(2);
    expect(flow.nodeDist[node(2, 2, 1)]).toBe(5);
    // The cell just north of the bridge is SIX steps out - were the bridge
    // a merging junction, it could cut through the deck and be four.
    expect(flow.nodeDist[node(2, 1, 0)]).toBe(6);
    // L is the underpass entry's walk: 7 cells down to the south Core.
    expect(flow.L).toBe(7);
  });
});
