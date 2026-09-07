/**
 * The Forge (session 28, feedback 2026-09-06 evening, item 4: "combining
 * relics should be done in its own menu window ... two empty slots that
 * you place relics in, then click an obvious COMBINE button, and get
 * something new from it - similar to Stone Story"). A modal over the
 * board: the held relics as a row of icon plates, two forge slots, the
 * result the pair would make, and one button. Rules are the sim's
 * (combineTargets); this only draws and hit-tests.
 */
import type { Sprite } from '@ascii-defense/content';
import type { TermSurface } from '@ascii-defense/render';
import { role } from '../palette';
import { rarityRole } from '../hud/HudPanel';
import { RELIC_PLATE_H, RELIC_PLATE_W, drawRelicPlate, type RelicPlateKind } from './relicPlate';
import { drawFrame } from '../screens/MenuScreen';

export interface ForgeHeld {
  index: number;
  name: string;
  kind: string;
  rarity?: string;
  id?: string;
}

export interface ForgeState {
  held: readonly ForgeHeld[];
  /** Held indices in the two forge slots; null = empty. */
  picked: readonly [number | null, number | null];
  /** What the pair makes, or null (empty slot, or a pair that makes nothing). */
  result: { name: string; rarity?: string } | null;
}

export type ForgeAction = { kind: 'held'; index: number } | { kind: 'slot'; slot: 0 | 1 } | { kind: 'combine' } | { kind: 'close' };

interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  action: ForgeAction;
}

const SLOT_W = RELIC_PLATE_W + 2;
const SLOT_H = RELIC_PLATE_H + 1;
// The held row carries the SLOT state (ready/cooling for an active); the plate wants the kind.
const kindOf = (k: string): RelicPlateKind => (k === 'active' || k === 'ready' || k === 'cooling' ? 'active' : k === 'consumable' ? 'consumable' : 'passive');

export class ForgeModal {
  private regions: Region[] = [];
  constructor(private readonly sprites: ReadonlyMap<string, Sprite>) {}

  actionAt(px: number, py: number, glyphPxW: number, glyphPxH: number): ForgeAction | null {
    const gx = Math.floor(px / glyphPxW);
    const gy = Math.floor(py / glyphPxH);
    for (const r of this.regions) if (gx >= r.x0 && gx < r.x1 && gy >= r.y0 && gy < r.y1) return r.action;
    return null;
  }

  render(term: TermSurface, s: ForgeState, phase: number): void {
    this.regions = [];
    const W = Math.min(term.cols - 4, 100);
    const H = Math.min(term.rows - 2, 34);
    const x0 = Math.floor((term.cols - W) / 2);
    const y0 = Math.floor((term.rows - H) / 2);
    const bg = role('ui.bg');
    const text = role('ui.text');
    const dim = role('ui.dim');
    const accent = role('ui.accent');
    const grid = role('ui.grid');
    // The plate in the menu language (session 30, PR 3): the frame, the lit band, the keys.
    drawFrame(term, { title: 'THE FORGE - two relics in, one out', keys: [{ key: 'Esc', does: 'close' }], phase, plateW: W - 2, frameH: H, x0: x0 + 1, y0 });
    term.write(x0 + 2, y0 + 2, 'two of a kind at one rarity become the next rarity; a recipe pair becomes a fused relic.'.slice(0, W - 4), dim, bg);
    term.write(x0 + 2, y0 + 3, 'click a held relic to place it; click a slot to empty it.'.slice(0, W - 4), dim, bg);

    // The held row: icon plates, index under each.
    const perRow = Math.floor((W - 4) / SLOT_W);
    let hy = y0 + 5;
    s.held.forEach((h, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const px = x0 + 2 + col * SLOT_W;
      const py = hy + row * (SLOT_H + 1);
      if (py + SLOT_H > y0 + H - 12) return; // no room: the rest is off the plate
      const inSlot = s.picked[0] === h.index || s.picked[1] === h.index;
      const sp = h.id ? this.sprites.get(`relic_${h.id}`) : undefined;
      drawRelicPlate(term, sp, px, py, { rarity: h.rarity, kind: kindOf(h.kind), plate: inSlot ? accent : grid, fg: inSlot ? bg : text, label: h.name.slice(0, 2).toUpperCase(), selected: inSlot });
      term.write(px, py + RELIC_PLATE_H, h.name.slice(0, SLOT_W - 1), inSlot ? accent : dim, bg);
      this.regions.push({ x0: px, y0: py, x1: px + SLOT_W - 1, y1: py + SLOT_H, action: { kind: 'held', index: h.index } });
    });
    if (s.held.length === 0) term.write(x0 + 2, hy, 'nothing held yet - relics come from offers, caches and the DRAW button', dim, bg);
    hy += Math.max(1, Math.ceil(Math.min(s.held.length, perRow * 3) / perRow)) * (SLOT_H + 1) + 1;

    // The two slots and the result.
    const slotY = Math.min(hy, y0 + H - 10);
    const drawSlot = (sx: number, which: 0 | 1): void => {
      const idx = s.picked[which];
      const h = idx === null ? undefined : s.held.find((x) => x.index === idx);
      const plate = h ? accent : grid;
      for (let r = 0; r < 5; r++) term.write(sx, slotY + r, ' '.repeat(9), text, plate);
      if (h) {
        const sp = h.id ? this.sprites.get(`relic_${h.id}`) : undefined;
        drawRelicPlate(term, sp, sx + 1, slotY, { rarity: h.rarity, kind: kindOf(h.kind), plate, fg: bg, label: h.name.slice(0, 2).toUpperCase() });
        term.write(sx, slotY + 5, h.name.slice(0, 9), accent, bg);
        term.write(sx, slotY + 6, h.rarity ?? '', dim, bg);
      } else {
        drawRelicPlate(term, undefined, sx + 1, slotY, { plate, fg: dim, empty: true });
        term.write(sx, slotY + 5, which === 0 ? 'first' : 'second', dim, bg);
      }
      this.regions.push({ x0: sx, y0: slotY, x1: sx + 9, y1: slotY + 5, action: { kind: 'slot', slot: which } });
    };
    const cx = x0 + Math.floor(W / 2);
    drawSlot(cx - 24, 0);
    term.write(cx - 13, slotY + 2, '+', accent, bg);
    drawSlot(cx - 10, 1);
    term.write(cx + 1, slotY + 2, '=', accent, bg);
    const rx = cx + 4;
    const rplate = s.result ? role(rarityRole(s.result.rarity) ?? 'ui.accent') : grid;
    for (let r = 0; r < 5; r++) term.write(rx, slotY + r, ' '.repeat(18), text, rplate);
    if (s.result) {
      term.write(rx + 1, slotY + 1, s.result.name.slice(0, 16), bg, rplate);
      term.write(rx + 1, slotY + 3, (s.result.rarity ?? '').slice(0, 16), bg, rplate);
    } else {
      const both = s.picked[0] !== null && s.picked[1] !== null;
      term.write(rx + 1, slotY + 2, both ? 'these make nothing' : 'pick two', dim, rplate);
    }
    // The button.
    const by = slotY + 8;
    const can = s.result !== null;
    const label = can ? `COMBINE -> ${s.result!.name}` : 'COMBINE';
    const bw = Math.max(24, label.length + 6);
    const bx = cx - Math.floor(bw / 2);
    for (let r = 0; r < 2; r++) term.write(bx, by + r, ' '.repeat(bw), can ? bg : dim, can ? accent : grid);
    term.write(bx + Math.floor((bw - label.length) / 2), by + 1, label, can ? bg : dim, can ? accent : grid);
    if (can) this.regions.push({ x0: bx, y0: by, x1: bx + bw, y1: by + 2, action: { kind: 'combine' } });
    const close = ' CLOSE ';
    term.write(x0 + W - close.length - 3, y0 + H - 3, close, text, grid);
    this.regions.push({ x0: x0 + W - close.length - 3, y0: y0 + H - 3, x1: x0 + W - 3, y1: y0 + H - 2, action: { kind: 'close' } });
  }
}
