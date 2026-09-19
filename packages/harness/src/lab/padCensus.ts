/**
 * The pad census (PRD sec 32.1, D42; Rework I, PR 1): the rule's targets read
 * over the app's own maps - the two Threat knobs off the front of the map
 * stream, the walk, the land - with the pad rule's knobs laid on top.
 *
 *   node tools/pad-census.mjs [seeds=500] [--per-tile=0.86] [--bias=1.5] [--show=3]
 *
 * The targets, written before the rule was (sec 32.1):
 *   - a 7x5 board opens with 25-35 pads;
 *   - 3-5 of them on the last shared stretch by the Core;
 *   - no lane without a pad in reach of its own road.
 * And what the census adds, because a count hides a bad board: the pads that
 * touch NO road (set-back), the share that touch three road cells or more
 * (the positions worth owning), and how far the worst lane's nearest pad is.
 */
import { PAD_REACH, THREAT_LEVELS, TileLibrary, createRng, dealPads, generateMap, isRoad, mapCells, reworkKnobs, threatKnobs } from '@ascii-defense/engine';
import { validateRelics } from '@ascii-defense/content';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';

declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
declare const process: { argv: string[] };

const lib = new TileLibrary(libraryJson.tiles);
const r = validateRelics.check(relicsJson);
const pool = r.ok ? r.value.relics.length : 30;
const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 500);
const flag = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const over = { ...(flag('per-tile') ? { perTile: Number(flag('per-tile')) } : {}), ...(flag('bias') ? { touchBias: Number(flag('bias')) } : {}) };
const SHOW = Number(flag('show') ?? 0);
const W = 7;
const H = 5;

const pct = (n: number, of: number): string => `${Math.round((100 * n) / Math.max(1, of))}%`;
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const range = (xs: readonly number[]): string => `${Math.min(...xs)}-${Math.max(...xs)}`;

console.log(`pad census - ${N} of the app's own maps a Threat, ${W}x${H} tiles${Object.keys(over).length ? ` - knobs over the Threat's own: ${JSON.stringify(over)}` : ''}`);
console.log('');
console.log('| Threat | knobs | pads a board | in 25-35 | on the shared stretch | in 3-5 | lanes with a pad in reach | set-back pads | pads at a bend or between lanes (5+ road) | what a pad touches: 0 / 1-2 / 3-4 / 5+ | ground before | fails |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');

for (const t of THREAT_LEVELS) {
  const pads: number[] = []; const stretch: number[] = []; const setback: number[] = []; const strong: number[] = []; const groundBefore: number[] = [];
  let lanes = 0; let lanesServed = 0; let fails = 0; let shown = 0;
  // A cell beside a STRAIGHT road touches three road cells; five and up is the inside of a bend, a crossing, or the cell between two lanes.
  const hist = [0, 0, 0, 0];
  const knob = reworkKnobs(t, over).pads;
  for (let i = 1; i <= N; i++) {
    const seed = i * 7919 + 13;
    const knobs = createRng(seed).stream('map');
    try {
      // The map WITHOUT the rule, then the rule on the SAME stream, as the app spends it - the map's last dice. The
      // census calls dealPads itself because it reads the deal (its stretch pads, its lanes), which a map does not carry.
      const m = generateMap(knobs, lib, { width: W, height: H, ...threatKnobs(knobs, t), relicPoolSize: pool, specials: [] });
      const cells = mapCells(m, lib);
      const deal = dealPads(knobs, cells, m.cellsW, m.cellsH, m.entries, m.coreFace, m.boons, W * H, knob);
      pads.push(deal.pads.length);
      stretch.push(deal.stretchPads.length);
      groundBefore.push(cells.filter((c) => c === 'G').length);
      const touches = deal.pads.map((k) => {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = (k % m.cellsW) + dx; const y = Math.floor(k / m.cellsW) + dy;
          const c = x < 0 || y < 0 || x >= m.cellsW || y >= m.cellsH ? null : cells[y * m.cellsW + x];
          if ((dx || dy) && c !== null && isRoad(c)) n++;
        }
        return n;
      });
      setback.push(touches.filter((n) => n === 0).length);
      strong.push(touches.filter((n) => n >= 5).length);
      for (const n of touches) hist[n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3]++;
      lanes += deal.lanePads.length;
      lanesServed += deal.lanePads.filter((l) => l.length > 0).length;
      if (shown < SHOW) {
        shown++;
        const bed = new Set(deal.bedrock);
        console.error(`\n${t.name}, seed ${seed}: ${deal.pads.length} pads (${deal.stretchPads.length} on the stretch), P = pad, . = bedrock, # = rock, o = ore, road as drawn`);
        for (let y = 0; y < m.cellsH; y++) {
          let row = '';
          for (let x = 0; x < m.cellsW; x++) { const c = cells[y * m.cellsW + x]; row += c === null ? ' ' : c === 'G' ? (bed.has(y * m.cellsW + x) ? '.' : 'P') : c === 'R' ? '#' : c === 'O' ? 'o' : c === 'C' ? 'C' : '+'; }
          console.error(row);
        }
      }
    } catch { fails++; }
  }
  const n = pads.length;
  console.log(`| ${t.name} | ${knob.perTile} a tile, bias ${knob.touchBias} | ${mean(pads).toFixed(1)} (${range(pads)}) | ${pct(pads.filter((p) => p >= 25 && p <= 35).length, n)} | ${mean(stretch).toFixed(1)} (${range(stretch)}) | ${pct(stretch.filter((s) => s >= 3 && s <= 5).length, n)} | ${pct(lanesServed, lanes)} of ${lanes} | ${mean(setback).toFixed(1)} | ${mean(strong).toFixed(1)} | ${hist.map((h) => pct(h, hist.reduce((a, b) => a + b, 0))).join(' / ')} | ${mean(groundBefore).toFixed(0)} | ${fails} |`);
}
console.log('');
console.log(`A pad is "in reach" of a lane within ${PAD_REACH} cells (Chebyshev) of the lane's own road - the part before it meets another lane.`);
