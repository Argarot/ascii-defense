/**
 * The arc as one continuous stroke (feedback 2026-09-05 item 4): every
 * pair of consecutive cells touches, the ends stay put, the bow curves the
 * middle. Plus the strike and the freeze reaching the layer from their
 * events.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import type { StampedSimEvent } from '@ascii-defense/engine';
import { CELL_H, CELL_W } from './style';
import { EffectsLayer, arcPath } from './effects';

describe('arcPath', () => {
  it('walks 8-connected cells from end to end, straight or bowed', () => {
    for (const bow of [0, 2.5, -2.5]) {
      const cells = arcPath(4, 3, 60, 21, bow, 7);
      expect(cells[0]).toEqual([4, 3]);
      expect(cells[cells.length - 1]).toEqual([60, 21]);
      for (let i = 1; i < cells.length; i++) {
        expect(Math.abs(cells[i][0] - cells[i - 1][0])).toBeLessThanOrEqual(1);
        expect(Math.abs(cells[i][1] - cells[i - 1][1])).toBeLessThanOrEqual(1);
      }
      // A bowed arc leaves the straight line somewhere in the middle.
      const mid = cells[Math.floor(cells.length / 2)];
      const straightY = 3 + ((mid[0] - 4) * 18) / 56;
      if (bow !== 0) expect(Math.abs(mid[1] - straightY)).toBeGreaterThan(0.9);
    }
  });
});

describe('the effects layer', () => {
  it('draws an arc as one stroke through every body, a strike as a column, a freeze as a cold frame', () => {
    const term = new TextTerm({ cols: 20 * CELL_W, rows: 8 * CELL_H });
    const fx = new EffectsLayer();
    const events: StampedSimEvent[] = [
      { kind: 'arc', pts: [{ x: 2.5, y: 4.5 }, { x: 9.5, y: 2.5 }, { x: 14.5, y: 5.5 }], seq: 0, tick: 10 },
      { kind: 'strike', x: 17.5, y: 6.5, r: 2, seq: 1, tick: 10 },
      { kind: 'freeze', ticks: 40, seq: 2, tick: 10 },
    ];
    fx.ingest(events);
    fx.draw(term, 11);
    const rows = term.toText().split('\n');
    // The arc: some stroke glyph in every column between the tower and the last body.
    const strokes = new Set(['-', '|', '/', '\\']);
    for (let gx = Math.floor(3 * CELL_W); gx < Math.floor(14 * CELL_W); gx++) {
      const column = rows.map((r) => r[gx] ?? ' ');
      expect(column.some((ch) => strokes.has(ch)), `column ${gx}`).toBe(true);
    }
    // The strike: a column of '|' from the top edge down to the cell.
    const bx = Math.floor(17.5 * CELL_W);
    expect(rows[0][bx]).toBe('|');
    expect(rows[Math.floor(6 * CELL_H)][bx]).toBe('|');
    // The freeze: a sparkle somewhere on the border, and nothing drawn deep inside by it alone.
    expect(rows.some((r, y) => (y < 2 || y >= rows.length - 2) && r.includes('*'))).toBe(true);
  });
});
