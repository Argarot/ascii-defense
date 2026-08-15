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
  S: '>>:.\u2808\u2818\u2838',
};

export const TERRAIN_KEY: Record<CellType, string> = {
  G: 'ground',
  R: 'road',
  K: 'rock',
  O: 'ore',
  S: 'spawn',
};

/** Stateless mixing hash for per-glyph texture (ASSETS.md sec 5). */
export function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Draw one cell's 5x3 glyphs of terrain texture at glyph position (gx0, gy0).
 * The hash is keyed on glyph coordinates, so the same cell at the same screen
 * position always textures identically.
 */
export function drawTerrainCell(
  term: GLTerm,
  kind: CellType,
  gx0: number,
  gy0: number,
  bgOverride?: string,
): void {
  const pool = POOLS[kind];
  const lit = role(`terrain.${TERRAIN_KEY[kind]}.lit`);
  const mid = role(`terrain.${TERRAIN_KEY[kind]}.mid`);
  const bg = bgOverride ?? role(`terrain.${TERRAIN_KEY[kind]}.dark`);
  for (let y = 0; y < CELL_H; y++)
    for (let x = 0; x < CELL_W; x++) {
      const g = pool[Math.floor(hash2(gx0 + x, gy0 + y, 6) * pool.length) % pool.length];
      term.put(gx0 + x, gy0 + y, g, hash2(gx0 + x, gy0 + y, 9) < 0.2 ? lit : mid, bg);
    }
}
