/**
 * The tutorial's highlight (session 31; Daniil: "a coloured box that
 * pulses changing size a bit to attract attention"): a box-drawn outline
 * around a glyph rectangle on whatever terminal the target lives on, in
 * the tutorial's yellow, one glyph wider on the pulse's other half. Drawn
 * AFTER the terminal's own render, over whatever is there; only the
 * outline's glyphs are touched, so the thing inside stays readable.
 */
import type { TermSurface } from '@ascii-defense/render';
import { role } from '../palette';

export interface GlyphRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** axis: where the pulse grows - both ways on the board, sideways only on a panel whose rows are text (session 31: the box must not eat the prompt). */
export function drawPulseBox(term: TermSurface, r: GlyphRect, phase: number, axis: 'both' | 'x' = 'both'): void {
  const grow = Math.sin(phase * Math.PI * 2) > 0 ? 1 : 0;
  const growY = axis === 'both' ? grow : 0;
  const x0 = r.x - 1 - grow;
  const y0 = r.y - 1 - growY;
  const x1 = r.x + r.w + grow;
  const y1 = r.y + r.h + growY;
  const fg = role('tutorial.box');
  const put = (x: number, y: number, ch: string): void => { if (x >= 0 && y >= 0 && x < term.cols && y < term.rows) term.put(x, y, ch, fg); };
  for (let x = x0 + 1; x < x1; x++) { put(x, y0, '─'); put(x, y1, '─'); }
  for (let y = y0 + 1; y < y1; y++) { put(x0, y, '│'); put(x1, y, '│'); }
  put(x0, y0, '◆'); put(x1, y0, '◆'); put(x0, y1, '◆'); put(x1, y1, '◆');
}
