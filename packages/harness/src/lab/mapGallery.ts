/**
 * The map gallery (session 36): a Threat's maps drawn as text, one glyph a
 * slot, side by side - because "two runs do not resemble each other" is a
 * claim about what the eye sees, and no column of numbers is the eye. The
 * sweep measures; this is for LOOKING, before and after a change to the
 * carve. Box-drawing for the road's ports, `E` on an entry's slot edge is
 * not drawn (the ports running off the board are the entries), `#` rock
 * land, `o` ore land, `.` plain land, blank for void; the Core is the `@`
 * past the east border.
 *
 *   node tools/map-gallery.mjs [threat=1] [maps=8] [--legacy] [--straight=.. --spread=.. --fresh=..]
 */
import { EDGES, THREAT_LEVELS, TileLibrary, createRng, generateMap, threatKnobs, type Edge } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import { landFamilyOf, walkCharacter } from './walkMetrics';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[] };

const lib = new TileLibrary(libraryJson.tiles);
const nums = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const threat = THREAT_LEVELS[nums[0] ?? 1];
const COUNT = nums[1] ?? 8;
const LEGACY = process.argv.includes('--legacy');
const flag = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const BOX: Record<string, string> = {
  ns: '│', ew: '─', en: '└', es: '┌', nw: '┘', sw: '┐',
  ens: '├', nsw: '┤', enw: '┴', esw: '┬', ensw: '┼',
  n: '╵', s: '╷', e: '╶', w: '╴',
};
const LAND: Record<string, string> = { plain: '.', rock: '#', ore: 'o' };

const rows: string[][] = [];
const captions: string[] = [];
for (let i = 1; i <= COUNT; i++) {
  const seed = i * 7919 + 13;
  const knobs = createRng(seed).stream('map');
  const drawn = threatKnobs(knobs, threat);
  const walk = { straight: flag('straight') ? Number(flag('straight')) : drawn.walk.straight, spread: flag('spread') ? Number(flag('spread')) : drawn.walk.spread, fresh: flag('fresh') ? Number(flag('fresh')) : drawn.walk.fresh };
  // --coverage=x: the board's fill target (D28 ships 0.9) - for SHOWING what a sparser board would look like, not a shipped option.
  const coverage = flag('coverage') ? Number(flag('coverage')) : undefined;
  const opts = LEGACY ? { entries: drawn.entries, targetPathCells: drawn.targetPathCells, coverage } : { ...drawn, walk, coverage };
  const m = generateMap(knobs, lib, { width: 7, height: 5, ...opts, relicPoolSize: 11, specials: [] });
  const c = walkCharacter(m, lib);
  const { width, height } = m.board;
  const rootY = Math.floor((m.core.y) / 5);
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let road = '';
    let land = '';
    for (let x = 0; x < width; x++) {
      const p = m.board.slots[y * width + x];
      if (!p) { road += ' '; land += ' '; continue; }
      const { cells, connectors } = lib.resolved(p.tileId, p.rotation);
      const key = EDGES.filter((e: Edge) => connectors[e]).sort().join('');
      road += key ? (BOX[key] ?? '?') : '·';
      land += LAND[landFamilyOf(cells)];
    }
    lines.push(`${road}${y === rootY ? '@' : ' '}  ${land}`);
  }
  rows.push(lines);
  captions.push(`#${i} e${c.entries} t${c.turnRatio.toFixed(2)} s${c.longestStraight}`.padEnd(17));
}

console.log(`${threat.name}${LEGACY ? ' - LEGACY walk' : ''}: the road (left) and the land beside it (right: . plain, # rock, o ore); e = entries, t = turn ratio, s = longest straight\n`);
const PER_ROW = 4;
for (let at = 0; at < rows.length; at += PER_ROW) {
  const group = rows.slice(at, at + PER_ROW);
  console.log(captions.slice(at, at + PER_ROW).join('   '));
  for (let y = 0; y < group[0].length; y++) console.log(group.map((l) => l[y].padEnd(17)).join('   '));
  console.log('');
}
