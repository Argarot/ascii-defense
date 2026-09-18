/**
 * The seed corpus (session 38; WBS 3.4, target L6): bundles
 * harness/src/lab/seedCorpus.ts once, runs it as parallel shards (a player
 * who keeps buying is slow to play), and prints the report: every seed the
 * intended build cannot win, every seed a know-nothing cannot lose, each
 * with its map's knobs.
 *
 * Usage: node tools/seed-corpus.mjs [seeds=500] [--threat=0|1|2] [--jobs=N]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

const args = process.argv.slice(2);
const jobsArg = args.find((a) => a.startsWith('--jobs='));
const JOBS = jobsArg ? Number(jobsArg.split('=')[1]) : Math.max(1, cpus().length - 2);
const pass = args.filter((a) => !a.startsWith('--jobs='));
const N = Number(pass.find((a) => /^\d+$/.test(a)) ?? 500);

mkdirSync('dist/lab', { recursive: true });
buildSync({ entryPoints: ['packages/harness/src/lab/seedCorpus.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'dist/lab/seed-corpus.mjs', logLevel: 'warning' });

const shard = (k) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['dist/lab/seed-corpus.mjs', ...pass, `--shard=${k}/${JOBS}`], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`shard ${k} exited ${code}`))));
});
const rows = (await Promise.all(Array.from({ length: JOBS }, (_, k) => shard(k)))).join('').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const NAMES = ['Calm', 'Standard', 'Grim'];
const FINAL = [15, 20, 25];
const pct = (a, b) => (b === 0 ? '-' : `${((100 * a) / b).toFixed(1)}%`);
const won = (death) => death === null; // the lab plays to the final wave and no further: no death wave = the run was won
console.log(`# the seed corpus - ${N} seeds per Threat, the app's own maps (7x5), the base world, no relics, 100 Scrap\n`);
console.log('A run is played to the Threat\'s final wave. Three plans, each tried only where the one before lost: the reference going on buying its line; the same line without the Refinery first; plain Bolts at the choke, never upgraded. **Unwinnable** = none of the three holds it. **Trivial** = one plain Bolt by the entry, then nothing, holds it.\n');
for (const t of [...new Set(rows.map((r) => r.threat))].sort()) {
  const mine = rows.filter((r) => r.threat === t).sort((a, b) => a.seed - b.seed);
  const dealt = mine.filter((r) => r.intended !== 'refused');
  const lostFirst = dealt.filter((r) => !won(r.intended));
  const lostBoth = lostFirst.filter((r) => !won(r.gunsFirst));
  const unwinnable = lostBoth.filter((r) => !won(r.boltsWide));
  const trivial = dealt.filter((r) => won(r.naive));
  console.log(`## ${NAMES[t]} - won by holding wave ${FINAL[t]}\n`);
  console.log('| | seeds | share |');
  console.log('|---|---|---|');
  console.log(`| dealt (the carve refused ${mine.length - dealt.length}) | ${dealt.length} | |`);
  console.log(`| the reference, going on, WINS | ${dealt.length - lostFirst.length} | ${pct(dealt.length - lostFirst.length, dealt.length)} |`);
  console.log(`| ...it loses, and the same line WITHOUT the Refinery first wins | ${lostFirst.length - lostBoth.length} | ${pct(lostFirst.length - lostBoth.length, dealt.length)} |`);
  console.log(`| ...both lose, and plain Bolts at the choke, never upgraded, win (a HARD OPENING, not a bad seed) | ${lostBoth.length - unwinnable.length} | ${pct(lostBoth.length - unwinnable.length, dealt.length)} |`);
  console.log(`| **UNWINNABLE for all three** | **${unwinnable.length}** | ${pct(unwinnable.length, dealt.length)} |`);
  console.log(`| **TRIVIAL**: one plain Bolt, then nothing, wins | **${trivial.length}** | ${pct(trivial.length, dealt.length)} |`);
  // L1 (Calm only): the stranger test plays Calm to wave 5 unaided - a seed that kills a know-nothing by then spends a stranger's one first session.
  const earlyDeath = t === 0 ? dealt.filter((r) => typeof r.naive === 'number' && r.naive <= 5) : [];
  if (t === 0) console.log(`| **L1 broken**: one plain Bolt, then nothing, is dead by wave 5 | **${earlyDeath.length}** | ${pct(earlyDeath.length, dealt.length)} |`);
  console.log('');
  const byEntries = new Map();
  for (const r of dealt) { const b = byEntries.get(r.entries) ?? { n: 0, lost: 0, unw: 0, triv: 0 }; b.n++; if (!won(r.intended)) b.lost++; if (!won(r.intended) && !won(r.gunsFirst)) b.unw++; if (won(r.naive)) b.triv++; byEntries.set(r.entries, b); }
  console.log('| entries the map drew | maps | the reference loses | both careful plans lose | trivial |');
  console.log('|---|---|---|---|---|');
  for (const [e, b] of [...byEntries].sort((a, c) => a[0] - c[0])) console.log(`| ${e} | ${b.n} | ${pct(b.lost, b.n)} | ${pct(b.unw, b.n)} | ${pct(b.triv, b.n)} |`);
  console.log('');
  const list = (title, picked) => {
    if (picked.length === 0) return;
    console.log(`### ${title}\n`);
    console.log('| seed | entries | path floor (cells) | carve attempts | reference dies | guns first dies | Bolts wide dies | one plain Bolt dies |');
    console.log('|---|---|---|---|---|---|---|---|');
    const cell = (death, played) => (!played ? '-' : death ?? 'wins');
    for (const r of picked.slice(0, 40)) console.log(`| ${r.seed} | ${r.entries} | ${r.pathCells} | ${r.attempts} | ${r.intended ?? 'wins'} | ${cell(r.gunsFirst, r.intended !== null)} | ${cell(r.boltsWide, r.intended !== null && r.gunsFirst !== null)} | ${r.naive ?? 'wins'} |`);
    if (picked.length > 40) console.log(`\n...and ${picked.length - 40} more.`);
    console.log('');
  };
  list(`${NAMES[t]}: a know-nothing is dead by wave 5 (L1)`, earlyDeath);
  list(`${NAMES[t]}: hard openings - both careful plans lose, Bolts wide wins`, lostBoth.filter((r) => won(r.boltsWide)));
  list(`${NAMES[t]}: unwinnable seeds`, unwinnable);
  list(`${NAMES[t]}: trivial seeds`, trivial);
}
