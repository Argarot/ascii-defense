/**
 * The board fits the screen (session 22, D24 option 1): how many tile slots
 * a viewport holds beside the HUD, clamped to what the generator is tuned
 * for. Pure, so the arithmetic is tested; the app calls it once at boot.
 *
 * 1920x1080 with a 40 px cell: (1920 - 300 - 24 - 40) / 200 = 7 tiles across
 * (the 40 is the Core strip past the east border, session 24),
 * (1080 - 70) / 200 = 5 down. The old fixed 12x7 board was 2400 px wide at
 * this cell - it no longer fits any screen, which is why the size is
 * derived, not declared.
 */
import { CORE_STRIP, TILE_SIZE } from '@ascii-defense/engine';

export interface BoardSizeOptions {
  /** Glyphs per cell (grid.json) and pixels per glyph (the font). */
  cellW: number;
  cellH: number;
  glyphPxW: number;
  glyphPxH: number;
  /** The HUD's glyph columns and its font scale (2x today). */
  hudCols: number;
  hudScale: number;
}

/** Horizontal chrome: the flex gap plus canvas borders. */
const CHROME_W = 24;
/** Vertical chrome: page padding, the caption line, borders. */
const CHROME_H = 70;
/** The generator is tuned between these; a tinier board would starve the
 *  carve of room for entries, a bigger one is the old 12x7 ceiling. */
export const MIN_SLOTS = { w: 6, h: 4 } as const;
export const MAX_SLOTS = { w: 12, h: 7 } as const;

export function boardSlotsFor(viewportW: number, viewportH: number, o: BoardSizeOptions): { w: number; h: number } {
  const tilePxW = TILE_SIZE * o.cellW * o.glyphPxW;
  const tilePxH = TILE_SIZE * o.cellH * o.glyphPxH;
  const hudPx = o.hudCols * o.glyphPxW * o.hudScale;
  const stripPx = CORE_STRIP * o.cellW * o.glyphPxW;
  const w = Math.floor((viewportW - hudPx - CHROME_W - stripPx) / tilePxW);
  const h = Math.floor((viewportH - CHROME_H) / tilePxH);
  return {
    w: Math.max(MIN_SLOTS.w, Math.min(MAX_SLOTS.w, w)),
    h: Math.max(MIN_SLOTS.h, Math.min(MAX_SLOTS.h, h)),
  };
}
