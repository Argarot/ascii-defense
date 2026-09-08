/**
 * Run the map sweep (session 33): bundles harness/src/lab/mapSweep.ts with
 * esbuild and executes it, like tools/build-sweep.mjs. Prints a markdown
 * table - the guard for the tile library's breadth.
 *
 * Usage: node tools/map-sweep.mjs [seeds=40]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('dist/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/mapSweep.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/lab/map-sweep.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['dist/lab/map-sweep.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
