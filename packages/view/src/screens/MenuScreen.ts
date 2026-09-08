/**
 * The screen layer (4.15): one reusable full-overlay menu, generalised from
 * the offer modal's pattern - paint over the finished board frame on the
 * transparent overlay terminal; closing a screen is simply not painting it.
 * No screen owns game state (PRD sec 15.1): items carry ids, the app decides
 * what an id means.
 *
 * The menu LANGUAGE (session 30, PR 1; Daniil's item 30, "the menus need a
 * real graphical rework"): every page is a framed plate - a box-drawn frame
 * with diamond corners, the title in a band on the top edge and lit by a
 * travelling glow, an optional hero row of sprites, body lines, tile
 * previews, COLUMNS of items side by side (a tree's branches, a tab rail),
 * the main items as plates, a footer, and a row of key hints. spleen has
 * the single-line box set and the diamond, nothing double or block-shaped;
 * the language is drawn from what the font has (a glyph the font lacks
 * draws nothing, silently - the playtest-13 lesson).
 */
import type { TermSurface } from '@ascii-defense/render';
import type { Sprite } from '@ascii-defense/content';
import { TILE_SIZE, tileRimMask, type CellType } from '@ascii-defense/engine';
import { CELL_H, CELL_W, drawTerrainCell } from '../board/style';
import { spriteState } from '../board/BoardView';
import { drawSpriteFrame, idleFrame } from '../board/sprites';
import { drawTree, treeSize, type TreeSpec } from './treePlates';
import { role } from '../palette';

export interface MenuItem {
  id: string;
  label: string;
  /** Dimmed and unclickable. */
  disabled?: boolean;
  /** Right-aligned annotation on the same row (e.g. a value or state). */
  note?: string;
  /** Radio-style state (playtest 13): the row reads as CHOSEN - accent
   *  label between markers - not merely hoverable. */
  selected?: boolean;
  /**
   * This item hangs from the one above it (session 30): a connector is
   * drawn between them - a tree's requirement, read at a glance.
   */
  link?: boolean;
  /** A tint for the row's label: a rarity, a branch colour. A palette role name. */
  tone?: string;
}

/** A pickable tile preview (2.21): the pool is seen, never read as names. */
export interface MenuTile {
  id: string;
  cells: readonly string[];
  selected: boolean;
  /** The frame's colour when not selected - a rarity role for a vein tile (session 30). */
  tone?: string;
  /** A short mark on the frame's top edge (session 33, PR 7): "x2" copies owned, "1/2" copies loaded. */
  badge?: string;
}

/** A column of items (session 30): the pages that are a tree or a rail lay these side by side. */
export interface MenuColumn {
  heading?: string;
  /** Dim lines under the heading - a branch's sentence, a tab's count. */
  lines?: readonly string[];
  items: readonly MenuItem[];
}

export interface MenuSpec {
  title: string;
  /** Lines under the title - flavour, stats, warnings. '' makes a gap. */
  body?: readonly string[];
  /** Tile previews rendered between body and items; clicking reports 'tile:<id>'. */
  tiles?: readonly MenuTile[];
  /** The tree drawn as a tree (feedback 2026-09-08, item 5): rows of linked plates with sprites, between the body and the columns. */
  tree?: TreeSpec;
  /** Columns of items side by side, between the body and the main items (session 30). */
  columns?: readonly MenuColumn[];
  items: readonly MenuItem[];
  footer?: string;
  /** Key hints in the frame's bottom band (session 30): [Esc] back  [N] next wave. */
  keys?: readonly { key: string; does: string }[];
  /** 0..1 breathing phase for the selected-item shimmer and the title's glow. */
  phase?: number;
  /** World milliseconds for the hero row's idle frames (feedback 2026-09-08, item 4: the title's towers animate). */
  animMs?: number;
  /**
   * The title page's HERO (4.28): a row of sprites drawn above the title at
   * the screen's scale - the towers themselves, until the art agent's splash
   * arrives. A page with a hero is a designed page, not a plate over a map.
   */
  hero?: readonly Sprite[];
  /** A dim line in the screen's bottom-right corner (build, cell, version). */
  caption?: string;
  /** The keyboard's cursor (session 31: WBS 4.24's other half): the id of the row the arrows are on; Enter activates it. */
  cursor?: string;
}

const TILE_GW = TILE_SIZE * CELL_W; // tile preview width in glyphs
const TILE_GH = TILE_SIZE * CELL_H;
const PLATE_BG = '#0a0f16';
const BACKDROP = '#070b11';
const COLUMN_GAP = 3;

/**
 * How many tile previews a screen of `cols` x `rows` can show at once with
 * `reservedRows` of title, body, items and footer around them - the same
 * arithmetic render() lays out with, so the app pages the loadout pool at
 * a count that fits THIS screen instead of a literal (playtest 18 found the
 * overflow at 5x3; at 8x5 a tile preview is 40x25 glyphs and far fewer fit).
 */
export function tileCapacity(cols: number, rows: number, reservedRows: number): number {
  const perRow = Math.max(1, Math.floor((cols - 10) / (TILE_GW + 3)));
  const rowsFit = Math.floor((rows - 2 - reservedRows) / (TILE_GH + 3));
  return Math.max(1, perRow * Math.max(0, rowsFit));
}

/** Mix two hex colours; t = 0 is a, 1 is b. */
function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number): number => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const k = Math.max(0, Math.min(1, t));
  const v = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k));
  return '#' + v.map((n) => n.toString(16).padStart(2, '0')).join('');
}

const itemW = (it: MenuItem): number => it.label.length + (it.note ? it.note.length + 3 : 0) + (it.selected ? 4 : 0);
const columnW = (c: MenuColumn): number => Math.max(c.heading?.length ?? 0, ...(c.lines ?? []).map((l) => l.length), ...c.items.map(itemW)) + 2;
const columnH = (c: MenuColumn): number => (c.heading ? 1 : 0) + (c.lines?.length ?? 0) + c.items.reduce((n, it) => n + (it.link ? 2 : 1), 0) + (c.items.length ? 1 : 0);

/** What drawFrame needs: where the plate is and what its bands say. */
export interface FrameOpts {
  title: string;
  keys?: readonly { key: string; does: string }[];
  phase: number;
  plateW: number;
  frameH: number;
  x0: number;
  y0: number;
}

/**
 * The frame of every page (session 30): the plate fill, the box-drawn
 * edges, the diamond corners, the title band on the top edge lit by a glow
 * that travels with the phase, the key hints in the bottom band. Shared by
 * the menu and the Smith so the shell has one face.
 */
export function drawFrame(term: TermSurface, o: FrameOpts): void {
  const accent = role('ui.accent');
  const grid = role('ui.grid');
  const dim = role('ui.dim');
  const text = role('ui.text');
  const W = term.cols;
  const { x0, y0, plateW, frameH } = o;
  for (let y = y0; y < y0 + frameH && y < term.rows; y++)
    for (let x = x0 - 1; x <= x0 + plateW && x < W; x++) term.put(x, y, ' ', text, PLATE_BG);
  const top = y0;
  const bottom = y0 + frameH - 1;
  for (let x = x0; x < x0 + plateW; x++) { term.put(x, top, '─', grid, PLATE_BG); term.put(x, bottom, '─', grid, PLATE_BG); }
  for (let y = top + 1; y < bottom; y++) { term.put(x0 - 1, y, '│', grid, PLATE_BG); term.put(x0 + plateW, y, '│', grid, PLATE_BG); }
  for (const [cx, cy] of [[x0 - 1, top], [x0 + plateW, top], [x0 - 1, bottom], [x0 + plateW, bottom]] as const) term.put(cx, cy, '◆', accent, PLATE_BG);
  const band = ` ${o.title} `;
  const bx = x0 + Math.floor((plateW - band.length - 2) / 2);
  term.put(bx, top, '┤', grid, PLATE_BG);
  term.put(bx + band.length + 1, top, '├', grid, PLATE_BG);
  for (let i = 0; i < band.length; i++) {
    const wave = 0.5 + 0.5 * Math.sin((i / Math.max(1, band.length)) * Math.PI * 2 - o.phase * Math.PI * 2);
    term.put(bx + 1 + i, top, band[i], mix(text, accent, 0.35 + 0.65 * wave), PLATE_BG);
  }
  const keysText = (o.keys ?? []).map((k) => `[${k.key}] ${k.does}`).join('   ');
  if (keysText) {
    const kx = x0 + Math.floor((plateW - keysText.length - 2) / 2);
    term.put(kx, bottom, '┤', grid, PLATE_BG);
    term.write(kx + 1, bottom, ' ' + keysText + ' ', dim, PLATE_BG);
    term.put(kx + keysText.length + 3, bottom, '├', grid, PLATE_BG);
    let x = kx + 2;
    for (const k of o.keys ?? []) {
      const key = `[${k.key}]`;
      term.write(x, bottom, key, accent, PLATE_BG);
      x += key.length + 1 + k.does.length + 3;
    }
  }
}

export class MenuScreen {
  private regions: { row: number; rowEnd?: number; x0: number; x1: number; id: string }[] = [];
  /** Every clickable id of the last render, in draw order - what the arrows walk. */
  private order: string[] = [];

  itemIds(): readonly string[] {
    return this.order;
  }

  render(term: TermSurface, spec: MenuSpec): void {
    this.regions = [];
    this.order = [];
    const W = term.cols;
    const phase = spec.phase ?? 0;
    // The board dims to backdrop under a screen (playtest 10): a checkerboard
    // of dark cells - the terminal's screen-door tint, since glyph cells have
    // no alpha. The map stays legible as a place, the menu owns the eye.
    for (let y = 0; y < term.rows; y++)
      for (let x = (y % 2); x < W; x += 2) term.put(x, y, ' ', role('ui.dim'), BACKDROP);
    // Plate width comes from the CONTENT (playtest 10: clipped text): the
    // longest of title, body lines, items with notes, columns, footer, keys -
    // plus padding.
    const tiles = spec.tiles ?? [];
    // A body line longer than the widest plate wraps at a word (session 31:
    // the summary's "you met" line and its workshop sentence were cut
    // mid-word on a narrow screen).
    const body = (spec.body ?? []).flatMap((l) => wrapLine(l, W - 12));
    const maxPerRow = Math.max(1, Math.floor((W - 10) / (TILE_GW + 3)));
    const perRow = Math.min(tiles.length, maxPerRow);
    const tileRows = perRow > 0 ? Math.ceil(tiles.length / perRow) : 0;
    const stripW = perRow > 0 ? perRow * (TILE_GW + 3) - 3 : 0;
    const columns = spec.columns ?? [];
    const colWs = columns.map(columnW);
    // Columns wrap into rows that fit the screen (a five-branch tree on a
    // narrow screen becomes three columns over two): greedy, in order.
    const fitW = W - 8;
    const rowsOfCols: number[][] = [];
    let rowW = 0;
    for (let i = 0; i < columns.length; i++) {
      const w = colWs[i] + (rowW > 0 ? COLUMN_GAP : 0);
      if (rowW > 0 && rowW + w > fitW) { rowsOfCols.push([]); rowW = 0; }
      if (rowsOfCols.length === 0) rowsOfCols.push([]);
      rowsOfCols[rowsOfCols.length - 1].push(i);
      rowW += colWs[i] + (rowW > 0 ? COLUMN_GAP : 0);
    }
    const rowWidth = (r: number[]): number => r.reduce((a, i) => a + colWs[i], 0) + COLUMN_GAP * Math.max(0, r.length - 1);
    const rowHeight = (r: number[]): number => Math.max(...r.map((i) => columnH(columns[i]))) + 1;
    const columnsW = rowsOfCols.length ? Math.max(...rowsOfCols.map(rowWidth)) : 0;
    const columnsH = rowsOfCols.reduce((a, r) => a + rowHeight(r), 0);
    const keysText = (spec.keys ?? []).map((k) => `[${k.key}] ${k.does}`).join('   ');
    const tree = spec.tree ? treeSize(spec.tree) : { w: 0, h: 0 };
    const widest = Math.max(
      tree.w,
      spec.title.length + 6,
      ...body.map((l) => l.length),
      ...spec.items.map(itemW),
      (spec.footer ?? '').length,
      keysText.length,
      stripW,
      columnsW,
    );
    const hero = spec.hero ?? [];
    const heroH = hero.length > 0 ? CELL_H + 2 : 0;
    const heroW = hero.length > 0 ? hero.length * (CELL_W + 2) - 2 : 0;
    const plateW = Math.min(W - 4, Math.max(widest + 8, heroW + 8));
    const stripH = tileRows * (TILE_GH + 3);
    const bodyH = body.length + (body.length ? 1 : 0);
    const treeH = tree.h > 0 ? tree.h + 1 : 0;
    const contentH = 2 + heroH + bodyH + treeH + stripH + columnsH + spec.items.length * 2 + (spec.footer ? 1 : 0);
    const frameH = contentH + 2; // the top band and the bottom band
    const y0 = Math.max(1, Math.floor((term.rows - frameH) / 2));
    const x0 = Math.floor((W - plateW) / 2);
    const accent = role('ui.accent');
    const grid = role('ui.grid');
    const dim = role('ui.dim');

    drawFrame(term, { title: spec.title, keys: spec.keys, phase, plateW, frameH, x0, y0 });
    const top = y0;

    let y = top + 2;
    if (hero.length > 0) {
      // The towers stand in a row above the title, each on its own ground.
      const hx0 = x0 + Math.floor((plateW - heroW) / 2);
      hero.forEach((sp, i) => {
        const gx = hx0 + i * (CELL_W + 2);
        for (let r = 0; r < CELL_H; r++) for (let c = 0; c < CELL_W; c++) term.put(gx + c, y + r, ' ', role('tower.ground'), role('tower.ground'));
        drawSpriteFrame(term, sp, idleFrame(sp, spriteState(sp, []), spec.animMs ?? 0, i), gx, y);
      });
      y += heroH;
    }
    for (const line of body) {
      const l = line.slice(0, plateW - 2);
      term.write(x0 + Math.floor((plateW - l.length) / 2), y++, l, dim, PLATE_BG);
    }
    if (body.length) y++;
    if (spec.tree && tree.h > 0) {
      const treeRegions: { row: number; rowEnd: number; x0: number; x1: number; id: string }[] = [];
      drawTree(term, spec.tree, x0 + Math.floor((plateW - tree.w) / 2), y, phase, spec.cursor, treeRegions, this.order);
      for (const r of treeRegions) this.regions.push(r);
      y += treeH;
    }
    if (tiles.length > 0) {
      // The pool is a VISUAL surface (PRD sec 4.8): each special drawn by the
      // same renderer the board uses, framed in accent when loaded.
      for (let i = 0; i < tiles.length; i++) {
        const col = i % perRow;
        const rowN = Math.floor(i / perRow);
        const rowCount = Math.min(perRow, tiles.length - rowN * perRow);
        const rowW = rowCount * (TILE_GW + 3) - 3;
        const tx = x0 + Math.max(1, Math.floor((plateW - rowW) / 2)) + col * (TILE_GW + 3);
        const ty = y + 1 + rowN * (TILE_GH + 3);
        const tile = tiles[i];
        const frame = tile.selected || spec.cursor === `tile:${tile.id}` ? accent : tile.tone ? role(tile.tone) : grid;
        this.order.push(`tile:${tile.id}`);
        for (let fy = -1; fy <= TILE_GH; fy++) {
          for (let fx = -1; fx <= TILE_GW; fx++) {
            if (fy !== -1 && fy !== TILE_GH && fx !== -1 && fx !== TILE_GW) continue;
            term.put(tx + fx, ty + fy, ' ', frame, frame);
          }
        }
        if (tile.badge) term.write(tx + TILE_GW - tile.badge.length, ty - 1, tile.badge.slice(0, TILE_GW), role('ui.bg'), frame);
        for (let cy = 0; cy < TILE_SIZE; cy++)
          for (let cx = 0; cx < TILE_SIZE; cx++)
            drawTerrainCell(term, tile.cells[cy][cx] as CellType, tx + cx * CELL_W, ty + cy * CELL_H, {
              // A COMPLETE tile derives its edges from actual connectivity,
              // exactly as the board does (playtest 15): per-cell declared
              // ports drew omni-built tiles - every pre-segment mint - with
              // no edges at all, while the board showed them correctly.
              // segmentRimMask stays an authoring-only view (lone cells).
              rim: tileRimMask(tile.cells, cx, cy),
            });
        this.regions.push({ row: ty - 1, rowEnd: ty + TILE_GH, x0: tx - 1, x1: tx + TILE_GW + 1, id: `tile:${tile.id}` });
      }
      y += stripH;
    }
    // ---- columns: a tree's branches, a rail of tabs -------------------------
    for (const row of rowsOfCols) {
      let cx0 = x0 + Math.floor((plateW - rowWidth(row)) / 2);
      for (const ci of row) {
        const c = columns[ci];
        const cw = colWs[ci];
        let cy = y;
        if (c.heading) { term.write(cx0 + Math.floor((cw - c.heading.length) / 2), cy++, c.heading, accent, PLATE_BG); }
        for (const l of c.lines ?? []) term.write(cx0 + Math.floor((cw - Math.min(l.length, cw)) / 2), cy++, l.slice(0, cw), dim, PLATE_BG);
        if (c.heading || c.lines?.length) cy++;
        for (const it of c.items) {
          if (it.link) { term.put(cx0 + Math.floor(cw / 2), cy++, '│', grid, PLATE_BG); }
          this.drawItem(term, it, cx0, cy, cw, phase, spec.cursor);
          cy++;
        }
        cx0 += cw + COLUMN_GAP;
      }
      y += rowHeight(row);
    }
    for (const it of spec.items) {
      this.drawItem(term, it, x0 + 2, y, plateW - 4, phase, spec.cursor);
      y += 2;
    }
    if (spec.footer) {
      const f = spec.footer.slice(0, plateW - 2);
      term.write(x0 + Math.floor((plateW - f.length) / 2), y, f, dim, PLATE_BG);
    }
    if (spec.caption) {
      const c = spec.caption.slice(0, W - 2);
      term.write(W - 1 - c.length, term.rows - 1, c, dim);
    }
  }

  /** One item as a plate row of width bw at (x, y); a selected row wears diamond markers around an accent label. */
  private drawItem(term: TermSurface, it: MenuItem, x: number, y: number, bw: number, phase: number, cursor?: string): void {
    const accent = role('ui.accent');
    // The keyboard's cursor row (session 31): the plate lit, so the arrows are seen to land somewhere.
    const onCursor = cursor !== undefined && cursor === it.id && !it.disabled;
    const fg = it.disabled ? role('ui.grid') : onCursor ? role('ui.bg') : it.selected ? accent : it.tone ? role(it.tone) : role('ui.text');
    const bg = it.disabled ? PLATE_BG : onCursor ? mix(role('ui.grid'), accent, 0.55) : role('ui.grid');
    // Centred label; the note keeps the right edge (playtest 10). A selected
    // row wears markers around an accent label (playtest 13) - diamonds, a
    // glyph spleen has (the first attempt used U+00BB, which it does not,
    // and GLTerm drew nothing).
    const label = it.selected ? `◆ ${it.label} ◆` : it.label;
    // Centred when there is room; a note keeps the right edge, so in a narrow column the label moves left of it.
    const room = it.note ? bw - it.note.length - 3 : bw;
    const pad = Math.max(1, Math.min(Math.floor((bw - label.length) / 2), room - label.length));
    const rowText = (' '.repeat(pad) + label).padEnd(bw, ' ').slice(0, bw);
    term.write(x, y, rowText, fg, bg);
    if (it.selected) {
      // The markers breathe with the phase.
      const glow = mix(role('ui.grid'), accent, 0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
      term.put(x + pad, y, '◆', glow, bg);
      term.put(x + pad + label.length - 1, y, '◆', glow, bg);
    }
    // A note longer than the row is clipped at the row's right edge, never drawn left of the plate (session 31).
    if (it.note) { const note = it.note.slice(0, Math.max(0, bw - 2)); term.write(Math.max(x + 1, x + bw - note.length - 1), y, note, it.disabled ? role('ui.grid') : onCursor ? role('ui.bg') : accent, bg); }
    if (onCursor) term.put(x, y, '>', role('ui.bg'), bg);
    if (!it.disabled) { this.regions.push({ row: y, x0: x, x1: x + bw, id: it.id }); this.order.push(it.id); }
  }

  itemAt(px: number, py: number, glyphPxW: number, glyphPxH: number): string | null {
    const gx = Math.floor(px / glyphPxW);
    const gy = Math.floor(py / glyphPxH);
    for (const r of this.regions) {
      const rowOk = r.rowEnd === undefined ? r.row === gy : gy >= r.row && gy <= r.rowEnd;
      if (rowOk && gx >= r.x0 && gx < r.x1) return r.id;
    }
    return null;
  }
}

/** A line wrapped at words to at most `w` glyphs; a word longer than `w` is cut. */
export function wrapLine(line: string, w: number): string[] {
  if (line.length <= w) return [line];
  const out: string[] = [];
  let cur = '';
  for (const word of line.split(' ')) {
    if (cur !== '' && cur.length + 1 + word.length > w) { out.push(cur); cur = ''; }
    cur = cur === '' ? word.slice(0, w) : cur + ' ' + word;
  }
  if (cur !== '') out.push(cur);
  return out;
}
