/**
 * The rework's probe (Rework I): named plans of the ONE table (plans.ts) on the
 * app's own maps, with the prototype's switch off and on - a READING, never a
 * tuning (PRD sec 32: nothing is tuned until Daniil has played it).
 *
 *   node tools/rework-probe.mjs [seeds=40] [--threat=1] [--plan=mixedDeep]
 *
 * Rows: the game as it is; pads on, never digging; pads on, a player who digs
 * at every chance (sec 32.2's target: such a run ends about six pads up).
 */
import { THREAT_LEVELS, TileLibrary } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent, type LabSpec } from './lab';
import { PLANS } from './plans';
import { corpusSeed, specFor } from './spec';

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
const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 40);
const threat = THREAT_LEVELS[Number(arg('threat') ?? 1)];
const planName = arg('plan') ?? 'mixedDeep';
const plan = PLANS[planName as keyof typeof PLANS];
if (!plan) throw new Error(`no plan '${planName}' in plans.ts`);

const mean = (xs: readonly number[]): string => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
const ROWS: { name: string; rework?: LabSpec['rework'] }[] = [
  { name: 'the game as it is' },
  { name: 'pads on, never digs', rework: { dig: 'never' } },
  { name: 'pads on, digs at every chance', rework: { dig: 'always' } },
];

console.log(`rework probe - ${threat.name}, plan ${planName}, ${N} of the app's own seeds - a reading, not a tuning`);
console.log('');
console.log('| row | wins | mean death wave of the losses | towers standing at the end | digs ordered | refused |');
console.log('|---|---|---|---|---|---|');
for (const row of ROWS) {
  let wins = 0; let refused = 0; const deaths: number[] = []; const towers: number[] = []; const digs: number[] = [];
  for (let i = 0; i < N; i++) {
    try {
      const rep = runLab({ ...specFor(threat, plan, corpusSeed(i)), rework: row.rework }, content);
      if (rep.result === 'survived') wins++; else deaths.push(rep.deathWave ?? 0);
      towers.push(rep.towersPlaced.filter((p) => p.x >= 0).length);
      digs.push(rep.digs);
    } catch { refused++; }
  }
  console.log(`| ${row.name} | ${Math.round((100 * wins) / Math.max(1, N - refused))}% of ${N - refused} | ${deaths.length ? mean(deaths) : '-'} | ${mean(towers)} | ${mean(digs)} | ${refused} |`);
}
