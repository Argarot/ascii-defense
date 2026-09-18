/**
 * The balance gate (session 38; WBS 1.5.2 and 3.2): plays a small corpus for
 * every (threat, plan) the committed bands name, in parallel shards, and
 * FAILS - exit 1 - when a measured rate is outside its band.
 *
 *   node tools/balance-check.mjs [--seeds=N] [--jobs=N]
 *
 * The bands live in packages/harness/balance/targets.json. They record what
 * the game IS, target met or not; a band that must move is moved in the PR
 * that moves the game, with the reason in its `why`.
 */
import { buildSync } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const spec = JSON.parse(readFileSync('packages/harness/balance/targets.json', 'utf8'));
const SEEDS = Number(flag('seeds') ?? spec.seeds);
const JOBS = Number(flag('jobs') ?? Math.max(1, cpus().length - 1));
const FINAL = { calm: 15, standard: 20, grim: 25 };

mkdirSync('dist/lab', { recursive: true });
buildSync({ entryPoints: ['packages/harness/src/lab/balanceCheck.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'dist/lab/balance-check.mjs', logLevel: 'warning' });

const plans = [...new Set(spec.bands.map((b) => b.run))].join(',');
const shard = (k) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['dist/lab/balance-check.mjs', `--seeds=${SEEDS}`, `--plans=${plans}`, `--shard=${k}/${JOBS}`], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`shard ${k} exited ${code}`))));
});
const runs = (await Promise.all(Array.from({ length: JOBS }, (_, k) => shard(k)))).join('').split('\n').filter(Boolean).map((l) => JSON.parse(l));

let red = 0;
console.log(`balance check - ${SEEDS} seeds a row, the app's own maps and purse\n`);
console.log('| | band | measured | what | |');
console.log('|---|---|---|---|---|');
for (const band of spec.bands) {
  const mine = runs.filter((r) => r.run === band.run && r.death !== 'refused');
  const [threat] = band.run.split(':');
  if (band.metric === 'death') {
    // The thermometer: the mean death wave of a plan that stops buying, a survivor counted as one past its horizon.
    const mean = mine.reduce((a, r) => a + (r.death ?? r.horizon + 1), 0) / mine.length;
    const ok = mine.length > 0 && mean >= band.min && mean <= band.max;
    if (!ok) red++;
    console.log(`| ${band.id} | wave ${band.min}-${band.max} | **wave ${mean.toFixed(2)}** over ${mine.length} | ${band.run}, mean death | ${ok ? 'ok' : 'OUTSIDE ITS BAND'} |`);
    continue;
  }
  // "holds N": the Core stands when wave N has been fought. "wins" is holds at the Threat's final wave; the lab plays no further, so no death wave is a win.
  const wave = band.metric === 'wins' ? FINAL[threat] : Number(band.metric.split(':')[1]);
  const rate = mine.filter((r) => r.death === null || r.death > wave).length / mine.length;
  const ok = mine.length > 0 && rate >= band.min && rate <= band.max;
  if (!ok) red++;
  console.log(`| ${band.id} | ${Math.round(band.min * 100)}-${Math.round(band.max * 100)}% | **${(rate * 100).toFixed(0)}%** of ${mine.length} | ${band.run}, ${band.metric} | ${ok ? 'ok' : 'OUTSIDE ITS BAND'} |`);
}
console.log(red === 0 ? '\nevery band holds' : `\n${red} band(s) broken - if the game was MEANT to move, move the band in the same PR and say why in its "why"`);
process.exit(red === 0 ? 0 : 1);
