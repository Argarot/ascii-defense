/**
 * The Scrap flow (session 36, the economy research): what a run EARNS
 * against what there is to BUY. Every sweep before this read the death wave;
 * none read the purse, so nobody could say whether Scrap was scarce, or a
 * currency with nothing left to spend it on.
 *
 * Three plans on the shipped Standard maps: the reference (six towers, fully
 * upgraded - a plan that ENDS), a plan that keeps building (eleven towers),
 * and a plan that builds as many Railbores as the board will take. For each:
 * the Scrap left in hand at the end of waves 5 / 10 / 15 / 20 / 25 after the
 * plan has bought everything it can afford, and the towers standing.
 *
 *   node tools/scrap-flow.mjs [corpus=40]
 */
import { STARTING_SCRAP, THREAT_LEVELS, TileLibrary, createRng, threatKnobs } from '@ascii-defense/engine';
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
const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 40);
/** `--threat=0|1|2`: Calm, Standard (default) or Grim. The constant keeps its name; it is whichever Threat was asked for. */
const STANDARD = THREAT_LEVELS[Number(process.argv.find((a) => a.startsWith('--threat='))?.split('=')[1] ?? 1)];
const RAIL: [number, number, number] = [0, 0, 0];
const P = (towerId: string, choices: [number, number, number], at: TowerPlacement['at'] = 'choke'): TowerPlacement => ({ towerId, choices, at });
const line: TowerPlacement[] = [P('bolt', RAIL), P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)];
/** `--tree`: the whole workshop bought, and the Laser line the balance tables use for it - once as a plan that ends, once as one that goes on. */
const TREE = process.argv.includes('--tree');
const laserLine: TowerPlacement[] = [P('refinery', [0, 0, 0], 'vein'), P('bolt', RAIL), P('laser', [0, 0, 0], 'inline'), P('frost', [1, 0, 1]), P('laser', [0, 0, 0], 'inline'), P('laser', [1, 1, 1], 'inline')];
const PLANS: [string, TowerPlacement[]][] = TREE ? [
  ['the tree: the Laser line - a plan that ENDS', laserLine],
  ['the tree, keeps building: the Laser line, then two more Lasers and four Railbores', [...laserLine, P('laser', [0, 0, 0], 'inline'), P('laser', [0, 0, 0], 'inline'), P('bolt', RAIL), P('bolt', RAIL), P('bolt', RAIL), P('bolt', RAIL)]],
] : [
  ['the reference: a Refinery and five towers, fully upgraded - a plan that ENDS', [P('refinery', [0, 0, 0], 'vein'), ...line]],
  ['keeps building: the reference, then a Frost and four more Railbores (eleven towers)', [P('refinery', [0, 0, 0], 'vein'), ...line, P('frost', [1, 0, 1]), P('bolt', RAIL), P('bolt', RAIL), P('bolt', RAIL), P('bolt', RAIL)]],
  ['never stops: the reference, then twenty-four more Railbores anywhere they fit', [P('refinery', [0, 0, 0], 'vein'), ...line, ...Array.from({ length: 24 }, () => P('bolt', RAIL, 'auto'))]],
];

/** What a plan costs bought outright: every tower and every tier choice it names, at list price. */
function listPrice(plan: TowerPlacement[]): number {
  let sum = 0;
  for (const p of plan) {
    const def = content.towerDefs.find((d) => d.id === p.towerId)!;
    sum += def.cost;
    p.choices.forEach((opt, tier) => { if (opt >= 0) sum += def.tiers?.[tier]?.choices[opt]?.cost ?? 0; });
  }
  return sum;
}

const MARKS = [5, 10, 15, 20, 25];
console.log(`## the Scrap flow - ${STANDARD.name}, the shipped maps, 7x5, 100 Scrap to start, ${N} seeds; Scrap IN HAND at the end of a wave, after the plan bought all it could\n`);
console.log(`| plan | list price | ${MARKS.map((m) => `in hand after wave ${m} (towers)`).join(' | ')} | death wave, mean | WINS (holds ${STANDARD.finalWave}) |`);
console.log(`|---|---|${MARKS.map(() => '---').join('|')}|---|---|`);
/** The second table, printed after the first: what each plan had EARNED by a mark - in hand, plus spent, less the starting purse. */
const earnedRows: string[] = [];
for (const [name, towers] of PLANS) {
  const hand: number[][] = MARKS.map(() => []);
  const earned: number[][] = MARKS.map(() => []);
  const stand: number[][] = MARKS.map(() => []);
  const deaths: number[] = [];
  for (let i = 1; i <= N; i++) {
    const seed = i * 7919 + 13;
    const spec: LabSpec = { seed, map: { width: 7, height: 5, ...threatKnobs(createRng(seed).stream('map'), STANDARD) }, towers, relicIds: [], unlocks: TREE ? ['*'] : [], interWaveTicks: STANDARD.waveSeconds * 20, difficulty: STANDARD.difficulty, maxWaves: 40, economy: { startingScrap: STARTING_SCRAP } };
    try {
      const r = runLab(spec, content);
      deaths.push(r.deathWave ?? 41);
      MARKS.forEach((m, k) => { const row = r.waves.find((w) => w.wave === m); if (row) { hand[k].push(row.scrapEnd); stand[k].push(row.towersEnd); earned[k].push(row.scrapEnd + row.spentEnd - 100); } });
    } catch { /* a seed the carve refuses is no reading */ }
  }
  const mean = (a: number[]): string => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length).toString() : '-');
  const wins = Math.round((100 * deaths.filter((d) => d > STANDARD.finalWave).length) / deaths.length);
  console.log(`| ${name} | ${listPrice(towers)} | ${MARKS.map((_, k) => `${mean(hand[k])} (${mean(stand[k])})`).join(' | ')} | ${(deaths.reduce((a, c) => a + c, 0) / deaths.length).toFixed(1)} | ${wins}% |`);
  earnedRows.push(`| ${name.split(':')[0]} | ${MARKS.map((_, k) => `${mean(earned[k])} (${hand[k].length})`).join(' | ')} |`);
}
console.log(`\n## what the run had EARNED by then - in hand, plus spent, less the 100 it started with; (seeds still alive at that wave)\n`);
console.log(`| plan | ${MARKS.map((m) => `by wave ${m}`).join(' | ')} |`);
console.log(`|---|${MARKS.map(() => '---').join('|')}|`);
for (const r of earnedRows) console.log(r);
