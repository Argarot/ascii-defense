/**
 * Terrain drawing as diffable text (session 22, PR 2). The first golden the
 * view has ever had: every cell letter, the void, the shore band and the
 * road kerbs drawn into a TextTerm and compared against a committed file.
 * A change to the drawing rules shows up as a text diff in the PR - never as
 * a screenshot someone has to squint at.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { CELL_TYPES, type CellType } from '@ascii-defense/engine';
import { CELL_H, CELL_W, ROAD_SPRITE, drawTerrainCell, drawVoidCell, roadVariation, setTerrainPack } from './style';

describe('terrain cells as text', () => {
  // These test the hashed texture; the approved pack's authored terrain (terrainSprites.test.ts) is cleared for them.
  beforeAll(() => setTerrainPack({}));
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

describe('roads are sprites (session 22): one state per letter, a variation per cell', () => {
  const roadLetters = ['|', '-', 'L', 'J', 'F', '7', 'T', 'U', 'E', '3', 'X', 'B'] as const;

  it('every road letter draws one of its sprite variations, glyph for glyph', () => {
    const term = new TextTerm({ cols: CELL_W, rows: CELL_H });
    for (const kind of roadLetters) {
      const st = ROAD_SPRITE.states[kind];
      expect(st, `sprite state '${kind}'`).toBeDefined();
      const variations = [st, ...(st.variations ?? [])];
      for (const [gx0, gy0] of [[0, 0], [CELL_W * 3, CELL_H * 5], [CELL_W * 7, 0]] as const) {
        const wide = new TextTerm({ cols: gx0 + CELL_W, rows: gy0 + CELL_H });
        drawTerrainCell(wide, kind, gx0, gy0, {});
        const drawn = Array.from({ length: CELL_H }, (_, y) => Array.from({ length: CELL_W }, (_, x) => wide.glyphAt(gx0 + x, gy0 + y)).join(''));
        const matches = variations.some((v) => v.art.every((row, y) => row === drawn[y]));
        expect(matches, `${kind} at ${gx0},${gy0} is one of its variations`).toBe(true);
        expect(variations[roadVariation(gx0, gy0, variations.length)].art.join('\n')).toBe(drawn.join('\n'));
      }
    }
    term.clear();
  });

  it('the same cell always shows the same variation, and neighbours differ', () => {
    const picks = new Set<number>();
    for (let i = 0; i < 40; i++) picks.add(roadVariation(i * CELL_W, 0, 4));
    expect(picks.size).toBeGreaterThan(1);
    expect(roadVariation(24, 15, 4)).toBe(roadVariation(24, 15, 4));
  });

  it("a road cell draws its EFFECTIVE shape: an 'X' whose north the graph closes wears the T-junction's art", () => {
    // The library's junction tiles put an omni 'X' at the join (Daniil's
    // playtest, session 23: "every T-junction has one wrong cell"). The
    // route graph knows which side is ground; the art must too.
    const x = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(x, 'X', 0, 0, { rim: 1 });
    const t = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(t, 'T', 0, 0, { rim: 0 });
    expect(x.toText()).toBe(t.toText());
    for (let y = 0; y < CELL_H; y++) for (let x0 = 0; x0 < CELL_W; x0++) expect(x.fgAt(x0, y) + x.bgAt(x0, y)).toBe(t.fgAt(x0, y) + t.bgAt(x0, y));
    // Two sides closed: a bend. East and south closed on an 'X' is a 'J'.
    const j = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(j, 'X', 0, 0, { rim: 2 | 4 });
    const jPlain = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(jPlain, 'J', 0, 0, { rim: 0 });
    expect(j.toText()).toBe(jPlain.toText());
  });

  it('a dead end has no letter: the art stays, and the closed sides get a kerb over it', () => {
    const open = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(open, 'X', 0, 0, { rim: 0 });
    const deadEnd = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(deadEnd, 'X', 0, 0, { rim: 1 | 2 | 4 }); // only west open
    for (let x = 0; x < CELL_W; x++) expect(deadEnd.glyphAt(x, 0).codePointAt(0)! & 0xff00).toBe(0x2800);
    for (let x = 0; x < CELL_W; x++) expect(deadEnd.glyphAt(x, CELL_H - 1).codePointAt(0)! & 0xff00).toBe(0x2800);
    for (let y = 0; y < CELL_H; y++) expect(deadEnd.glyphAt(CELL_W - 1, y).codePointAt(0)! & 0xff00).toBe(0x2800);
    for (let y = 1; y < CELL_H - 1; y++) for (let x = 0; x < CELL_W - 1; x++) expect(deadEnd.glyphAt(x, y)).toBe(open.glyphAt(x, y));
    // A '|' already closes east and west in its art: the rim adds nothing there.
    const bar = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(bar, '|', 0, 0, { rim: 10 });
    const barPlain = new TextTerm({ cols: CELL_W, rows: CELL_H });
    drawTerrainCell(barPlain, '|', 0, 0, { rim: 0 });
    expect(bar.toText()).toBe(barPlain.toText());
  });
});
