/**
 * The menu language (session 30, PR 1): a framed plate with a title band,
 * columns that wrap, links between items, key hints, diamond markers.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { MenuScreen, type MenuSpec, tileCapacity } from './MenuScreen';

describe('the menu language', () => {
  it('frames the plate, puts the title in the top band, lays columns side by side with links, and hints keys in the bottom band', () => {
    const term = new TextTerm({ cols: 120, rows: 50 });
    const screen = new MenuScreen();
    const spec: MenuSpec = {
      title: 'WORKSHOP',
      body: ['banked ore: 40'],
      columns: [
        { heading: 'ARSENAL', items: [{ id: 'node:tesla', label: 'Tesla Coil', note: '20 t1' }, { id: 'node:laser', label: 'Laser Lance', note: 'locked', link: true, disabled: true }] },
        { heading: 'THREAT', items: [{ id: 'node:grim', label: 'Grim', note: 'BOUGHT', selected: true }] },
      ],
      items: [{ id: 'back', label: 'BACK' }],
      keys: [{ key: 'Esc', does: 'back' }],
      phase: 0.3,
    };
    screen.render(term, spec);
    const lines = term.toText().split('\n');
    const bandRow = lines.findIndex((l) => l.includes('┤ WORKSHOP ├'));
    expect(bandRow).toBeGreaterThanOrEqual(0);
    expect(lines[bandRow]).toMatch(/◆.*─.*◆/); // diamond corners on the top edge
    const arsenalRow = lines.findIndex((l) => l.includes('ARSENAL'));
    expect(lines[arsenalRow]).toContain('THREAT'); // side by side
    const teslaRow = lines.findIndex((l) => l.includes('Tesla Coil'));
    expect(lines[teslaRow + 1].trim()).toContain('│'); // the link hangs the Laser from the Tesla
    expect(lines[teslaRow + 2]).toContain('Laser Lance');
    expect(lines[teslaRow]).toContain('◆ Grim ◆'); // the selected row wears diamonds
    const keysRow = lines.findIndex((l) => l.includes('[Esc] back'));
    expect(keysRow).toBeGreaterThan(teslaRow);
    expect(lines[keysRow]).toMatch(/◆.*◆/); // the bottom band's corners
    // Clicks: the Tesla row answers, the disabled Laser does not.
    expect(screen.itemAt((lines[teslaRow].indexOf('Tesla') + 2) * 8, teslaRow * 8, 8, 8)).toBe('node:tesla');
    expect(screen.itemAt((lines[teslaRow + 2].indexOf('Laser') + 2) * 8, (teslaRow + 2) * 8, 8, 8)).toBeNull();
  });

  it('wraps columns into rows when the screen is narrow', () => {
    const term = new TextTerm({ cols: 60, rows: 60 });
    const screen = new MenuScreen();
    const col = (n: number) => ({ heading: `BRANCH ${n}`, items: [{ id: `n${n}`, label: `node number ${n}`, note: '20 t1' }] });
    screen.render(term, { title: 'T', columns: [col(1), col(2), col(3), col(4), col(5)], items: [] });
    const lines = term.toText().split('\n');
    const rows = lines.map((l, i) => (l.includes('BRANCH') ? i : -1)).filter((i) => i >= 0);
    expect(rows.length).toBeGreaterThan(1); // more than one row of columns
    expect(lines.some((l) => l.includes('BRANCH 5'))).toBe(true); // nothing lost
  });
});

describe('the keyboard on a page (session 31)', () => {
  it('reports every clickable id in draw order and lights the cursor row', () => {
    const term = new TextTerm({ cols: 120, rows: 50 });
    const screen = new MenuScreen();
    const spec: MenuSpec = {
      title: 'T',
      tiles: [{ id: 'twin', cells: ['GGGGG', 'GG|GG', 'GG|GG', 'GG|GG', 'GGGGG'], selected: false }],
      columns: [{ heading: 'A', items: [{ id: 'a1', label: 'one' }, { id: 'a2', label: 'two', disabled: true }] }],
      items: [{ id: 'back', label: 'BACK' }],
    };
    screen.render(term, spec);
    expect([...screen.itemIds()]).toEqual(['tile:twin', 'a1', 'back']); // the disabled row is skipped
    screen.render(term, { ...spec, cursor: 'back' });
    const row = term.toText().split('\n').find((l) => l.includes('BACK'))!;
    expect(row.indexOf('>')).toBeGreaterThan(0); // the marker, inside the frame's edge
    expect(row.indexOf('>')).toBeLessThan(row.indexOf('BACK'));
  });
});

describe('mini previews (session 33, PR 8)', () => {
  it('a dozen tiles fit a page at one glyph a cell, each with a region', () => {
    const term = new TextTerm({ cols: 120, rows: 50 });
    const screen = new MenuScreen();
    const tiles = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, cells: ['GGGGG', 'GGRGG', '-----', 'GGOGG', 'GGGGG'], selected: i === 0, badge: i === 1 ? '1/2' : undefined }));
    screen.render(term, { title: 'LOADOUT', tiles, tileScale: 'mini', items: [{ id: 'back', label: 'BACK' }] });
    expect(screen.itemIds().filter((id) => id.startsWith('tile:'))).toHaveLength(12);
    const text = term.toText();
    expect((text.match(/─────/g) ?? []).length).toBeGreaterThanOrEqual(12); // every tile's road, one glyph a cell
    expect(text).toContain('1/2');
    expect(tileCapacity(120, 50, 15, true)).toBeGreaterThanOrEqual(12);
    expect(tileCapacity(120, 50, 15, false)).toBeLessThan(6);
  });
});
