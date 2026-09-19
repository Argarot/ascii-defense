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
import { PLANS, type Plan } from './plans';
import { corpusSeed, specFor } from './spec';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[]; exit: (code: number) => never };

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
const plan: Plan = PLANS[planName as keyof typeof PLANS];
if (!plan) throw new Error(`no plan '${planName}' in plans.ts`);

const mean = (xs: readonly number[]): string => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);

// --clear: the clear bonus's row pair (PRD sec 32.3) - the SAME build, placed at the choke by the Core and placed
// FORWARD by the entries, and what each earns on top of its bounties. The target it is read against is the re-fit's
// (a Core-hugging build about 60% of today's income, a forward one about 160%); this is the reading before any fit.
if (process.argv.includes('--clear')) {
  console.log(`clear bonus - ${threat.name}, plan ${planName}, ${N} of the app's own seeds, pads on, never digs - a reading, not a tuning`);
  console.log('');
  console.log('| the same build, placed | wins | waves cleared a run | bounties a run | clear bonus a run | bonus as a share of bounties | mean seconds to clear / par |');
  console.log('|---|---|---|---|---|---|---|');
  for (const where of ['choke', 'entry'] as const) {
    let wins = 0; let refused = 0; const bounties: number[] = []; const bonus: number[] = []; const cleared: number[] = []; const secs: number[] = []; const pars: number[] = [];
    const at = (p: (typeof plan.towers)[number]): (typeof plan.towers)[number] => (typeof p.at === 'object' || p.at === 'vein' ? p : { ...p, at: where });
    for (let i = 0; i < N; i++) {
      try {
        const rep = runLab({ ...specFor(threat, { ...plan, towers: plan.towers.map(at), tail: plan.tail?.map(at) }, corpusSeed(i)), rework: { dig: 'never' } }, content);
        if (rep.result === 'survived') wins++;
        bounties.push(rep.clears.reduce((a, c) => a + c.bounties, 0));
        bonus.push(rep.clears.reduce((a, c) => a + c.bonus, 0));
        cleared.push(rep.clears.length);
        for (const c of rep.clears) { secs.push(c.seconds); pars.push(c.par); }
      } catch { refused++; }
    }
    const b = Number(mean(bounties)); const x = Number(mean(bonus));
    console.log(`| ${where === 'choke' ? 'at the choke, by the Core' : 'forward, by the entries'} | ${Math.round((100 * wins) / Math.max(1, N - refused))}% of ${N - refused} | ${mean(cleared)} | ${b} | ${x} | ${b > 0 ? Math.round((100 * x) / b) : 0}% | ${mean(secs)} / ${mean(pars)} |`);
  }
  process.exit(0);
}
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
