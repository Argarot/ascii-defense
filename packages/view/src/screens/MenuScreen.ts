/**
 * The screen layer (4.15): one reusable full-overlay menu, generalised from
 * the offer modal's pattern - paint over the finished board frame on the
 * transparent overlay terminal; closing a screen is simply not painting it.
 * No screen owns game state (PRD sec 15.1): items carry ids, the app decides
 * what an id means.
 */
import type { GLTerm } from '@ascii-defense/render';
import { TILE_SIZE, tileRimMask, type CellType } from '@ascii-defense/engine';
import { CELL_H, CELL_W, drawTerrainCell } from '../board/style';
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
}

/** A pickable tile preview (2.21): the pool is seen, never read as names. */
export interface MenuTile {
  id: string;
  cells: readonly string[];
  selected: boolean;
}

export interface MenuSpec {
  title: string;
  /** Lines under the title - flavour, stats, warnings. '' makes a gap. */
  body?: readonly string[];
  /** Tile previews rendered between body and items; clicking reports 'tile:<id>'. */
  tiles?: readonly MenuTile[];
  items: readonly MenuItem[];
  footer?: string;
  /** 0..1 breathing phase for the selected-item shimmer. */
  phase?: number;
}

const TILE_GW = TILE_SIZE * CELL_W; // tile preview width in glyphs
const TILE_GH = TILE_SIZE * CELL_H;

export class MenuScreen {
  private regions: { row: number; rowEnd?: number; x0: number; x1: number; id: string }[] = [];

  render(term: GLTerm, spec: MenuSpec): void {
    this.regions = [];
    const W = term.cols;
    // The board dims to backdrop under a screen (playtest 10): a checkerboard
    // of dark cells - the terminal's screen-door tint, since glyph cells have
    // no alpha. The map stays legible as a place, the menu owns the eye.
    for (let y = 0; y < term.rows; y++)
      for (let x = (y % 2); x < W; x += 2) term.put(x, y, ' ', role('ui.dim'), '#070b11');
    // Plate width comes from the CONTENT (playtest 10: clipped text): the
    // longest of title, body lines, items with notes, footer - plus padding.
    const noteW = (it: MenuItem): number => it.label.length + (it.note ? it.note.length + 3 : 0);
    // Tiles wrap into rows sized by the terminal, never clipped (playtest
    // 12, item 2): the plate grows to fit whole tiles, rows grow to fit all.
    const tiles = spec.tiles ?? [];
    const maxPerRow = Math.max(1, Math.floor((W - 10) / (TILE_GW + 3)));
    const perRow = Math.min(tiles.length, maxPerRow);
    const tileRows = perRow > 0 ? Math.ceil(tiles.length / perRow) : 0;
    const stripW = perRow > 0 ? perRow * (TILE_GW + 3) - 3 : 0;
    const widest = Math.max(
      spec.title.length,
      ...(spec.body ?? []).map((l) => l.length),
      ...spec.items.map(noteW),
      (spec.footer ?? '').length,
      stripW,
    );
    const plateW = Math.min(W - 2, widest + 8);
    const stripH = tileRows * (TILE_GH + 3);
    const contentH = 4 + (spec.body?.length ?? 0) + stripH + spec.items.length * 2 + (spec.footer ? 2 : 0);
    const y0 = Math.max(1, Math.floor((term.rows - contentH) / 2));
    const x0 = Math.floor((W - plateW) / 2);
    for (let y = y0 - 1; y < y0 + contentH + 1 && y < term.rows; y++)
      for (let x = x0 - 1; x <= x0 + plateW && x < W; x++) term.put(x, y, ' ', role('ui.text'), '#0a0f16');
    let y = y0;
    term.write(x0 + Math.floor((plateW - spec.title.length) / 2), y, spec.title, role('ui.accent'));
    y += 2;
    for (const line of spec.body ?? []) {
      const l = line.slice(0, plateW - 2);
      term.write(x0 + Math.floor((plateW - l.length) / 2), y++, l, role('ui.dim'));
    }
    if (spec.body?.length) y++;
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
        const frame = tile.selected ? role('ui.accent') : role('ui.grid');
        for (let fy = -1; fy <= TILE_GH; fy++) {
          for (let fx = -1; fx <= TILE_GW; fx++) {
            if (fy !== -1 && fy !== TILE_GH && fx !== -1 && fx !== TILE_GW) continue;
            term.put(tx + fx, ty + fy, ' ', frame, frame);
          }
        }
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
    for (const it of spec.items) {
      const fg = it.disabled ? role('ui.grid') : it.selected ? role('ui.accent') : role('ui.text');
      const bg = it.disabled ? '#0a0f16' : role('ui.grid');
      const bw = plateW - 4;
      // Centred label; the note keeps the right edge (playtest 10). A
      // selected row wears markers around an accent label (playtest 13).
      // ASCII markers on purpose: the first attempt used U+00BB, which
      // spleen does not have - GLTerm silently drew nothing, which is
      // exactly the "no visible effect" Daniil reported.
      const label = it.selected ? `[ ${it.label} ]` : it.label;
      const pad = Math.max(0, Math.floor((bw - label.length) / 2));
      const rowText = (' '.repeat(pad) + label).padEnd(bw, ' ').slice(0, bw);
      term.write(x0 + 2, y, rowText, fg, bg);
      if (it.note) term.write(x0 + 2 + bw - it.note.length - 1, y, it.note, it.disabled ? role('ui.grid') : role('ui.accent'), bg);
      if (!it.disabled) this.regions.push({ row: y, x0: x0 + 2, x1: x0 + plateW - 2, id: it.id });
      y += 2;
    }
    if (spec.footer) {
      const f = spec.footer.slice(0, plateW - 2);
      term.write(x0 + Math.floor((plateW - f.length) / 2), y, f, role('ui.dim'));
    }
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
