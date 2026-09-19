/**
 * Run the rework's probe (Rework I): bundles harness/src/lab/reworkProbe.ts
 * with esbuild and executes it, like tools/map-sweep.mjs. A named plan on the
 * app's own maps with the prototype's switch off and on - a reading, never a
 * tuning.
 *
 * Usage: node tools/rework-probe.mjs [seeds=40] [--threat=1] [--plan=mixedDeep]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('node_modules/.cache/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/reworkProbe.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'node_modules/.cache/lab/rework-probe.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['node_modules/.cache/lab/rework-probe.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
