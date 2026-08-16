/**
 * Terrain tiles: 5x5 cell grids whose edge connectors are DERIVED, never
 * declared (PRD sec 4.2). The center-or-nothing rule is what makes invalid
 * boards unrepresentable:
 *
 *   - a road may cross a tile edge only at that edge's center cell
 *   - therefore "does this edge carry road" is a boolean, and two tiles agree
 *     on a shared edge iff those booleans are equal
 *   - inside the tile the road shape is arbitrary, Carcassonne-style
 *
 * A declared connector cannot disagree with the drawn cells because there is
 * no declared connector.
 */
import { isCellType, isRoad, isRouteCell, roadsConnect, type CellType } from '../grid/cells';

export const TILE_SIZE = 5;
const CENTER = 2; // (TILE_SIZE - 1) / 2

/** Content-format tile: id plus 5 strings of 5 cell codes. */
export interface TileDef {
  id: string;
  name?: string;
  cells: string[];
}

export type Edge = 'n' | 'e' | 's' | 'w';
export const EDGES: readonly Edge[] = ['n', 'e', 's', 'w'];
export const OPPOSITE: Record<Edge, Edge> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Which edges carry road. Derived from the grid, see deriveConnectors. */
export type Connectors = Record<Edge, boolean>;

/** Rotation in quarter turns clockwise. */
export type Rotation = 0 | 1 | 2 | 3;
export const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

/** Cell at (x, y) of a def's grid; y is the row index (northmost = 0). */
export function cellAt(cells: readonly string[], x: number, y: number): CellType {
  return cells[y][x] as CellType;
}

/** Directional glyphs rotate WITH the grid: up becomes right, and so on. */
const ROTATE_GLYPH: Record<string, string> = { '-': '|', '|': '-', L: 'F', F: '7', '7': 'J', J: 'L' };

/** Rotate the grid one quarter turn clockwise, k times. Pure. */
export function rotateCells(cells: readonly string[], k: Rotation): string[] {
  let out = cells.slice();
  for (let turn = 0; turn < k; turn++) {
    const prev = out;
    out = [];
    for (let y = 0; y < TILE_SIZE; y++) {
      let row = '';
      // Clockwise: new (x, y) reads old (y, SIZE-1-x).
      for (let x = 0; x < TILE_SIZE; x++) {
        const c = prev[TILE_SIZE - 1 - x][y];
        row += ROTATE_GLYPH[c] ?? c;
      }
      out.push(row);
    }
  }
  return out;
}

/**
 * Derive connectors from a grid - DIRECTIONALLY (PRD sec 4.2.1, Daniil's
 * insight): an edge carries a crossing only when its centre cell is road AND
 * the cell just inside continues that road inward (same lane, or Core). A
 * road that merely runs ALONG the border touches the edge without crossing
 * it - which is exactly how two tiles' roads touch without connecting.
 */
export function deriveConnectors(cells: readonly string[]): Connectors {
  const crossing = (cx: number, cy: number, ix: number, iy: number): boolean => {
    const centre = cellAt(cells, cx, cy);
    if (!isRoad(centre)) return false;
    const inward = cellAt(cells, ix, iy);
    if (!isRoad(inward) && inward !== 'C') return false;
    return roadsConnect(centre, inward, ix - cx, iy - cy);
  };
  return {
    n: crossing(CENTER, 0, CENTER, 1),
    s: crossing(CENTER, TILE_SIZE - 1, CENTER, TILE_SIZE - 2),
    w: crossing(0, CENTER, 1, CENTER),
    e: crossing(TILE_SIZE - 1, CENTER, TILE_SIZE - 2, CENTER),
  };
}

/**
 * Every rule that makes a tile grid legal. Returns human-readable reasons -
 * this exact function backs the content linter, the Tile Smith authoring tool
 * and the engine's own loading, so a tile that validates anywhere validates
 * everywhere.
 */
export function validateTileCells(cells: readonly string[]): string[] {
  const errors: string[] = [];

  // -- shape and vocabulary --------------------------------------------------
  if (cells.length !== TILE_SIZE) {
    return [`tile must have ${TILE_SIZE} rows, has ${cells.length}`];
  }
  for (let y = 0; y < TILE_SIZE; y++) {
    if (cells[y].length !== TILE_SIZE) {
      return [`row ${y} must have ${TILE_SIZE} cells, has ${cells[y].length}`];
    }
    for (let x = 0; x < TILE_SIZE; x++) {
      if (!isCellType(cells[y][x])) return [`cell (${x},${y}) has unknown type '${cells[y][x]}'`];
    }
  }

  const onEdge = (x: number, y: number): boolean =>
    x === 0 || y === 0 || x === TILE_SIZE - 1 || y === TILE_SIZE - 1;
  const isEdgeCenter = (x: number, y: number): boolean =>
    (x === CENTER && (y === 0 || y === TILE_SIZE - 1)) ||
    (y === CENTER && (x === 0 || x === TILE_SIZE - 1));

  // -- placement rules -------------------------------------------------------
  // (The old "roads touch edges only at centres" rule is GONE - session 14.
  // Roads may hug borders; only centre cells with inward continuation derive
  // crossings, so border roads touch neighbours without connecting.)
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      // Core cells are the route's terminus; on an edge they would read as a
      // connector while deriving none, which is a visual lie.
      if (cellAt(cells, x, y) === 'C' && onEdge(x, y)) {
        errors.push(`core at (${x},${y}) sits on an edge - the Core must be interior`);
      }
    }
  void onEdge;
  void isEdgeCenter;

  // -- lane continuity -------------------------------------------------------
  // Route cells form LANE components: 4-adjacent cells join when their lanes
  // join ('R' with 'R', 'r' with 'r', Core with anything). EVERY component
  // must derive at least one crossing, or it is a road to nowhere that can
  // never join the network - unreachable decoration is a lie in road's
  // clothing.
  const route: [number, number][] = [];
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++)
      if (isRouteCell(cellAt(cells, x, y))) route.push([x, y]);

  if (route.length > 0) {
    const key = (x: number, y: number): number => y * TILE_SIZE + x;
    const inRoute = new Set(route.map(([x, y]) => key(x, y)));
    const seenAll = new Set<number>();
    const conn = deriveConnectors(cells);
    const crossingCells = new Set<number>();
    if (conn.n) crossingCells.add(key(CENTER, 0));
    if (conn.s) crossingCells.add(key(CENTER, TILE_SIZE - 1));
    if (conn.w) crossingCells.add(key(0, CENTER));
    if (conn.e) crossingCells.add(key(TILE_SIZE - 1, CENTER));

    for (const [sx, sy] of route) {
      if (seenAll.has(key(sx, sy))) continue;
      // Flood one lane component.
      const comp = new Set<number>([key(sx, sy)]);
      const stack: [number, number][] = [[sx, sy]];
      while (stack.length) {
        const [x, y] = stack.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          const k = key(nx, ny);
          if (!inRoute.has(k) || comp.has(k)) continue;
          if (!roadsConnect(cellAt(cells, x, y), cellAt(cells, nx, ny), dx, dy)) continue;
          comp.add(k);
          stack.push([nx, ny]);
        }
      }
      let reaches = false;
      for (const k of comp) {
        seenAll.add(k);
        if (crossingCells.has(k)) reaches = true;
      }
      if (!reaches) {
        errors.push(`lane component at (${sx},${sy}) derives no crossing - a road that cannot join the network`);
      }
    }
  }

  return errors;
}

/**
 * Do ALL of this tile's crossings belong to one lane component - i.e. does
 * the tile actually ROUTE between every edge it presents? Single-lane tiles
 * always did, so connector booleans used to imply this for free. Lane tiles
 * (session 14) can present two crossings on two different roads - legal as
 * a tile, but unusable on a carved ROAD SLOT, where the generator needs the
 * path to pass THROUGH. The library index calls this to keep connectivity
 * by construction; a multi-lane tile that fails it is simply never dealt
 * onto a road slot. (Found live: a minted twin-stub tile with signature n.s
 * was placed as a straight and the route broke at boot.)
 */
export function crossingsInterconnect(cells: readonly string[]): boolean {
  const conn = deriveConnectors(cells);
  const crossings: [number, number][] = [];
  if (conn.n) crossings.push([CENTER, 0]);
  if (conn.s) crossings.push([CENTER, TILE_SIZE - 1]);
  if (conn.w) crossings.push([0, CENTER]);
  if (conn.e) crossings.push([TILE_SIZE - 1, CENTER]);
  if (crossings.length <= 1) return true;
  // Flood the lane component containing the first crossing.
  const key = (x: number, y: number): number => y * TILE_SIZE + x;
  const seen = new Set<number>([key(crossings[0][0], crossings[0][1])]);
  const stack = [crossings[0]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      if (!isRouteCell(cellAt(cells, nx, ny))) continue;
      if (!roadsConnect(cellAt(cells, x, y), cellAt(cells, nx, ny), dx, dy)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return crossings.every(([x, y]) => seen.has(key(x, y)));
}

/** Convenience: validate a content TileDef (id + grid). */
export function validateTile(def: TileDef): string[] {
  const errors = validateTileCells(def.cells);
  if (!/^[a-z][a-z0-9_]*$/.test(def.id)) errors.unshift(`bad tile id '${def.id}'`);
  return errors;
}
