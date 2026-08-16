import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { deriveConnectors, rotateCells, validateTileCells } from './tile';
import {
  TileLibrary,
  canPlace,
  createBoard,
  growBoard,
  place,
  resolveCells,
  slotAt,
} from './board';

// A compact way to write grids in tests.
const g = (...rows: string[]): string[] => rows;

const CORNER = g('GGGGG', 'GGGGG', 'RRRGG', 'GGRGG', 'GGRGG'); // w + s
const STRAIGHT = g('GGGGG', 'GGGGG', 'RRRRR', 'GGGGG', 'GGGGG'); // w + e
const MEADOW = g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG');

describe('tile validity - the rules that make bad tiles unrepresentable', () => {
  it('accepts the reference shapes', () => {
    expect(validateTileCells(CORNER)).toEqual([]);
    expect(validateTileCells(STRAIGHT)).toEqual([]);
    expect(validateTileCells(MEADOW)).toEqual([]);
  });

  // -- session 14: the border rule is GONE; lanes and crossings replace it --

  it('a road up a non-centre column is legal IF it exits through a centre crossing', () => {
    // Column 1 road turning to the west centre: hugs the edge, then crosses.
    const ok = g('GRGGG', 'GRGGG', 'RRGGG', 'GGGGG', 'GGGGG');
    expect(validateTileCells(ok)).toEqual([]);
    // ...but the crossing derives WEST only - the north border cell does not
    // leak a connector (directional rule).
    const conn = deriveConnectors(ok);
    expect(conn).toEqual({ n: false, e: false, s: false, w: true });
  });

  it('a border-hugging road with NO crossing anywhere is an orphan lane', () => {
    const bad = g('GRGGG', 'GRGGG', 'GRGGG', 'GGGGG', 'GGGGG'); // column 1, no exit
    expect(validateTileCells(bad).join()).toMatch(/derives no crossing/);
  });

  it('split road stubs each need their own crossing - and then they are LEGAL', () => {
    // n and s stubs, disconnected: under lane rules each is its own
    // component, and each derives its own crossing - two roads in one tile.
    const twoRoads = g('GGRGG', 'GGRGG', 'GGGGG', 'GGRGG', 'GGRGG');
    expect(validateTileCells(twoRoads)).toEqual([]);
    const conn = deriveConnectors(twoRoads);
    expect(conn.n).toBe(true);
    expect(conn.s).toBe(true);
  });

  it('rejects an interior road blob with no crossing', () => {
    const bad = g('GGGGG', 'GRRGG', 'GRRGG', 'GGGGG', 'GGGGG');
    expect(validateTileCells(bad).join()).toMatch(/derives no crossing/);
  });

  it('LANES: touching roads of different lanes are separate components', () => {
    // Two vertical lanes side by side, TOUCHING, each with its own... only
    // one centre per edge - so lane R crosses north, lane r crosses south.
    const lanes = g('GGRGG', 'GGRGG', 'GGRrG', 'GGGrG', 'GGGrG');
    // R path: (2,0)-(2,2) exits north... (2,2) centre? crossing south for r:
    // r occupies (3,2)-(3,4): column 3 is not the south centre (2,4). Invalid!
    expect(validateTileCells(lanes).join()).toMatch(/derives no crossing/);
    // Give each lane its own centre crossing and it validates.
    const good = g('GGRGG', 'GGRGG', 'GGRGG', 'GGrGG', 'GGrGG');
    // R holds the north half through centre (2,2)... but R at (2,2) and r at
    // (2,3) TOUCH without joining: R must cross north (yes, via (2,0)+(2,1))
    // and r must cross south (via (2,4)+(2,3)). Both legal, one column, two
    // lanes meeting head-on without merging.
    expect(validateTileCells(good)).toEqual([]);
    const conn = deriveConnectors(good);
    expect(conn.n).toBe(true); // R's crossing
    expect(conn.s).toBe(true); // r's crossing
  });

  it('rejects a core cell on any edge, even the center', () => {
    const bad = g('GGGGG', 'GGGGG', 'CRRRR', 'GGGGG', 'GGGGG');
    expect(validateTileCells(bad).join()).toMatch(/core.*edge/);
  });

  it('accepts an interior core block joined to the road', () => {
    const good = g('GGGGG', 'GCCCG', 'GCCCR', 'GCCCG', 'GGGGG');
    expect(validateTileCells(good)).toEqual([]);
    // Core cells derive no connector: only the east road cell does.
    expect(deriveConnectors(good)).toEqual({ n: false, e: true, s: false, w: false });
  });

  it('rejects unknown cell codes and malformed shapes', () => {
    expect(validateTileCells(g('GGGGG', 'GGGGG', 'GGXGG', 'GGGGG', 'GGGGG')).join()).toMatch(/unknown type/);
    expect(validateTileCells(g('GGGGG', 'GGGGG')).join()).toMatch(/5 rows/);
    expect(validateTileCells(g('GGGGG', 'GGGGG', 'GGGG', 'GGGGG', 'GGGGG')).join()).toMatch(/5 cells/);
  });
});

describe('rotation', () => {
  it('rotates connectors clockwise: w+s becomes n+w', () => {
    expect(deriveConnectors(CORNER)).toEqual({ n: false, e: false, s: true, w: true });
    expect(deriveConnectors(rotateCells(CORNER, 1))).toEqual({ n: true, e: false, s: false, w: true });
  });

  it('four quarter turns are the identity', () => {
    expect(rotateCells(CORNER, 3).map((r) => r)).not.toEqual(CORNER);
    let cells = CORNER;
    for (let i = 0; i < 4; i++) cells = rotateCells(cells, 1);
    expect(cells).toEqual(CORNER);
  });

  it('rotation preserves validity', () => {
    for (const k of [1, 2, 3] as const) expect(validateTileCells(rotateCells(CORNER, k))).toEqual([]);
  });
});

describe('placement legality', () => {
  const lib = new TileLibrary([
    { id: 'straight', cells: STRAIGHT },
    { id: 'corner', cells: CORNER },
    { id: 'meadow', cells: MEADOW },
  ]);

  it('roads join road, meadow joins meadow-edges', () => {
    let board = createBoard(3, 1);
    board = place(board, 'straight', 0, 1, 0);
    // straight has w+e: another straight to the east agrees (w meets e)...
    expect(canPlace(board, lib, 'straight', 0, 2, 0)).toBe(false); // e faces off-board
    // ...but rotated 90 (n+s) it disagrees on the shared edge.
    expect(canPlace(board, lib, 'straight', 1, 2, 0)).toBe(false);
    // meadow against the straight's road edge: disagree.
    expect(canPlace(board, lib, 'meadow', 0, 2, 0)).toBe(false);
  });

  it('a connector may not face off the board', () => {
    const board = createBoard(2, 2);
    // straight (w+e) on a 2-wide board always has a road facing out.
    expect(canPlace(board, lib, 'straight', 0, 0, 0)).toBe(false);
    expect(canPlace(board, lib, 'straight', 0, 1, 0)).toBe(false);
    // rotated to n+s at (0,0) of a 2-tall board: also out. Meadow is fine.
    expect(canPlace(board, lib, 'straight', 1, 0, 0)).toBe(false);
    expect(canPlace(board, lib, 'meadow', 0, 0, 0)).toBe(true);
  });

  it('occupied and out-of-bounds slots refuse', () => {
    let board = createBoard(2, 1);
    board = place(board, 'meadow', 0, 0, 0);
    expect(canPlace(board, lib, 'meadow', 0, 0, 0)).toBe(false);
    expect(canPlace(board, lib, 'meadow', 0, -1, 0)).toBe(false);
    expect(canPlace(board, lib, 'meadow', 0, 2, 0)).toBe(false);
  });

  it('requireContact demands a neighbour', () => {
    let board = createBoard(3, 3);
    board = place(board, 'meadow', 0, 1, 1);
    expect(canPlace(board, lib, 'meadow', 0, 0, 1, { requireContact: true })).toBe(true);
    expect(canPlace(board, lib, 'meadow', 0, 0, 0, { requireContact: true })).toBe(false); // diagonal is not contact
  });

  it('requireRoadJoin: a road tile may not attach by a ground edge only', () => {
    // Corner (w+s) at center of 3x3, rotated so its roads point n+w: its
    // south edge is plain ground.
    let board = createBoard(3, 3);
    board = place(board, 'corner', 1, 1, 1); // rot 1: w+s -> n+w
    // A corner below it, roads pointing away (n+w rotated to e+s at rot 3?):
    // use rot 2 (e+n roads? w+s rotated twice -> e+n). Its n edge carries road,
    // the neighbour's s edge does not: edge DISAGREES, illegal outright.
    expect(canPlace(board, lib, 'corner', 2, 1, 2, { requireRoadJoin: true })).toBe(false);
    // Straight rotated to n+s placed to the EAST of the center tile: shared
    // w/e edge is ground/ground (agrees), but its road joins nothing.
    expect(canPlace(board, lib, 'straight', 1, 2, 1)).toBe(true); // legal without the rule
    expect(canPlace(board, lib, 'straight', 1, 2, 1, { requireRoadJoin: true })).toBe(false);
    // Meadow attaching by ground edge stays fine under the rule.
    expect(canPlace(board, lib, 'meadow', 0, 1, 2, { requireRoadJoin: true })).toBe(true);
  });
});

describe('grown boards hold the connectivity contract (seeded, edge-biased sizes)', () => {
  const LIB_DEFS = [
    { id: 'core', cells: g('GGGGG', 'GCCCG', 'GCCCR', 'GCCCG', 'GGGGG') },
    { id: 'straight', cells: STRAIGHT },
    { id: 'corner', cells: CORNER },
    { id: 'tee', cells: g('GGGGG', 'GGGGG', 'RRRRR', 'GGRGG', 'GGRGG') },
    { id: 'cross', cells: g('GGRGG', 'GGRGG', 'RRRRR', 'GGRGG', 'GGRGG') },
    { id: 'spur', cells: g('GGGGG', 'GGGGG', 'RRRGG', 'GGGGG', 'GGGGG') },
    { id: 'meadow', cells: MEADOW },
  ];
  const lib = new TileLibrary(LIB_DEFS);

  // Smallest board a core fits on, up to demo size. Small boards are where
  // boundary bugs live, which is why they get equal representation.
  const SIZES: [number, number][] = [[2, 1], [2, 2], [3, 3], [8, 3], [14, 7]];

  it('every board: tiles valid, every shared edge agrees, no road exits the world', () => {
    let boards = 0;
    for (const [w, h] of SIZES) {
      for (let seed = 1; seed <= 7; seed++) {
        const rng = createRng(seed * 1000 + w * 10 + h);
        const board = growBoard(rng.stream('map'), lib, {
          width: w,
          height: h,
          startTileId: 'core',
          maxTiles: w * h,
        });
        boards++;

        const cells = resolveCells(board, lib);
        const W = w * 5;
        const at = (x: number, y: number) => cells[y * W + x];

        for (let ty = 0; ty < h; ty++)
          for (let tx = 0; tx < w; tx++) {
            const p = slotAt(board, tx, ty);
            if (!p) continue;
            // Re-derive validity from the resolved grid, independent of canPlace.
            const resolved = lib.resolved(p.tileId, p.rotation);
            expect(validateTileCells(resolved.cells)).toEqual([]);

            // Horizontal seam with the east neighbour, if placed.
            if (tx + 1 < w && slotAt(board, tx + 1, ty)) {
              for (let cy = 0; cy < 5; cy++) {
                const yy = ty * 5 + cy;
                const east = at(tx * 5 + 4, yy) === 'R';
                const west = at((tx + 1) * 5, yy) === 'R';
                expect(east).toBe(west); // both center (matched) or both non-road
              }
            }
            // Vertical seam with the south neighbour.
            if (ty + 1 < h && slotAt(board, tx, ty + 1)) {
              for (let cx = 0; cx < 5; cx++) {
                const xx = tx * 5 + cx;
                const south = at(xx, ty * 5 + 4) === 'R';
                const north = at(xx, (ty + 1) * 5) === 'R';
                expect(south).toBe(north);
              }
            }
            // No road on a world-facing border.
            if (tx === 0) for (let cy = 0; cy < 5; cy++) expect(at(0, ty * 5 + cy)).not.toBe('R');
            if (tx === w - 1) for (let cy = 0; cy < 5; cy++) expect(at(W - 1, ty * 5 + cy)).not.toBe('R');
            if (ty === 0) for (let cx = 0; cx < 5; cx++) expect(at(tx * 5 + cx, 0)).not.toBe('R');
            if (ty === h - 1) for (let cx = 0; cx < 5; cx++) expect(at(tx * 5 + cx, h * 5 - 1)).not.toBe('R');
          }
      }
    }
    expect(boards).toBe(SIZES.length * 7);
  });

  it('the road network grown from the core is one connected component', () => {
    // The in-game guarantee: growth only ever extends the landmass, and roads
    // only join at matched connectors, so every road cell must be reachable
    // from the core. Checked on the resolved grid with plain BFS.
    for (let seed = 1; seed <= 10; seed++) {
      const rng = createRng(seed);
      const w = 8, h = 6;
      const board = growBoard(rng.stream('map'), lib, {
        width: w, height: h, startTileId: 'core', maxTiles: w * h,
      });
      const cells = resolveCells(board, lib);
      const W = w * 5, H = h * 5;
      const route = new Set<number>();
      let start = -1;
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] === 'R' || cells[i] === 'C') route.add(i);
        if (cells[i] === 'C') start = i;
      }
      expect(start).toBeGreaterThanOrEqual(0);

      const seen = new Set<number>([start]);
      const stack = [start];
      while (stack.length) {
        const i = stack.pop()!;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (route.has(ni) && !seen.has(ni)) { seen.add(ni); stack.push(ni); }
        }
      }
      expect(seen.size).toBe(route.size);
    }
  });

  it('growth is deterministic per seed', () => {
    const grow = () =>
      growBoard(createRng(777).stream('map'), lib, {
        width: 6, height: 5, startTileId: 'core', maxTiles: 30,
      });
    expect(grow()).toEqual(grow());
  });

  it('a core cannot exist on a 1x1 board - its road would exit the world', () => {
    expect(() =>
      growBoard(createRng(1).stream('map'), lib, {
        width: 1, height: 1, startTileId: 'core', maxTiles: 5,
      }),
    ).toThrow(/fits nowhere/);
  });
});
