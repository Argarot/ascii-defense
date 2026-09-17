/**
 * The carve's variety (session 36): the walk has a character and the land
 * has regions. These are tested as PROPERTIES over a corpus, never as
 * numbers - the numbers are the map sweep's, and they will move the next
 * time the library grows; what must not move is which way they point.
 *
 * Small corpora on purpose (the full reading is `node tools/map-sweep.mjs`).
 */
import { describe, expect, it } from 'vitest';
import { MAP_LAND, THREAT_LEVELS, TileLibrary, createRng, generateMap, threatKnobs, type MapGenOptions } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import { landFamilyOf, mean, walkCharacter, type WalkCharacter } from './walkMetrics';

const lib = new TileLibrary(libraryJson.tiles);
const [CALM, STANDARD, GRIM] = THREAT_LEVELS;
const SEEDS = Array.from({ length: 40 }, (_, i) => (i + 1) * 7919 + 13);

/** A Standard board with Standard's knobs for the seed, and whatever walk / land the test asks for - so only the thing under test differs. */
function deal(seed: number, extra: Partial<MapGenOptions>): WalkCharacter {
  const knobs = createRng(seed).stream('map');
  const { entries, targetPathCells } = threatKnobs(knobs, STANDARD);
  return walkCharacter(generateMap(knobs, lib, { width: 7, height: 5, entries, targetPathCells, relicPoolSize: 11, specials: [], ...extra }), lib);
}

describe('the walk has a character (session 36)', () => {
  it('no walk and no land asked for: the map is the map it always was, to the last die', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const a = createRng(seed).stream('map');
      const b = createRng(seed).stream('map');
      const opts = { width: 7, height: 5, entries: 3, targetPathCells: 40, relicPoolSize: 11 };
      expect(generateMap(a, lib, opts)).toEqual(generateMap(b, lib, { ...opts, walk: undefined, land: undefined }));
      // ...and the stream is left in the same state, so everything dealt after the map is the same too.
      expect(a.state()).toEqual(b.state());
    }
  });

  it('Calm walks in avenues and Grim in knots, on the same boards', () => {
    const gentle = SEEDS.map((s) => deal(s, { walk: CALM.walk }));
    const knotted = SEEDS.map((s) => deal(s, { walk: GRIM.walk }));
    expect(mean(gentle.map((m) => m.turnRatio))).toBeLessThan(mean(knotted.map((m) => m.turnRatio)));
    expect(mean(gentle.map((m) => m.longestStraight))).toBeGreaterThan(mean(knotted.map((m) => m.longestStraight)));
  });

  it('a character is a taste, never a rule: every map of every Threat still passes the generator\'s own verification', () => {
    // generateMap runs verifyMap on what it returns and throws on a violation; a walk that broke a topology rule could not get here.
    for (const threat of THREAT_LEVELS)
      for (const seed of SEEDS) {
        const knobs = createRng(seed).stream('map');
        expect(() => generateMap(knobs, lib, { width: 7, height: 5, ...threatKnobs(knobs, threat), relicPoolSize: 11, specials: [] }), `${threat.name} @${seed}`).not.toThrow();
      }
  });

  it('is the seed\'s: the same seed and the same Threat deal the same map', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const once = (): unknown => { const k = createRng(seed).stream('map'); return generateMap(k, lib, { width: 7, height: 5, ...threatKnobs(k, STANDARD), relicPoolSize: 11, specials: [] }); };
      expect(once()).toEqual(once());
    }
  });

  it('Standard has no taste of its own and the widest roll - it is the Threat whose maps differ by the walk', () => {
    expect(STANDARD.walk.straight).toBe(1);
    expect(STANDARD.walk.spread).toBeGreaterThan(CALM.walk.spread);
    expect(STANDARD.walk.spread).toBeGreaterThan(GRIM.walk.spread);
    // Calm's whole range is gentle and Grim's whole range is knotted: a roll never turns one into the other.
    expect(CALM.walk.straight / CALM.walk.spread).toBeGreaterThan(1);
    expect(GRIM.walk.straight * GRIM.walk.spread).toBeLessThan(1);
  });
});

describe('the land has regions (session 36)', () => {
  const scattered = SEEDS.map((s) => deal(s, {}));
  const grouped = SEEDS.map((s) => deal(s, { land: MAP_LAND }));

  it('adjacent tiles match clearly more often than salt and pepper', () => {
    expect(mean(grouped.map((m) => m.landClumping))).toBeGreaterThan(mean(scattered.map((m) => m.landClumping)) + 0.08);
  });

  it('moves WHERE the land sits far more than how much of each there is - the ore economy was priced on the ore share', () => {
    const shift = (family: 'plain' | 'rock' | 'ore'): number => Math.abs(mean(grouped.map((m) => m.land[family])) - mean(scattered.map((m) => m.land[family])));
    // Ore is the one the ladder's numbers rest on (docs/lab/ore-sweep-2026-09-17.md): held tight.
    expect(shift('ore')).toBeLessThan(0.05);
    // Three regions of three families pull the mix a little toward thirds (the library is rock-heavy: 0.29 / 0.40 / 0.32); a few points, not a re-deal.
    expect(shift('plain')).toBeLessThan(0.09);
    expect(shift('rock')).toBeLessThan(0.09);
  });

  it('the Core\'s own region is never rock: the ground by the Core is where every tower has its gift, and rock cannot be built on', () => {
    // The root slot - east border, the Core's row - leans toward its region's family like any slot. With the rule its
    // tile is rock far less often than a tile anywhere (rock is the commonest family: about 0.37 of all tiles).
    const rockAtRoot = (extra: Partial<MapGenOptions>): number => {
      let rock = 0;
      for (const seed of SEEDS) {
        const knobs = createRng(seed).stream('map');
        const { entries, targetPathCells } = threatKnobs(knobs, STANDARD);
        const m = generateMap(knobs, lib, { width: 7, height: 5, entries, targetPathCells, relicPoolSize: 11, specials: [], ...extra });
        const root = m.board.slots[Math.floor(m.core.y / 5) * 7 + 6]!;
        if (landFamilyOf(lib.resolved(root.tileId, root.rotation).cells) === 'rock') rock++;
      }
      return rock / SEEDS.length;
    };
    expect(rockAtRoot({ land: MAP_LAND })).toBeLessThan(0.2);
    expect(rockAtRoot({ land: MAP_LAND })).toBeLessThan(rockAtRoot({}));
  });

  it('never leaves a map without ore: three regions, three families, each present', () => {
    for (const m of grouped) expect(m.land.ore).toBeGreaterThan(0);
    expect(MAP_LAND.regions).toBeGreaterThanOrEqual(3);
  });
});
