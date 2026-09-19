/**
 * Run the tail probe (session 36, PR 5): bundles harness/src/lab/tailProbe.ts with
 * esbuild and executes it, like tools/build-sweep.mjs. Prints a markdown
 * table - every early death of the reference build, with the map and the plan that produced it.
 *
 * Usage: node tools/tail-probe.mjs [threat=1] [corpus=60] [below=15]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('node_modules/.cache/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/tailProbe.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'node_modules/.cache/lab/tail-probe.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['node_modules/.cache/lab/tail-probe.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
