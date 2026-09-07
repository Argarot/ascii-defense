/**
 * The Tile Smith as a page (session 30, PR 2): the brushes, the tile's
 * cells and the plates answer clicks by id; MINT is a region only when
 * the tile is valid and affordable; the verdict and the price are on
 * screen.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { SmithScreen, type SmithState } from './SmithScreen';

const state = (over: Partial<SmithState> = {}): SmithState => ({
  cells: ['GGGGG', 'GGGGG', '-----', 'GGGGG', 'GGGGG'],
  brush: '-',
  mode: 'cells',
  veinTier: 1,
  veinTierMax: 1,
  deposits: [],
  boons: [],
  connectors: { n: false, e: true, s: false, w: true },
  errors: [],
  id: 'tile_abc',
  price: { tier: 1, ore: 20 },
  ore: [50, 0, 0],
  canUndo: true,
  note: '',
  dev: false,
  phase: 0,
  ...over,
});

describe('the Tile Smith page', () => {
  it('draws the frame, the brushes, the tile and the truth; every plate answers a click', () => {
    const term = new TextTerm({ cols: 140, rows: 60 });
    const screen = new SmithScreen();
    screen.render(term, state());
    const text = term.toText();
    const lines = text.split('\n');
    expect(text).toContain('┤ THE TILE SMITH ├');
    expect(text).toContain('valid - the game would accept this');
    expect(text).toContain('20 tier-1 ore (have 50)');
    expect(text).toContain('connectors: N -  E road  S -  W road');
    // The brush matrix: the '-' brush is a region; so is a cell of the tile; so are MINT and BACK.
    const ids = new Set<string>();
    for (let y = 0; y < lines.length; y++) for (let x = 0; x < 140; x += 1) { const id = screen.itemAt(x * 8, y * 8, 8, 8); if (id) ids.add(id); }
    expect(ids.has('brush:-')).toBe(true);
    expect(ids.has('brush:X')).toBe(true);
    expect(ids.has('brush:C')).toBe(false); // the Core brush hides without ?dev
    expect(ids.has('cell:0,0')).toBe(true);
    expect(ids.has('cell:4,4')).toBe(true);
    expect(ids.has('mint')).toBe(true);
    expect(ids.has('back')).toBe(true);
    expect(ids.has('undo')).toBe(true);
    expect(ids.has('mode:overlay')).toBe(true);
    expect(lines.findIndex((l) => l.includes('THE TILE - as the board draws it'))).toBeGreaterThan(0);
  });

  it('withholds MINT when the tile is invalid or the purse is short, and says why', () => {
    const term = new TextTerm({ cols: 140, rows: 60 });
    const screen = new SmithScreen();
    screen.render(term, state({ errors: ['road E leaves the tile without a partner'], note: 'fix the road' }));
    let ids = new Set<string>();
    for (let y = 0; y < 60; y++) for (let x = 0; x < 140; x++) { const id = screen.itemAt(x * 8, y * 8, 8, 8); if (id) ids.add(id); }
    expect(ids.has('mint')).toBe(false);
    expect(term.toText()).toContain('road E leaves the tile');
    screen.render(term, state({ ore: [5, 0, 0] }));
    ids = new Set<string>();
    for (let y = 0; y < 60; y++) for (let x = 0; x < 140; x++) { const id = screen.itemAt(x * 8, y * 8, 8, 8); if (id) ids.add(id); }
    expect(ids.has('mint')).toBe(false);
    expect(term.toText()).toContain('(have 5)');
  });
});
