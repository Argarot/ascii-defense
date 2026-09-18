/**
 * The fit harness's runner (session 39, D37): bundles harness/src/lab/fit.ts
 * once, plays every (threat, plan) asked for against a PATCH of the game in
 * parallel shards, and prints one table. See fit.ts for the patch format.
 *
 *   node tools/fit.mjs [--patch=file.json] [--seeds=80] [--plans=standard:spam,...] [--jobs=N] [--no-build]
 *
 * With no --plans it reads the ladder's targets (docs/ROADMAP.md, S1-S6): the
 * rungs of every Threat a fit has to keep in view at once.
 */
import { buildSync } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const SEEDS = Number(flag('seeds') ?? 80);
const JOBS = Number(flag('jobs') ?? Math.max(1, cpus().length - 2));
const patchFile = flag('patch');
const patch = patchFile ? readFileSync(patchFile, 'utf8') : '{}';
JSON.parse(patch); // a malformed patch fails here, with the file's name in the trace, not in sixteen shards
const DEFAULT_PLANS = [
  'calm:naive1', 'calm:spam', 'calm:forks', 'calm:reference',
  'standard:spam', 'standard:forks', 'standard:rails', 'standard:reference', 'standard:spamRelics',
  'grim:spam', 'grim:reference', 'grim:referenceRelics', 'grim:treeBase', 'grim:treeLaser', 'grim:treeTesla', 'grim:treeMixed',
];
const PLANS = (flag('plans') ?? DEFAULT_PLANS.join(',')).split(',');

mkdirSync('dist/lab', { recursive: true });
if (!args.includes('--no-build')) buildSync({ entryPoints: ['packages/harness/src/lab/fit.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'dist/lab/fit.mjs', logLevel: 'warning' });

const shard = (k) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['dist/lab/fit.mjs', `--seeds=${SEEDS}`, `--plans=${PLANS.join(',')}`, `--shard=${k}/${JOBS}`], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, FIT_PATCH: patch } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`shard ${k} exited ${code}`))));
});
const started = Date.now();
const runs = (await Promise.all(Array.from({ length: JOBS }, (_, k) => shard(k)))).join('').split('\n').filter(Boolean).map((l) => JSON.parse(l));

console.log(`fit - ${patchFile ?? 'the game as shipped'} - ${SEEDS} seeds a row, the app's own maps and purse -${((Date.now() - started) / 1000).toFixed(0)}s\n`);
console.log('| run | WINS | mean death | holds 5 | holds 10 | holds 15 | towers at the end (median) |');
console.log('|---|---|---|---|---|---|---|');
const pct = (a, b) => `${Math.round((100 * a) / b)}%`;
for (const want of PLANS) {
  const mine = runs.filter((r) => r.run === want && r.death !== 'refused');
  // A row refused on every seed is a broken PLAN, not a reading: say why, in the row (a relic set naming a rare was silently "-" once).
  if (mine.length === 0) { console.log(`| ${want} | REFUSED on every seed: ${runs.find((r) => r.run === want)?.why ?? 'no run came back'} | | | | | |`); continue; }
  const holds = (w) => pct(mine.filter((r) => r.death === null || r.death > w).length, mine.length);
  const mean = mine.reduce((a, r) => a + (r.death ?? r.final + 1), 0) / mine.length;
  const towers = mine.map((r) => r.towers).sort((a, b) => a - b)[Math.floor(mine.length / 2)];
  console.log(`| ${want} | **${pct(mine.filter((r) => r.death === null).length, mine.length)}** | ${mean.toFixed(1)} | ${holds(5)} | ${holds(10)} | ${holds(15)} | ${towers} |`);
}
