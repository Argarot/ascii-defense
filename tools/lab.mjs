/**
 * Run the balance lab CLI: bundles harness/src/lab/cli.ts with esbuild and
 * executes it. No build step to remember, no tsx dependency.
 *
 * Usage: node tools/lab.mjs
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('dist/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/lab/cli.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['dist/lab/cli.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
