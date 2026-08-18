/**
 * Terrain styling shared by every surface that draws cells - the game board
 * (BoardView) and the Tile Smith preview. One module so the authoring tool
 * can never drift from what the game draws.
 */
import type { CellType } from '@ascii-defense/engine';
import type { GLTerm } from '@ascii-defense/render';
import { ROAD_PORTS } from '@ascii-defense/engine';
import { role } from '../palette';

export const CELL_W = 5;
export const CELL_H = 3;

export const POOLS: Record<CellType, string> = {
  G: "          .'`,\u2800\u2801\u2802\u2804\u2808\u2810\u2820\u2840\u2880\u2803\u2809",
  X: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  R: '#%@&\u28ff\u287f\u28bf\u28fb\u28fd\u28fe\u28f7$WMB\u28f6\u28ef',
  B: ':;.,=⠉⠒⠤⠶⠛⠿-_~⠐⠠',
  '-': ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  '|': ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  L: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  J: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  F: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  '7': ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  T: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  U: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  E: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  '3': ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  O: '*+.o\u283f\u283e\u283d\u283bO0\u2837',
  C: '\u28ff\u28f7\u28ef@O0\u28f6',
};

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
  term: GLTerm,
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
const WATER_POOL = '~⠒⠂.⠦';

export function drawVoidCell(term: GLTerm, gx0: number, gy0: number, drift = 0, hoverBg?: string): void {
  const dark = role('terrain.water.dark');
  const mid = role('terrain.water.mid');
  const lit = role('terrain.water.lit');
  const bg = hoverBg ?? dark;
  for (let y = 0; y < CELL_H; y++)
    for (let x = 0; x < CELL_W; x++) {
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
