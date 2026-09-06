/**
 * The strip (session 24, WBS 4.27 - Daniil: "the bottom part of the screen
 * can have additional UI"): a full-width panel UNDER the board at the HUD's
 * 2x font. Three sections, left to right:
 *
 *   BUILD   one button per tower in the roster, drawn with the tower's OWN
 *           sprite (the same art the board shows), full colour when the
 *           player can afford it and grey when not - buttons, not labels.
 *   WAVE    this wave as it stands (alive, by kind) and the next one, each
 *           kind with its traits in a word, so "what is coming and what it
 *           is good against" is on screen, not in a tooltip.
 *   CORE    the vessel's card, ALWAYS: health, the relic slots with the
 *           actives clickable, the draw button. The Core sits at the east
 *           edge (PR 1); its abilities live here, right below it, not in a
 *           card that only appears when the face is selected.
 *
 * Regions are click targets AND hover previews, as on the HUD: hovering a
 * build button previews that tower's radius on the selected tile, hovering
 * a slot writes its description.
 */
import type { TermSurface } from '@ascii-defense/render';
import type { Sprite } from '@ascii-defense/content';
import { role } from '../palette';
import { spriteState } from '../board/BoardView';
import { drawSpriteFrame } from '../board/sprites';
import { CELL_H, CELL_W } from '../board/style';
import type { HudAction, HudState } from './HudPanel';
import { rarityRole, RELIC_PULSE_TICKS } from './HudPanel';

/**
 * Rows the strip takes at the BOARD's font scale (feedback 2026-09-05 item
 * 6: the 2x strip ran out of room with six towers and twelve slots; at 1x
 * the same 128 px hold sixteen rows and twice the columns). boardSize.ts
 * reserves the same height as eight HUD-scale rows.
 */
export const STRIP_ROWS = 16;
/** A button's rows: the sprite, the name, the cost. */
const BUTTON_H = 7;

/** A trait, in a word the strip can afford (the rule lives in engine/sim/traits.ts). */
const TRAIT_WORD: Record<string, string> = {
  armoured: 'armoured',
  shielded: 'shielded',
  fast: 'fast',
  swarm: 'swarm x3',
  'resists-kinetic': 'resists kinetic',
  'resists-energy': 'resists energy',
  'weak-kinetic': 'weak to kinetic',
  'weak-energy': 'weak to energy',
};
/** The same trait as a two-glyph MARK for a narrow strip: the shield's brackets are the board's own. */
const TRAIT_MARK: Record<string, string> = {
  armoured: '##',
  shielded: '()',
  fast: '>>',
  swarm: 'x3',
  'resists-kinetic': 'K-',
  'resists-energy': 'E-',
  'weak-kinetic': 'K+',
  'weak-energy': 'E+',
};
function traitText(traits: readonly string[], room: number): string {
  const words = traits.map((t) => TRAIT_WORD[t] ?? t).join(' ');
  if (words.length <= room) return words;
  return traits.map((t) => TRAIT_MARK[t] ?? t.slice(0, 2)).join(' ').slice(0, Math.max(0, room));
}

interface Region {
  row: number;
  x0: number;
  x1: number;
  action: HudAction;
}

/**
 * One button per roster slot, eight slots (session 25, Daniil: "leave space
 * for more towers"; PRD sec 5.3's target is eight). Ten columns: the 8-glyph
 * sprite with a margin each side, and a SHORT name under it (the roster's
 * `short`; the full names are too long). On a 7-tile strip (144 columns)
 * the eight buttons take 82, the wave 32 and the Core card the rest.
 */
const BUTTON_W = 10;
export const BUTTON_SLOTS = 8;

export class StripPanel {
  private regions: Region[] = [];
  private readonly sprites: Map<string, Sprite>;

  constructor(
    private term: TermSurface,
    private glyphPxW: number,
    private glyphPxH: number,
    sprites: readonly Sprite[] = [],
  ) {
    this.sprites = new Map(sprites.map((s) => [s.id, s]));
  }

  actionAt(px: number, py: number): HudAction | null {
    const gx = Math.floor(px / this.glyphPxW);
    const gy = Math.floor(py / this.glyphPxH);
    for (const r of this.regions) {
      if (r.row === gy && gx >= r.x0 && gx < r.x1) return r.action;
    }
    return null;
  }

  render(s: HudState): void {
    const term = this.term;
    this.regions = [];
    term.clear(role('ui.bg'));
    const W = term.cols;
    const H = term.rows;
    const dim = role('ui.dim');
    const text = role('ui.text');
    const grid = role('ui.grid');
    const accent = role('ui.accent');
    const bg = role('ui.bg');

    // ---- BUILD: the roster as sprite buttons -------------------------------
    const roster = s.roster ?? [];
    term.write(1, 0, 'BUILD', dim);
    roster.slice(0, BUTTON_SLOTS).forEach((t, i) => {
      const x0 = 1 + i * BUTTON_W;
      const usable = t.affordable && t.buildable;
      const selected = t.id === s.selectedBuildId;
      // The plate never changes with selection (Daniil, session 25: the
      // accent plate was distracting). Selection is the name in accent with
      // a marker before it - readable, not loud.
      const plate = usable ? grid : bg;
      for (let r = 1; r <= BUTTON_H; r++) for (let c = 0; c < BUTTON_W; c++) term.put(x0 + c, r, ' ', plate, plate);
      const sp = this.sprites.get(t.id);
      const sx = x0 + Math.floor((BUTTON_W - CELL_W) / 2);
      if (sp) {
        const frame = spriteState(sp, []);
        drawSpriteFrame(term, sp, frame, sx, 1, usable ? { groundRole: 'tower.ground' } : { flatFg: 'ui.dim' });
      } else {
        term.write(sx, 3, t.id.slice(0, CELL_W), usable ? text : dim, plate);
      }
      const name = (t.short ?? t.name).slice(0, BUTTON_W - 2);
      if (selected) term.put(x0, 1 + CELL_H, '>', accent, plate);
      term.write(x0 + 1, 1 + CELL_H, name, selected ? accent : usable ? text : dim, plate);
      const cost = `$${t.cost}`;
      term.write(x0 + BUTTON_W - 1 - cost.length, 2 + CELL_H, cost, t.affordable ? text : role('enemy.fast'), plate);
      for (let r = 1; r <= BUTTON_H; r++) this.regions.push({ row: r, x0, x1: x0 + BUTTON_W, action: { kind: 'buildId', id: t.id } });
    });
    // The spare slots are drawn as empty frames: the room for the towers
    // still to come is visible, not implied.
    for (let i = roster.length; i < BUTTON_SLOTS; i++) {
      const x0 = 1 + i * BUTTON_W;
      term.put(x0, 1, '┌', grid); term.put(x0 + BUTTON_W - 2, 1, '┐', grid);
      term.put(x0, BUTTON_H, '└', grid); term.put(x0 + BUTTON_W - 2, BUTTON_H, '┘', grid);
    }
    const buildW = 1 + BUTTON_SLOTS * BUTTON_W + 1;
    // Under the buttons: what a click does, and where the card is.
    term.write(1, BUTTON_H + 2, s.buildTargetSelected ? 'click a button: builds on the selected tile' : 'select a tile, then click a button', dim);
    term.write(1, BUTTON_H + 3, 'hover a button: its card in the column', dim);
    term.write(1, BUTTON_H + 4, 'grey: not enough scrap, or not for that tile', dim);

    // ---- WAVE: now and next, with traits -------------------------------------
    const wx = buildW + 1;
    const waveW = Math.max(32, Math.min(52, Math.floor((W - wx) * 0.55)));
    const colW = Math.floor(waveW / 2);
    const head = s.finalWave > 0 ? `WAVE ${s.wave}/${s.finalWave}` : `WAVE ${s.wave}`;
    term.write(wx, 0, head, text);
    if (s.nextWave && !s.nextWave.waiting && s.nextWaveIn > 0) term.write(wx + head.length + 2, 0, `next in ${s.nextWaveIn}s`, dim);
    term.write(wx, 1, 'NOW', dim);
    const now = s.waveNow ?? [];
    if (now.length === 0) term.write(wx, 2, 'the road is empty', dim);
    const KIND_W = 12;
    now.slice(0, H - 2).forEach((k, i) => {
      const line = `${k.count} ${k.name}`.slice(0, KIND_W - 1).padEnd(KIND_W);
      term.write(wx, 2 + i, line, text);
      term.write(wx + KIND_W, 2 + i, traitText(k.traits, colW - KIND_W - 1), dim);
    });
    const nx = wx + colW;
    if (s.nextWave) {
      const nw = s.nextWave;
      term.write(nx, 1, nw.boss ? `NEXT ${nw.wave} BOSS` : `NEXT ${nw.wave}`, nw.boss ? role('enemy.fast') : dim);
      nw.kinds.slice(0, H - 2).forEach((k, i) => {
        const line = `${k.count} ${k.name}`.slice(0, KIND_W - 1).padEnd(KIND_W);
        term.write(nx, 2 + i, line, text);
        term.write(nx + KIND_W, 2 + i, traitText(k.traits ?? [], colW - KIND_W - 1), dim);
      });
    } else {
      term.write(nx, 1, 'NEXT', dim);
      term.write(nx, 2, 'the last wave is out', dim);
    }

    // ---- CORE: the vessel, always ---------------------------------------------
    const cx = wx + waveW + 2;
    const cw = W - cx - 1;
    const c = s.coreCard;
    if (c && cw >= 20) {
      // The column already shows the Core's health; here the card is the
      // slots and the actives only (feedback 2026-09-06, item 3).
      term.write(cx, 0, `THE CORE - relics and actives ${c.slots.filter((x) => x.state !== 'empty').length}/${c.relicSlots ?? c.slots.length} - click one for its card`.slice(0, cw), role('terrain.core.lit'));
      // Square slots, one row: the HUD's grid at 5x3, as many as fit.
      const slotW = 5;
      const slotH = 3;
      const perRow = Math.max(1, Math.floor(cw / slotW));
      c.slots.forEach((slot, i) => {
        if (Math.floor(i / perRow) > 0 && 2 + slotH * 2 > H - 2) return; // no room for a second row
        const x0 = cx + (i % perRow) * slotW;
        const rowBase = 2 + Math.floor(i / perRow) * slotH;
        const [fg, sbg] =
          slot.state === 'empty'
            ? [grid, bg]
            : slot.state === 'ready'
              ? [bg, accent]
              : slot.state === 'cooling'
                ? [dim, grid]
                : slot.state === 'consumable'
                  ? [bg, role('terrain.ore.lit')]
                  : [text, grid]; // passive
        for (let r = 0; r < slotH; r++)
          for (let k = 0; k < slotW - 1; k++) term.put(x0 + k, rowBase + r, ' ', fg, sbg);
        if (slot.state === 'empty') {
          term.put(x0, rowBase, '┌', fg); term.put(x0 + 3, rowBase, '┐', fg);
          term.put(x0, rowBase + 2, '└', fg); term.put(x0 + 3, rowBase + 2, '┘', fg);
        } else {
          const rsp = slot.id ? this.sprites.get(`relic_${slot.id}`) : undefined;
          if (rsp) drawSpriteFrame(term, rsp, rsp.states[''], x0, rowBase, slot.state === 'cooling' ? { flatFg: 'ui.dim' } : { transparent: true });
          else term.write(x0 + 1, rowBase + 1, slot.label.slice(0, 2), fg, sbg);
          if (slot.state === 'cooling') term.write(x0 + 1, rowBase + 2, String(Math.min(99, slot.cooldownSec)).padStart(2), fg, sbg);
          const rr = rarityRole(slot.rarity);
          if (rr) { term.put(x0, rowBase, '┌', role(rr), sbg); term.put(x0 + 3, rowBase, '┐', role(rr), sbg); term.put(x0, rowBase + 2, '└', role(rr), sbg); term.put(x0 + 3, rowBase + 2, '┘', role(rr), sbg); }
          // The rule just fired (session 28, PR 3): the plate flashes; the opened one is underlined.
          if (slot.firedAgo !== undefined && slot.firedAgo >= 0 && slot.firedAgo < RELIC_PULSE_TICKS) for (let r = 0; r < slotH; r++) for (let k = 0; k < slotW - 1; k++) term.tint(x0 + k, rowBase + r, role('fx.flash'));
          if (slot.selected) for (let k = 0; k < slotW - 1; k++) term.put(x0 + k, rowBase + slotH, '^', accent);
          for (let r = 0; r < slotH; r++) this.regions.push({ row: rowBase + r, x0, x1: x0 + slotW - 1, action: { kind: 'relic', index: i } });
        }
      });
      const drawRow = 2 + slotH;
      const drawLabel = ` DRAW RELIC  ${c.drawCost} ore`;
      const drawW = Math.min(cw, 24);
      term.write(cx, drawRow, drawLabel.padEnd(drawW).slice(0, drawW), c.canDraw ? bg : dim, c.canDraw ? role('terrain.ore.lit') : grid);
      if (c.canDraw) this.regions.push({ row: drawRow, x0: cx, x1: cx + drawW, action: { kind: 'coreDraw' } });
      const hint = c.hoverDesc ?? 'hover a slot for details; click actives to fire';
      const lines = this.wrap(hint, cw, 2);
      lines.forEach((l, i) => term.write(cx, drawRow + 1 + i, l, c.hoverDesc ? text : dim));
      // Lit sets (session 28, PR 2): one line under the slots naming what the held relics' tags light.
      if ((c.sets ?? []).length) term.write(cx, drawRow + 3, `sets: ${(c.sets ?? []).join(', ')}`.slice(0, cw), role('terrain.core.lit'));
    }

    term.flush();
  }

  private wrap(s: string, w: number, maxLines: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of s.split(' ')) {
      if (line !== '' && line.length + 1 + word.length > w) {
        lines.push(line);
        line = word;
      } else line = line === '' ? word : line + ' ' + word;
    }
    if (line !== '') lines.push(line);
    if (lines.length > maxLines) {
      const head = lines.slice(0, maxLines - 1);
      head.push(lines.slice(maxLines - 1).join(' ').slice(0, w));
      return head;
    }
    return lines;
  }
}
