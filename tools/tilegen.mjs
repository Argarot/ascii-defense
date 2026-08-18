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
const { generateVariants, canonicalKeyOf } = await import('../dist/lab/tilegen.mjs');

const perSig = Number(process.argv[2] ?? 4);
const tiles = generateVariants(20260816, perSig);

const f = 'packages/content/assets/tiles/library.json';
const lib = JSON.parse(readFileSync(f, 'utf8'));
const hand = lib.tiles.filter((t) => !t.id.startsWith('gen_'));
// A generated tile that duplicates a hand-authored shape (canonically, so
// rotations count) would weight that shape twice in the pools - drop it.
const handForms = new Set(hand.map((t) => canonicalKeyOf(t.cells)));
const fresh = tiles.filter((t) => !handForms.has(canonicalKeyOf(t.cells)));
lib.tiles = [...hand, ...fresh];
writeFileSync(f, JSON.stringify(lib, null, 2) + '\n');
console.log(`library: ${hand.length} authored + ${fresh.length} generated (${tiles.length - fresh.length} hand-twin(s) dropped)`);
