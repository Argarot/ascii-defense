/**
 * Drawing one sprite frame onto any surface (session 24): the board draws
 * towers with it and the strip draws the build buttons with it, so a
 * tower's button IS its board art - no second drawing of the same thing.
 */
import type { TermSurface } from '@ascii-defense/render';
import type { Sprite } from '@ascii-defense/content';
import { role } from '../palette';
import { CELL_H, CELL_W } from './style';

export type SpriteFrame = { art: readonly string[]; ink: readonly string[]; bgInk?: readonly string[] };

export interface DrawSpriteOptions {
  /** Paint every glyph in this role instead of the sprite's own inks (a greyed button). */
  flatFg?: string;
  /** Background for glyphs without a bgInk; default the tower's ground. */
  groundRole?: string;
}

export function drawSpriteFrame(term: TermSurface, sp: Sprite, frame: SpriteFrame, gx0: number, gy0: number, opts: DrawSpriteOptions = {}): void {
  const ground = role(opts.groundRole ?? 'tower.ground');
  const rows = Math.min(CELL_H, frame.art.length);
  for (let r = 0; r < rows; r++) {
    const artRow = [...frame.art[r]];
    const inkRow = [...frame.ink[r]];
    const bgRow = frame.bgInk ? [...frame.bgInk[r]] : null;
    const cols = Math.min(CELL_W, artRow.length);
    for (let c = 0; c < cols; c++) {
      const chr = artRow[c];
      const inkRole = sp.inkMap[inkRow[c]];
      if (chr === ' ' || inkRole === null || inkRole === undefined || !term.has(chr)) continue;
      const rn = inkRole === 'PATH' ? 'tower.core' : inkRole;
      const bgRole = bgRow ? sp.inkMap[bgRow[c]] : undefined;
      const bg = opts.flatFg ? undefined : bgRole === null || bgRole === undefined || bgRole === 'PATH' ? ground : role(bgRole);
      term.put(gx0 + c, gy0 + r, chr, opts.flatFg ? role(opts.flatFg) : role(rn), bg);
    }
  }
}
