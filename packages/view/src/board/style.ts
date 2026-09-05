/**
 * Terrain styling shared by every surface that draws cells - the game board
 * (BoardView) and the Tile Smith preview. One module so the authoring tool
 * can never drift from what the game draws.
 *
 * The GLYPHS come from content (terrain/appearance.json, playtest 14): the
 * art surface for cells is a file a graphics pack replaces, never code.
 * This module keeps only the drawing RULES - shading, rims, richness, drift.
 */
import { CELL_TYPES, ROAD_PORTS, type CellType } from '@ascii-defense/engine';
import type { TermSurface } from '@ascii-defense/render';
import { validateGrid, validateSprite, validateTerrain } from '@ascii-defense/content';
import terrainJson from '@ascii-defense/content/assets/terrain/appearance.json';
import gridJson from '@ascii-defense/content/assets/grid.json';
import roadJson from '@ascii-defense/content/assets/sprites/road_muted_cobble.json';
import { role } from '../palette';

// The cell geometry is CONTENT (grid.json, D24): the linter checks every
// sprite against the same file, so the view and the art cannot disagree.
const gridResult = validateGrid.check(gridJson);
if (!gridResult.ok) throw new Error('grid.json failed validation: ' + gridResult.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
/** Glyphs per cell: 8 x 5 of the 5 x 8 font = a 40 px square. */
export const CELL_W: number = gridResult.value.cell[0];
export const CELL_H: number = gridResult.value.cell[1];
/** Pixels per glyph - the bitmap font's native size, never scaled fractionally. */
export const GLYPH_PX_W: number = gridResult.value.glyphPx[0];
export const GLYPH_PX_H: number = gridResult.value.glyphPx[1];

const terrainResult = validateTerrain.check(terrainJson);
if (!terrainResult.ok) {
  throw new Error(
    'terrain/appearance.json failed validation: ' +
      terrainResult.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
  );
}
const APPEARANCE = terrainResult.value;
// Every cell letter must have a pool - a pack with missing cells is refused
// at load, the same load-or-explain contract the palette has.
for (const c of CELL_TYPES) {
  if (!APPEARANCE.pools[c]) throw new Error(`terrain appearance missing a glyph pool for cell '${c}'`);
}

export const POOLS = APPEARANCE.pools as Record<CellType, string>;

// The road family (session 22): Daniil's sprites, one state per road letter,
// four static variations each. Load-or-explain like the palette; a road
// letter the sprite lacks falls back to the glyph pool below.
const roadResult = validateSprite.check(roadJson);
if (!roadResult.ok) throw new Error('road sprite failed validation: ' + roadResult.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
export const ROAD_SPRITE = roadResult.value;
/**
 * Port mask -> the road letter with exactly those ports. The bridge is
 * excluded: its union mask is the crossing's, but its art is its own.
 */
const PORT_LETTER: Partial<Record<number, CellType>> = {};
for (const [letter, ports] of Object.entries(ROAD_PORTS) as [CellType, number][]) if (letter !== 'B') PORT_LETTER[ports] = letter;

/** Which of a state's variations a cell shows: the mixing hash of its glyph origin, never dice. */
export function roadVariation(gx0: number, gy0: number, count: number): number {
  return count <= 1 ? 0 : Math.floor(hash2(gx0, gy0, 41) * count) % count;
}

export const TERRAIN_KEY: Record<CellType, string> = {
  G: 'ground',
  X: 'road',
  B: 'road',
  '-': 'road',
  '|': 'road',
  L: 'road',
  J: 'road',
  F: 'road',
  '7': 'road',
  T: 'road',
  U: 'road',
  E: 'road',
  '3': 'road',
  R: 'rock',
  O: 'ore',
  C: 'core',
};

/** Stateless mixing hash for per-glyph texture (ASSETS.md sec 5). */
export function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface TerrainShade {
  /** Ore only: remaining richness 0..1; scales the gold-speck density. */
  richness?: number;
  /** Road only: CLOSED sides as bits N=1 E=2 S=4 W=8 (kerbs).  */
  rim?: number;
  bg?: string;
  /** This cell is the top edge of its terrain mass: light the top glyph row. */
  litTop?: boolean;
  /** Bottom edge of its mass: sink the bottom row toward the background. */
  shadowBottom?: boolean;
  /**
   * Terrain drift step (WBS 4.1): an integer that advances slowly on the
   * WALL clock. A hash-fixed ~18% of glyphs re-roll their pick each step, so
   * the ground breathes without flickering; 0 (or absent) is perfectly
   * static - the reduced-motion path and every non-game surface (Tile Smith
   * passes nothing and stays a still authoring tool).
   */
  drift?: number;
}

/**
 * Draw one cell's 5x3 glyphs of terrain texture at glyph position (gx0, gy0).
 * The hash is keyed on glyph coordinates, so the same cell at the same screen
 * position always textures identically.
 *
 * Boundary shading (ASSETS sec 3): depth comes from shading, never geometry.
 * Consistent light: highlights top, shadow bottom, everywhere.
 */
export function drawTerrainCell(
  term: TermSurface,
  kind: CellType,
  gx0: number,
  gy0: number,
  shade: TerrainShade = {},
): void {
  const pool = POOLS[kind];
  const lit = role(`terrain.${TERRAIN_KEY[kind]}.lit`);
  const mid = role(`terrain.${TERRAIN_KEY[kind]}.mid`);
  const dark = role(`terrain.${TERRAIN_KEY[kind]}.dark`);
  const mix = (h1: string, h2: string, t01: number): string => {
    const p = (h: string, i: number): number => parseInt(h.slice(i, i + 2), 16);
    const c = (i: number): string => Math.round(p(h1, i) + (p(h2, i) - p(h1, i)) * t01).toString(16).padStart(2, '0');
    return '#' + c(1) + c(3) + c(5);
  };
  const bg = shade.bg ?? (kind === 'O' ? mix(role('terrain.rock.dark'), dark, shade.richness ?? 1) : dark);
  // Ore richness scales which glyphs still show GOLD: a rich vein sparkles,
  // a drawn-down one fades toward rock, a spent one has nothing left to say
  // (PRD sec 6 - "where is the money" is answered by looking).
  const rockMid = role('terrain.rock.mid');
  const richness = kind === 'O' ? (shade.richness ?? 1) : 1;
  // Closed-side mask (N=1 E=2 S=4 W=8) comes from the CALLER, which knows the
  // neighbours - the board reads it off the route graph, Tile Smith off the
  // tile. Deriving it here from ROAD_PORTS was the playtest-6 bug: omni 'X'
  // junctions declare all four sides and so were drawn with no kerb at all.
  const rim = ROAD_PORTS[kind] === undefined ? 0 : (shade.rim ?? 0);
  const kerb = role('terrain.rock.lit');
  const drift = shade.drift ?? 0;
  // Roads are SPRITES (session 22): one state per letter, a variation per
  // cell by position hash. The letter's kerbs are baked into the art; the
  // route graph can still close a side the letter leaves open (an 'X' at a
  // dead end, a port facing ground), and THAT side gets the hairline kerb
  // drawn over the sprite - the sim's verdict, not the letter's.
  // The state drawn is the cell's EFFECTIVE shape (session 23 - Daniil's
  // playtest: "every T-junction has one cell with the wrong sprite"): the
  // letter's ports minus the sides the route graph closes. The library's
  // junction tiles carry an omni 'X' at the join and a minted tile's ports
  // are 'X' too; drawn by letter they wore the crossing's art - no kerbs at
  // all - with one braille line over it. Drawn by effective ports, an 'X'
  // with north closed IS a T-junction and wears the T's art. The bridge
  // keeps its own art (two strands, kerbs baked); a dead end (one port) has
  // no letter and keeps the letter's art with the kerb drawn over it.
  const ports = ROAD_PORTS[kind];
  const drawn: CellType = ports === undefined || kind === 'B' ? kind : (PORT_LETTER[ports & ~rim & 15] ?? kind);
  const roadState = ports !== undefined ? ROAD_SPRITE.states[drawn] : undefined;
  if (roadState) {
    const variations = [roadState, ...(roadState.variations ?? [])];
    const v = variations[roadVariation(gx0, gy0, variations.length)];
    for (let y = 0; y < CELL_H; y++) {
      const art = [...v.art[y]];
      const ink = [...v.ink[y]];
      const bgKeys = v.bgInk ? [...v.bgInk[y]] : null;
      for (let x = 0; x < CELL_W; x++) {
        const fgRole = ROAD_SPRITE.inkMap[ink[x]];
        const bgRole = bgKeys ? ROAD_SPRITE.inkMap[bgKeys[x]] : undefined;
        const cellBg = shade.bg ?? (bgRole ? role(bgRole) : dark);
        const ch = art[x];
        term.put(gx0 + x, gy0 + y, ch === ' ' || !fgRole ? ' ' : ch, fgRole ? role(fgRole) : mid, cellBg);
      }
    }
    // Sides the graph closes but the letter opens: kerb them over the art.
    const unexpected = rim & (ROAD_PORTS[drawn] ?? 0);
    if (unexpected !== 0) {
      for (let y = 0; y < CELL_H; y++)
        for (let x = 0; x < CELL_W; x++) {
          let dots = 0;
          if ((unexpected & 1) !== 0 && y === 0) dots |= 0x09;
          if ((unexpected & 4) !== 0 && y === CELL_H - 1) dots |= 0xc0;
          if ((unexpected & 8) !== 0 && x === 0) dots |= 0x47;
          if ((unexpected & 2) !== 0 && x === CELL_W - 1) dots |= 0xb8;
          if (dots !== 0) term.put(gx0 + x, gy0 + y, String.fromCodePoint(0x2800 | dots), kerb, shade.bg ?? dark);
        }
    }
    return;
  }
  for (let y = 0; y < CELL_H; y++)
    for (let x = 0; x < CELL_W; x++) {
      const alive = drift !== 0 && hash2(gx0 + x, gy0 + y, 17) < 0.18;
      const g = pool[Math.floor(hash2(gx0 + x, gy0 + y, alive ? 6 + drift : 6) * pool.length) % pool.length];
      let fg = hash2(gx0 + x, gy0 + y, 9) < 0.2 ? lit : mid;
      if (kind === 'O' && hash2(gx0 + x, gy0 + y, 13) > richness) fg = rockMid;
      if (shade.litTop && y === 0) fg = lit;
      if (shade.shadowBottom && y === CELL_H - 1) fg = dark; // sinks into the bg
      if (rim !== 0) {
        // A kerb, drawn as INK ON THE BOUNDARY rather than as shading
        // (Daniil, playtest 6). Braille packs a 2x4 dot matrix into one
        // 5x8 glyph, so a closed side becomes a hairline against the very
        // edge of the cell: the road keeps its full width and geometry,
        // and the boundary is still unmistakable. Corners simply OR their
        // two edges together, so an L-bend gets an L-shaped kerb.
        let dots = 0;
        if ((rim & 1) !== 0 && y === 0) dots |= 0x09; // top row of dots
        if ((rim & 4) !== 0 && y === CELL_H - 1) dots |= 0xc0; // bottom row
        if ((rim & 8) !== 0 && x === 0) dots |= 0x47; // left column
        if ((rim & 2) !== 0 && x === CELL_W - 1) dots |= 0xb8; // right column
        if (dots !== 0) {
          term.put(gx0 + x, gy0 + y, String.fromCodePoint(0x2800 | dots), kerb, bg);
          continue;
        }
      }
      term.put(gx0 + x, gy0 + y, g, fg, bg);
    }
}

/**
 * Void becomes water (PRD sec 13): sparse ripples on a near-black surface,
 * unmistakably BENEATH the landmass - unclaimed, unreachable, and by
 * construction never carrying road (sec 4.2), so painting here is always
 * safe. The same drift step that stirs the ground moves the ripples; at
 * drift 0 (reduced motion, still surfaces) it is a static texture.
 */
const WATER_POOL = APPEARANCE.waterPool;

/**
 * @param shore bitmask of sides facing LAND (N=1 E=2 S=4 W=8): the coast
 * band (6.6, asked twice). The land-facing edge of a water cell gets a
 * sand fringe - dense grains at the waterline thinning seaward, with an
 * occasional foam ripple in lit water - so the coast reads as a beach
 * rather than a cut. Procedural and safe by construction: border cells
 * never carry road (PRD sec 4.2).
 */
export function drawVoidCell(term: TermSurface, gx0: number, gy0: number, drift = 0, hoverBg?: string, shore = 0): void {
  const dark = role('terrain.water.dark');
  const mid = role('terrain.water.mid');
  const lit = role('terrain.water.lit');
  const sandLit = role('terrain.shore.lit');
  const sandMid = role('terrain.shore.mid');
  const sandBg = role('terrain.shore.dark');
  const SAND_POOL = APPEARANCE.sandPool;
  const bg = hoverBg ?? dark;
  for (let y = 0; y < CELL_H; y++)
    for (let x = 0; x < CELL_W; x++) {
      // Distance from the nearest land-facing edge, in glyphs; Infinity when
      // no side faces land. Row 0 is the waterline of a north-facing shore.
      let edge = Infinity;
      if ((shore & 1) !== 0) edge = Math.min(edge, y);
      if ((shore & 4) !== 0) edge = Math.min(edge, CELL_H - 1 - y);
      if ((shore & 8) !== 0) edge = Math.min(edge, x); // one glyph column reads as one step
      if ((shore & 2) !== 0) edge = Math.min(edge, CELL_W - 1 - x);
      if (edge <= 1) {
        // The beach: grains dense at the waterline, thinning into the water.
        const density = edge === 0 ? 0.8 : 0.25;
        const h = hash2(gx0 + x, gy0 + y, 51);
        if (h < density) {
          const g = SAND_POOL[Math.floor(hash2(gx0 + x, gy0 + y, 53) * SAND_POOL.length) % SAND_POOL.length];
          term.put(gx0 + x, gy0 + y, g, h < density * 0.4 ? sandLit : sandMid, hoverBg ?? sandBg);
          continue;
        }
        // Surf: a rare bright ripple right at the waterline, riding the drift.
        if (edge === 0 && hash2(gx0 + x, gy0 + y, 55 + drift) < 0.12) {
          term.put(gx0 + x, gy0 + y, '~', lit, hoverBg ?? sandBg);
          continue;
        }
        term.put(gx0 + x, gy0 + y, ' ', mid, hoverBg ?? sandBg);
        continue;
      }
      // Ripples re-roll position each step - water moves rather than breathes.
      const h = hash2(gx0 + x, gy0 + y, 27 + drift);
      if (h < 0.1) {
        const g = WATER_POOL[Math.floor(hash2(gx0 + x, gy0 + y, 29 + drift) * WATER_POOL.length) % WATER_POOL.length];
        term.put(gx0 + x, gy0 + y, g, hash2(gx0 + x, gy0 + y, 33) < 0.25 ? lit : mid, bg);
      } else {
        term.put(gx0 + x, gy0 + y, ' ', mid, bg);
      }
    }
}
