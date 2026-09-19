/**
 * Every first-meeting banner the game can produce FITS (D41): its line
 * wraps into the rows the side panel gives it with no word left over, and
 * its title fits the plate. A sentence that does not fit is a lie by
 * omission (CONTRIBUTING sec 5) - and the first tower banner looked at in
 * the running game was one.
 */
import { describe, expect, it } from 'vitest';
import { CODEX } from './generated/codex';
import { BOON_NOTICE_LINE, CHEST_NOTICE_LINE, NOTICE_ROWS, enemyNoticeLine, towerNoticeLine } from './notices';

/** The side panel's width in glyphs (main.ts HUD_COLS). */
const W = 30;

/** Greedy word wrap, the way HudPanel.wrap fills a row - without its cut, so an overflow shows as an extra row. */
function rows(text: string): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line !== '' && (line + ' ' + word).length > W) { out.push(line); line = word; }
    else line = line === '' ? word : line + ' ' + word;
  }
  if (line !== '') out.push(line);
  return out;
}

describe('first-meeting banners (D41)', () => {
  const lines: [string, string][] = [
    ...CODEX.enemies.map((e): [string, string] => [`NEW: ${e.name.toUpperCase()}`, enemyNoticeLine(e)]),
    ...CODEX.towers.map((c): [string, string] => [`YOUR FIRST ${c.name.toUpperCase()}`, towerNoticeLine(c)]),
    ['A CHEST SURFACED', CHEST_NOTICE_LINE],
    ['BOON GROUND', BOON_NOTICE_LINE],
  ];

  it('covers every enemy and every tower the codex knows', () => {
    expect(lines.length).toBe(CODEX.enemies.length + CODEX.towers.length + 2);
    expect(CODEX.enemies.length).toBeGreaterThan(10);
  });

  it.each(lines)('%s: the line is whole in the rows the panel gives it', (_title, line) => {
    expect(line.length).toBeGreaterThan(0);
    expect(rows(line).length, `"${line}" wraps to ${rows(line).length} rows`).toBeLessThanOrEqual(NOTICE_ROWS);
    for (const word of line.split(' ')) expect(word.length).toBeLessThanOrEqual(W);
  });

  it.each(lines)('%s: the title fits the plate even with three more waiting behind it', (title) => {
    // HudPanel.button pads one glyph on the left and cuts at the panel's width.
    expect(` ${title} (+3)`.length).toBeLessThanOrEqual(W);
  });

  it('a tower says its first sentence, never a cut one', () => {
    for (const c of CODEX.towers) {
      const line = towerNoticeLine(c);
      expect(c.desc.startsWith(line)).toBe(true);
      expect(line.endsWith(':')).toBe(false);
      expect(line.endsWith('+')).toBe(false);
    }
  });
});
