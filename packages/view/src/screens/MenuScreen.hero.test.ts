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
import gruntJson from '@ascii-defense/content/assets/sprites/enemy_grunt.json';
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
    expect(titleRow).toBeGreaterThanOrEqual(0); // the title is the frame's top band (session 30)
    // Sprite glyphs stand in the rows under the band, two sprites wide.
    let drawn = 0;
    for (let y = titleRow + 1; y < titleRow + CELL_H + 3 && y < lines.length; y++) drawn += lines[y].trim().replace(/[⠀-⣿ │─◆]/g, '').length;
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
    expect(plainTitle).toBeGreaterThan(titleRow); // with a hero the frame is taller, so its band sits higher (session 30)
  });

  // Round of 2026-09-18, item 2 (#382): the new-enemy card drew its 3x2
  // walker in the top-left corner of a cell-sized lighter box.
  it('stands a sprite smaller than a cell CENTRED in its slot, with no ground box of its own', () => {
    const grunt = must(validateSprite.check(gruntJson));
    const [w, h] = grunt.cell;
    expect(w).toBeLessThan(CELL_W);
    const term = new TextTerm({ cols: 120, rows: 50 });
    new MenuScreen().render(term, { title: 'NEW ENEMY: GRUNT', hero: [grunt], body: ['hp 10'], items: [{ id: 'card:ok', label: 'GOT IT' }] });
    // Find the head glyph: the hero is the only '@' on the page.
    let at: { x: number; y: number } | null = null;
    for (let y = 0; y < 50 && !at; y++) for (let x = 0; x < 120; x++) if (term.glyphAt(x, y) === '@') { at = { x, y }; break; }
    expect(at).not.toBeNull();
    // '(@)' is three wide with '@' in the middle: the sprite's left edge is one before it.
    const left = at!.x - 1;
    const top = at!.y;
    // The slot is the page's centre (one hero): the sprite's margins inside the cell differ by at most one glyph.
    const slotLeft = Math.floor((120 - CELL_W) / 2);
    const padL = left - slotLeft;
    const padR = slotLeft + CELL_W - (left + w);
    expect(Math.abs(padL - padR)).toBeLessThanOrEqual(1);
    expect(padL).toBeGreaterThan(0);
    const slotTop = top - Math.floor((CELL_H - h) / 2);
    // No lighter box: every glyph of the slot the sprite does not cover carries the plate's own background.
    const plate = term.bgAt(slotLeft - 3, slotTop);
    for (let r = 0; r < CELL_H; r++) for (let c = 0; c < CELL_W; c++) expect(term.bgAt(slotLeft + c, slotTop + r)).toBe(plate);
  });
});
