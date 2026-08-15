/**
 * BoardView: the one place where board state meets glyphs (ARCHITECTURE sec 1
 * - view is the only layer that knows both sides). Owns the cell<->glyph<->
 * pixel geometry, terrain texture, decoration, and interaction feedback
 * (hover highlight, selection brackets, inspector text).
 *
 * Redraws are full-scene on purpose: the renderer measures ~0.5 ms for far
 * larger grids, and statelessness here means hover can never desync from the
 * board. Texture comes from a stateless spatial hash; only board growth and
 * decoration draw from RNG streams, so redrawing consumes no randomness.
 */
import {
  TILE_SIZE,
  TileLibrary,
  createRng,
  resolveCells,
  slotAt,
  type Board,
  type CellType,
  type GeneratedMap,
} from '@ascii-defense/engine';
import type { GLTerm } from '@ascii-defense/render';
import { role } from '../palette';
import { CELL_H, CELL_W, drawTerrainCell } from './style';

export { CELL_W, CELL_H } from './style';

const TOWERS = [
  ['.-^-.', '|[O]|', "'---'"],
  ['\\ | /', '|(@)|', "'---'"],
  ['* . *', '|<8>|', "* ' *"],
  ['=====', '|{$}|', "'---'"],
];
const TOWER_CORE = /[O@$8]/;

const DESCRIBE: Record<CellType, string> = {
  G: 'ground \u00b7 buildable',
  R: 'road \u00b7 NEVER buildable',
  K: 'rock \u00b7 blocked',
  O: 'ore \u00b7 buildable \u00b7 a refinery here mines Ore',
  C: 'the CORE \u00b7 protect this \u00b7 every road leads here',
};

export interface CellRef {
  x: number;
  y: number;
}

export interface BoardViewOptions {
  /** Board size in tiles. */
  mapX: number;
  mapY: number;
  /** HUD rows above the board, in glyph rows. */
  offsetY: number;
  /** Pixels per glyph (native font size). */
  glyphPxW: number;
  glyphPxH: number;
}

export interface RenderState {
  hover: CellRef | null;
  selected: CellRef | null;
  /** Walker positions in continuous cell units (subcell resolution). */
  enemies?: readonly { x: number; y: number }[];
  /** Right side of the title row: sim status (breaches, speed). */
  status?: string;
  /** Faint markers on tile corners - the map's seams, visible on demand. */
  showGrid?: boolean;
}

export class BoardView {
  private board!: Board;
  private map!: GeneratedMap;
  private cells!: (CellType | null)[];
  private seed = 0;

  readonly cellsW: number;
  readonly cellsH: number;

  constructor(
    private term: GLTerm,
    private lib: TileLibrary,
    private opts: BoardViewOptions,
  ) {
    this.cellsW = opts.mapX * TILE_SIZE;
    this.cellsH = opts.mapY * TILE_SIZE;
  }

  /** Adopt a generated map. Generation is the app's business (engine call). */
  setMap(map: GeneratedMap, seed: number): void {
    this.map = map;
    this.board = map.board;
    this.seed = seed;
    this.cells = resolveCells(this.board, this.lib);
  }

  cellType(ref: CellRef): CellType | null {
    if (ref.x < 0 || ref.y < 0 || ref.x >= this.cellsW || ref.y >= this.cellsH) return null;
    return this.cells[ref.y * this.cellsW + ref.x];
  }

  /** Canvas pixel -> board cell, or null when over the HUD rows / outside. */
  cellFromPixel(px: number, py: number): CellRef | null {
    const { glyphPxW, glyphPxH, offsetY } = this.opts;
    const x = Math.floor(px / (glyphPxW * CELL_W));
    const y = Math.floor((py - offsetY * glyphPxH) / (glyphPxH * CELL_H));
    if (x < 0 || y < 0 || x >= this.cellsW || y >= this.cellsH) return null;
    return { x, y };
  }

  /** Inspector line for a cell - the seam where engine facts become words. */
  describeCell(ref: CellRef | null): string {
    if (!ref) return '';
    const t = this.cellType(ref);
    const base = t === null ? 'void \u00b7 unclaimed land \u00b7 the run grows here' : DESCRIBE[t];
    return `cell ${ref.x},${ref.y} \u00b7 ${base}`;
  }

  render(state: RenderState): void {
    const term = this.term;
    const { offsetY } = this.opts;
    const decor = createRng(this.seed).stream('combat');

    term.clear(role('ui.bg'));
    term.write(0, 0, `ASCII DEFENSE \u00b7 generated map \u00b7 seed ${this.seed}`, role('ui.accent'));
    if (state.status) {
      term.write(this.cellsW * CELL_W - state.status.length, 0, state.status, role('ui.accent'));
    }
    term.write(
      0,
      1,
      `hover inspects \u00b7 click selects \u00b7 R rerolls \u00b7 G tile seams \u00b7 ?seed=${this.seed} pins this map \u00b7 ${this.map.entries.length} entries, one unique road each`,
      role('ui.dim'),
    );
    term.write(0, 2, this.describeCell(state.selected ?? state.hover), role('ui.text'));

    let towerN = 0;
    for (let cy = 0; cy < this.cellsH; cy++)
      for (let cx = 0; cx < this.cellsW; cx++) {
        const kind = this.cells[cy * this.cellsW + cx];
        const hovered = state.hover?.x === cx && state.hover?.y === cy;
        const gx0 = cx * CELL_W;
        const gy0 = offsetY + cy * CELL_H;

        if (kind === null) {
          // Void: near-black, but hover still answers so the board edge is
          // discoverable by mouse.
          if (hovered)
            for (let y = 0; y < CELL_H; y++)
              for (let x = 0; x < CELL_W; x++) term.put(gx0 + x, gy0 + y, ' ', role('ui.dim'), '#1a2330');
          continue;
        }

        const hoverBg = hovered ? '#2a3a4d' : undefined;
        // Boundary shading only for landmass types: roads read as routes and
        // the Core has its own look; ground/rock/ore get mass edges.
        const shaded = kind === 'G' || kind === 'K' || kind === 'O';
        const north = cy > 0 ? this.cells[(cy - 1) * this.cellsW + cx] : null;
        const south = cy + 1 < this.cellsH ? this.cells[(cy + 1) * this.cellsW + cx] : null;
        drawTerrainCell(term, kind, gx0, gy0, {
          bg: hoverBg,
          litTop: shaded && north !== kind,
          shadowBottom: shaded && south !== kind,
        });

        if (kind === 'G' && decor.chance(0.16)) {
          const art = TOWERS[towerN % TOWERS.length];
          const col = role(`path.${(towerN % 4) + 1}`);
          towerN++;
          for (let r = 0; r < CELL_H; r++)
            for (let c = 0; c < CELL_W; c++) {
              const chr = art[r][c];
              if (chr === ' ' || !term.has(chr)) continue;
              term.put(gx0 + c, gy0 + r, chr, TOWER_CORE.test(chr) ? col : role('tower.frame'), hoverBg ?? role('tower.ground'));
            }
        }
      }

    // Tile seams, on demand (G key): a faint corner mark per placed tile -
    // enough to count tiles by, dim enough to vanish during play.
    if (state.showGrid) {
      const gridCol = role('ui.grid');
      const TGX = TILE_SIZE * CELL_W;
      const TGY = TILE_SIZE * CELL_H;
      for (let ty = 0; ty < this.opts.mapY; ty++)
        for (let tx = 0; tx < this.opts.mapX; tx++) {
          if (!slotAt(this.board, tx, ty)) continue;
          const gx0 = tx * TGX;
          const gy0 = offsetY + ty * TGY;
          term.put(gx0, gy0, '+', gridCol);
          term.put(gx0 + TGX - 1, gy0, '+', gridCol);
          term.put(gx0, gy0 + TGY - 1, '+', gridCol);
          term.put(gx0 + TGX - 1, gy0 + TGY - 1, '+', gridCol);
        }
    }

    // Real walkers, drawn at subcell resolution: continuous cell coords map
    // to the 5x3 glyph grid, so motion has 5 horizontal steps per cell
    // instead of snapping cell to cell.
    for (const e of state.enemies ?? []) {
      const gx = Math.floor(e.x * CELL_W);
      const gy = offsetY + Math.floor(e.y * CELL_H);
      term.put(gx, gy, '@', role('enemy.eye'));
    }

    // Selection brackets last, over everything: the selected cell's corner
    // glyphs get light box-drawing corners in the accent colour.
    if (state.selected) {
      const { x, y } = state.selected;
      const gx0 = x * CELL_W;
      const gy0 = offsetY + y * CELL_H;
      const accent = role('ui.accent');
      term.put(gx0, gy0, '\u250c', accent);
      term.put(gx0 + CELL_W - 1, gy0, '\u2510', accent);
      term.put(gx0, gy0 + CELL_H - 1, '\u2514', accent);
      term.put(gx0 + CELL_W - 1, gy0 + CELL_H - 1, '\u2518', accent);
    }

    term.flush();
  }
}
