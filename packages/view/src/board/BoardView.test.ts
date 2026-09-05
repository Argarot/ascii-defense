/**
 * The board as diffable text (session 22, PR 2): a small hermetic map,
 * towers in several sprite states, an enemy, a cache, a boon, a range disc,
 * rendered into a TextTerm. The golden file is the screen; a rule change is
 * a text diff. This is the net under the geometry migration: the flip to
 * 8x5 must change this file in exactly the way the flip intends.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { TILE_SIZE, TileLibrary, createRng, generateMap, resolveCells } from '@ascii-defense/engine';
import { validateSprite } from '@ascii-defense/content';
import boltJson from '@ascii-defense/content/assets/sprites/bolt.json';
import mortarJson from '@ascii-defense/content/assets/sprites/mortar.json';
import { BoardView, CELL_H, CELL_W, spriteState, type RenderState } from './BoardView';
import { EffectsLayer } from './effects';

const g = (...rows: string[]): string[] => rows;
const LIB = new TileLibrary([
  { id: 'straight', cells: g('GGGGG', 'GGGGG', '-----', 'GGGGG', 'GGGGG') },
  { id: 'corner', cells: g('GGGGG', 'GGGGG', '--7GG', 'GG|GG', 'GG|GG') },
  { id: 'tee', cells: g('GGGGG', 'GGGGG', '--T--', 'GG|GG', 'GG|GG') },
  { id: 'meadow', cells: g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG') },
  { id: 'rocky', cells: g('GGGGG', 'GRRGG', 'GRRGG', 'GGGGG', 'GGGGG') },
  { id: 'ore_patch', cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG') },
]);

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('sprite invalid');
  return r.value;
}
const SPRITES = [must(validateSprite.check(boltJson)), must(validateSprite.check(mortarJson))];

function world() {
  const opts = { width: 4, height: 3, entries: 2, targetPathCells: 15 };
  const map = generateMap(createRng(7).stream('map'), LIB, opts);
  const cells = resolveCells(map.board, LIB);
  const W = opts.width * TILE_SIZE;
  const H = opts.height * TILE_SIZE;
  const term = new TextTerm({ cols: W * CELL_W, rows: H * CELL_H });
  const view = new BoardView(term, LIB, { mapX: opts.width, mapY: opts.height, glyphPxW: 5, glyphPxH: 8, sprites: SPRITES });
  view.setMap(map);
  return { map, cells, W, H, term, view };
}

function firstGround(cells: readonly (string | null)[], W: number, H: number, nth: number): { x: number; y: number } {
  let seen = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cells[y * W + x] === 'G' && seen++ === nth) return { x, y };
  throw new Error('no ground');
}

describe('the board as text', () => {
  it('renders a small map with towers in three sprite states, an enemy, a cache, a boon and a range disc', async () => {
    const { cells, W, H, term, view } = world();
    const a = firstGround(cells, W, H, 0);
    const b = firstGround(cells, W, H, 3);
    const c = firstGround(cells, W, H, 6);
    const d = firstGround(cells, W, H, 9);
    const state: RenderState = {
      hover: null,
      selected: { x: a.x, y: a.y },
      towers: [
        { x: a.x, y: a.y, id: 'bolt', choices: [-1, -1, -1] },
        { x: b.x, y: b.y, id: 'bolt', choices: [0, 1, -1] },
        { x: c.x, y: c.y, id: 'mortar', choices: [1, 0, 1] },
      ],
      enemies: [{ x: 2.5, y: 2.5, id: 'grunt', hp01: 0.5, shielded: true, slowed: false }],
      caches: [{ x: d.x, y: d.y }],
      boons: [{ x: d.x, y: d.y + 1, tier: 2 }],
      range: { x: a.x, y: a.y, r: 3, minR: 1 },
      animMs: 0,
      drift: 0,
      phase: 0,
    };
    view.render(state);
    await expect(term.toText()).toMatchFileSnapshot('__snapshots__/board.golden.txt');
  });

  it('a tower sprite lands at its cell and its state follows its choices', () => {
    const { cells, W, H, term, view } = world();
    const a = firstGround(cells, W, H, 0);
    view.render({ hover: null, selected: null, towers: [{ x: a.x, y: a.y, id: 'bolt', choices: [0, 0, 0] }], animMs: 0, drift: 0 });
    const st = spriteState(SPRITES[0], [0, 0, 0]);
    // Every non-space glyph inside the view's cell is on screen at its spot.
    let checked = 0;
    for (let r = 0; r < Math.min(CELL_H, st.art.length); r++) {
      const row = [...st.art[r]];
      for (let c = 0; c < Math.min(CELL_W, row.length); c++) {
        if (row[c] === ' ') continue;
        expect(term.glyphAt(a.x * CELL_W + c, a.y * CELL_H + r)).toBe(row[c]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('spriteState falls back through prefixes and refuses a sprite with no base', () => {
    const sp = { ...SPRITES[0], states: { '': SPRITES[0].states[''], '0': SPRITES[0].states['0'] } };
    expect(spriteState(sp, [0, 1, 1])).toBe(sp.states['0']); // '011' -> '01' -> '0'
    expect(spriteState(sp, [1, -1, -1])).toBe(sp.states['']); // '1' -> ''
    expect(() => spriteState({ ...sp, states: { '0': sp.states['0'] } }, [1, -1, -1])).toThrow(/base state/);
  });

  it('effects draw over the board without touching its glyph state where they only tint', () => {
    const { view } = world();
    const effects = new EffectsLayer();
    effects.ingest([{ kind: 'breach', x: 3.5, y: 3.5, dmg: 1, seq: 1, tick: 10 }]);
    let painted = 0;
    view.render({ hover: null, selected: null, animMs: 0, drift: 0 }, (t) => {
      const before = t.toText();
      effects.draw(t, 11);
      if (t.toText() === before) painted++; // a breach tints backgrounds only
    });
    expect(painted).toBe(1);
  });
});
