/**
 * Run the price sweep (2026-09-17; PRD sec 27, D31): bundles harness/src/lab/priceSweep.ts with
 * esbuild and executes it, like tools/build-sweep.mjs. Prints a markdown
 * table - what priceTile() charges for the anchors, the dial and the ceiling.
 *
 * Usage: node tools/price-sweep.mjs
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('node_modules/.cache/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/priceSweep.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'node_modules/.cache/lab/price-sweep.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['node_modules/.cache/lab/price-sweep.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
