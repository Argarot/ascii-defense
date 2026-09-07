/**
 * The menu language (session 30, PR 1): a framed plate with a title band,
 * columns that wrap, links between items, key hints, diamond markers.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { MenuScreen, type MenuSpec } from './MenuScreen';

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
