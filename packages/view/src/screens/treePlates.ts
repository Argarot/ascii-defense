/**
 * The tree drawn as a tree (feedback 2026-09-08, item 5: "the tech tree
 * needs to actually visually look like a tree, with sprites for the things
 * you buy, not just text boxes; the visual language needs to be appealing").
 *
 * A row per branch; in a row, CHAINS of plates linked left to right by a
 * rail (a node hangs from the one before it); a plate is a ring in the
 * state's colour - gold when bought, the accent when it can be bought, dim
 * when it cannot - around the thing it buys: the tower's own 8x5 sprite in
 * the arsenal's big plates, a 4x3 relic icon or a drawn glyph icon in the
 * small ones; the name and the price (or BOUGHT, or why not) under it. The
 * focused plate breathes. Everything here is glyphs spleen has: the
 * single-line box set, the diamond, braille.
 */
import type { Sprite } from '@ascii-defense/content';
import type { TermSurface } from '@ascii-defense/render';
import { role } from '../palette';
import { drawSpriteFrame } from '../board/sprites';
import { spriteState } from '../board/BoardView';

/** Two hex colours blended: t = 0 is a, t = 1 is b. */
function mix(a: string, b: string, t: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export interface TreePlate {
  id: string;
  /** Up to eleven glyphs (thirteen on a big plate): the row under the plate. */
  name: string;
  /** The row under the name: a price, BOUGHT, or why not. */
  note: string;
  /** The thing it buys: a tower sprite (big plates) or a relic icon (small ones). */
  sprite?: Sprite;
  /** A drawn 4x3 icon when there is no sprite. */
  icon?: readonly string[];
  /** The icon's colour, a palette role. */
  iconRole?: string;
  state: 'bought' | 'open' | 'locked';
  selected?: boolean;
}
export interface TreeChain { plates: readonly TreePlate[] }
export interface TreeRow {
  heading: string;
  chains: readonly TreeChain[];
  /** Big plates: an 8x5 sprite inside a 10x7 ring. */
  big?: boolean;
}
export interface TreeSpec { rows: readonly TreeRow[] }

const SMALL = { w: 8, h: 5, pitch: 11 };
const BIG = { w: 10, h: 7, pitch: 13 };
const CHAIN_GAP = 2;
const UNDER = 2; // name and note rows
const PLATE_BG = '#0f1620';

const geom = (row: TreeRow) => (row.big ? BIG : SMALL);
export function treeRowHeight(row: TreeRow): number {
  return 1 + geom(row).h + UNDER + 1; // heading, plate, two rows, a gap
}
export function treeRowWidth(row: TreeRow): number {
  const g = geom(row);
  const n = row.chains.reduce((a, c) => a + c.plates.length, 0);
  return n * g.pitch - (g.pitch - g.w) + Math.max(0, row.chains.length - 1) * CHAIN_GAP;
}
export function treeSize(spec: TreeSpec): { w: number; h: number } {
  return { w: Math.max(0, ...spec.rows.map(treeRowWidth)), h: spec.rows.reduce((a, r) => a + treeRowHeight(r), 0) };
}

export interface TreeRegion { row: number; rowEnd: number; x0: number; x1: number; id: string }

/**
 * Draws the tree with its left edge at x0 and its top at y; pushes a click
 * region per plate (the plate and its two rows under it) and the ids in
 * draw order. `cursor` lights the plate the keyboard is on.
 */
export function drawTree(term: TermSurface, spec: TreeSpec, x0: number, y: number, phase: number, cursor: string | undefined, regions: TreeRegion[], order: string[]): void {
  const accent = role('ui.accent');
  const dim = role('ui.dim');
  const gold = role('rarity.legendary');
  const grid = role('ui.grid');
  let ry = y;
  for (const row of spec.rows) {
    const g = geom(row);
    const rowW = treeRowWidth(row);
    term.write(x0 + Math.max(0, Math.floor((rowW - row.heading.length) / 2)), ry, row.heading, accent, PLATE_BG);
    const py = ry + 1;
    let px = x0;
    row.chains.forEach((chain, ci) => {
      chain.plates.forEach((p, pi) => {
        const ring = p.state === 'bought' ? gold : p.state === 'open' ? accent : dim;
        const onCursor = cursor !== undefined && cursor === p.id;
        const breathe = p.selected || onCursor ? mix(ring, '#ffffff', 0.35 + 0.35 * Math.sin(phase * Math.PI * 2)) : ring;
        // The ring.
        for (let r = 0; r < g.h; r++) for (let c = 0; c < g.w; c++) term.put(px + c, py + r, ' ', ring, PLATE_BG);
        for (let c = 1; c < g.w - 1; c++) { term.put(px + c, py, '─', breathe, PLATE_BG); term.put(px + c, py + g.h - 1, '─', breathe, PLATE_BG); }
        for (let r = 1; r < g.h - 1; r++) { term.put(px, py + r, '│', breathe, PLATE_BG); term.put(px + g.w - 1, py + r, '│', breathe, PLATE_BG); }
        const corner = p.state === 'bought' ? '◆' : p.selected || onCursor ? '◆' : undefined;
        term.put(px, py, corner ?? '┌', breathe, PLATE_BG);
        term.put(px + g.w - 1, py, corner ?? '┐', breathe, PLATE_BG);
        term.put(px, py + g.h - 1, corner ?? '└', breathe, PLATE_BG);
        term.put(px + g.w - 1, py + g.h - 1, corner ?? '┘', breathe, PLATE_BG);
        // The thing it buys.
        const ix = px + Math.floor((g.w - (p.sprite ? p.sprite.cell[0] : 4)) / 2);
        const iy = py + Math.floor((g.h - (p.sprite ? p.sprite.cell[1] : 3)) / 2);
        if (p.sprite) {
          const st = spriteState(p.sprite, []);
          drawSpriteFrame(term, p.sprite, st, ix, iy, p.state === 'locked' ? { flatFg: 'ui.dim' } : { transparent: true });
        } else if (p.icon) {
          const ir = role(p.state === 'locked' ? 'ui.dim' : (p.iconRole ?? 'ui.text'));
          p.icon.forEach((line, r) => { for (let c = 0; c < line.length; c++) if (line[c] !== ' ') term.put(ix + c, iy + r, line[c], ir, PLATE_BG); });
        }
        // The rows under: the name, then the price or the state.
        const nameFg = p.state === 'bought' ? gold : p.state === 'open' ? role('ui.text') : dim;
        const name = p.name.slice(0, g.pitch - 1);
        term.write(px + Math.max(0, Math.floor((g.w - name.length) / 2)), py + g.h, name, nameFg, PLATE_BG);
        const note = p.note.slice(0, g.pitch - 1);
        term.write(px + Math.max(0, Math.floor((g.w - note.length) / 2)), py + g.h + 1, note, p.state === 'bought' ? gold : p.state === 'open' ? accent : dim, PLATE_BG);
        if (onCursor) term.put(px - 1 < x0 ? px : px - 1, py + Math.floor(g.h / 2), '>', accent, PLATE_BG);
        regions.push({ row: py, rowEnd: py + g.h + UNDER - 1, x0: px, x1: px + g.w, id: p.id });
        order.push(p.id);
        // The rail to the next plate of the chain: it hangs from this one.
        if (pi < chain.plates.length - 1) {
          const mid = py + Math.floor(g.h / 2);
          for (let c = px + g.w; c < px + g.pitch; c++) term.put(c, mid, '─', chain.plates[pi + 1].state === 'locked' ? grid : ring, PLATE_BG);
        }
        px += g.pitch;
      });
      if (ci < row.chains.length - 1) px += CHAIN_GAP; // a wider gap between chains: a rail never crosses it
    });
    ry += treeRowHeight(row);
  }
}
