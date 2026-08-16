/**
 * Terrain styling shared by every surface that draws cells - the game board
 * (BoardView) and the Tile Smith preview. One module so the authoring tool
 * can never drift from what the game draws.
 */
import type { CellType } from '@ascii-defense/engine';
import type { GLTerm } from '@ascii-defense/render';
import { role } from '../palette';

export const CELL_W = 5;
export const CELL_H = 3;

export const POOLS: Record<CellType, string> = {
  G: "          .'`,\u2800\u2801\u2802\u2804\u2808\u2810\u2820\u2840\u2880\u2803\u2809",
  R: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  K: '#%@&\u28ff\u287f\u28bf\u28fb\u28fd\u28fe\u28f7$WMB\u28f6\u28ef',
  O: '*+.o\u283f\u283e\u283d\u283bO0\u2837',
  C: '\u28ff\u28f7\u28ef@O0\u28f6',
};

export const TERRAIN_KEY: Record<CellType, string> = {
  G: 'ground',
  R: 'road',
  K: 'rock',
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
  bg?: string;
  /** This cell is the top edge of its terrain mass: light the top glyph row. */
  litTop?: boolean;
  /** Bottom edge of its mass: sink the bottom row toward the background. */
  shadowBottom?: boolean;
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
  const bg = shade.bg ?? dark;
  // Ore richness scales which glyphs still show GOLD: a rich vein sparkles,
  // a drawn-down one fades toward rock, a spent one has nothing left to say
  // (PRD sec 6 - "where is the money" is answered by looking).
  const rockMid = role('terrain.rock.mid');
  const richness = kind === 'O' ? (shade.richness ?? 1) : 1;
  for (let y = 0; y < CELL_H; y++)
    for (let x = 0; x < CELL_W; x++) {
      const g = pool[Math.floor(hash2(gx0 + x, gy0 + y, 6) * pool.length) % pool.length];
      let fg = hash2(gx0 + x, gy0 + y, 9) < 0.2 ? lit : mid;
      if (kind === 'O' && hash2(gx0 + x, gy0 + y, 13) > richness) fg = rockMid;
      if (shade.litTop && y === 0) fg = lit;
      if (shade.shadowBottom && y === CELL_H - 1) fg = dark; // sinks into the bg
      term.put(gx0 + x, gy0 + y, g, fg, bg);
    }
}
