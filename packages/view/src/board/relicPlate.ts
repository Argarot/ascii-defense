/**
 * The relic plate (session 30, PR 3; Daniil's items 14 and 19): every place
 * a held or offered relic is drawn - the strip's slots, the Forge's row
 * and slots, the offer's cards - draws it the same way: the 4x3 icon
 * inside a one-glyph RING in the rarity's colour (common grey, rare blue,
 * epic purple, legendary gold), with corners that say the KIND - a passive
 * wears plain corners, an active wears diamonds (a button), a consumable
 * wears crosses (one use). 6x5 glyphs. The art agent may later paint 6x5
 * relic sprites carrying their own ring; until then the view draws it.
 */
import type { Sprite } from '@ascii-defense/content';
import type { TermSurface } from '@ascii-defense/render';
import { role, rarityRole } from '../palette';
import { drawSpriteFrame } from './sprites';

export const RELIC_PLATE_W = 6;
export const RELIC_PLATE_H = 5;

export type RelicPlateKind = 'passive' | 'active' | 'consumable';

export interface RelicPlateOpts {
  rarity?: string;
  kind?: RelicPlateKind;
  /** The plate's background. */
  plate: string;
  /** The text colour for a two-letter tag when there is no sprite. */
  fg: string;
  /** Two letters drawn when there is no sprite. */
  label?: string;
  /** Draw the icon greyed (an active cooling). */
  dimIcon?: boolean;
  /** The opened one: the ring in the accent, whatever the rarity. */
  selected?: boolean;
  /** The rule just fired: the whole plate flashes. */
  flash?: boolean;
  /** An empty slot: the ring only, dim. */
  empty?: boolean;
  /** A slot the tree has not granted: two dim crosses, no ring. */
  locked?: boolean;
}

const CORNERS: Record<RelicPlateKind, [string, string, string, string]> = {
  passive: ['┌', '┐', '└', '┘'],
  active: ['◆', '◆', '◆', '◆'],
  consumable: ['+', '+', '+', '+'],
};

export function drawRelicPlate(term: TermSurface, sprite: Sprite | undefined, x: number, y: number, o: RelicPlateOpts): void {
  for (let r = 0; r < RELIC_PLATE_H; r++) for (let k = 0; k < RELIC_PLATE_W; k++) term.put(x + k, y + r, ' ', o.fg, o.plate);
  if (o.locked) {
    term.put(x + 2, y + 2, 'x', role('ui.dim'), o.plate);
    term.put(x + 3, y + 2, 'x', role('ui.dim'), o.plate);
    return;
  }
  const rr = o.rarity ? rarityRole(o.rarity) : null;
  const ring = o.selected ? role('ui.accent') : o.empty ? role('ui.grid') : rr ? role(rr) : role('ui.grid');
  for (let k = 1; k < RELIC_PLATE_W - 1; k++) { term.put(x + k, y, '─', ring, o.plate); term.put(x + k, y + RELIC_PLATE_H - 1, '─', ring, o.plate); }
  for (let r = 1; r < RELIC_PLATE_H - 1; r++) { term.put(x, y + r, '│', ring, o.plate); term.put(x + RELIC_PLATE_W - 1, y + r, '│', ring, o.plate); }
  const c = CORNERS[o.kind ?? 'passive'];
  term.put(x, y, c[0], ring, o.plate);
  term.put(x + RELIC_PLATE_W - 1, y, c[1], ring, o.plate);
  term.put(x, y + RELIC_PLATE_H - 1, c[2], ring, o.plate);
  term.put(x + RELIC_PLATE_W - 1, y + RELIC_PLATE_H - 1, c[3], ring, o.plate);
  if (o.empty) return;
  if (sprite) drawSpriteFrame(term, sprite, sprite.states[''], x + 1, y + 1, o.dimIcon ? { flatFg: 'ui.dim' } : { transparent: true });
  else if (o.label) term.write(x + 2, y + 2, o.label.slice(0, 2), o.fg, o.plate);
  if (o.flash) for (let r = 0; r < RELIC_PLATE_H; r++) for (let k = 0; k < RELIC_PLATE_W; k++) term.tint(x + k, y + r, role('fx.flash'));
}
