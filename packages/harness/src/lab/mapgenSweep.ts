/**
 * The mapgen sweep (session 24, WBS 2.30): the app's exact generation loop
 * - seed rerolls and all - over boards, loadouts and seeds, as a table.
 * Born as a one-off probe on 2026-09-04 that turned "the generator
 * struggles with custom tiles" into "five specials fail 30/30 on every
 * small board"; permanent now, because every carve change is judged here.
 *
 * Per board x loadout: failures (a genError the player would see), mean and
 * max seed rerolls, mean generation time, mean road coverage, mean entries,
 * the share of maps within the lane band, and the mean shortest/longest
 * lane ratio in cells.
 *
 * Usage: node tools/mapgen-sweep.mjs [seeds=30]
 */
import { TILE_SIZE, TileLibrary, createRng, generateMap, mapCells, computeFlowField, type GeneratedMap, type TileDef } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';

// The harness has no node types (layer rule): the three globals it uses, declared.
declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[] };
declare const performance: { now(): number };

const g = (...rows: string[]): string[] => rows;
/** Minted-style specials of every road class the Smith can produce. */
const MINTED: TileDef[] = [
  { id: 'sp_road', cells: g('GG|GG', 'GG|GG', 'GG|GG', 'GG|GG', 'GG|GG') },
  { id: 'sp_x', cells: g('GG|GG', 'GG|GG', '--X--', 'GG|GG', 'GG|GG') },
  { id: 'sp_bridge', cells: g('GG|GG', 'GG|GG', '--B--', 'GG|GG', 'GG|GG') },
  { id: 'sp_twin', cells: g('GG|GG', 'GGL7G', '-7GL-', 'GL7GG', 'GG|GG') },
  { id: 'sp_fold', cells: g('GGGGG', 'GF-7G', '-JGL-', 'GGGGG', 'GGGGG') },
  { id: 'sp_vein', cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG'), deposits: [{ x: 1, y: 1, amount: 777 }] },
];
const lib = new TileLibrary([...libraryJson.tiles, ...MINTED]);
/** Standard, as protocol.ts ships it (harness may not import app). */
const T = { entries: [2, 5] as const, pathBias: 8 };

const BOARDS: [number, number][] = [[12, 7], [7, 5], [7, 4], [6, 4]];
const LOADOUTS: [string, string[]][] = [
  ['none', []],
  ['sp_x', ['sp_x']],
  ['sp_bridge', ['sp_bridge']],
  ['sp_twin', ['sp_twin']],
  ['twin_bend', ['twin_bend']],
  ['3 shipped', ['twin_bend', 'gen_ne_4', 'gen_ns_2']],
  ['5 minted', ['sp_twin', 'sp_bridge', 'sp_x', 'sp_fold', 'sp_vein']],
  ['5 shipped', ['twin_bend', 'gen_ne_4', 'gen_ns_2', 'gen_ns_3', 'gen_ne_1']],
];

interface Outcome { ok: boolean; rerolls: number; ms: number; map?: GeneratedMap; err?: string }

function appGen(seed0: number, w: number, h: number, specials: string[]): Outcome {
  let seed = seed0;
  const t0 = performance.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const knobs = createRng(seed).stream('map');
      const entries = knobs.int(T.entries[0], T.entries[1]);
      const targetPathCells = (T.pathBias + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
      const map = generateMap(knobs, lib, { width: w, height: h, entries, targetPathCells, relicPoolSize: 11, specials });
      return { ok: true, rerolls: attempt, ms: performance.now() - t0, map };
    } catch (e) {
      if (attempt >= 60) return { ok: false, rerolls: attempt, ms: performance.now() - t0, err: (e as Error).message.slice(0, 70) };
      seed = (seed + 1) % 1_000_000;
    }
  }
}

function laneRatio(map: GeneratedMap): number {
  const cells = mapCells(map, lib);
  const flow = computeFlowField(cells, map.cellsW, map.cellsH, map.entries);
  const lanes = map.entries.map((e) => flow.dist[e.y * map.cellsW + e.x]);
  return lanes.length > 1 ? Math.min(...lanes) / Math.max(...lanes) : 1;
}

const SEEDS = Number(process.argv[2] ?? 30);
console.log(`mapgen sweep · Standard knobs · ${SEEDS} seeds per cell · the app's reroll loop (60)\n`);
console.log('| board | loadout | fails | rerolls mean/max | ms | coverage | entries | in band | lane ratio | sample error |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [w, h] of BOARDS)
  for (const [name, specials] of LOADOUTS) {
    let fails = 0, sumR = 0, maxR = 0, sumMs = 0, sumCov = 0, sumEnt = 0, inBand = 0, sumRatio = 0, ok = 0;
    let err = '';
    for (let s = 0; s < SEEDS; s++) {
      const r = appGen(1000 + s * 7919, w, h, specials);
      sumR += r.rerolls; maxR = Math.max(maxR, r.rerolls); sumMs += r.ms;
      if (!r.ok || !r.map) { fails++; err = r.err ?? ''; continue; }
      ok++;
      sumCov += r.map.coverage; sumEnt += r.map.entries.length; if (r.map.laneBand > 0) inBand++;
      sumRatio += laneRatio(r.map);
    }
    const n = Math.max(1, ok);
    console.log(`| ${w}x${h} | ${name} | ${fails}/${SEEDS} | ${(sumR / SEEDS).toFixed(1)}/${maxR} | ${(sumMs / SEEDS).toFixed(0)} | ${(sumCov / n).toFixed(2)} | ${(sumEnt / n).toFixed(1)} | ${ok ? Math.round((100 * inBand) / ok) : 0}% | ${(sumRatio / n).toFixed(2)} | ${err} |`);
  }
