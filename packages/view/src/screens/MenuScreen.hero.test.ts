/**
 * The title page as a designed page (session 24, 4.28): a hero row of the
 * towers' own sprites above the title, a caption in the corner, and the
 * items still where the click expects them.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { validateSprite } from '@ascii-defense/content';
import boltJson from '@ascii-defense/content/assets/sprites/bolt.json';
import mortarJson from '@ascii-defense/content/assets/sprites/mortar.json';
import { CELL_H, CELL_W } from '../board/style';
import { MenuScreen, type MenuSpec } from './MenuScreen';

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('sprite invalid');
  return r.value;
}
const SPRITES = [must(validateSprite.check(boltJson)), must(validateSprite.check(mortarJson))];

describe('the title page', () => {
  it('draws the hero sprites above the title, the caption bottom-right, and keeps the items clickable', () => {
    const term = new TextTerm({ cols: 120, rows: 50 });
    const screen = new MenuScreen();
    const spec: MenuSpec = {
      title: 'ASCII DEFENSE',
      hero: SPRITES,
      caption: 'spleen 5x8 - 8x5 glyph cells',
      body: ['the board is a press'],
      items: [{ id: 'new', label: 'NEW RUN' }, { id: 'settings', label: 'SETTINGS' }],
      footer: 'runs played 0',
    };
    screen.render(term, spec);
    const lines = term.toText().split('\n');
    const titleRow = lines.findIndex((l) => l.includes('ASCII DEFENSE'));
    expect(titleRow).toBeGreaterThan(CELL_H); // room for the hero above
    // Sprite glyphs stand in the rows above the title, two sprites wide.
    let drawn = 0;
    for (let y = titleRow - CELL_H - 2; y < titleRow; y++) if (y >= 0) drawn += lines[y].trim().replace(/[⠀-⣿ ]/g, '').length;
    expect(drawn).toBeGreaterThan(CELL_W); // more than a sliver of art
    // The caption sits in the last row, right-aligned.
    expect(lines[49].trimEnd().endsWith('8x5 glyph cells')).toBe(true);
    // Items resolve to their ids at their rendered rows.
    const newRow = lines.findIndex((l) => l.includes('NEW RUN'));
    expect(screen.itemAt(60 * 10, newRow * 16 + 1, 10, 16)).toBe('new');
    // Without a hero the layout is the old one: the title sits near the top of the plate.
    const plain = new TextTerm({ cols: 120, rows: 50 });
    screen.render(plain, { ...spec, hero: undefined });
    const plainTitle = plain.toText().split('\n').findIndex((l) => l.includes('ASCII DEFENSE'));
    expect(plainTitle).toBeLessThan(titleRow);
  });
});
