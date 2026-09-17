/**
 * The map sweep (session 33, the plan's guard for the generator's hundred):
 * every Threat's knobs on the app's own board size, a corpus of seeds each -
 * did the carve reach its coverage, how many entries, how long the lanes,
 * how many tile ids the maps used. A library of a hundred shapes the carve
 * cannot place at coverage, or that all look alike, shows here.
 *
 * Since session 36 (the carve's variety) it also reads what the road LOOKS
 * like: each Threat's walk character - how often it turns, how long it runs
 * straight, how long its lanes are - how much that character varies from
 * map to map, how clumped the land is, and the RESEMBLANCE column: the mean
 * share of slots on which two maps of the Threat carry the same road shape
 * in the same place. `--legacy` reads the generator with no walk options
 * (the engine's default, what every map was before session 36), for the
 * before-and-after.
 *
 *   node tools/map-sweep.mjs [seeds=40] [--legacy]
 */
import { THREAT_LEVELS, TileLibrary, createRng, generateMap, threatKnobs } from '@ascii-defense/engine';
import { validateRelics } from '@ascii-defense/content';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { mean, meanResemblance, sd, walkCharacter, type WalkCharacter } from './walkMetrics';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[] };

const lib = new TileLibrary(libraryJson.tiles);
const r = validateRelics.check(relicsJson);
const pool = r.ok ? r.value.relics.length : 30;
const THREATS = THREAT_LEVELS;
const LEGACY = process.argv.includes('--legacy');
/** `--no-land`: the shipped walk with the land as it was - reads the two changes apart. */
const NO_LAND = process.argv.includes('--no-land');
const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 40);
const f2 = (x: number): string => x.toFixed(2);
/** `--straight=c,s,g --spread=x --fresh=y`: try a walk the Threat table does not ship - how the shipped numbers were found. */
const flag = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const tryStraight = flag('straight')?.split(',').map(Number);
const trySpread = flag('spread') === undefined ? undefined : Number(flag('spread'));
const tryFresh = flag('fresh') === undefined ? undefined : Number(flag('fresh'));
const tryBias = flag('land-bias') === undefined ? undefined : Number(flag('land-bias'));
const tryRegions = flag('land-regions') === undefined ? undefined : Number(flag('land-regions'));

const byThreat: { name: string; maps: WalkCharacter[]; used: Set<string>; fails: number; floors: number[] }[] = [];
for (const t of THREATS) {
  const maps: WalkCharacter[] = []; const used = new Set<string>(); const floors: number[] = []; let fails = 0;
  for (let i = 1; i <= N; i++) {
    const seed = i * 7919 + 13;
    const knobs = createRng(seed).stream('map');
    const drawn = threatKnobs(knobs, t);
    // --legacy: the two knobs the generator has always taken, and nothing else - the walk as it was before session 36.
    const ti = THREATS.indexOf(t);
    const walk = { straight: tryStraight?.[ti] ?? drawn.walk.straight, spread: trySpread ?? drawn.walk.spread, fresh: tryFresh ?? drawn.walk.fresh };
    const opts = LEGACY ? { entries: drawn.entries, targetPathCells: drawn.targetPathCells } : { ...drawn, walk, land: NO_LAND ? undefined : { regions: tryRegions ?? drawn.land.regions, bias: tryBias ?? drawn.land.bias } };
    try {
      const m = generateMap(knobs, lib, { width: 7, height: 5, ...opts, relicPoolSize: pool, specials: [] });
      maps.push(walkCharacter(m, lib)); floors.push(m.pathFloorCells);
      for (const p of m.board.slots) if (p) used.add(p.tileId);
    } catch { fails++; }
  }
  byThreat.push({ name: t.name, maps, used, fails, floors });
}

console.log(`## the map sweep - ${libraryJson.tiles.length} tiles in the library, ${N} seeds per Threat on the app's 7x5 board${LEGACY ? ' - LEGACY walk (no walk options: the generator as it was before session 36)' : ''}\n`);
console.log('| threat | carved | coverage mean (min) | entries mean (min-max; sd) | maps with 5 entries or fewer | maps with a straight run of 4+ slots | path floor mean (cells) | tile ids used | failures |');
console.log('|---|---|---|---|---|---|---|---|---|');
const share = (n: number, of: number): string => (of ? `${Math.round((100 * n) / of)}%` : '-');
for (const t of byThreat) {
  const cov = t.maps.map((m) => m.coverage); const ents = t.maps.map((m) => m.entries);
  // The two map KINDS the eye tells apart at once: a few long winding lanes, and a road that runs in avenues.
  const few = t.maps.filter((m) => m.entries <= 5).length; const avenues = t.maps.filter((m) => m.longestStraight >= 4).length;
  console.log(`| ${t.name} | ${N - t.fails}/${N} | ${f2(mean(cov))} (${cov.length ? f2(Math.min(...cov)) : '-'}) | ${f2(mean(ents))} (${ents.length ? Math.min(...ents) : '-'}-${ents.length ? Math.max(...ents) : '-'}; ${f2(sd(ents))}) | ${share(few, t.maps.length)} | ${share(avenues, t.maps.length)} | ${f2(mean(t.floors))} | ${t.used.size} | ${t.fails} |`);
}

console.log(`\n## the walk's character - what the road looks like, and how much it differs from map to map (the spread is the variety)\n`);
console.log('| threat | lane length, cells: mean (sd) | turn ratio: mean (sd) | longest straight, slots: mean (sd) | junction share | north-south share (sd) | RESEMBLANCE: two maps agree on this share of slots |');
console.log('|---|---|---|---|---|---|---|');
for (const t of byThreat) {
  const col = (pick: (m: WalkCharacter) => number): string => { const a = t.maps.map(pick); return `${f2(mean(a))} (${f2(sd(a))})`; };
  console.log(`| ${t.name} | ${col((m) => m.laneCells)} | ${col((m) => m.turnRatio)} | ${col((m) => m.longestStraight)} | ${f2(mean(t.maps.map((m) => m.junctionShare)))} | ${col((m) => m.verticalShare)} | ${f2(meanResemblance(t.maps))} |`);
}

console.log(`\n## the land - what stands beside the road\n`);
console.log('| threat | plain / rock / ore, share of tiles | adjacent tiles of one family | ...which chance alone would give | ore tiles per map: mean (min-max) |');
console.log('|---|---|---|---|---|');
for (const t of byThreat) {
  const land = (['plain', 'rock', 'ore'] as const).map((k) => mean(t.maps.map((m) => m.land[k])));
  const chance = land.reduce((a, s) => a + s * s, 0);
  const oreTiles = t.maps.map((m) => Math.round(m.land.ore * m.signature.filter((s) => s !== '.').length));
  console.log(`| ${t.name} | ${land.map(f2).join(' / ')} | ${f2(mean(t.maps.map((m) => m.landClumping)))} | ${f2(chance)} | ${f2(mean(oreTiles))} (${Math.min(...oreTiles)}-${Math.max(...oreTiles)}) |`);
}
