/**
 * Run the pad census (PRD sec 32.1; Rework I, PR 1): bundles
 * harness/src/lab/padCensus.ts with esbuild and executes it, like
 * tools/map-sweep.mjs. Prints a markdown table; --show=N also draws N boards
 * a Threat on stderr.
 *
 * Usage: node tools/pad-census.mjs [seeds=500] [--per-tile=0.86] [--bias=1.5] [--show=3]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('node_modules/.cache/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/padCensus.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'node_modules/.cache/lab/pad-census.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['node_modules/.cache/lab/pad-census.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
