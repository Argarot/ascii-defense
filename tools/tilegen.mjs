/**
 * Regenerate the generated half of the tile library (WBS 2.15).
 * Deterministic: same seed, same tiles. Hand-authored tiles are untouched;
 * everything with an id starting 'gen_' is replaced wholesale.
 *
 * Usage: node tools/tilegen.mjs [perSignature=4]
 */
import { buildSync } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('dist/lab', { recursive: true });
buildSync({
  entryPoints: ['packages/harness/src/tilegen/generate.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/lab/tilegen.mjs',
  logLevel: 'warning',
});
const { generateVariants } = await import('../dist/lab/tilegen.mjs');

const perSig = Number(process.argv[2] ?? 4);
const tiles = generateVariants(20260816, perSig);

const f = 'packages/content/assets/tiles/library.json';
const lib = JSON.parse(readFileSync(f, 'utf8'));
const hand = lib.tiles.filter((t) => !t.id.startsWith('gen_'));
lib.tiles = [...hand, ...tiles];
writeFileSync(f, JSON.stringify(lib, null, 2) + '\n');
console.log(`library: ${hand.length} authored + ${tiles.length} generated`);
