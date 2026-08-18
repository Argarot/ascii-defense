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

const CORNER = g('GGGGG', 'GGGGG', 'XXXGG', 'GGXGG', 'GGXGG'); // w + s
const STRAIGHT = g('GGGGG', 'GGGGG', 'XXXXX', 'GGGGG', 'GGGGG'); // w + e
const MEADOW = g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG');

describe('tile validity - the rules that make bad tiles unrepresentable', () => {
  it('accepts the reference shapes', () => {
    expect(validateTileCells(CORNER)).toEqual([]);
    expect(validateTileCells(STRAIGHT)).toEqual([]);
    expect(validateTileCells(MEADOW)).toEqual([]);
  });

  // -- entry-point rule (Daniil, 2026-08-17): every entry leads to another --

  it('a road that enters and passes THROUGH is legal; one that enters and stops is not', () => {
    expect(validateTileCells(CORNER)).toEqual([]); // w->s: both entries served
    // A road entering W and dead-ending inside is a stub the generator can
    // never place - the exact shape Tile Smith minted live (playtest 8).
    const stub = g('GGGGG', 'GGGGG', 'XXGGG', 'GGGGG', 'GGGGG');
    expect(validateTileCells(stub).join()).toMatch(/no other entry point/);
    // Border-hugging after entering no longer rescues it - still one entry.
    const hugStub = g('GXGGG', 'GXGGG', 'XXGGG', 'GGGGG', 'GGGGG');
    expect(validateTileCells(hugStub).join()).toMatch(/no other entry point/);
  });

  it('a road reaching no entry point at all is decoration, not road', () => {
    const orphan = g('GXGGG', 'GXGGG', 'GXGGG', 'GGGGG', 'GGGGG'); // column 1, no exit
    expect(validateTileCells(orphan).join()).toMatch(/no entry point/);
    const blob = g('GGGGG', 'GXXGG', 'GXXGG', 'GGGGG', 'GGGGG');
    expect(validateTileCells(blob).join()).toMatch(/no entry point/);
  });

  it('two opposed dead-end stubs are NOT a road - the session-14 boot-breaker is unrepresentable', () => {
    // n and s stubs, disconnected. Each derives an entry, neither leads
    // anywhere: dealt onto a road slot as a straight, the route broke at
    // boot (found live, session 14). Now invalid by construction.
    const twoStubs = g('GGXGG', 'GGXGG', 'GGGGG', 'GGXGG', 'GGXGG');
    expect(validateTileCells(twoStubs).join()).toMatch(/no other entry point/);
    // Head-on different-lane stubs are the same lie in lane clothing.
    const headOn = g('GGXGG', 'GGXGG', 'GGXGG', 'GGBGG', 'GGBGG');
    expect(validateTileCells(headOn).join()).toMatch(/no other entry point/);
  });

  it('T-JUNCTIONS: first-class 3-port types route three ways and rotate as a cycle (2.23)', () => {
    // A T with stem south: enters W, exits E and S. Three entries, all served.
    const tee = g('GGGGG', 'GGGGG', '--T--', 'GG|GG', 'GG|GG');
    expect(validateTileCells(tee)).toEqual([]);
    expect(deriveConnectors(tee)).toEqual({ n: false, e: true, s: true, w: true });
    // Rotating the grid rotates the junction: T -> 3 -> U -> E -> T.
    const r1 = rotateCells(tee, 1);
    expect(r1.join('')).toContain('3');
    expect(deriveConnectors(r1)).toEqual({ n: true, e: false, s: true, w: true });
    expect(rotateCells(rotateCells(tee, 3), 1)).toEqual(tee); // full turn is identity
    // The reason Ts are NOT 'X' (Daniil): two adjacent omni cells merge;
    // a T's closed side does not - touch-without-connecting survives.
    const denseR = g('GGXGG', 'GGXGG', 'XXXXG', 'GGXGG', 'GGXGG');
    void denseR; // (R junction tiles remain legal; Ts exist for dense maps)
  });

  it('LANES: twin_bend - two roads touching without merging, every entry served', () => {
    // The shipped two-lane tile: each bend links W-N / E-S respectively,
    // segments touch diagonally-adjacent without joining, four entries,
    // every one of them leads to another. The shape the rule must keep.
    const twinBend = g('GG|GG', 'GGL7G', '-7GL-', 'GL7GG', 'GG|GG');
    expect(validateTileCells(twinBend)).toEqual([]);
    expect(deriveConnectors(twinBend)).toEqual({ n: true, e: true, s: true, w: true });
    // And a broken variant - snip one bend so its entry dead-ends - fails.
    const snipped = g('GG|GG', 'GGL7G', '-7GGG', 'GL7GG', 'GG|GG');
    expect(validateTileCells(snipped).length).toBeGreaterThan(0);
  });

  it('rejects a core cell on any edge, even the center', () => {
    const bad = g('GGGGG', 'GGGGG', 'CXXXX', 'GGGGG', 'GGGGG');
    expect(validateTileCells(bad).join()).toMatch(/core.*edge/);
  });

  it('accepts an interior core block joined to the road', () => {
    const good = g('GGGGG', 'GCCCG', 'GCCCX', 'GCCCG', 'GGGGG');
    expect(validateTileCells(good)).toEqual([]);
    // Core cells derive no connector: only the east road cell does.
    expect(deriveConnectors(good)).toEqual({ n: false, e: true, s: false, w: false });
  });

  it('a spur off a through-road dead-ends and is rejected (2.26, playtest 11)', () => {
    // The 2.20 entry-point rule ALONE passes this: the spur reaches both
    // entries via the through-road. Daniil's screenshot tile, distilled.
    const spur = g('GGGGG', 'GG|GG', '--U--', 'GGGGG', 'GGGGG');
    expect(validateTileCells(spur).join()).toMatch(/dead-ends/);
    // The same shape carried to the edge centre is a T-junction: three
    // entries, no dead end, valid.
    const tee3 = g('GG|GG', 'GG|GG', '--U--', 'GGGGG', 'GGGGG');
    expect(validateTileCells(tee3)).toEqual([]);
    // Touch-without-merge interlock (the 2.23 motivating fixture) stays legal:
    // two bent roads, each entry-to-entry, touching at back-to-back bends.
    const interlock = g('GG|GG', 'GG|GG', '--JF-', 'GGFJG', 'GG|GG');
    expect(validateTileCells(interlock)).toEqual([]);
  });

  it('rejects unknown cell codes and malformed shapes', () => {
    // 'Z' is outside the alphabet ('X' used to be, until it became the crossroads).
    expect(validateTileCells(g('GGGGG', 'GGGGG', 'GGZGG', 'GGGGG', 'GGGGG')).join()).toMatch(/unknown type/);
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
    { id: 'core', cells: g('GGGGG', 'GCCCG', 'GCCCX', 'GCCCG', 'GGGGG') },
    { id: 'straight', cells: STRAIGHT },
    { id: 'corner', cells: CORNER },
    { id: 'tee', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGXGG', 'GGXGG') },
    { id: 'cross', cells: g('GGXGG', 'GGXGG', 'XXXXX', 'GGXGG', 'GGXGG') },
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
                const east = at(tx * 5 + 4, yy) === 'X';
                const west = at((tx + 1) * 5, yy) === 'X';
                expect(east).toBe(west); // both center (matched) or both non-road
              }
            }
            // Vertical seam with the south neighbour.
            if (ty + 1 < h && slotAt(board, tx, ty + 1)) {
              for (let cx = 0; cx < 5; cx++) {
                const xx = tx * 5 + cx;
                const south = at(xx, ty * 5 + 4) === 'X';
                const north = at(xx, (ty + 1) * 5) === 'X';
                expect(south).toBe(north);
              }
            }
            // No road on a world-facing border.
            if (tx === 0) for (let cy = 0; cy < 5; cy++) expect(at(0, ty * 5 + cy)).not.toBe('X');
            if (tx === w - 1) for (let cy = 0; cy < 5; cy++) expect(at(W - 1, ty * 5 + cy)).not.toBe('X');
            if (ty === 0) for (let cx = 0; cx < 5; cx++) expect(at(tx * 5 + cx, 0)).not.toBe('X');
            if (ty === h - 1) for (let cx = 0; cx < 5; cx++) expect(at(tx * 5 + cx, h * 5 - 1)).not.toBe('X');
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
        if (cells[i] === 'X' || cells[i] === 'C') route.add(i);
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
