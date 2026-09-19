/**
 * The balance gate's player (session 38; WBS 1.5.2 and 3.2): one shard of a
 * small corpus, every plan the committed bands name, one JSON line per run.
 * tools/balance-check.mjs runs the shards, reads the bands in
 * packages/harness/balance/targets.json and fails outside them.
 *
 * The bands record what the game IS on the day they were set, target met or
 * not - a gate that only knew the wished-for numbers would be red from its
 * first day and teach everyone to ignore it. What it catches is a CHANGE:
 * a curve nudged, a tower re-priced, a generator rule that shortens roads.
 *
 *   node tools/balance-check.mjs [--seeds=N] [--jobs=N]
 */
import { STARTING_SCRAP, THREAT_LEVELS, TileLibrary } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent } from './lab';
import { THREAT_KEYS, planOf } from './plans';

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
const N = Number(arg('seeds') ?? 40);
const [SHARD, SHARDS] = (arg('shard') ?? '0/1').split('/').map(Number);
/** `--plans=calm:naive1,grim:reference`: the (threat, plan) pairs the bands name - nothing else is played. */
const WANTED = (arg('plans') ?? '').split(',').filter(Boolean);

for (const want of WANTED) {
  const [threatKey, planKey] = want.split(':');
  const threat = THREAT_LEVELS[THREAT_KEYS.indexOf(threatKey as (typeof THREAT_KEYS)[number])];
  if (!threat) throw new Error(`unknown threat in '${want}' - threats: ${THREAT_KEYS.join(', ')}`);
  const plan = planOf(planKey);
  for (let i = SHARD; i < N; i += SHARDS) {
    const seed = (i + 1) * 7919 + 13;
    let death: number | null | 'refused';
    try {
      death = runLab({ seed, map: { width: 7, height: 5, threat }, towers: plan.towers, tail: plan.tail, relicIds: [], relics: plan.relics, unlocks: plan.unlocks, interWaveTicks: threat.waveSeconds * 20, difficulty: threat.difficulty, maxWaves: plan.horizon ?? threat.finalWave, economy: { startingScrap: STARTING_SCRAP } }, content).deathWave;
    } catch { death = 'refused'; }
    console.log(JSON.stringify({ run: want, seed, death, horizon: plan.horizon ?? threat.finalWave }));
  }
}
