/**
 * The tail probe (session 36, PR 5): the balance-debt sweep found the
 * reference build dying at wave 6 on a few Standard seeds while its median
 * is 25. A mean hides that; this prints every early death with what the map
 * and the plan looked like, so the cause can be named instead of averaged.
 *
 *   node tools/tail-probe.mjs [threat=1] [corpus=60] [below=15]
 */
import { THREAT_LEVELS, TileLibrary, createRng, threatKnobs } from '@ascii-defense/engine';
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
const args = process.argv.slice(2).map(Number);
const threat = THREAT_LEVELS[args[0] ?? 1];
const N = args[1] ?? 60;
const BELOW = args[2] ?? 15;
const RAILBORE: [number, number, number] = [0, 0, 0];
const at = (towerId: string, choices: [number, number, number], where: TowerPlacement['at']): TowerPlacement => ({ towerId, choices, at: where });
const line: TowerPlacement[] = [at('bolt', RAILBORE, 'choke'), at('frost', [1, 0, 1], 'choke'), at('bolt', RAILBORE, 'choke'), at('mortar', [1, 1, 0], 'choke'), at('bolt', RAILBORE, 'choke')];
const PLANS: [string, TowerPlacement[]][] = [
  ['Refinery FIRST, then the line (the reference as the sweeps run it)', [at('refinery', [0, 0, 0], 'vein'), ...line]],
  ['one Bolt, THEN the Refinery, then the line', [line[0], at('refinery', [0, 0, 0], 'vein'), ...line.slice(1)]],
  ['the line, no Refinery at all', line],
];

console.log(`## the tail - ${threat.name}, ${N} seeds, every death before wave ${BELOW}\n`);
console.log('| seed | entries | path floor (cells) | ' + PLANS.map(([n]) => n).join(' | ') + ' |');
console.log('|---|---|---|' + PLANS.map(() => '---').join('|') + '|');
const all: number[][] = PLANS.map(() => []);
/** Deaths of the first plan, by how many entries the map drew: the knob the tail turned out to hang on. */
const byEntries = new Map<number, number[]>();
for (let i = 1; i <= N; i++) {
  const seed = i * 7919 + 13;
  const knobs = threatKnobs(createRng(seed).stream('map'), threat);
  const deaths = PLANS.map(([, towers]) => {
    const spec: LabSpec = { seed, map: { width: 7, height: 5, ...knobs }, towers, relicIds: [], unlocks: [], interWaveTicks: threat.waveSeconds * 20, difficulty: threat.difficulty, maxWaves: 40, economy: { startingScrap: 100 } };
    try { return runLab(spec, content).deathWave ?? 41; } catch { return -1; }
  });
  deaths.forEach((d, k) => { if (d >= 0) all[k].push(d); });
  if (deaths[0] >= 0) byEntries.set(knobs.entries, [...(byEntries.get(knobs.entries) ?? []), deaths[0]]);
  if (deaths[0] >= 0 && deaths[0] < BELOW) console.log(`| ${seed} | ${knobs.entries} | ${knobs.targetPathCells} | ${deaths.join(' | ')} |`);
}
console.log('\n| entries the map drew | maps | mean death | min | WINS |');
console.log('|---|---|---|---|---|');
for (const [n, d] of [...byEntries].sort((a, b) => a[0] - b[0]))
  console.log(`| ${n} | ${d.length} | ${(d.reduce((a, c) => a + c, 0) / d.length).toFixed(1)} | ${Math.min(...d)} | ${Math.round((100 * d.filter((x) => x > threat.finalWave).length) / d.length)}% |`);
console.log('\n| plan | mean | min | holds wave 10 | WINS |');
console.log('|---|---|---|---|---|');
PLANS.forEach(([name], k) => {
  const d = all[k];
  console.log(`| ${name} | ${(d.reduce((a, c) => a + c, 0) / d.length).toFixed(1)} | ${Math.min(...d)} | ${Math.round((100 * d.filter((x) => x > 10).length) / d.length)}% | ${Math.round((100 * d.filter((x) => x > threat.finalWave).length) / d.length)}% |`);
});
