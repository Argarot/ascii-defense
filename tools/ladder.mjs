/**
 * The difficulty ladder, read in parallel (session 38): `build-sweep --debt`
 * with one process per table ROW. A player who keeps buying (LabSpec.tail) is
 * slow to play - 120 seeds of one row is minutes on one core, and the ladder
 * has thirty-odd rows.
 *
 * Every rung is a plan of the lab's ONE table (harness/src/lab/plans.ts),
 * bought depth first, on the app's own map for the seed - the same players
 * and the same boards as the fit harness, the balance gate and the seed
 * corpus. What this tool adds to theirs is the PURSE: towers standing and
 * Scrap in hand at the end, beside what the last wave paid.
 *
 * Usage: node tools/ladder.mjs [corpus=120] [--only=calm,standard,grim,tree] [--jobs=N]
 *
 * A Threat at another growth rate is the fit harness's job:
 *        node tools/fit.mjs --patch=candidate.json      with { "threats": { "grim": { "hpGeometric": 1.12 } } }
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

const args = process.argv.slice(2);
const jobsArg = args.find((a) => a.startsWith('--jobs='));
const JOBS = jobsArg ? Number(jobsArg.split('=')[1]) : Math.max(1, cpus().length - 2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const TABLES = onlyArg ? onlyArg.slice(7).split(',') : ['calm', 'standard', 'grim', 'tree'];
const corpus = args.find((a) => /^\d+$/.test(a)) ?? '120';
/** Anything else (`--geo=1.12` for the fit) goes to every row's process as it is. */
const pass = args.filter((a) => a.startsWith('--') && !a.startsWith('--jobs=') && !a.startsWith('--only=') && a !== '--no-build');

mkdirSync('node_modules/.cache/lab', { recursive: true });
// `--no-build`: several reads at once (one per --geo) share the bundle the first of them wrote.
if (!args.includes('--no-build')) buildSync({ entryPoints: ['packages/harness/src/lab/buildSweep.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'node_modules/.cache/lab/build-sweep.mjs', logLevel: 'warning' });

const run = (extra) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['node_modules/.cache/lab/build-sweep.mjs', '--debt', corpus, ...pass, ...extra], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`${extra.join(' ')} exited ${code}`))));
});

// What there is to read, then every row as its own job, at most JOBS at a time.
const jobs = [];
for (const table of TABLES) {
  const rows = Number(await run([`--only=${table}`, '--rows']));
  for (let k = 0; k < rows; k++) jobs.push({ table, k });
}
const lines = new Map();
let next = 0;
const worker = async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    lines.set(`${job.table}:${job.k}`, await run([`--only=${job.table}`, `--row=${job.k}`]));
  }
};
await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, worker));

for (const table of TABLES) {
  console.log(await run([`--only=${table}`, '--row=-1']));
  for (const job of jobs.filter((j) => j.table === table)) console.log(lines.get(`${job.table}:${job.k}`));
  console.log('');
}
