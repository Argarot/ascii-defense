/**
 * Run the variant sweep (session 22): bundles harness/src/lab/sweep.ts with
 * esbuild and executes it, like tools/lab.mjs. Prints markdown tables.
 *
 * Usage: node tools/sweep.mjs [seed ...]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('dist/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/sweep.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/lab/sweep.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['dist/lab/sweep.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
