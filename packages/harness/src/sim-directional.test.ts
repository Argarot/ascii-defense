/**
 * The sim walks the roads the game actually ships (issue #211, the
 * 2026-09-03 audit): every engine sim fixture is an omni-`X` world - straight,
 * corner, tee and cross all drawn in the one letter that connects to
 * anything - while the shipped library is bends, straights, forks, meanders
 * and bridges, whose ports must FACE for a step to exist. The golden hash
 * pins a world the game never plays, and the bridge's two strands had no
 * sim-level test at all.
 *
 * So: the shipped library, the shipped Threats' own maps, an undefended
 * Core with health to spare, and the one property that matters - EVERY body
 * that spawns walks the whole directional road and reaches the Core. A port
 * that does not face, a strand a walker cannot leave, a lane the flow field
 * routes nowhere: each of them strands a body on the road, and the count
 * comes up short.
 */
import { describe, expect, it } from 'vitest';
import { Sim, THREAT_LEVELS, TileLibrary, createRng, generateMap, mapCells, threatKnobs, type EnemyDef, type TowerDef } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';

const lib = new TileLibrary(libraryJson.tiles);
const WALKER: EnemyDef = { id: 'walker', hp: 10, speed: 0.25, damage: 1 };
const BOLT: TowerDef = { id: 'bolt', cost: 20, range: 6, fireEveryTicks: 10, projectile: { damage: 6, speed: 0.6, homing: true } };
const SPAWNS = 40;

function walkAll(seed: number, threatIdx: number, specials: string[] = [], world: TileLibrary = lib): { breached: number; alive: number; bridges: number; roadLetters: Set<string> } {
  const knobs = createRng(seed).stream('map');
  const map = generateMap(knobs, world, { width: 7, height: 5, ...threatKnobs(knobs, THREAT_LEVELS[threatIdx]), relicPoolSize: 11, specials });
  const cells = mapCells(map, world);
  const sim = new Sim(seed, { cells, cellsW: map.cellsW, cellsH: map.cellsH, map, enemyDefs: [WALKER], towerDefs: [BOLT], spawnEveryTicks: 4, maxSpawns: SPAWNS, coreHp: 1_000_000 });
  // The longest lane on a 7x5 board is well under 200 cells; at a quarter cell a tick, forty bodies four ticks apart are all home long before this.
  for (let t = 0; t < 1400 && (sim.breaches < SPAWNS); t++) sim.tick();
  const letters = new Set<string>();
  for (const c of cells) if (c !== null && !'GROC'.includes(c)) letters.add(c);
  return { breached: sim.breaches, alive: sim.aliveCount(), bridges: cells.filter((c) => c === 'B').length, roadLetters: letters };
}

describe('the sim walks directional roads (issue #211)', () => {
  it('every body that spawns reaches the Core, on every Threat\'s own maps of the shipped library', () => {
    const letters = new Set<string>();
    for (const threatIdx of [0, 1, 2])
      for (let i = 1; i <= 12; i++) {
        const seed = i * 7919 + 13;
        const r = walkAll(seed, threatIdx);
        expect(r.breached, `${THREAT_LEVELS[threatIdx].name} @${seed}: ${r.alive} bodies still on the road`).toBe(SPAWNS);
        for (const l of r.roadLetters) letters.add(l);
      }
    // ...and those maps really were directional: straights and all four bends at least, not an omni world.
    for (const l of ['-', '|', 'L', 'J', 'F', '7']) expect(letters.has(l), `no '${l}' cell on any map - the corpus is not exercising directional road`).toBe(true);
  });

  it('a bridge is walked on both strands: bodies cross it and none turns off the deck into a dead end', () => {
    // The shipped library carries no bridge - a bridge is something a player MINTS in the Tile Smith (the 'B' brush) - so
    // the world here is the shipped library plus the minted bridge the mapgen sweep uses. A loaded special is guaranteed
    // on the map (PRD sec 4.8); its deck and its underpass are separate roads, each joined to the tree by its own arm.
    const BRIDGE = { id: 'sp_bridge', special: true, cells: ['GG|GG', 'GG|GG', '--B--', 'GG|GG', 'GG|GG'] };
    const withBridge = new TileLibrary([...libraryJson.tiles, BRIDGE]);
    let mapsWithBridge = 0;
    for (let i = 1; i <= 10; i++) {
      const seed = i * 7919 + 13;
      let r: ReturnType<typeof walkAll>;
      try { r = walkAll(seed, 1, [BRIDGE.id], withBridge); } catch { continue; } // a loadout no carve hosts is another test's business
      if (r.bridges === 0) continue;
      mapsWithBridge++;
      expect(r.breached, `@${seed}: ${r.alive} bodies stranded on a map with ${r.bridges} bridge cell(s)`).toBe(SPAWNS);
    }
    expect(mapsWithBridge, 'no map in the corpus carried a bridge - the test proved nothing').toBeGreaterThan(0);
  });
});
