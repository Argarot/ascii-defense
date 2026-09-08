/**
 * The map sweep (session 33, the plan's guard for the generator's hundred):
 * every Threat's knobs on the app's own board size, forty seeds each -
 * did the carve reach its coverage, how many entries, how long the lanes,
 * how many tile ids the maps used. A library of a hundred shapes the carve
 * cannot place at coverage, or that all look alike, shows here.
 *
 *   node tools/map-sweep.mjs [seeds=40]
 */
import { TILE_SIZE, TileLibrary, createRng, generateMap } from '@ascii-defense/engine';
import { validateRelics } from '@ascii-defense/content';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[] };

const lib = new TileLibrary(libraryJson.tiles);
const r = validateRelics.check(relicsJson);
const pool = r.ok ? r.value.relics.length : 30;
const THREATS = [{ name: 'Calm', e: [2, 3] as const, bias: 12 }, { name: 'Standard', e: [2, 5] as const, bias: 8 }, { name: 'Grim', e: [3, 6] as const, bias: 5 }];
const N = Number(process.argv[2] ?? 40);
const mean = (a: number[]): string => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-');

console.log(`## the map sweep - ${libraryJson.tiles.length} tiles in the library, ${N} seeds per Threat on the app's 7x5 board\n`);
console.log('| threat | carved | coverage mean (min) | entries mean (min-max) | path floor mean (cells) | tile ids used | failures |');
console.log('|---|---|---|---|---|---|---|');
for (const t of THREATS) {
  const cov: number[] = []; const ents: number[] = []; const lanes: number[] = []; const used = new Set<string>(); let fails = 0;
  for (let i = 1; i <= N; i++) {
    const seed = i * 7919 + 13;
    const knobs = createRng(seed).stream('map');
    const entries = knobs.int(t.e[0], t.e[1]);
    const targetPathCells = (t.bias + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
    try {
      const m = generateMap(knobs, lib, { width: 7, height: 5, entries, targetPathCells, relicPoolSize: pool, specials: [] });
      cov.push(m.coverage); ents.push(m.entries.length); lanes.push(m.pathFloorCells);
      for (const p of m.board.slots) if (p) used.add(p.tileId);
    } catch { fails++; }
  }
  console.log(`| ${t.name} | ${N - fails}/${N} | ${mean(cov)} (${cov.length ? Math.min(...cov).toFixed(2) : '-'}) | ${mean(ents)} (${cov.length ? Math.min(...ents) : '-'}-${cov.length ? Math.max(...ents) : '-'}) | ${mean(lanes)} | ${used.size} | ${fails} |`);
}
