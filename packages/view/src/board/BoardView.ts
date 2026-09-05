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
  mapCells,
  CORE_STRIP,
  slotAt,
  type Board,
  type CellType,
  type GeneratedMap,
} from '@ascii-defense/engine';
import type { TermSurface } from '@ascii-defense/render';
import type { Sprite } from '@ascii-defense/content';
import { role } from '../palette';
import { isReducedMotion } from '../motion';
import { CELL_H, CELL_W, drawStripCell, drawTerrainCell, drawVoidCell } from './style';
import { attackLook, drawSpriteFrame, idleFrame } from './sprites';

export { CELL_W, CELL_H } from './style';

// Fallback art for a tower with no sprite in content - distinct silhouette,
// no animation. Every shipped tower has a sprite; this catches new content
// authored ahead of its art.
const TOWER_CORE = /[OMFR?]/;
/** A framed box with '[?]' in the middle, at whatever size the cell is. */
function fallbackArt(w: number, h: number): string[] {
  const mid = Math.floor(h / 2);
  const cx = Math.floor(w / 2);
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      if (y === 0) row += x === 0 || x === w - 1 ? '.' : x === cx ? '^' : '-';
      else if (y === h - 1) row += x === 0 || x === w - 1 ? "'" : '-';
      else if (y === mid && x >= cx - 1 && x <= cx + 1) row += '[?]'[x - (cx - 1)];
      else row += x === 0 || x === w - 1 ? '|' : ' ';
    }
    rows.push(row);
  }
  return rows;
}
const TOWER_ART_DEFAULT = { art: fallbackArt(CELL_W, CELL_H), coreRole: 'path.3' };
/** The middle row and the three middle columns of a cell - where markers sit. */
const MID_Y = Math.floor(CELL_H / 2);
const MID_X = Math.floor(CELL_W / 2);

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

/**
 * What a shot looks like, by the tower that fired it (Daniil, session 23:
 * the Bolt and the Mortar shared one '*' and read as the same weapon). A
 * bolt is a short bright dash in the turret's own shaft colour; a shell is
 * the heavy white burst it always was. Unknown kinds keep the shell.
 */
const PROJECTILE_LOOK: Record<string, { glyph: string; roleName: string }> = {
  bolt: { glyph: '-', roleName: 'tower.bolt.bolt_shaft' },
  mortar: { glyph: '*', roleName: 'tower.core' },
  missile: { glyph: '>', roleName: 'fx.ember' },
};
const PROJECTILE_DEFAULT = PROJECTILE_LOOK.mortar;

const DESCRIBE: Record<CellType, string> = {
  G: 'ground \u2802 buildable',
  X: 'road crossroads \u2802 NEVER buildable',
  B: 'road \u2802 NEVER buildable \u2802 bridge',
  '-': 'road segment \u2802 east-west',
  '|': 'road segment \u2802 north-south',
  L: 'road segment \u2802 bends north-east',
  J: 'road segment \u2802 bends north-west',
  F: 'road segment \u2802 bends south-east',
  '7': 'road segment \u2802 bends south-west',
  T: 'road junction \u2802 T \u2802 stem south',
  U: 'road junction \u2802 T \u2802 stem north',
  E: 'road junction \u2802 T \u2802 opens east',
  '3': 'road junction \u2802 T \u2802 opens west',
  R: 'rock \u2802 blocked',
  O: 'ore \u2802 buildable \u2802 a refinery here mines Ore',
  C: 'the CORE \u2802 protect this \u2802 every road leads here',
};

export interface CellRef {
  x: number;
  y: number;
}

/**
 * The sprite state for a tower's committed choices: option indices per tier,
 * in tier order, stopping at the first uncommitted tier ('' = base). Falls
 * back through shorter prefixes so a sprite authored for fewer tiers still
 * resolves; '' must exist (the linter does not enforce that yet).
 */
export function spriteState(sp: Sprite, choices: readonly number[]): Sprite['states'][string] {
  return spriteStateFor(sp, choices).st;
}

const FACING_LETTER = ['n', 'e', 's', 'w'] as const;

/**
 * The state for choices AND a facing (session 27; docs/ART-AGENT.md sec 4):
 * a key with '/n', '/e', '/s' or '/w' appended is preferred when the tower
 * faces that way, at every prefix length; `faced` says whether one was
 * found (the view draws an arrow otherwise).
 */
export function spriteStateFor(sp: Sprite, choices: readonly number[], facing?: number): { st: Sprite['states'][string]; faced: boolean } {
  let key = '';
  for (const c of choices) {
    if (c < 0) break;
    key += String(c);
  }
  const letter = facing !== undefined ? FACING_LETTER[facing] : undefined;
  for (let k = key; ; k = k.slice(0, -1)) {
    if (letter) {
      const faced = sp.states[`${k}/${letter}`];
      if (faced) return { st: faced, faced: true };
    }
    const st = sp.states[k];
    if (st) return { st, faced: false };
    if (k === '') throw new Error(`sprite '${sp.id}' has no base state ''`);
  }
}

export interface BoardViewOptions {
  /** Board size in tiles. */
  mapX: number;
  mapY: number;
  /** Pixels per glyph (native font size). */
  glyphPxW: number;
  glyphPxH: number;
  /** Validated sprites by content id; towers without one get fallback art. */
  sprites?: readonly Sprite[];
}


export interface RenderState {
  hover: CellRef | null;
  selected: CellRef | null;
  /** Walkers in continuous cell units (subcell resolution), with their def id
   *  so each enemy type reads differently on the board, plus the readout
   *  state (WBS 2.14): shield bracket, health mark, slow tint. No tooltips -
   *  the enemy itself is the readout (PRD sec 8). */
  /** frozen and slows (distinct sources) draw as marks beside the walker (WBS 2.31). */
  enemies?: readonly { x: number; y: number; id?: string; hp01?: number; shielded?: boolean; slowed?: boolean; frozen?: boolean; slows?: number; k?: number; g?: number }[];
  /** Live towers, in cell coordinates, with their def id for per-type art and
   *  their committed choices for per-state art (sprite v2). */
  /** cooldown01 runs 1 (just fired) to 0 (ready); sinceFire is ticks since the last shot, -1 before the first (session 25). */
  towers?: readonly { x: number; y: number; id?: string; choices?: readonly number[]; cooldown01?: number; sinceFire?: number; facing?: number }[];
  /** Projectiles in flight, continuous cell units; per-tick velocity, when
   *  given, draws a short trail behind the head (WBS 4.1). */
  /** Shots in flight; `kind` is the firing tower's id, which picks the glyph. */
  projectiles?: readonly { x: number; y: number; vx?: number; vy?: number; kind?: string; k?: number }[];
  /** The hovered cell accepts a build right now (sim's verdict, not ours). */
  hoverBuildable?: boolean;
  /** Faint markers on tile corners - the map's seams, visible on demand. */
  showGrid?: boolean;
  /** Range overlay for the selected tower, in cell units; minR = the dead zone. */
  /** beam: a line-shaped tower's corridor (dir 0 n, 1 e, 2 s, 3 w; w cells wide) drawn instead of the rings (WBS 2.34). */
  range?: { x: number; y: number; r: number; minR?: number; beam?: { dir: number; w: number } } | null;
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
  /** The sim's route graph (FlowField.allowed): legal steps per cell. Kerbs
   *  are drawn from ITS verdict, so what looks connected IS connected. */
  routeAllowed?: Uint8Array;
  /** Boon cells (PRD sec 4.7) - corner marks = tier, visible under towers; the type picks the colour (4.29). */
  boons?: readonly { x: number; y: number; tier?: number; boon?: 'range' | 'damage' | 'rate' }[];
  /** The Core has fallen; draw the end screen over everything. */
  gameOver?: boolean;
  /** Animation phase 0..1 for breathing UI (telegraphs). */
  phase?: number;
  /**
   * Ambient wall-clock milliseconds for idle sprite frames (WBS 4.1). The
   * app freezes this at 0 under reduced motion, pinning every idle cycle to
   * frame 0; the sim never sees it (ambient time is presentation time).
   */
  animMs?: number;
  /** Terrain drift step - a slowly advancing integer; 0 = static ground. */
  drift?: number;
}

export class BoardView {
  private board!: Board;
  private cells!: (CellType | null)[];
  private readonly sprites: Map<string, Sprite>;

  readonly cellsW: number;
  readonly cellsH: number;

  constructor(
    private term: TermSurface,
    private lib: TileLibrary,
    private opts: BoardViewOptions,
  ) {
    // The board's tiles plus the Core strip past the east border (session 24).
    this.cellsW = opts.mapX * TILE_SIZE + CORE_STRIP;
    this.cellsH = opts.mapY * TILE_SIZE;
    this.sprites = new Map((opts.sprites ?? []).map((s) => [s.id, s]));
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
    if (map.cellsW !== this.cellsW || map.cellsH !== this.cellsH) {
      throw new Error(`map cell grid ${map.cellsW}x${map.cellsH} does not fit this view (${this.cellsW}x${this.cellsH})`);
    }
    this.cells = mapCells(map, this.lib);
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
    const base = t === null ? 'void \u2802 unclaimed land \u2802 the run grows here' : DESCRIBE[t];
    return `cell ${ref.x},${ref.y} \u2802 ${base}`;
  }

  render(state: RenderState, overlay?: (term: TermSurface) => void): void {
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

        if (kind === null && cx >= this.opts.mapX * TILE_SIZE) {
          // The Core strip (session 24): the column past the east border
          // that holds the Core face. Since session 25 mapCells fills it
          // with ground, so this is the wall only for a grid that left it
          // empty (a test's hand-built map).
          drawStripCell(term, gx0, gy0);
          continue;
        }
        if (kind === null) {
          // Void is WATER (PRD sec 13): unclaimed land reads as a surface,
          // not a hole. Hover still answers so the edge is discoverable.
          // The shore mask names which sides face land (6.6): those edges
          // grow the beach band. Land never becomes water mid-run, so
          // reading neighbours per frame is cheap and always current.
          let shore = 0;
          if (cy > 0 && this.cells[(cy - 1) * this.cellsW + cx] !== null) shore |= 1;
          if (cx + 1 < this.cellsW && this.cells[cy * this.cellsW + cx + 1] !== null) shore |= 2;
          if (cy + 1 < this.cellsH && this.cells[(cy + 1) * this.cellsW + cx] !== null) shore |= 4;
          if (cx > 0 && this.cells[cy * this.cellsW + cx - 1] !== null) shore |= 8;
          drawVoidCell(term, gx0, gy0, state.drift ?? 0, hovered ? '#1a2330' : undefined, shore);
          continue;
        }

        // The Core FACE from its sprite when content has one (session 25):
        // the three stacked cells are the states top, mid, bot, found by
        // counting the face cells above this one in the column.
        const face = kind === 'C' ? this.sprites.get('core_face') : undefined;
        if (face) {
          let above = 0;
          for (let y = cy - 1; y >= 0 && this.cells[y * this.cellsW + cx] === 'C'; y--) above++;
          const st = face.states[above === 0 ? 'top' : above === 1 ? 'mid' : 'bot'];
          if (st) {
            const dark = role('terrain.core.dark');
            for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) term.put(gx0 + x, gy0 + y, ' ', dark, hovered ? '#2a3a4d' : dark);
            drawSpriteFrame(term, face, idleFrame(face, st, state.animMs ?? 0, above), gx0, gy0, { groundRole: 'terrain.core.dark' });
            continue;
          }
        }
        // Buildable-and-hovered glows green: the sim said yes, the view shows
        // it. Ordinary hover stays neutral blue-grey.
        const hoverBg = hovered ? (state.hoverBuildable ? '#17402f' : '#2a3a4d') : undefined;
        // Boundary shading only for landmass types: roads read as routes and
        // the Core has its own look; ground/rock/ore get mass edges.
        const shaded = kind === 'G' || kind === 'R' || kind === 'O';
        const north = cy > 0 ? this.cells[(cy - 1) * this.cellsW + cx] : null;
        const south = cy + 1 < this.cellsH ? this.cells[(cy + 1) * this.cellsW + cx] : null;
        drawTerrainCell(term, kind, gx0, gy0, {
          bg: hoverBg,
          litTop: shaded && north !== kind,
          shadowBottom: shaded && south !== kind,
          richness: kind === 'O' ? richnessAt?.get(cy * this.cellsW + cx) : undefined,
          rim: state.routeAllowed ? ~state.routeAllowed[cy * this.cellsW + cx] & 15 : 0,
          // Ground and the Core breathe; rock, roads and ore hold still -
          // moving glyphs on a cell the player reads for data would lie.
          drift: kind === 'G' || kind === 'C' ? state.drift : undefined,
        });
      }

    // Real towers - every tower drawn here exists in the sim, occupies its
    // cell, and has a kill count. Sprites come from content (WBS 4.1): the
    // base art plus optional idle frames, cycled on the AMBIENT clock so a
    // paused board still feels inhabited and reduced motion pins frame 0.
    for (const t of state.towers ?? []) {
      const sp = t.id ? this.sprites.get(t.id) : undefined;
      const gx0 = t.x * CELL_W;
      const gy0 = offsetY + t.y * CELL_H;
      if (sp) {
        // Sprite v2 (session 22): the state is keyed by the tower's committed
        // choices ('' base, '0', '01', '010'...), falling back to the longest
        // authored prefix so a sprite drawn for fewer tiers still shows.
        const { st, faced } = spriteStateFor(sp, t.choices ?? [], t.facing);
        const cycle = [st, ...(st.frames ?? [])];
        // Offset each tower's cycle by its position so a row of refineries
        // churns out of step instead of marching in lockstep.
        const fi =
          cycle.length > 1
            ? (Math.floor((state.animMs ?? 0) / (sp.frameMs ?? 600)) + t.x * 7 + t.y * 13) % cycle.length
            : 0;
        const frame = cycle[fi];
        // The ATTACK look (session 25): the tower's own fire/cool/charge
        // sequences at this moment of its cycle, or the derived placeholder;
        // idle when neither applies. Reduced motion keeps the idle frame.
        const look = isReducedMotion() ? null : attackLook(sp, st, frame, t.sinceFire ?? -1, t.cooldown01 ?? 0);
        if (look) {
          // The cell is repainted under a recoil so the vacated row is ground, not the previous frame.
          if (look.dy) for (let c = 0; c < CELL_W; c++) term.put(gx0 + c, gy0, ' ', role('tower.ground'), role('tower.ground'));
          drawSpriteFrame(term, sp, look.frame, gx0, gy0 + (look.dy ?? 0), { flatFg: look.flatFg, clipRows: CELL_H - (look.dy ?? 0) });
          if (look.overlay && gy0 + look.overlay.y >= 0) term.put(gx0 + look.overlay.x, gy0 + look.overlay.y, look.overlay.ch, role(look.overlay.role));
        } else {
          drawSpriteFrame(term, sp, frame, gx0, gy0);
        }
        // A line-shaped tower wears its facing as an arrow on the cell's
        // edge (WBS 2.34) until the art agent draws it per facing.
        if (t.facing !== undefined && !faced) {
          const ARROW = ['^', '>', 'v', '<'] as const;
          const ax = t.facing === 1 ? CELL_W - 1 : t.facing === 3 ? 0 : Math.floor(CELL_W / 2);
          const ay = t.facing === 0 ? 0 : t.facing === 2 ? CELL_H - 1 : Math.floor(CELL_H / 2);
          term.put(gx0 + ax, gy0 + ay, ARROW[t.facing], role('tower.laser.lens'));
        }
      } else {
        for (let r = 0; r < CELL_H; r++)
          for (let c = 0; c < CELL_W; c++) {
            const chr = TOWER_ART_DEFAULT.art[r][c];
            if (chr === ' ' || !term.has(chr)) continue;
            term.put(gx0 + c, gy0 + r, chr, TOWER_CORE.test(chr) ? role(TOWER_ART_DEFAULT.coreRole) : role('tower.frame'), role('tower.ground'));
          }
      }
    }

    // Range OUTLINE for the selected tower, at glyph (subcell) resolution:
    // tint only the glyphs whose distance from the tower's center sits on
    // the radius, giving a near-true circle instead of a blocky area fill.
    if (state.range?.beam) {
      // A CORRIDOR instead of rings (WBS 2.34): the cells the beam covers
      // down the facing, shaded, with the far end brighter.
      const { dir, w } = state.range.beam;
      const half = Math.max(0.5, w / 2);
      const dx = [0, 1, 0, -1][dir];
      const dy = [-1, 0, 1, 0][dir];
      const pulse = state.rangeIsPreview ? 0.6 * Math.abs(((state.phase ?? 0) * 2) % 2 - 1) : 0;
      for (let k = 1; k <= state.range.r; k++) {
        for (let side = -Math.ceil(half - 0.5); side <= Math.ceil(half - 0.5); side++) {
          const cx = state.range.x + dx * k + (dx === 0 ? side : 0);
          const cy = state.range.y + dy * k + (dy === 0 ? side : 0);
          if (cx < 0 || cy < 0 || cx >= this.cellsW || cy >= this.cellsH) continue;
          const s = 1.25 + 0.4 * (k / state.range.r) + pulse;
          for (let gy = 0; gy < CELL_H; gy++) for (let gx = 0; gx < CELL_W; gx++) term.shade(cx * CELL_W + gx, offsetY + cy * CELL_H + gy, s, 0.06);
        }
      }
    } else if (state.range) {
      // The range as THREE TOUCHING RINGS, one glyph row thin, stepping
      // inward from the radius and fading as they go (Daniil, session 23,
      // item 6 - the filled disc of design round 1 was not what he asked
      // for). The outline says where the reach ends; the fade says which
      // side is inside; the board under it stays readable. The dead zone
      // is the same drawing mirrored: three rings stepping OUTWARD from
      // minR and fading outward, in the same ink - the direction of the
      // fade is the whole message, no second colour needed.
      const cx = state.range.x + 0.5;
      const cy = state.range.y + 0.5;
      const r = state.range.r;
      const minR = state.range.minR ?? 0;
      // One glyph row, in cells: the thinnest ring the grid can draw. Each
      // glyph joins the ring nearest its distance, so the three rings touch.
      const step = 1 / CELL_H;
      const band = step / 2;
      const RING_SHADE = [1.9, 1.45, 1.2] as const;
      const pulse = state.rangeIsPreview ? 0.9 * Math.abs(((state.phase ?? 0) * 2) % 2 - 1) : 0;
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
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > r + band) continue;
          const outer = Math.round((r - d) / step); // 0 = the rim itself, counting inward
          if (outer >= 0 && outer < RING_SHADE.length) {
            const s = RING_SHADE[outer] * (state.rangeIsPreview ? 0.8 : 1);
            term.shade(gx, offsetY + gy, s + (outer === 0 ? pulse : pulse * 0.3), 0.07 - 0.02 * outer);
            continue;
          }
          if (minR <= 0 || d < minR - band) continue;
          const inner = Math.round((d - minR) / step); // 0 = the dead zone's edge, counting outward
          if (inner >= 0 && inner < RING_SHADE.length) {
            const s = RING_SHADE[inner] * (state.rangeIsPreview ? 0.8 : 1);
            term.shade(gx, offsetY + gy, s + pulse * 0.3, 0.07 - 0.02 * inner);
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
    // instead of snapping cell to cell. Each enemy type has its own look,
    // and the enemy IS its readout (2.14, PRD sec 8): a live shield is a
    // bracket around the glyph (destroyed separately from the body), damage
    // is a braille mark above, a slow is a cold tint underneath.
    const HP_RAMP = ['⡀', '⡄', '⡆', '⡇']; // ⡀⡄⡆⡇ - quarters of a life
    let walker = 0;
    for (const e of state.enemies ?? []) {
      const gx = Math.floor(e.x * CELL_W);
      const gy = offsetY + Math.floor(e.y * CELL_H);
      // A walker with a sprite (session 25, kind 'enemy') is drawn CENTRED
      // on its position, feet on the position row, transparent over the
      // road; a slow tints the glyphs' ground cold. Without one, the
      // single-glyph look stands.
      const sp = e.id ? this.sprites.get(`enemy_${e.id}`) : undefined;
      let left = gx;
      let right = gx;
      let top = gy;
      if (sp) {
        const [w, h] = sp.cell;
        left = gx - Math.floor(w / 2);
        right = left + w - 1;
        top = gy - (h - 1);
        const frame = idleFrame(sp, sp.states[''], state.animMs ?? 0, walker++);
        drawSpriteFrame(term, sp, frame, left, top, e.slowed ? { groundRole: 'status.slowed' } : { transparent: true });
      } else {
        const look = (e.id && ENEMY_LOOK[e.id]) || ENEMY_LOOK.grunt;
        term.put(gx, gy, look.glyph, role(look.roleName), e.slowed ? '#16303c' : undefined);
      }
      if (e.shielded) {
        term.put(left - 1, gy, '(', role('enemy.shell'));
        term.put(right + 1, gy, ')', role('enemy.shell'));
      }
      // Every status shows on the body (PRD sec 8, WBS 2.31): a cold '~'
      // per slow SOURCE stacked up the left side, a '*' when it stands
      // frozen. The colour presents; the glyph carries it.
      const marks = e.frozen ? ['*'] : Array.from({ length: Math.min(3, e.slows ?? (e.slowed ? 1 : 0)) }, () => '~');
      marks.forEach((m, i) => {
        const my = top - i;
        if (my >= 0) term.put(left - 2, my, m, role(m === '*' ? 'ui.text' : 'tower.frost.ice_edge'));
      });
      if (e.hp01 !== undefined && e.hp01 < 0.995) {
        // Glyph AND colour carry the bar (2.25, playtest 9): two braille
        // dots alone are too coarse, so the ramp is 4 glyph steps x 3
        // colour bands = 12 readable states. Colour presents, nothing
        // branches on it (invariant 10).
        const pip = HP_RAMP[Math.max(0, Math.min(3, Math.floor(e.hp01 * 4)))];
        const col = e.hp01 < 0.3 ? role('enemy.fast') : e.hp01 < 0.65 ? role('terrain.ore.mid') : role('ui.accent');
        // Top-row enemies flip the pip below the sprite - off-board clipping
        // was why "not all enemies show health bars" (playtest 10).
        term.put(gx, top > 0 ? top - 1 : gy + 1, pip, col);
      }
    }

    // Projectiles: a bright head streaking at subcell resolution, with a
    // short cooling trail along its own velocity (WBS 4.1) - the spray that
    // makes fire read as fire. Reduced motion keeps the head only.
    const trails = !isReducedMotion();
    for (const p of state.projectiles ?? []) {
      const gx = Math.floor(p.x * CELL_W);
      const gy = offsetY + Math.floor(p.y * CELL_H);
      if (trails && p.vx !== undefined && p.vy !== undefined) {
        for (const [k, chr, rn] of [[1.4, '+', 'fx.ember'], [2.8, '.', 'fx.smoke']] as const) {
          const tx = Math.floor((p.x - p.vx * k) * CELL_W);
          const ty = offsetY + Math.floor((p.y - p.vy * k) * CELL_H);
          if (tx !== gx || ty !== gy) term.put(tx, ty, chr, role(rn));
        }
      }
      const look = (p.kind && PROJECTILE_LOOK[p.kind]) || PROJECTILE_DEFAULT;
      term.put(gx, gy, look.glyph, role(look.roleName));
    }

    // Boon ground (PRD sec 4.7, 4.29 - Daniil): EACH BOON TYPE WEARS ITS OWN
    // COLOUR - a range platform, a heat sink and a power tap are three
    // backgrounds, not one. An EMPTY boon cell also shows corner GLYPHS so
    // the eye finds the cell it belongs to; once a tower stands on it only
    // the background survives (bg-only writes never disturb the tower's
    // glyphs). One corner per tier (playtest 5, item 8): glanceable rarity.
    const towerCells = new Set((state.towers ?? []).map((t) => t.y * this.cellsW + t.x));
    for (const b of state.boons ?? []) {
      const gx = b.x * CELL_W;
      const gy = offsetY + b.y * CELL_H;
      const colour = role(`boon.${b.boon ?? 'range'}`);
      const corners = [[0, 0, '┌'], [CELL_W - 1, 0, '┐'], [0, CELL_H - 1, '└'], [CELL_W - 1, CELL_H - 1, '┘']] as const;
      const built = towerCells.has(b.y * this.cellsW + b.x);
      for (let i = 0; i < Math.min(4, b.tier ?? 1); i++) {
        const [cx, cy, glyph] = corners[i];
        if (built || !term.has(glyph)) term.tint(gx + cx, gy + cy, colour);
        else term.put(gx + cx, gy + cy, glyph, role('ui.text'), colour);
      }
    }

    // Unclaimed caches: a bright '?' plate - something IS here, go pay for
    // it. Claimed ones simply stop being drawn (the list shrinks).
    for (const c of state.caches ?? []) {
      const gx = c.x * CELL_W;
      const gy = offsetY + c.y * CELL_H;
      term.put(gx + MID_X - 1, gy + MID_Y, '[', role('terrain.ore.lit'));
      term.put(gx + MID_X, gy + MID_Y, '?', '#ffffff', '#5a4a12');
      term.put(gx + MID_X + 1, gy + MID_Y, ']', role('terrain.ore.lit'));
    }

    // Entry markers, two honest states (Daniil: a blink at a quiet entry
    // reads as a lie). STEADY plate = enemies are entering here right now;
    // BREATHING '!' = the next wave will enter here. An entry can be both.
    for (const t of state.activeEntries ?? []) {
      const gx = t.x * CELL_W;
      const gy = offsetY + t.y * CELL_H;
      term.put(gx + MID_X - 1, gy + MID_Y, '>', '#ffffff', '#8a2231');
      term.put(gx + MID_X + 1, gy + MID_Y, '>', '#ffffff', '#8a2231');
    }
    const breathe = 1.3 + 1.5 * Math.abs(((state.phase ?? 0) * 2) % 2 - 1);
    for (const t of state.telegraph ?? []) {
      const gx = t.x * CELL_W;
      const gy = offsetY + t.y * CELL_H;
      for (let yy = 0; yy < CELL_H; yy++)
        for (let xx = 0; xx < CELL_W; xx++) term.shade(gx + xx, gy + yy, breathe, 0.12);
      // No bold in a bitmap font; contrast does bold's job - bright glyphs
      // on a solid dark-red plate that the breathing cannot wash out.
      term.put(gx + MID_X - 1, gy + MID_Y, '!', '#ffffff', '#8a2231');
      term.put(gx + MID_X + 1, gy + MID_Y, '!', '#ffffff', '#8a2231');
    }

    // The effects layer paints here - above the world, below the selection
    // brackets and any end screen (the UI always wins over eye candy).
    overlay?.(term);

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
      const sub = 'the summary has the rest';
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
