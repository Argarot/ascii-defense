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
import { deriveConnectors, tilePartition, validateTile, validateTileCells } from '../tiles/tile';
import { generateMap } from './mapgen';
import { verifyMap } from './verify';

const g = (...rows: string[]): string[] => rows;
// The same hermetic shapes mapgen.test.ts uses (engine may not import content).
const BASE_TILES = [
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
      board, entries: [], core: { x: 0, y: 0 }, coreFace: [], cellsW: 2 * 5 + 1, cellsH: 2 * 5,
      caches: [], rockContents: [], deposits: [], boons: [], voidShareTarget: 1, pathFloorCells: 0, coverage: 0, laneBand: 0,
    };
    const issues = verifyMap(loopMap, LIB, {});
    expect(issues.some((i) => i.rule === 'tier1/road-tree')).toBe(true);
  });
});

describe('regression: loops on generated maps (playtest 2026-08-19, seed 633440)', () => {
  it('a REACHABLE board cycle is caught by the strand-level exactly-one-route check', () => {
    // A ring through the Core: core_x's east exit circles via three corners
    // back into its north exit - every cell routes, the flow field is happy,
    // and there are two ways from the ring to the Core. The literal law
    // (exactly one route) must say no.
    // Session 24: the Core is a face past the east border; the root is a
    // crossroads on that border whose east port feeds it, and the ring
    // hangs off the crossroads' north and west ports.
    const wanted: { tile: string; x: number; y: number; conn: Record<string, boolean> }[] = [
      { tile: 'cross', x: 2, y: 1, conn: { n: true, e: true, s: true, w: true } },
      { tile: 'corner', x: 1, y: 1, conn: { n: true, e: true, s: false, w: false } },
      { tile: 'corner', x: 1, y: 0, conn: { n: false, e: true, s: true, w: false } },
      { tile: 'corner', x: 2, y: 0, conn: { n: false, e: false, s: true, w: true } },
    ];
    let board = createBoard(3, 3);
    for (const w of wanted) {
      const rot = ([0, 1, 2, 3] as const).find((r) => {
        const c = deriveConnectors(LIB.resolved(w.tile, r).cells);
        return c.n === w.conn.n && c.e === w.conn.e && c.s === w.conn.s && c.w === w.conn.w;
      });
      expect(rot, `no ${w.tile} rotation gives ${JSON.stringify(w.conn)}`).toBeDefined();
      board = place(board, w.tile, rot!, w.x, w.y);
    }
    const core = { x: 3 * 5, y: 1 * 5 + 2 };
    const ringMap = {
      board, entries: [], core, coreFace: [{ x: core.x, y: core.y - 1 }, core, { x: core.x, y: core.y + 1 }],
      cellsW: 3 * 5 + 1, cellsH: 3 * 5, caches: [], rockContents: [], deposits: [], boons: [],
      voidShareTarget: 1, pathFloorCells: 0, coverage: 0, laneBand: 0,
    };
    const issues = verifyMap(ringMap, LIB, {});
    expect(issues.some((i) => i.rule === 'tier1/route-unique'), JSON.stringify(issues)).toBe(true);
  });

  it('a tile whose road loops is refused by validity (the authoring surface)', () => {
    // The class Daniil minted by hand: an omni blob closes a cell cycle.
    const loopTile = ['GGGGG', 'GXXGG', 'GXXGG', 'GG|GG', 'GG|GG'];
    // Make it edge-legal first: route the blob to the s edge... the blob
    // itself is the offence regardless of connectors.
    expect(validateTileCells(loopTile).some((e) => /loops at/.test(e))).toBe(true);
    // And a plain path does not trip the rule.
    expect(validateTileCells(g('GGGGG', 'GGGGG', '-----', 'GGGGG', 'GGGGG'))).toEqual([]);
  });
});

describe('regression: boon-on-ground, both halves (playtest 16, engine side)', () => {
  // PR 1 pinned this red: a library built WITHOUT the validator accepted an
  // authored boon on a rock cell and dealt it silently. Closed in PR 3:
  // the generator refuses the overlay loudly, and validateTile (the
  // authoring surface: the Smith and the worker's loadout gate) names the
  // cell. The lifecycle half of the reported bug - a new map's boons
  // composited over an old sim's board - is PR 4's fixture.
  const BOONROCK = {
    id: 'sp_boonrock',
    cells: g('GGGGG', 'GRGGG', 'GGGGG', 'GGGGG', 'GGGGG'),
    boons: [{ x: 1, y: 1, boon: 'damage' as const, tier: 2 as const }],
  };

  it('the generator refuses an authored boon on a non-ground cell, loudly', () => {
    const lib = libWith(BOONROCK);
    expect(() =>
      generateMap(createRng(13).stream('map'), lib, {
        width: 8, height: 5, entries: 2, targetPathCells: 30, relicPoolSize: 11, specials: ['sp_boonrock'],
      }),
    ).toThrow(/authors a boon on a non-ground cell/);
  });

  it('the authoring surface refuses it too (validateTile)', () => {
    expect(validateTile(BOONROCK).some((e) => /boon at \(1,1\)/.test(e))).toBe(true);
  });
});
