/**
 * The seed corpus (session 38; WBS 3.4, target L6): every seed the build a
 * Threat is meant for CANNOT win, and every seed a player who knows nothing
 * CANNOT lose - listed with the knobs of its map, because a bad seed is a
 * fact about the generator before it is a fact about the curve.
 *
 * One shard of the work: `--shard=k/n` plays the seeds whose index is k mod n
 * and prints one JSON line per seed. tools/seed-corpus.mjs runs the shards in
 * parallel and writes the report - a player who keeps buying (LabSpec.tail)
 * stands thirty towers by the last wave, and five hundred such runs per
 * Threat is an hour on one core.
 *
 *   node tools/seed-corpus.mjs [seeds=500] [--threat=0|1|2]
 */
import { THREAT_LEVELS, TileLibrary, createRng, generateMap, threatKnobs } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent, type LabSpec, type TowerPlacement } from './lab';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[] };

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('content invalid: ' + JSON.stringify(r.errors).slice(0, 200));
  return r.value;
}
const content: LabContent = {
  lib: new TileLibrary(libraryJson.tiles),
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  towerDefs: must(validateTowers.check(towersJson)).towers,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
  tree: must(validateTree.check(treeJson)),
};

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 500);
const [SHARD, SHARDS] = (arg('shard') ?? '0/1').split('/').map(Number);
const THREATS = arg('threat') !== undefined ? [Number(arg('threat'))] : [0, 1, 2];

const RAIL: [number, number, number] = [0, 0, 0];
const PLAIN: [number, number, number] = [-1, -1, -1];
const P = (towerId: string, choices: [number, number, number], at: TowerPlacement['at'] = 'choke'): TowerPlacement => ({ towerId, choices, at });
const LINE: TowerPlacement[] = [P('bolt', RAIL), P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)];
/** The build a Threat is meant for - the base world's reference, going on buying its line (docs/lab: the ladder's top rung on every Threat the base world is meant to win). */
const INTENDED = { towers: [P('refinery', [0, 0, 0], 'vein'), ...LINE], tail: LINE };
/** The same build for a player who looks at the map first: no Refinery before the guns (the tail probe of 2026-09-17 - on a map of many fronts the Refinery is the mistake, not the map). */
const GUNS_FIRST = { towers: LINE, tail: LINE };
/**
 * Plain Bolts at the choke, never upgraded, for as long as Scrap comes. The last resort, and the strongest line in
 * the game on the day this was written (docs/lab/ladder-2026-09-18.md): every seed the two plans above lost, it won.
 */
const BOLTS_WIDE = { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)] };
/** A player who knows nothing: one plain Bolt where the enemies appear, then nothing. */
const NAIVE = { towers: [P('bolt', PLAIN, 'entry')], tail: undefined };

for (const t of THREATS) {
  const threat = THREAT_LEVELS[t];
  for (let i = SHARD; i < N; i += SHARDS) {
    const seed = (i + 1) * 7919 + 13;
    // The APP'S map for this seed (LabSpec.map's `threat` form): a seed listed here is a seed a player can type in.
    const stream = createRng(seed).stream('map');
    const knobs = threatKnobs(stream, threat);
    const base = { seed, map: { width: 7, height: 5, threat }, relicIds: [], unlocks: [], interWaveTicks: threat.waveSeconds * 20, difficulty: threat.difficulty, maxWaves: threat.finalWave, economy: { startingScrap: 100 } };
    const play = (plan: { towers: TowerPlacement[]; tail?: TowerPlacement[] }): number | null | 'refused' => {
      try { return runLab({ ...base, ...plan } as LabSpec, content).deathWave; } catch { return 'refused'; }
    };
    let attempts = -1;
    try { attempts = generateMap(stream, content.lib, { width: 7, height: 5, ...knobs, relicPoolSize: content.relicDefs.length, specials: [] }).attempts ?? -1; } catch { /* refused */ }
    const intended = play(INTENDED);
    // The second plan is only worth its minutes where the first one lost.
    const gunsFirst = intended === null ? null : play(GUNS_FIRST);
    const boltsWide = intended === null || gunsFirst === null ? null : play(BOLTS_WIDE);
    console.log(JSON.stringify({ threat: t, seed, entries: knobs.entries, pathCells: knobs.targetPathCells, attempts, intended, gunsFirst, boltsWide, naive: play(NAIVE) }));
  }
}
