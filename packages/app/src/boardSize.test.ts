import { describe, expect, it } from 'vitest';
import { MAX_SLOTS, MIN_SLOTS, boardSlotsFor } from './boardSize';

const G = { cellW: 8, cellH: 5, glyphPxW: 5, glyphPxH: 8, hudCols: 30, hudScale: 2 };

describe('the board fits the screen (D24, option 1)', () => {
  it('a 1920x1080 desktop holds 7x5 tiles beside the HUD at a 40 px cell', () => {
    expect(boardSlotsFor(1920, 1080, G)).toEqual({ w: 7, h: 4 }); // 5 before the strip took 132 px
  });

  it('a 1920x1200 screen gains a row; 2560x1440 gains columns', () => {
    expect(boardSlotsFor(1920, 1200, G)).toEqual({ w: 7, h: 4 });
    expect(boardSlotsFor(2560, 1440, G)).toEqual({ w: 10, h: 6 }); // 11 before the Core strip took 40 px
  });

  it('never below the generator floor, never above the old 12x7 ceiling', () => {
    expect(boardSlotsFor(800, 600, G)).toEqual({ w: MIN_SLOTS.w, h: MIN_SLOTS.h });
    expect(boardSlotsFor(5000, 3000, G)).toEqual({ w: MAX_SLOTS.w, h: MAX_SLOTS.h });
  });

  it('the old 5x3 cell on the old screen gives the old 12x7 board - the formula is not new, the cell is', () => {
    expect(boardSlotsFor(1920, 1200, { ...G, cellW: 5, cellH: 3 })).toEqual({ w: 12, h: 7 });
  });
});
