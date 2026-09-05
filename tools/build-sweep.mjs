/**
 * Run the build sweep (session 24): bundles harness/src/lab/buildSweep.ts with
 * esbuild and executes it, like tools/sweep.mjs. Prints markdown tables.
 *
 * Usage: node tools/build-sweep.mjs [seed ...]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('dist/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/buildSweep.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/lab/build-sweep.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['dist/lab/build-sweep.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
