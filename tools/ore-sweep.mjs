/**
 * Run the ore sweep (2026-09-17; PRD sec 26, D30): bundles harness/src/lab/oreSweep.ts with
 * esbuild and executes it, like tools/build-sweep.mjs. Prints a markdown
 * table - the ladder.s spawn, vein and income numbers.
 *
 * Usage: node tools/ore-sweep.mjs [seeds=400]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('dist/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/oreSweep.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/lab/ore-sweep.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['dist/lab/ore-sweep.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
