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
  growBoard,
  resolveCells,
  type Board,
  type CellType,
} from '@ascii-defense/engine';
import type { GLTerm } from '@ascii-defense/render';
import { role } from '../palette';

/** Glyphs per cell - the 5x3 cell shape that makes cells square-ish. */
export const CELL_W = 5;
export const CELL_H = 3;

const POOLS: Record<CellType, string> = {
  G: "          .'`,\u2800\u2801\u2802\u2804\u2808\u2810\u2820\u2840\u2880\u2803\u2809",
  R: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  K: '#%@&\u28ff\u287f\u28bf\u28fb\u28fd\u28fe\u28f7$WMB\u28f6\u28ef',
  O: '*+.o\u283f\u283e\u283d\u283bO0\u2837',
  S: '>>:.\u2808\u2818\u2838',
};
const TOWERS = [
  ['.-^-.', '|[O]|', "'---'"],
  ['\\ | /', '|(@)|', "'---'"],
  ['* . *', '|<8>|', "* ' *"],
  ['=====', '|{$}|', "'---'"],
];
const ENEMY = '<(o)>';
const TOWER_CORE = /[O@$8]/;

const DESCRIBE: Record<CellType, string> = {
  G: 'ground \u00b7 buildable',
  R: 'road \u00b7 NEVER buildable',
  K: 'rock \u00b7 blocked',
  O: 'ore \u00b7 buildable \u00b7 a refinery here mines Ore',
  S: 'spawn \u00b7 enemy entry',
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
}

export class BoardView {
  private board!: Board;
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

  /** Grow and cache the board for a seed. Rendering never regrows. */
  setSeed(seed: number): void {
    this.seed = seed;
    this.board = growBoard(createRng(seed).stream('map'), this.lib, {
      width: this.opts.mapX,
      height: this.opts.mapY,
      startTileId: 'spawn',
      // Mid-run snapshot, not endgame: visible void is the game's shape.
      maxTiles: Math.floor(this.opts.mapX * this.opts.mapY * 0.6),
    });
    this.cells = resolveCells(this.board, this.lib);
  }

  tilesLaid(): number {
    return this.board.slots.filter(Boolean).length;
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
    term.write(0, 0, `ASCII DEFENSE \u00b7 terrain demo \u00b7 seed ${this.seed}`, role('ui.accent'));
    term.write(
      0,
      1,
      `hover inspects \u00b7 click selects \u00b7 R rerolls \u00b7 ?seed=${this.seed} pins this board \u00b7 ${this.tilesLaid()} tiles grown from the spawn`,
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

        const pool = POOLS[kind];
        const c3 = [
          role(`terrain.${TERRAIN_KEY[kind]}.mid`),
          role(`terrain.${TERRAIN_KEY[kind]}.lit`),
          role(`terrain.${TERRAIN_KEY[kind]}.dark`),
        ];
        const bg = hovered ? '#2a3a4d' : c3[2];
        for (let y = 0; y < CELL_H; y++)
          for (let x = 0; x < CELL_W; x++) {
            const g = pool[Math.floor(hash2(gx0 + x, gy0 + y, 6) * pool.length) % pool.length];
            term.put(gx0 + x, gy0 + y, g, hash2(gx0 + x, gy0 + y, 9) < 0.2 ? c3[1] : c3[0], bg);
          }

        if (kind === 'G' && decor.chance(0.16)) {
          const art = TOWERS[towerN % TOWERS.length];
          const col = role(`path.${(towerN % 4) + 1}`);
          towerN++;
          for (let r = 0; r < CELL_H; r++)
            for (let c = 0; c < CELL_W; c++) {
              const chr = art[r][c];
              if (chr === ' ' || !term.has(chr)) continue;
              term.put(gx0 + c, gy0 + r, chr, TOWER_CORE.test(chr) ? col : role('tower.frame'), hovered ? bg : role('tower.ground'));
            }
        }
        if (kind === 'R' && decor.chance(0.12))
          for (let i = 0; i < Math.min(CELL_W, ENEMY.length); i++)
            if (term.has(ENEMY[i])) term.put(gx0 + i, gy0, ENEMY[i], role('enemy.eye'), bg);
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

const TERRAIN_KEY: Record<CellType, string> = {
  G: 'ground',
  R: 'road',
  K: 'rock',
  O: 'ore',
  S: 'spawn',
};

/** Stateless mixing hash for per-glyph texture (ASSETS.md sec 5). */
function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
