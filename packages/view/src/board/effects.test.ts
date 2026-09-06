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
  it('a lance pulse has a shape: a front that runs out, a held beam brighter in the middle row, a centre that cools before its glow (2026-09-06, item 3)', () => {
    const lum = (hex: string): number => (parseInt(hex.slice(1, 3), 16) * 0.2126 + parseInt(hex.slice(3, 5), 16) * 0.7152 + parseInt(hex.slice(5, 7), 16) * 0.0722);
    const drawAt = (age01: number): TextTerm => {
      const term = new TextTerm({ cols: 14 * CELL_W, rows: 4 * CELL_H });
      const fx = new EffectsLayer();
      fx.ingest([{ kind: 'beam', x0: 1.5, y0: 1.5, x1: 12.5, y1: 1.5, w: 1, heat: 1, every: 20, seq: 0, tick: 100 }]);
      fx.draw(term, 100 + age01 * 20);
      return term;
    };
    const row = Math.floor(1.5 * CELL_H);
    const near = Math.floor(2.2 * CELL_W);
    const far = Math.floor(12 * CELL_W);
    const untouched = new TextTerm({ cols: 1, rows: 1 }).bgAt(0, 0);
    // The strike: the front has left the lens but not reached the turn.
    const strike = drawAt(0.03);
    expect(strike.bgAt(near, row)).not.toBe(untouched);
    expect(strike.bgAt(far, row)).toBe(untouched);
    // The hold: the whole run lit, the middle row brighter than its afterglow rows.
    const hold = drawAt(0.3);
    expect(hold.bgAt(far, row)).not.toBe(untouched);
    expect(lum(hold.bgAt(near, row))).toBeGreaterThan(lum(hold.bgAt(near, row - 1)));
    expect(lum(hold.bgAt(near, row))).toBeGreaterThan(lum(hold.bgAt(near, row + 1)));
    // The decay: the centre has cooled well below the hold; the glow still shows.
    const late = drawAt(0.9);
    expect(lum(late.bgAt(near, row))).toBeLessThan(lum(hold.bgAt(near, row)) * 0.6);
    expect(late.bgAt(near, row - 1)).not.toBe(untouched);
  });

  it('an effect born at the newest tick waits for the render clock instead of dying (feedback 2026-09-06, item 1)', () => {
    const fx = new EffectsLayer();
    fx.ingest([{ kind: 'impact', x: 3.5, y: 2.5, r: 0, seq: 0, tick: 10 }]);
    // The picture runs a tick behind the sim: nothing shows yet, nothing is lost.
    const before = new TextTerm({ cols: 8 * CELL_W, rows: 4 * CELL_H });
    fx.draw(before, 9.4);
    expect(before.toText()).not.toContain('x');
    expect(fx.alive()).toEqual({ alive: 1, drawn: 0 });
    // The clock reaches the birth tick: the spark is there.
    const after = new TextTerm({ cols: 8 * CELL_W, rows: 4 * CELL_H });
    fx.draw(after, 10.3);
    expect(after.toText()).toContain('x');
    expect(fx.alive()).toEqual({ alive: 1, drawn: 1 });
    // And it expires on its own clock, not the render clock's lag.
    fx.draw(new TextTerm({ cols: 8 * CELL_W, rows: 4 * CELL_H }), 10 + 4 + 0.5);
    expect(fx.alive().alive).toBe(0);
  });

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
