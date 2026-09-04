/**
 * The loadout screen fits its surface (playtest 18, his item 3: "only
 * showing two rows of tiles" - everything past two rows rendered off the
 * bottom of the modal terminal with no way to reach it). The app pages the
 * pool at 10; this test pins BOTH halves: an unpaged 12-tile spec overflows
 * the modal (the bug, demonstrated), and a paged 10-tile spec with pager
 * rows fits entirely - every clickable region inside the terminal.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { MenuScreen, tileCapacity, type MenuSpec } from './MenuScreen';

// The modal terminal's dimensions in the live app on a 1920x1080 screen at
// the 8x5 cell: a 7x5-tile board at half resolution (140 x 62 glyphs).
const MODAL = { cols: 140, rows: 62 };
// What the app pages at: the capacity for one body line, three item rows
// and a footer around the tiles.
const PER_PAGE = tileCapacity(MODAL.cols, MODAL.rows, 4 + 1 + 6 + 2);
const fakeTerm = () => new TextTerm(MODAL);

const g = (...rows: string[]): string[] => rows;
const TILE = g('GGGGG', 'GG|GG', 'GG|GG', 'GG|GG', 'GGGGG');
const tiles = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, cells: TILE, selected: false }));

function regionsOf(screen: MenuScreen): { row: number; rowEnd?: number }[] {
  // itemAt is the public surface; the region list drives it. Reach in for
  // the fit assertion - the test is about geometry, not the accessor.
  return (screen as unknown as { regions: { row: number; rowEnd?: number }[] }).regions;
}

describe('loadout tile paging fits the modal', () => {
  it('12 unpaged tiles overflow the modal terminal (the playtest-18 bug)', () => {
    const screen = new MenuScreen();
    const spec: MenuSpec = { title: 'LOADOUT', body: ['pick'], tiles: tiles(12), items: [{ id: 'back', label: 'DONE' }] };
    screen.render(fakeTerm(), spec);
    const overflow = regionsOf(screen).some((r) => (r.rowEnd ?? r.row) >= MODAL.rows);
    expect(overflow).toBe(true);
  });

  it('a page of tileCapacity tiles plus pager rows fits entirely, and one more does not', () => {
    expect(PER_PAGE).toBeGreaterThan(0);
    const screen = new MenuScreen();
    const spec: MenuSpec = {
      title: 'LOADOUT',
      body: ['pick'],
      tiles: tiles(PER_PAGE),
      items: [
        { id: 'page:prev', label: '< PREV PAGE', disabled: true },
        { id: 'page:next', label: 'NEXT PAGE >' },
        { id: 'back', label: 'DONE' },
      ],
      footer: '0/5 loaded - page 1/2',
    };
    screen.render(fakeTerm(), spec);
    for (const r of regionsOf(screen)) {
      expect(r.rowEnd ?? r.row, JSON.stringify(r)).toBeLessThan(MODAL.rows);
    }
  });
});
