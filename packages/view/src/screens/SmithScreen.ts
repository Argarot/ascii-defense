/**
 * The Tile Smith as a page of the shell (session 30, PR 2; Daniil: "fold
 * tile smith into the main menu and make it part of the game"). The same
 * verbs as the standalone tool (pick a brush, click a cell; overlays cycle
 * by click), drawn in the menu language on the fullscreen terminal: the
 * brush matrix as plates on the left, the tile at the board's own scale in
 * the middle, the truth on the right - derived connectors, the engine's
 * verdict, the id, the price the shop would charge, MINT. No state lives
 * here (PRD sec 15.1): the app owns the tile; this draws it and reports
 * clicks by id.
 */
import type { TermSurface } from '@ascii-defense/render';
import { TILE_SIZE, segmentRimMask, type CellType } from '@ascii-defense/engine';
import { CELL_H, CELL_W, drawTerrainCell } from '../board/style';
import { role } from '../palette';
import { drawFrame } from './MenuScreen';

/** Daniil's matrix: the road block reads as a box, terrain under it (tilesmith.ts). */
export const BRUSH_GRID: CellType[][] = [
  ['F', 'T', '7', '|'],
  ['E', 'X', '3', '-'],
  ['L', 'U', 'J', 'B'],
  ['G', 'R', 'O', 'C'],
];
/** A schematic glyph per brush - the box-drawing shape it places. */
export const BRUSH_GLYPH: Record<string, string> = {
  F: '┌', T: '┬', '7': '┐', '|': '│',
  E: '├', X: '┼', '3': '┤', '-': '─',
  L: '└', U: '┴', J: '┘', B: 'B',
  G: 'G', R: 'R', O: 'O', C: 'C',
};
export const BRUSH_NAME: Record<string, string> = {
  '-': 'road east-west', '|': 'road north-south',
  L: 'bend north-east', J: 'bend north-west', F: 'bend south-east', '7': 'bend south-west',
  T: 'T-junction, stem south', U: 'T-junction, stem north', E: 'T-junction, opens east', '3': 'T-junction, opens west',
  X: 'crossroads', B: 'bridge: two roads cross and never merge',
  G: 'ground', R: 'rock', O: 'ore', C: 'core',
};

export interface SmithState {
  cells: readonly string[];
  brush: CellType;
  /** CELLS paints terrain; OVERLAYS clicks a vein or a boon onto a cell. */
  mode: 'cells' | 'overlay';
  /** The tier an authored vein gets (the tree's ore tier caps it). */
  veinTier: number;
  veinTierMax: number;
  deposits: readonly { x: number; y: number; amount: number; tier?: number }[];
  boons: readonly { x: number; y: number; boon: string; tier: number }[];
  connectors: { n: boolean; e: boolean; s: boolean; w: boolean };
  /** The engine's verdict and the shell's own rules; empty means the tile mints. */
  errors: readonly string[];
  id: string;
  price: { tier: number; ore: number };
  ore: readonly number[];
  canUndo: boolean;
  /** A line under MINT: what just happened, or what stops it. */
  note: string;
  /** Show the Core brush (library work behind ?dev). */
  dev: boolean;
  phase: number;
}

const TILE_GW = TILE_SIZE * CELL_W;
const TILE_GH = TILE_SIZE * CELL_H;
const BRUSH_W = 5;
const BRUSH_H = 2;
const PLATE_BG = '#0a0f16';

export class SmithScreen {
  private regions: { row: number; rowEnd: number; x0: number; x1: number; id: string }[] = [];

  render(term: TermSurface, s: SmithState): void {
    this.regions = [];
    const W = term.cols;
    const accent = role('ui.accent');
    const grid = role('ui.grid');
    const dim = role('ui.dim');
    const text = role('ui.text');
    const bg = role('ui.bg');
    for (let y = 0; y < term.rows; y++)
      for (let x = (y % 2); x < W; x += 2) term.put(x, y, ' ', dim, '#070b11');
    const leftW = BRUSH_W * 4 + 3;
    const rightW = 40;
    const plateW = Math.min(W - 4, leftW + 3 + TILE_GW + 3 + rightW + 4);
    const frameH = Math.max(TILE_GH + 8, 34);
    const y0 = Math.max(1, Math.floor((term.rows - frameH) / 2));
    const x0 = Math.floor((W - plateW) / 2);
    drawFrame(term, { title: 'THE TILE SMITH', keys: [{ key: 'Esc', does: 'back to the workshop' }, { key: 'Ctrl+Z', does: 'undo' }], phase: s.phase, plateW, frameH, x0, y0 });
    const top = y0;
    const put = (x: number, y: number, t: string, fg: string, b = PLATE_BG): void => term.write(x, y, t, fg, b);

    // ---- left: the brush matrix, the mode, undo -----------------------------
    const lx = x0 + 2;
    let ly = top + 2;
    put(lx, ly++, 'BRUSHES', accent);
    put(lx, ly++, 'roads, then terrain', dim);
    ly++;
    BRUSH_GRID.forEach((row, ri) => {
      row.forEach((t, ci) => {
        if (t === 'C' && !s.dev) return;
        const bx = lx + ci * BRUSH_W;
        const by = ly + ri * BRUSH_H;
        const on = s.mode === 'cells' && s.brush === t;
        const plate = on ? accent : grid;
        const fg = on ? bg : text;
        put(bx, by, ' '.repeat(BRUSH_W - 1), fg, plate);
        term.put(bx + 1, by, BRUSH_GLYPH[t], fg, plate);
        term.put(bx + 2, by, t === 'B' || t.length === 1 && /[GROC]/.test(t) ? ' ' : ' ', fg, plate);
        this.regions.push({ row: by, rowEnd: by, x0: bx, x1: bx + BRUSH_W - 1, id: `brush:${t}` });
      });
    });
    ly += BRUSH_H * 4;
    put(lx, ly++, BRUSH_NAME[s.brush] ?? '', dim);
    ly++;
    const modeBtn = (id: string, label: string, on: boolean, y: number, x: number, w: number): void => {
      put(x, y, (' ' + label).padEnd(w).slice(0, w), on ? bg : text, on ? accent : grid);
      this.regions.push({ row: y, rowEnd: y, x0: x, x1: x + w, id });
    };
    modeBtn('mode:cells', 'CELLS', s.mode === 'cells', ly, lx, 9);
    modeBtn('mode:overlay', 'OVERLAYS', s.mode === 'overlay', ly, lx + 10, 10);
    ly += 2;
    if (s.mode === 'overlay') {
      put(lx, ly++, 'a click on ore cycles its vein', dim);
      put(lx, ly++, '30 / 60 / 90 / none; on ground', dim);
      put(lx, ly++, 'its boon range / damage / rate', dim);
      ly++;
      put(lx, ly++, `vein tier (the tree allows ${s.veinTierMax})`, dim);
      for (let t = 1; t <= 3; t++) modeBtn(`tier:${t}`, `T${t}`, s.veinTier === t, ly, lx + (t - 1) * 6, 5);
      ly += 2;
    } else {
      put(lx, ly++, 'click a cell to paint it with', dim);
      put(lx, ly++, 'the held brush; terrain erases', dim);
      put(lx, ly++, 'road', dim);
      ly++;
    }
    if (s.canUndo) modeBtn('undo', 'UNDO', false, ly, lx, 9);
    else put(lx, ly, ' UNDO', grid, PLATE_BG);
    ly += 2;

    // ---- middle: the tile, at the board's scale ------------------------------
    const tx = lx + leftW + 3;
    const ty = top + 4;
    put(tx, ty - 2, 'THE TILE - as the board draws it', accent);
    for (let fy = -1; fy <= TILE_GH; fy++)
      for (let fx = -1; fx <= TILE_GW; fx++) {
        if (fy !== -1 && fy !== TILE_GH && fx !== -1 && fx !== TILE_GW) continue;
        term.put(tx + fx, ty + fy, ' ', grid, grid);
      }
    for (let cy = 0; cy < TILE_SIZE; cy++)
      for (let cx = 0; cx < TILE_SIZE; cx++) {
        const authored = s.deposits.find((d) => d.x === cx && d.y === cy);
        drawTerrainCell(term, s.cells[cy][cx] as CellType, tx + cx * CELL_W, ty + cy * CELL_H, {
          rim: segmentRimMask(s.cells[cy][cx], cx, cy),
          richness: authored ? authored.amount / 90 : undefined,
        });
        // A vein's tier as corner marks, a boon as tinted corners - what the board does.
        const gx = tx + cx * CELL_W;
        const gy = ty + cy * CELL_H;
        if (authored && (authored.tier ?? 1) > 1) for (let i = 0; i < (authored.tier ?? 1); i++) term.put(gx + CELL_W - 1 - i, gy, '◆', role((authored.tier ?? 1) >= 3 ? 'rarity.epic' : 'rarity.rare'));
        const boon = s.boons.find((b) => b.x === cx && b.y === cy);
        if (boon) {
          const corners = [[0, 0], [CELL_W - 1, 0], [0, CELL_H - 1], [CELL_W - 1, CELL_H - 1]] as const;
          for (let i = 0; i < Math.min(4, boon.tier); i++) term.tint(gx + corners[i][0], gy + corners[i][1], role(`boon.${boon.boon}`));
        }
        this.regions.push({ row: gy, rowEnd: gy + CELL_H - 1, x0: gx, x1: gx + CELL_W, id: `cell:${cx},${cy}` });
      }
    const conn = ['n', 'e', 's', 'w'] as const;
    put(tx, ty + TILE_GH + 2, 'connectors: ' + conn.map((e) => `${e.toUpperCase()} ${s.connectors[e] ? 'road' : '-'}`).join('  '), dim);

    // ---- right: the truth ----------------------------------------------------
    const rx = tx + TILE_GW + 3;
    let ry = top + 2;
    put(rx, ry++, 'THE VERDICT', accent);
    if (s.errors.length === 0) put(rx, ry++, 'valid - the game would accept this', role('rarity.common'));
    else for (const e of s.errors.slice(0, 6)) { for (const line of wrap(e, rightW - 2).slice(0, 2)) put(rx, ry++, line, role('enemy.fast')); }
    ry++;
    put(rx, ry++, `id ${s.id}`, text);
    put(rx, ry++, `${s.deposits.length} vein(s), ${s.boons.length} boon(s), ${[...s.cells.join('')].filter((c) => c !== 'G' && c !== 'R' && c !== 'O' && c !== 'C').length} road cell(s)`, dim);
    ry++;
    put(rx, ry++, 'THE PRICE', accent);
    put(rx, ry++, `${s.price.ore} tier-${s.price.tier} ore (have ${s.ore[s.price.tier - 1] ?? 0})`, text);
    put(rx, ry++, 'the shop and the smith share one', dim);
    put(rx, ry++, 'pricing function: roads, veins,', dim);
    put(rx, ry++, 'boons, the vein tier', dim);
    ry++;
    const canMint = s.errors.length === 0 && (s.ore[s.price.tier - 1] ?? 0) >= s.price.ore;
    put(rx, ry, (' MINT - ' + s.price.ore + ' ore').padEnd(rightW - 4).slice(0, rightW - 4), canMint ? bg : grid, canMint ? accent : PLATE_BG);
    if (canMint) this.regions.push({ row: ry, rowEnd: ry, x0: rx, x1: rx + rightW - 4, id: 'mint' });
    ry += 2;
    for (const line of wrap(s.note, rightW - 2).slice(0, 3)) put(rx, ry++, line, dim);
    ry++;
    put(rx, ry, ' BACK'.padEnd(rightW - 4), text, grid);
    this.regions.push({ row: ry, rowEnd: ry, x0: rx, x1: rx + rightW - 4, id: 'back' });
  }

  itemAt(px: number, py: number, glyphPxW: number, glyphPxH: number): string | null {
    const gx = Math.floor(px / glyphPxW);
    const gy = Math.floor(py / glyphPxH);
    for (const r of this.regions) if (gy >= r.row && gy <= r.rowEnd && gx >= r.x0 && gx < r.x1) return r.id;
    return null;
  }
}

function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (word === '') continue;
    if (line !== '' && line.length + 1 + word.length > w) { out.push(line); line = word; }
    else line = line === '' ? word : line + ' ' + word;
  }
  if (line !== '') out.push(line);
  return out;
}
