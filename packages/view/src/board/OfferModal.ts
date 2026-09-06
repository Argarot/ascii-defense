/**
 * The pick-1-of-3 relic offer (WBS 1.6.2), and the project's first POP-UP:
 * drawn OVER the board terminal after the board renders. There is no state
 * to save or restore - the view redraws every frame from sim state, so the
 * modal is simply painted last while it exists and not painted when it does
 * not (Daniil's point 6; this pattern is reused for future cards).
 *
 * Regions are glyph-coordinate rectangles the app maps clicks through, the
 * same words-are-buttons contract as the HUD.
 */
import type { TermSurface } from '@ascii-defense/render';
import { role } from '../palette';

export interface OfferCard {
  name: string;
  kind: string;
  desc: string;
  /** 'common' | 'rare' | 'epic' (session 28, PR 2): the card's frame colour and its word. */
  rarity?: string;
}

interface CardRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Card index, or -1 for the reroll button. */
  option: number;
}

const CARD_W = 34;
const CARD_H = 14;
const GAP = 4;

export class OfferModal {
  private regions: CardRegion[] = [];

  /** Option index under a canvas pixel, or null. */
  optionAt(px: number, py: number, glyphPxW: number, glyphPxH: number): number | null {
    const gx = Math.floor(px / glyphPxW);
    const gy = Math.floor(py / glyphPxH);
    for (const r of this.regions) {
      if (gx >= r.x0 && gx < r.x1 && gy >= r.y0 && gy < r.y1) return r.option;
    }
    return null;
  }

  render(term: TermSurface, cards: readonly OfferCard[], wave: number, phase: number, reroll?: { cost: number; can: boolean; ore: number }, titleText?: string): void {
    this.regions = [];
    const totalW = cards.length * CARD_W + (cards.length - 1) * GAP;
    const x0 = Math.max(0, Math.floor((term.cols - totalW) / 2));
    const y0 = Math.max(0, Math.floor((term.rows - CARD_H) / 2) - 2);

    const title = titleText ?? `WAVE ${wave} CLEARED - CHOOSE A RELIC`;
    const blink = phase % 1 < 0.5;
    term.write(Math.floor((term.cols - title.length) / 2), y0 - 2, title, blink ? role('ui.accent') : role('ui.text'), role('ui.bg'));

    cards.forEach((c, i) => {
      const cx = x0 + i * (CARD_W + GAP);
      // Plate, then border rows - a solid card over whatever the board shows.
      for (let r = 0; r < CARD_H; r++) {
        term.write(cx, y0 + r, ' '.repeat(CARD_W), role('ui.text'), role('ui.bg'));
      }
      // Rarity with teeth (session 28, PR 2): the frame wears the rarity's colour and the word.
      const frame = c.rarity === 'rare' ? role('rarity.rare') : c.rarity === 'epic' ? role('rarity.epic') : role('ui.accent');
      term.write(cx, y0, '+' + '-'.repeat(CARD_W - 2) + '+', frame, role('ui.bg'));
      term.write(cx, y0 + CARD_H - 1, '+' + '-'.repeat(CARD_W - 2) + '+', frame, role('ui.bg'));
      for (let r = 1; r < CARD_H - 1; r++) {
        term.write(cx, y0 + r, '|', frame, role('ui.bg'));
        term.write(cx + CARD_W - 1, y0 + r, '|', frame, role('ui.bg'));
      }
      term.write(cx + 2, y0 + 2, c.name.slice(0, CARD_W - 4), frame, role('ui.bg'));
      const kindLine = (c.rarity && c.rarity !== 'common' ? `${c.rarity.toUpperCase()} ` : '') + c.kind.toUpperCase();
      term.write(cx + 2, y0 + 3, kindLine.slice(0, CARD_W - 4), c.rarity && c.rarity !== 'common' ? frame : role('ui.dim'), role('ui.bg'));
      // Wrapped description.
      let row = y0 + 5;
      let line = '';
      for (const word of c.desc.split(' ')) {
        if (line !== '' && line.length + 1 + word.length > CARD_W - 4) {
          term.write(cx + 2, row++, line, role('ui.text'), role('ui.bg'));
          line = word;
        } else {
          line = line === '' ? word : line + ' ' + word;
        }
        if (row >= y0 + CARD_H - 3) break;
      }
      if (line !== '' && row < y0 + CARD_H - 2) term.write(cx + 2, row, line, role('ui.text'), role('ui.bg'));
      const hint = `[ TAKE - press ${i + 1} ]`;
      term.write(cx + Math.floor((CARD_W - hint.length) / 2), y0 + CARD_H - 2, hint, role('ui.accent'), role('ui.bg'));
      this.regions.push({ x0: cx, y0, x1: cx + CARD_W, y1: y0 + CARD_H, option: i });
    });
    if (reroll) {
      // Channel C's second half - a BUTTON the size of a card row, not a
      // whisper (Daniil could not find it). Two rows tall, always visible;
      // grey only when Ore cannot cover it.
      const label = reroll.can
        ? `REROLL OFFER - ${reroll.cost} ore (you have ${reroll.ore})`
        : `reroll costs ${reroll.cost} ore - you have ${reroll.ore}`;
      const bw = Math.max(label.length + 6, 44);
      const rx = Math.floor((term.cols - bw) / 2);
      const ry = y0 + CARD_H + 2;
      const fg = reroll.can ? role('ui.bg') : role('ui.dim');
      const bg = reroll.can ? role('terrain.ore.lit') : role('ui.grid');
      for (let row = 0; row < 2; row++) term.write(rx, ry + row, ' '.repeat(bw), fg, bg);
      term.write(rx + Math.floor((bw - label.length) / 2), ry + 1, label, fg, bg);
      if (reroll.can) this.regions.push({ x0: rx, y0: ry, x1: rx + bw, y1: ry + 2, option: -1 });
    }
  }
}
