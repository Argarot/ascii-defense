/**
 * Run the Scrap flow (session 36, the economy research): bundles
 * harness/src/lab/scrapFlow.ts with esbuild and executes it, like
 * tools/build-sweep.mjs. Prints a markdown table - what a run earns against
 * what there is to buy.
 *
 * Usage: node tools/scrap-flow.mjs [corpus=40]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('node_modules/.cache/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/scrapFlow.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'node_modules/.cache/lab/scrap-flow.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['node_modules/.cache/lab/scrap-flow.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
