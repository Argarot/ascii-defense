/**
 * Run the mapgen sweep (session 24): bundles harness/src/lab/mapgenSweep.ts
 * with esbuild and executes it, like tools/sweep.mjs. Prints a markdown table.
 *
 * Usage: node tools/mapgen-sweep.mjs [seeds]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('dist/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/mapgenSweep.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/lab/mapgen-sweep.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['dist/lab/mapgen-sweep.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
