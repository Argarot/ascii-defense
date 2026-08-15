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

// Bolt Turret placeholder art; the real sprite pipeline (Phase 2) replaces
// this with REXPaint-authored tiers.
const TOWER_ART = ['.-^-.', '|[O]|', "'---'"];
const TOWER_CORE = /[O@$8]/;

// Per-enemy-type look, so the roster is readable on the board. Placeholder
// until sprites; unknown ids fall back to the classic '@'.
const ENEMY_LOOK: Record<string, { glyph: string; roleName: string }> = {
  grunt: { glyph: '@', roleName: 'enemy.eye' },
  skitter: { glyph: 'x', roleName: 'enemy.fast' },
};

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
  /** Pixels per glyph (native font size). */
  glyphPxW: number;
  glyphPxH: number;
}

/** Text rows below the board: inspector, title, help. */
export const HUD_ROWS = 3;

export interface RenderState {
  hover: CellRef | null;
  selected: CellRef | null;
  /** Walkers in continuous cell units (subcell resolution), with their def id
   *  so each enemy type reads differently on the board. */
  enemies?: readonly { x: number; y: number; id?: string }[];
  /** Live towers, in cell coordinates. */
  towers?: readonly { x: number; y: number }[];
  /** Projectiles in flight, continuous cell units. */
  projectiles?: readonly { x: number; y: number }[];
  /** The hovered cell accepts a build right now (sim's verdict, not ours). */
  hoverBuildable?: boolean;
  /** Replaces the inspector line when the app knows better (tower stats). */
  inspectorOverride?: string;
  /** Right side of the title row: sim status (breaches, speed). */
  status?: string;
  /** Faint markers on tile corners - the map's seams, visible on demand. */
  showGrid?: boolean;
  /** Range overlay for the selected tower, in cell units. */
  range?: { x: number; y: number; r: number } | null;
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
    const { glyphPxW, glyphPxH } = this.opts;
    const x = Math.floor(px / (glyphPxW * CELL_W));
    const y = Math.floor(py / (glyphPxH * CELL_H));
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
    const offsetY = 0; // board at the top; HUD text lives BELOW the board
    const hudY = this.cellsH * CELL_H;

    term.clear(role('ui.bg'));
    // Bottom HUD rows: inspector nearest the board, then title, then help.
    term.write(
      0,
      hudY,
      state.inspectorOverride ?? this.describeCell(state.selected ?? state.hover),
      role('ui.text'),
    );
    term.write(0, hudY + 1, `ASCII DEFENSE \u00b7 generated map \u00b7 seed ${this.seed}`, role('ui.accent'));
    if (state.status) {
      term.write(this.cellsW * CELL_W - state.status.length, hudY + 1, state.status, role('ui.accent'));
    }
    term.write(
      0,
      hudY + 2,
      `hover inspects \u00b7 click selects/builds \u00b7 R rerolls \u00b7 G tile seams \u00b7 X sells \u00b7 ?seed=${this.seed} pins this map \u00b7 ${this.map.entries.length} entries`,
      role('ui.dim'),
    );

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

        // Buildable-and-hovered glows green: the sim said yes, the view shows
        // it. Ordinary hover stays neutral blue-grey.
        const hoverBg = hovered ? (state.hoverBuildable ? '#17402f' : '#2a3a4d') : undefined;
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
      }

    // Real towers - the demo's fake scatter is gone; every tower drawn here
    // exists in the sim, occupies its cell, and has a kill count.
    for (const t of state.towers ?? []) {
      const gx0 = t.x * CELL_W;
      const gy0 = offsetY + t.y * CELL_H;
      for (let r = 0; r < CELL_H; r++)
        for (let c = 0; c < CELL_W; c++) {
          const chr = TOWER_ART[r][c];
          if (chr === ' ' || !term.has(chr)) continue;
          term.put(gx0 + c, gy0 + r, chr, TOWER_CORE.test(chr) ? role('path.1') : role('tower.frame'), role('tower.ground'));
        }
    }

    // Range overlay for the selected tower: tint (background-only, glyphs
    // untouched) every cell whose center the tower can reach. No guesswork.
    if (state.range) {
      const { x: rx, y: ry, r } = state.range;
      const r2 = r * r;
      const minX = Math.max(0, Math.floor(rx - r));
      const maxX = Math.min(this.cellsW - 1, Math.ceil(rx + r));
      const minY = Math.max(0, Math.floor(ry - r));
      const maxY = Math.min(this.cellsH - 1, Math.ceil(ry + r));
      for (let cy = minY; cy <= maxY; cy++)
        for (let cx = minX; cx <= maxX; cx++) {
          const dx = cx - rx;
          const dy = cy - ry;
          if (dx * dx + dy * dy > r2) continue;
          if (this.cells[cy * this.cellsW + cx] === null) continue;
          for (let y = 0; y < CELL_H; y++)
            for (let x = 0; x < CELL_W; x++) term.tint(cx * CELL_W + x, offsetY + cy * CELL_H + y, '#1c3a52');
        }
    }

    // Tile seams, on demand (G key): L-shaped BACKGROUND tints on each
    // corner (3 glyphs: corner + one along each edge). Tinting leaves the
    // terrain glyphs untouched, so seams never erase structures (Daniil).
    if (state.showGrid) {
      const seam = '#3a4d63';
      const TGX = TILE_SIZE * CELL_W;
      const TGY = TILE_SIZE * CELL_H;
      for (let ty = 0; ty < this.opts.mapY; ty++)
        for (let tx = 0; tx < this.opts.mapX; tx++) {
          if (!slotAt(this.board, tx, ty)) continue;
          const x0 = tx * TGX;
          const x1 = tx * TGX + TGX - 1;
          const y0 = offsetY + ty * TGY;
          const y1 = offsetY + ty * TGY + TGY - 1;
          for (const [cxr, cyr, hx, vy] of [
            [x0, y0, 1, 1],
            [x1, y0, -1, 1],
            [x0, y1, 1, -1],
            [x1, y1, -1, -1],
          ] as const) {
            term.tint(cxr, cyr, seam);
            term.tint(cxr + hx, cyr, seam);
            term.tint(cxr, cyr + vy, seam);
          }
        }
    }

    // Real walkers, drawn at subcell resolution: continuous cell coords map
    // to the 5x3 glyph grid, so motion has 5 horizontal steps per cell
    // instead of snapping cell to cell. Each enemy type has its own look.
    for (const e of state.enemies ?? []) {
      const gx = Math.floor(e.x * CELL_W);
      const gy = offsetY + Math.floor(e.y * CELL_H);
      const look = (e.id && ENEMY_LOOK[e.id]) || ENEMY_LOOK.grunt;
      term.put(gx, gy, look.glyph, role(look.roleName));
    }

    // Projectiles: single bright glyphs streaking at subcell resolution.
    for (const p of state.projectiles ?? []) {
      const gx = Math.floor(p.x * CELL_W);
      const gy = offsetY + Math.floor(p.y * CELL_H);
      term.put(gx, gy, '*', role('tower.core'));
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
