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
  boonTier: 1,
  price: [20, 0, 0],
  priceLines: [{ label: 'a tile', purse: 0, ore: 20 }],
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
    expect(text).toContain('20 ore (have 50)');
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

  it('prices a tier-2 vein in tier-2 ore on top, and withholds MINT until that tier is mined (PRD sec 26)', () => {
    const term = new TextTerm({ cols: 140, rows: 60 });
    const screen = new SmithScreen();
    const mintable = (): boolean => { for (let y = 0; y < 60; y++) for (let x = 0; x < 140; x++) if (screen.itemAt(x * 8, y * 8, 8, 8) === 'mint') return true; return false; };
    screen.render(term, state({ price: [20, 15, 0], ore: [50, 0, 0] }));
    expect(term.toText()).toContain('15 tier-2 ore (have 0)');
    expect(term.toText()).toContain('MINT - 20 ore + 15 tier-2 ore');
    expect(mintable()).toBe(false);
    screen.render(term, state({ price: [20, 15, 0], ore: [50, 15, 0] }));
    expect(mintable()).toBe(true);
  });
});

describe('the Smith authors what the price function charges for (PRD sec 27, D31)', () => {
  it('offers a boon tier, B1 to B4, in OVERLAYS - the held one lit', () => {
    const term = new TextTerm({ cols: 140, rows: 60 });
    const screen = new SmithScreen();
    screen.render(term, state({ mode: 'overlay', boonTier: 3 }));
    const ids = new Set<string>();
    for (let y = 0; y < 60; y++) for (let x = 0; x < 140; x++) { const id = screen.itemAt(x * 8, y * 8, 8, 8); if (id) ids.add(id); }
    for (const t of [1, 2, 3, 4]) expect(ids.has(`boontier:${t}`), `B${t}`).toBe(true);
    expect(term.toText()).toContain('boon tier');
  });

  it('itemises the price: every line the function charged is on the page, with its purse', () => {
    const term = new TextTerm({ cols: 140, rows: 60 });
    const screen = new SmithScreen();
    screen.render(term, state({
      price: [68, 13, 0],
      priceLines: [
        { label: 'a tile', purse: 0, ore: 20 }, { label: '5 road cells', purse: 0, ore: 4.5 }, { label: '1 vein, 30 Ore', purse: 0, ore: 6.5 },
        { label: '1 tier-2 boon', purse: 0, ore: 38.7 }, { label: 'tier-2 veins, on top', purse: 1, ore: 13 }, { label: '2 features: x1.15 on each', purse: 0, ore: 0 },
      ],
    }));
    const text = term.toText();
    for (const want of ['5 road cells', '4.5', '1 tier-2 boon', '39', 'tier-2 veins, on top', '13 t2', '2 features: x1.15 on each', 'MINT - 68 ore + 13 tier-2 ore', 'BACK']) expect(text, want).toContain(want);
  });
});
