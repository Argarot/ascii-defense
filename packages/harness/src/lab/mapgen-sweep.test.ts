/**
 * The SHIPPED library against the generation spec (2.27, playtest round 1).
 *
 * The engine's own mapgen tests are hermetic by invariant (engine may not
 * import content), which means they exercise SIMPLE tile shapes - and the
 * playtest found loops the hermetic sweeps never could: the real library's
 * wiggly and twin tiles are where touching-not-merging roads live. This
 * sweep closes that class: real tiles, real knob derivation, loadout-heavy
 * runs, verifyMap (including the strand-level exactly-one-route law) on
 * every map.
 */
import { describe, expect, it } from 'vitest';
import { TILE_SIZE, TileLibrary, createRng, generateMap, mirrorCanonicalKey, tileIsSpecialShape, verifyMap, type TileDef } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';

const g = (...rows: string[]): string[] => rows;
const LIB = new TileLibrary(libraryJson.tiles);

// Minted-style specials of every road class a player can build in the
// Smith: plain segment road, junction, bridge, twin-segment, ore overlay.
const MINTED: TileDef[] = [
  { id: 'sp_road', cells: g('GG|GG', 'GG|GG', 'GG|GG', 'GG|GG', 'GG|GG') },
  { id: 'sp_x', cells: g('GG|GG', 'GG|GG', '--X--', 'GG|GG', 'GG|GG') },
  { id: 'sp_bridge', cells: g('GG|GG', 'GG|GG', '--B--', 'GG|GG', 'GG|GG') },
  { id: 'sp_twin', cells: g('GG|GG', 'GGL7G', '-7GL-', 'GL7GG', 'GG|GG') },
  { id: 'sp_fold', cells: g('GGGGG', 'GF-7G', '-JGL-', 'GGGGG', 'GGGGG') },
  { id: 'sp_vein', cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG'), deposits: [{ x: 1, y: 1, amount: 777 }] },
];
const withMinted = (): TileLibrary => new TileLibrary([...libraryJson.tiles, ...MINTED]);

/** The live app's knob derivation, threat table inlined (harness may not import app). */
const THREATS = [
  { entries: [2, 3] as const, pathBias: 12 },
  { entries: [2, 5] as const, pathBias: 8 },
  { entries: [3, 6] as const, pathBias: 5 },
];

function appMap(seed0: number, lib: TileLibrary, specials?: string[], threatIdx = 1) {
  // The worker's exact behaviour: generation failures reroll the seed,
  // bounded; a loadout no carve can host must surface, never spin.
  let seed = seed0;
  for (let attempt = 0; ; attempt++) {
    try {
      const T = THREATS[threatIdx];
      const knobs = createRng(seed).stream('map');
      const entries = knobs.int(T.entries[0], T.entries[1]);
      const targetPathCells = (T.pathBias + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
      return generateMap(knobs, lib, { width: 12, height: 7, entries, targetPathCells, relicPoolSize: 11, specials });
    } catch (e) {
      if (attempt >= 60) throw e;
      seed = (seed + 1) % 1_000_000;
    }
  }
}

describe('the label law: shipped flags match the special-shape predicate', () => {
  it('every tile is flagged special IFF its shape is special (touching or twin-segment)', () => {
    // One predicate, audited forever - playtest 18 found the confusion that
    // one unlabeled shape causes. tilegen emits the flag; this test keeps
    // hand-authored tiles honest too.
    for (const t of libraryJson.tiles) {
      const should = tileIsSpecialShape(t.cells);
      const flagged = (t as { special?: boolean }).special === true;
      expect(flagged, `${t.id}: shape says special=${should}, library says ${flagged}`).toBe(should);
    }
  });

  it('no two shipped tiles share a mirror-canonical form (no duplicates, rotations, or mirror twins)', () => {
    // Rotation identity found nothing in playtest 17's sweep - and playtest
    // 18's screenshot showed gen_ns_3/gen_ns_4 side by side: exact mirrors,
    // reading as one asset shipped twice. Reflection joins the law.
    const seen = new Map<string, string>();
    for (const t of libraryJson.tiles) {
      const k = mirrorCanonicalKey(t.cells);
      expect(seen.has(k), `${t.id} duplicates ${seen.get(k)}`).toBe(false);
      seen.set(k, t.id);
    }
  });
});

describe('the shipped library satisfies the spec (verifyMap on real content)', () => {
  it('plain runs, all threats, 40 seeds each', () => {
    for (let threatIdx = 0; threatIdx < 3; threatIdx++) {
      for (let seed = 1; seed <= 40; seed++) {
        const map = appMap(seed * 101 + threatIdx, LIB, undefined, threatIdx);
        const issues = verifyMap(map, LIB, { relicPoolSize: 11 });
        expect(issues, `threat ${threatIdx} seed ${seed * 101 + threatIdx}: ${JSON.stringify(issues)}`).toEqual([]);
      }
    }
  });

  it('loadout-heavy runs: the multi-segment road classes at once, all threats', () => {
    const lib = withMinted();
    const specials = ['sp_twin', 'sp_bridge', 'sp_x', 'sp_fold', 'sp_vein'];
    for (let threatIdx = 0; threatIdx < 3; threatIdx++) {
      for (let seed = 1; seed <= 8; seed++) {
        const map = appMap(seed * 37 + threatIdx, lib, specials, threatIdx);
        const issues = verifyMap(map, lib, { relicPoolSize: 11, specials });
        expect(issues, `threat ${threatIdx} seed ${seed * 37 + threatIdx}: ${JSON.stringify(issues)}`).toEqual([]);
      }
    }
  }, 60000);

  it('the reported map: seed 633440, threat 0, twin+bridge loadout class', () => {
    // The exact minted defs from the report are not available; this pins
    // the reporter's SEED and the reporter's tile CLASS (two disconnected
    // roads on one tile). If his exported save arrives, the exact defs
    // replace these.
    const lib = withMinted();
    const specials = ['sp_twin', 'sp_bridge', 'sp_x'];
    const map = appMap(633440, lib, specials, 0);
    const issues = verifyMap(map, lib, { relicPoolSize: 11, specials });
    expect(issues, JSON.stringify(issues)).toEqual([]);
  });
});
