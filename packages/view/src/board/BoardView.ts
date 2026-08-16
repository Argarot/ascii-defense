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

// Per-tower placeholder art; the real sprite pipeline (Phase 2) replaces
// these with REXPaint-authored tiers. Distinct silhouettes so types read at
// a glance (Daniil).
const TOWER_ART_BY_ID: Record<string, { art: string[]; coreRole: string }> = {
  bolt: { art: ['.-^-.', '|[O]|', "'---'"], coreRole: 'path.1' },
  mortar: { art: [',===.', '|(M)|', "'---'"], coreRole: 'path.2' },
  frost: { art: ['*~.~*', '<(F)>', '*~.~*'], coreRole: 'enemy.shell' },
  refinery: { art: ['_/=\\_', '|[R]|', '|___|'], coreRole: 'terrain.ore.lit' },
};
const TOWER_ART_DEFAULT = { art: ['.-^-.', '|[?]|', "'---'"], coreRole: 'path.3' };
const TOWER_CORE = /[OMFR?]/;

// Per-enemy-type look, so the roster is readable on the board. Placeholder
// until sprites; unknown ids fall back to the classic '@'.
const ENEMY_LOOK: Record<string, { glyph: string; roleName: string }> = {
  grunt: { glyph: '@', roleName: 'enemy.eye' },
  skitter: { glyph: 'x', roleName: 'enemy.fast' },
  swarmling: { glyph: 'm', roleName: 'enemy.swarm' },
  brute: { glyph: 'B', roleName: 'enemy.brute' },
  shell: { glyph: 'S', roleName: 'enemy.shell' },
  husk: { glyph: 'H', roleName: 'enemy.husk' },
};

const DESCRIBE: Record<CellType, string> = {
  G: 'ground \u00b7 buildable',
  R: 'road \u00b7 NEVER buildable',
  r: 'road \u00b7 NEVER buildable \u00b7 lane B',
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


export interface RenderState {
  hover: CellRef | null;
  selected: CellRef | null;
  /** Walkers in continuous cell units (subcell resolution), with their def id
   *  so each enemy type reads differently on the board. */
  enemies?: readonly { x: number; y: number; id?: string }[];
  /** Live towers, in cell coordinates, with their def id for per-type art. */
  towers?: readonly { x: number; y: number; id?: string }[];
  /** Projectiles in flight, continuous cell units. */
  projectiles?: readonly { x: number; y: number }[];
  /** The hovered cell accepts a build right now (sim's verdict, not ours). */
  hoverBuildable?: boolean;
  /** Faint markers on tile corners - the map's seams, visible on demand. */
  showGrid?: boolean;
  /** Range overlay for the selected tower, in cell units. */
  range?: { x: number; y: number; r: number } | null;
  /** The range shown is a pre-build preview: pulse it. */
  rangeIsPreview?: boolean;
  /** Entries the NEXT wave attacks from - telegraphed with blinking '!' markers. */
  telegraph?: readonly CellRef[];
  /** Entries spawning RIGHT NOW - steady markers, no blink. */
  activeEntries?: readonly CellRef[];
  /** Unclaimed relic caches - drawn as a bright find on the terrain. */
  caches?: readonly CellRef[];
  /** Ore cells' remaining richness 0..1 - scales the gold-speck density. */
  oreRichness?: readonly { x: number; y: number; frac: number }[];
  /** The Core has fallen; draw the end screen over everything. */
  gameOver?: boolean;
  /** Expanding pulse rings: age01 runs 0 (just fired) to 1 (full range). */
  pulses?: readonly { x: number; y: number; r: number; age01: number }[];
  /** Animation phase 0..1 for breathing UI (telegraphs). */
  phase?: number;
}

export class BoardView {
  private board!: Board;
  private cells!: (CellType | null)[];

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
  /** Apply the sim's terrain mutations (prospected rocks). Idempotent. */
  private appliedChanges = 0;
  applyCellChanges(changes: readonly { x: number; y: number; t: string }[]): void {
    for (; this.appliedChanges < changes.length; this.appliedChanges++) {
      const c = changes[this.appliedChanges];
      this.cells[c.y * this.cellsW + c.x] = c.t as (typeof this.cells)[number];
    }
  }

  setMap(map: GeneratedMap): void {
    this.appliedChanges = 0;
    this.board = map.board;
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
    const richnessAt = state.oreRichness
      ? new Map(state.oreRichness.map((r) => [r.y * this.cellsW + r.x, r.frac]))
      : undefined;
    const offsetY = 0; // the board owns its whole surface; text lives in HudPanel

    term.clear(role('ui.bg'));

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
          richness: kind === 'O' ? richnessAt?.get(cy * this.cellsW + cx) : undefined,
        });
      }

    // Real towers - the demo's fake scatter is gone; every tower drawn here
    // exists in the sim, occupies its cell, and has a kill count.
    for (const t of state.towers ?? []) {
      const look = (t.id && TOWER_ART_BY_ID[t.id]) || TOWER_ART_DEFAULT;
      const gx0 = t.x * CELL_W;
      const gy0 = offsetY + t.y * CELL_H;
      for (let r = 0; r < CELL_H; r++)
        for (let c = 0; c < CELL_W; c++) {
          const chr = look.art[r][c];
          if (chr === ' ' || !term.has(chr)) continue;
          term.put(gx0 + c, gy0 + r, chr, TOWER_CORE.test(chr) ? role(look.coreRole) : role('tower.frame'), role('tower.ground'));
        }
    }

    // Pulse rings: each recent emission expands from its tower to full range
    // and fades - drawn with relative shading so it reads as light, not paint.
    for (const pu of state.pulses ?? []) {
      const rNow = pu.r * pu.age01;
      const band = 0.24;
      const minGx = Math.max(0, Math.floor((pu.x - rNow - 1) * CELL_W));
      const maxGx = Math.min(this.cellsW * CELL_W - 1, Math.ceil((pu.x + rNow + 1) * CELL_W));
      const minGy = Math.max(0, Math.floor((pu.y - rNow - 1) * CELL_H));
      const maxGy = Math.min(this.cellsH * CELL_H - 1, Math.ceil((pu.y + rNow + 1) * CELL_H));
      const strength = 1 + 1.4 * (1 - pu.age01);
      for (let gy = minGy; gy <= maxGy; gy++)
        for (let gx = minGx; gx <= maxGx; gx++) {
          const ux = (gx + 0.5) / CELL_W - pu.x;
          const uy = (gy + 0.5) / CELL_H - pu.y;
          if (Math.abs(Math.sqrt(ux * ux + uy * uy) - rNow) <= band) {
            term.shade(gx, offsetY + gy, strength, 0.08);
          }
        }
    }

    // Range OUTLINE for the selected tower, at glyph (subcell) resolution:
    // tint only the glyphs whose distance from the tower's center sits on
    // the radius, giving a near-true circle instead of a blocky area fill.
    if (state.range) {
      const cx = state.range.x + 0.5;
      const cy = state.range.y + 0.5;
      const r = state.range.r;
      // Band half-width in cell units: wide enough that every glyph row and
      // column the circle crosses catches at least one tinted glyph.
      const band = 0.22;
      const minGx = Math.max(0, Math.floor((cx - r - 1) * CELL_W));
      const maxGx = Math.min(this.cellsW * CELL_W - 1, Math.ceil((cx + r + 1) * CELL_W));
      const minGy = Math.max(0, Math.floor((cy - r - 1) * CELL_H));
      const maxGy = Math.min(this.cellsH * CELL_H - 1, Math.ceil((cy + r + 1) * CELL_H));
      for (let gy = minGy; gy <= maxGy; gy++)
        for (let gx = minGx; gx <= maxGx; gx++) {
          const ux = (gx + 0.5) / CELL_W;
          const uy = (gy + 0.5) / CELL_H;
          const dx = ux - cx;
          const dy = uy - cy;
          if (Math.abs(Math.sqrt(dx * dx + dy * dy) - r) <= band) {
            // Brighten what is already there - the ring wears the terrain's
            // own tone instead of flat paint (Daniil). Previews breathe.
            const mul = state.rangeIsPreview ? 1.3 + 0.9 * Math.abs(((state.phase ?? 0) * 2) % 2 - 1) : 1.9;
            term.shade(gx, offsetY + gy, mul, 0.07);
          }
        }
    }

    // Tile seams, on demand (G key): ONE brightened glyph per tile (top-left
    // corner - corners touch, so one per tile draws the whole lattice), shaded
    // relative to the terrain underneath rather than flat-painted.
    if (state.showGrid) {
      const TGX = TILE_SIZE * CELL_W;
      const TGY = TILE_SIZE * CELL_H;
      for (let ty = 0; ty < this.opts.mapY; ty++)
        for (let tx = 0; tx < this.opts.mapX; tx++) {
          if (!slotAt(this.board, tx, ty)) continue;
          term.shade(tx * TGX, offsetY + ty * TGY, 2.4, 0.1);
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

    // Unclaimed caches: a bright '?' plate - something IS here, go pay for
    // it. Claimed ones simply stop being drawn (the list shrinks).
    for (const c of state.caches ?? []) {
      const gx = c.x * CELL_W;
      const gy = offsetY + c.y * CELL_H;
      term.put(gx + 1, gy + 1, '[', role('terrain.ore.lit'));
      term.put(gx + 2, gy + 1, '?', '#ffffff', '#5a4a12');
      term.put(gx + 3, gy + 1, ']', role('terrain.ore.lit'));
    }

    // Entry markers, two honest states (Daniil: a blink at a quiet entry
    // reads as a lie). STEADY plate = enemies are entering here right now;
    // BREATHING '!' = the next wave will enter here. An entry can be both.
    for (const t of state.activeEntries ?? []) {
      const gx = t.x * CELL_W;
      const gy = offsetY + t.y * CELL_H;
      term.put(gx + 1, gy + 1, '>', '#ffffff', '#8a2231');
      term.put(gx + 3, gy + 1, '>', '#ffffff', '#8a2231');
    }
    const breathe = 1.3 + 1.5 * Math.abs(((state.phase ?? 0) * 2) % 2 - 1);
    for (const t of state.telegraph ?? []) {
      const gx = t.x * CELL_W;
      const gy = offsetY + t.y * CELL_H;
      for (let yy = 0; yy < CELL_H; yy++)
        for (let xx = 0; xx < CELL_W; xx++) term.shade(gx + xx, gy + yy, breathe, 0.12);
      // No bold in a bitmap font; contrast does bold's job - bright glyphs
      // on a solid dark-red plate that the breathing cannot wash out.
      term.put(gx + 1, gy + 1, '!', '#ffffff', '#8a2231');
      term.put(gx + 3, gy + 1, '!', '#ffffff', '#8a2231');
    }

    // Selection brackets last, over everything. Selecting any Core cell
    // brackets the WHOLE Core block (Daniil) - the building is the unit,
    // not one of its nine cells.
    if (state.selected) {
      let x0 = state.selected.x;
      let y0 = state.selected.y;
      let x1 = x0;
      let y1 = y0;
      if (this.cellType(state.selected) === 'C') {
        const seen = new Set<number>([y0 * this.cellsW + x0]);
        const stack = [[x0, y0]];
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
          y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = cx + dx; const ny = cy + dy;
            const k = ny * this.cellsW + nx;
            if (nx >= 0 && ny >= 0 && nx < this.cellsW && ny < this.cellsH && this.cells[k] === 'C' && !seen.has(k)) {
              seen.add(k); stack.push([nx, ny]);
            }
          }
        }
      }
      const gx0 = x0 * CELL_W;
      const gy0 = offsetY + y0 * CELL_H;
      const gx1 = x1 * CELL_W + CELL_W - 1;
      const gy1 = offsetY + y1 * CELL_H + CELL_H - 1;
      const accent = role('ui.accent');
      term.put(gx0, gy0, '┌', accent);
      term.put(gx1, gy0, '┐', accent);
      term.put(gx0, gy1, '└', accent);
      term.put(gx1, gy1, '┘', accent);
    }

    // The end. A dark band across the middle so the message owns the eye.
    if (state.gameOver) {
      const msg = 'THE  CORE  HAS  FALLEN';
      const sub = 'press R for a new run';
      const midY = Math.floor((this.cellsH * CELL_H) / 2);
      const midX = Math.floor((this.cellsW * CELL_W) / 2);
      for (let y = midY - 2; y <= midY + 2; y++)
        for (let x = 0; x < this.cellsW * CELL_W; x++) term.put(x, y, ' ', role('ui.bg'), '#12060a');
      term.write(midX - Math.floor(msg.length / 2), midY - 1, msg, role('enemy.fast'));
      term.write(midX - Math.floor(sub.length / 2), midY + 1, sub, role('ui.dim'));
    }

    term.flush();
  }
}
