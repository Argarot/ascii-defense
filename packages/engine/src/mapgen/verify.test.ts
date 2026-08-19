/**
 * verifyMap against the CURRENT generator (WBS 2.27, PR 1): the measured
 * baseline the rebuild is judged against. Sweeps assert which spec rules the
 * old pipeline already satisfies; `it.fails` tests pin the rules it is KNOWN
 * to break вЂ” they are the reserved regression fixtures, and they flip to
 * plain `it` when the rebuild kills the bug (vitest fails the run the moment
 * a `.fails` test starts passing, so the flip cannot be forgotten).
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { TileLibrary, createBoard, place } from '../tiles/board';
import { deriveConnectors, tilePartition } from '../tiles/tile';
import { generateMap } from './mapgen';
import { verifyMap } from './verify';

const g = (...rows: string[]): string[] => rows;
// The same hermetic shapes mapgen.test.ts uses (engine may not import content).
const BASE_TILES = [
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
];
const LIB = new TileLibrary(BASE_TILES);
const libWith = (...extra: { id: string; cells: string[]; deposits?: { x: number; y: number; amount: number }[]; boons?: { x: number; y: number; boon: 'range' | 'damage' | 'rate'; tier: 1 | 2 | 3 | 4 }[] }[]): TileLibrary =>
  new TileLibrary([...BASE_TILES, ...extra]);

const CASES = [
  { width: 5, height: 4, entries: 2, targetPathCells: 30 },
  { width: 8, height: 5, entries: 3, targetPathCells: 40 },
  { width: 12, height: 7, entries: 4, targetPathCells: 70 },
  { width: 14, height: 7, entries: 6, targetPathCells: 30 },
];

describe('verifyMap: the current generator against the spec (the baseline)', () => {
  it('plain maps satisfy every checkable invariant', () => {
    for (const opts of CASES) {
      for (let seed = 1; seed <= 25; seed++) {
        const map = generateMap(createRng(seed * 31).stream('map'), LIB, { ...opts, relicPoolSize: 11 });
        const issues = verifyMap(map, LIB, { relicPoolSize: 11 });
        expect(issues, `${opts.width}x${opts.height} seed ${seed * 31}: ${JSON.stringify(issues)}`).toEqual([]);
      }
    }
  });

  it('maps with road, junction, bridge and ore specials satisfy the spec', () => {
    const lib = libWith(
      { id: 'sp_road', cells: g('GG|GG', 'GG|GG', 'GG|GG', 'GG|GG', 'GG|GG') },
      { id: 'sp_x', cells: g('GG|GG', 'GG|GG', '--X--', 'GG|GG', 'GG|GG') },
      { id: 'sp_bridge', cells: g('GG|GG', 'GG|GG', '--B--', 'GG|GG', 'GG|GG') },
      { id: 'sp_vein', cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG'), deposits: [{ x: 1, y: 1, amount: 777 }] },
    );
    const specials = ['sp_road', 'sp_x', 'sp_bridge', 'sp_vein'];
    for (let seed = 1; seed <= 15; seed++) {
      const map = generateMap(createRng(seed * 7).stream('map'), lib, {
        width: 12, height: 7, entries: 3, targetPathCells: 50, relicPoolSize: 11, specials,
      });
      const issues = verifyMap(map, lib, { relicPoolSize: 11, specials });
      expect(issues, `seed ${seed * 7}: ${JSON.stringify(issues)}`).toEqual([]);
    }
  });

  it('maps whose pool can tunnel (bridge + twin-bend basics) stay trees under the segment-aware check', () => {
    // Two roads in one slot = two nodes in the road graph. Without these
    // tiles in the ROLLED pool the carve can never tunnel, so this is the
    // only sweep that exercises multi-segment slots outside anchors.
    const lib = libWith(
      { id: 'bridge_basic', cells: g('GG|GG', 'GG|GG', '--B--', 'GG|GG', 'GG|GG') },
      { id: 'twin_bend', cells: g('GG|GG', 'GGL7G', '--7L-', 'GG|GG', 'GG|GG') },
    );
    let multiSegmentMaps = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const map = generateMap(createRng(seed * 17).stream('map'), lib, {
        width: 12, height: 7, entries: 6, targetPathCells: 60, relicPoolSize: 11,
      });
      const issues = verifyMap(map, lib, { relicPoolSize: 11 });
      expect(issues, `seed ${seed * 17}: ${JSON.stringify(issues)}`).toEqual([]);
      if (map.board.slots.some((p) => p && tilePartition(lib.resolved(p.tileId, p.rotation).cells).length > 1)) {
        multiSegmentMaps++;
      }
    }
    // The sweep must actually EXERCISE tunnels, or this test proves nothing.
    expect(multiSegmentMaps).toBeGreaterThan(0);
  });

  it('flags a special that never landed (the checker itself works)', () => {
    // Sanity: verifyMap must be able to say no. A map generated WITHOUT the
    // special, verified as if it were loaded, must fail exactly-once.
    const map = generateMap(createRng(5).stream('map'), LIB, CASES[1]);
    const issues = verifyMap(map, LIB, { specials: ['sp_road'] });
    expect(issues.some((i) => i.rule === 'tier0/specials-exactly-once')).toBe(true);
  });

  it('catches a LOOP (the tree check itself works)', () => {
    // A hand-built 2x2 ring of corners: drivable, edge-legal, and exactly
    // the shape the no-loops rule exists to forbid. |E| = |V| here.
    const wanted: { x: number; y: number; conn: Record<string, boolean> }[] = [
      { x: 0, y: 0, conn: { n: false, e: true, s: true, w: false } },
      { x: 1, y: 0, conn: { n: false, e: false, s: true, w: true } },
      { x: 1, y: 1, conn: { n: true, e: false, s: false, w: true } },
      { x: 0, y: 1, conn: { n: true, e: true, s: false, w: false } },
    ];
    let board = createBoard(2, 2);
    for (const w of wanted) {
      const rot = ([0, 1, 2, 3] as const).find((r) => {
        const c = deriveConnectors(LIB.resolved('corner', r).cells);
        return c.n === w.conn.n && c.e === w.conn.e && c.s === w.conn.s && c.w === w.conn.w;
      });
      expect(rot, `no corner rotation gives ${JSON.stringify(w.conn)}`).toBeDefined();
      board = place(board, 'corner', rot!, w.x, w.y);
    }
    const loopMap = {
      board, entries: [], core: { x: 0, y: 0 }, caches: [], rockContents: [], deposits: [], boons: [],
    };
    const issues = verifyMap(loopMap, LIB, {});
    expect(issues.some((i) => i.rule === 'tier1/road-tree')).toBe(true);
  });
});

describe('reserved regression fixtures (playtest 16) - flip to plain `it` when the rebuild lands', () => {
  // Boon-on-void, the engine half: the authored-overlay path accepts a boon
  // on ANY cell of the tile - rock included - with no validator, smith or
  // generator check. Spec tier3/boons-on-ground says boons sit on buildable
  // ground only, dealt AND authored.
  it.fails('an authored boon on a non-ground cell is refused', () => {
    const lib = libWith({
      id: 'sp_boonrock',
      cells: g('GGGGG', 'GRGGG', 'GGGGG', 'GGGGG', 'GGGGG'),
      boons: [{ x: 1, y: 1, boon: 'damage', tier: 2 }],
    });
    for (let seed = 1; seed <= 5; seed++) {
      const map = generateMap(createRng(seed * 13).stream('map'), lib, {
        width: 8, height: 5, entries: 2, targetPathCells: 30, relicPoolSize: 11, specials: ['sp_boonrock'],
      });
      const issues = verifyMap(map, lib, { relicPoolSize: 11, specials: ['sp_boonrock'] });
      expect(issues.filter((i) => i.rule === 'tier3/boons-on-ground'), `seed ${seed * 13}`).toEqual([]);
    }
  });
});
