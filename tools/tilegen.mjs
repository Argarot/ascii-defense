/**
 * Regenerate the generated half of the tile library (WBS 2.15).
 * Deterministic: same seed, same tiles.
 *
 * Usage: node tools/tilegen.mjs [perSignature=25] [fillers=40] [decorationsPerRoad=2]
 *
 * Session 33 (the plan's "generator's hundred"): every legal ROUTING shape
 * per signature is enumerated (never a special - those are chosen, and the
 * Smith mints them), spread over the turn counts, twenty-five per signature
 * by default, named by family ("Bend III", "Fork II"); ids t_<sig>_<n>.
 * The hand tiles and the old wander's gen_ tiles stay as they are (a save
 * may own one); an enumerated tile the library already names keeps its
 * name and overlays.
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
const { enumerateVariants, enumerateFillers, decorateRoads, canonicalKeyOf, nameByFamily } = await import('../dist/lab/tilegen.mjs');

const perSig = Number(process.argv[2] ?? 25);
const fillers = Number(process.argv[3] ?? 40);
const perBase = Number(process.argv[4] ?? 2);
const routing = nameByFamily(enumerateVariants(20260816, perSig));

const f = 'packages/content/assets/tiles/library.json';
const lib = JSON.parse(readFileSync(f, 'utf8'));
// Everything that is not the enumerator's own (`t_`) stays as it is: the
// hand tiles and the old wander's gen_ tiles, which saves may own.
const mine = (id) => id.startsWith('t_') || id.startsWith('f_') || /r\d+$/.test(id); // enumerated roads, fillers, decorated roads
const hand = lib.tiles.filter((t) => !mine(t.id));
const known = new Map(lib.tiles.filter((t) => mine(t.id)).map((t) => [t.id, t]));
// The land: fillers, and every routing shape (kept or enumerated) decorated with rock and veins.
const roadBases = [...hand.filter((t) => !t.special && t.cells.join('').replace(/[GRO]/g, '').length > 0 && !t.id.startsWith('gen_')), ...routing];
const tiles = [...routing, ...enumerateFillers(20260816, fillers), ...nameByFamily(decorateRoads(20260816, roadBases, perBase))];
// An enumerated tile that duplicates a kept shape (canonically, so
// rotations and mirrors count) would weight that shape twice - drop it.
const handForms = new Set(hand.map((t) => canonicalKeyOf(t.cells)));
const fresh = [];
for (const t of tiles) {
  if (handForms.has(canonicalKeyOf(t.cells))) continue;
  const was = known.get(t.id);
  // What the library already knows about this id stays: its name, its weight, its overlays.
  fresh.push({ ...t, ...(was?.name ? { name: was.name } : {}), ...(was?.weight !== undefined ? { weight: was.weight } : {}), ...(was?.deposits ? { deposits: was.deposits } : {}), ...(was?.boons ? { boons: was.boons } : {}) });
}
lib.tiles = [...hand, ...fresh];
writeFileSync(f, JSON.stringify(lib, null, 2) + '\n');
console.log(`library: ${hand.length} kept + ${fresh.length} generated - ${routing.length} routing shapes, the fillers and the decorated roads (${tiles.length - fresh.length} dropped as twins of a kept shape)`);
