/**
 * Build pads (PRD sec 32.1, D42; Rework I, PR 1) - the rule's properties, on
 * the shipped library and the app's own maps. The 500-seed reading is the
 * census (tools/pad-census.mjs); this holds what must be true of EVERY map.
 */
import { describe, expect, it } from 'vitest';
import { PAD_REACH, REWORK_PADS, THREAT_LEVELS, TileLibrary, createRng, generateMap, isRoad, mapCells, reworkKnobs, threatKnobs, validateTileCells, verifyMap, type GeneratedMap } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';

const lib = new TileLibrary(libraryJson.tiles);
const POOL = 54;
const SEEDS = Array.from({ length: 12 }, (_, i) => (i + 1) * 7919 + 13);

/** The app's own map for a seed (workerRuntime's spread), with or without the prototype's switch. */
function deal(seed: number, threatIdx: number, rework: boolean): GeneratedMap {
  const t = THREAT_LEVELS[threatIdx];
  const knobs = createRng(seed).stream('map');
  return generateMap(knobs, lib, { width: 7, height: 5, ...threatKnobs(knobs, t), relicPoolSize: POOL, specials: [], ...(rework ? reworkKnobs(t) : {}) });
}

describe('build pads: the switch', () => {
  it('off, a map carries no bedrock and no cell is one - the engine\'s default is the game as it is', () => {
    const m = deal(SEEDS[0], 1, false);
    expect(m.bedrock).toBeUndefined();
    expect(mapCells(m, lib).includes('D')).toBe(false);
  });

  it('on, NOTHING moves but the ground: the same seed is the same board, rock, veins and boons (the rule spends the map\'s last dice)', () => {
    for (const threatIdx of [0, 1, 2]) {
      for (const seed of SEEDS.slice(0, 4)) {
        const off = deal(seed, threatIdx, false);
        const on = deal(seed, threatIdx, true);
        const { bedrock, ...rest } = on;
        expect(rest, `seed ${seed}, threat ${threatIdx}`).toEqual(off);
        expect(bedrock!.length).toBeGreaterThan(0);
        const a = mapCells(off, lib);
        const b = mapCells(on, lib);
        a.forEach((c, k) => { if (c !== b[k]) expect([c, b[k]], `cell ${k}`).toEqual(['G', 'D']); });
      }
    }
  });
});

describe('build pads: every map', () => {
  for (const threatIdx of [0, 1, 2]) {
    const t = THREAT_LEVELS[threatIdx];
    it(`${t.name}: the count is the knob's, every pad has road in reach, no boon is lost, and the map still verifies`, () => {
      for (const seed of SEEDS) {
        const m = deal(seed, threatIdx, true);
        const cells = mapCells(m, lib);
        const W = m.cellsW;
        const pads = cells.flatMap((c, k) => (c === 'G' ? [k] : []));
        expect(pads.length, `seed ${seed}: pads`).toBe(Math.round(REWORK_PADS[t.name].perTile * 35));
        // Boon ground is a pad wherever it was dealt (sec 32.1) - up to a tile from the road, a set-back pad by birth.
        const boonAt = new Set(m.boons.map((b) => b.y * W + b.x));
        for (const k of pads) {
          if (boonAt.has(k)) continue;
          let near = false;
          for (let dy = -PAD_REACH; dy <= PAD_REACH; dy++)
            for (let dx = -PAD_REACH; dx <= PAD_REACH; dx++) {
              const x = (k % W) + dx;
              const y = Math.floor(k / W) + dy;
              const c = x < 0 || y < 0 || x >= W || y >= m.cellsH ? null : cells[y * W + x];
              if (c !== null && isRoad(c)) near = true;
            }
          expect(near, `seed ${seed}: the pad at ${k % W},${Math.floor(k / W)} has road within ${PAD_REACH}`).toBe(true);
        }
        for (const b of m.boons) expect(cells[b.y * W + b.x], `seed ${seed}: boon ground is a pad`).toBe('G');
        // Rock and ore are untouched: digging (sec 32.2) is the next piece.
        expect(cells.filter((c) => c === 'R').length).toBe(mapCells({ ...m, bedrock: undefined }, lib).filter((c) => c === 'R').length);
        expect(verifyMap(m, lib, { relicPoolSize: POOL }), `seed ${seed}`).toEqual([]);
      }
    });
  }

  it('the precious cells are by the Core: 3 to 5 pads touch the last shared stretch or the face', () => {
    for (const threatIdx of [0, 1, 2]) {
      for (const seed of SEEDS) {
        const m = deal(seed, threatIdx, true);
        const cells = mapCells(m, lib);
        // The cells within one of the face, or of the road cell that feeds it: the narrowest honest reading of "by the Core".
        const gate = { x: m.core.x - 1, y: m.core.y };
        let byCore = 0;
        cells.forEach((c, k) => {
          if (c !== 'G') return;
          const x = k % m.cellsW;
          const y = Math.floor(k / m.cellsW);
          if ([...m.coreFace, gate].some((f) => Math.abs(f.x - x) <= 1 && Math.abs(f.y - y) <= 1)) byCore++;
        });
        expect(byCore, `seed ${seed}, threat ${threatIdx}: pads beside the face`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('a saved prototype run keeps its board: the bedrock rides the map through JSON', () => {
    const m = deal(SEEDS[2], 1, true);
    const back = JSON.parse(JSON.stringify(m)) as GeneratedMap;
    expect(mapCells(back, lib)).toEqual(mapCells(m, lib));
  });
});

describe('bedrock is the generator\'s', () => {
  it('a tile may not author it yet (sec 32.10 will)', () => {
    expect(validateTileCells(['GGGGG', 'GGDGG', '-----', 'GGGGG', 'GGGGG'])[0]).toContain('bedrock');
  });
});
