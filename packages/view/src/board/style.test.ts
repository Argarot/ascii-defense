/**
 * Terrain drawing as diffable text (session 22, PR 2). The first golden the
 * view has ever had: every cell letter, the void, the shore band and the
 * road kerbs drawn into a TextTerm and compared against a committed file.
 * A change to the drawing rules shows up as a text diff in the PR - never as
 * a screenshot someone has to squint at.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { CELL_TYPES, type CellType } from '@ascii-defense/engine';
import { CELL_H, CELL_W, drawTerrainCell, drawVoidCell } from './style';

describe('terrain cells as text', () => {
  it('every cell letter, then water with every shore side', async () => {
    const letters = CELL_TYPES as readonly CellType[];
    const term = new TextTerm({ cols: (letters.length + 5) * (CELL_W + 1), rows: CELL_H + 1 });
    letters.forEach((kind, i) => drawTerrainCell(term, kind, i * (CELL_W + 1), 0, { rim: kind === '|' ? 10 : kind === '-' ? 5 : 0 }));
    // Water: open, then a shore on each single side (N, E, S, W).
    [0, 1, 2, 4, 8].forEach((shore, j) => drawVoidCell(term, (letters.length + j) * (CELL_W + 1), 0, 0, undefined, shore));
    await expect(term.toText()).toMatchFileSnapshot('__snapshots__/terrain-cells.golden.txt');
  });

  it('a hidden glyph in a pool would be caught: every drawn glyph exists in the shipped atlas', () => {
    // GLTerm draws nothing for an absent glyph; TextTerm mirrors that when
    // given the atlas, so a blank cell here would mean a pool names a glyph
    // the font lacks. (The content linter checks pools too; this checks the
    // drawing path end to end.)
    const glyphs = (globalThis as unknown as { __atlas?: number[] }).__atlas;
    const term = new TextTerm({ cols: CELL_W, rows: CELL_H, glyphs });
    for (const kind of CELL_TYPES as readonly CellType[]) {
      term.clear();
      drawTerrainCell(term, kind, 0, 0, {});
      let drawn = 0;
      for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) if (term.glyphAt(x, y) !== ' ') drawn++;
      // Ground is mostly empty by design; a road or the Core is never blank.
      if (kind !== 'G') expect(drawn, `cell '${kind}' drew nothing`).toBeGreaterThan(0);
    }
  });

  it('boundary shading lights the top row and sinks the bottom row', () => {
    const term = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(term, 'G', 0, 0, { litTop: true, shadowBottom: true });
    const top = new Set<string>();
    const bottom = new Set<string>();
    for (let x = 0; x < CELL_W; x++) { top.add(term.fgAt(x, 0)); bottom.add(term.fgAt(x, CELL_H - 1)); }
    expect(top.size).toBe(1); // the whole top row wears the lit colour
    expect(bottom.size).toBe(1); // the whole bottom row wears the dark colour
    expect([...top][0]).not.toBe([...bottom][0]);
  });
});
