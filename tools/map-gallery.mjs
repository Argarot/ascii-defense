/**
 * Run the map gallery (session 36): bundles harness/src/lab/mapGallery.ts with
 * esbuild and executes it, like tools/build-sweep.mjs. Prints a markdown
 * table - a Threat.s maps drawn as text, for LOOKING at before and after a carve change.
 *
 * Usage: node tools/map-gallery.mjs [threat=1] [maps=8] [--legacy]
 */
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('node_modules/.cache/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/lab/mapGallery.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'node_modules/.cache/lab/map-gallery.mjs',
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, ['node_modules/.cache/lab/map-gallery.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
