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
import { STARTING_SCRAP, THREAT_LEVELS, TileLibrary, createRng, generateMap, threatKnobs } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent, type LabSpec } from './lab';
import { PLANS, type Plan } from './plans';

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

// The corpus's players, from the ONE table (plans.ts). Until 2026-09-18 these were the chassis-first reference and
// plain-Bolt width - "the strongest line in the game on the day this was written", which D37 then killed (3% on
// Standard). A seed is "unwinnable" only if the build the Threat is MEANT for cannot win it, and that build is the
// mixed line bought depth first: the chassis-first reference wins Standard 46% where this wins 93%.
/** The build a Threat is meant for: the base world's mixed line, depth first, going on. */
const INTENDED = PLANS.mixedDeep;
/** The same line with no Refinery - for a map whose vein is not worth the Scrap (the tail probe of 2026-09-17: on a map of many fronts the Refinery is the mistake, not the map). */
const NO_VEIN = PLANS.mixedDeepNoVein;
/** The last resort: nothing but Railbores, each finished before the next - the strongest single line the base world has (90% on Standard). */
const RAILS = PLANS.rails;
/** A player who knows nothing: one plain Bolt where the enemies appear, then nothing. */
const NAIVE = PLANS.naive1;

for (const t of THREATS) {
  const threat = THREAT_LEVELS[t];
  for (let i = SHARD; i < N; i += SHARDS) {
    const seed = (i + 1) * 7919 + 13;
    // The APP'S map for this seed (LabSpec.map's `threat` form): a seed listed here is a seed a player can type in.
    const stream = createRng(seed).stream('map');
    const knobs = threatKnobs(stream, threat);
    const base = { seed, map: { width: 7, height: 5, threat }, relicIds: [], unlocks: [], interWaveTicks: threat.waveSeconds * 20, difficulty: threat.difficulty, maxWaves: threat.finalWave, economy: { startingScrap: STARTING_SCRAP } };
    const play = (plan: Plan): number | null | 'refused' => {
      try { return runLab({ ...base, towers: plan.towers, tail: plan.tail } as LabSpec, content).deathWave; } catch { return 'refused'; }
    };
    let attempts = -1;
    try { attempts = generateMap(stream, content.lib, { width: 7, height: 5, ...knobs, relicPoolSize: content.relicDefs.length, specials: [] }).attempts ?? -1; } catch { /* refused */ }
    const intended = play(INTENDED);
    // The second plan is only worth its minutes where the first one lost.
    const noVein = intended === null ? null : play(NO_VEIN);
    const rails = intended === null || noVein === null ? null : play(RAILS);
    console.log(JSON.stringify({ threat: t, seed, scrap: STARTING_SCRAP, entries: knobs.entries, pathCells: knobs.targetPathCells, attempts, intended, noVein, rails, naive: play(NAIVE) }));
  }
}
