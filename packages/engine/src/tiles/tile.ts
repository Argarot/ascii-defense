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
import { isCellType, isRouteCell, type CellType } from '../grid/cells';

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

/** Rotate the grid one quarter turn clockwise, k times. Pure. */
export function rotateCells(cells: readonly string[], k: Rotation): string[] {
  let out = cells.slice();
  for (let turn = 0; turn < k; turn++) {
    const prev = out;
    out = [];
    for (let y = 0; y < TILE_SIZE; y++) {
      let row = '';
      // Clockwise: new (x, y) reads old (y, SIZE-1-x).
      for (let x = 0; x < TILE_SIZE; x++) row += prev[TILE_SIZE - 1 - x][y];
      out.push(row);
    }
  }
  return out;
}

/**
 * Derive connectors from a grid. Only meaningful on a VALID grid - call
 * validateTileCells first (or trust the content pipeline, which did).
 */
export function deriveConnectors(cells: readonly string[]): Connectors {
  return {
    n: cellAt(cells, CENTER, 0) === 'R',
    s: cellAt(cells, CENTER, TILE_SIZE - 1) === 'R',
    w: cellAt(cells, 0, CENTER) === 'R',
    e: cellAt(cells, TILE_SIZE - 1, CENTER) === 'R',
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

  // -- the center-or-nothing rule -------------------------------------------
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      const c = cellAt(cells, x, y);
      if (c === 'R' && onEdge(x, y) && !isEdgeCenter(x, y)) {
        errors.push(`road at (${x},${y}) touches an edge off-center - roads may cross edges only at their middle cell`);
      }
      // Spawn is the route's terminus; on an edge it would read as a
      // connector while deriving none, which is a visual lie.
      if (c === 'S' && onEdge(x, y)) {
        errors.push(`spawn at (${x},${y}) sits on an edge - spawns must be interior`);
      }
    }

  // -- route continuity ------------------------------------------------------
  // All route cells (road + spawn) must form ONE 4-connected component, and
  // if any exist, at least one must be an edge-center road (a connector).
  // Split roads or roads-to-nowhere would silently break "connectivity by
  // construction" the moment the tile is laid.
  const route: [number, number][] = [];
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++)
      if (isRouteCell(cellAt(cells, x, y))) route.push([x, y]);

  if (route.length > 0) {
    const key = (x: number, y: number): number => y * TILE_SIZE + x;
    const inRoute = new Set(route.map(([x, y]) => key(x, y)));
    const seen = new Set<number>([key(route[0][0], route[0][1])]);
    const stack = [route[0]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = key(x + dx, y + dy);
        if (inRoute.has(k) && !seen.has(k)) {
          seen.add(k);
          stack.push([x + dx, y + dy]);
        }
      }
    }
    if (seen.size !== route.length) {
      errors.push(`route cells form ${'>'}1 disconnected group - all road/spawn cells must connect`);
    }
    const conn = deriveConnectors(cells);
    if (!conn.n && !conn.e && !conn.s && !conn.w) {
      errors.push('route never reaches an edge center - a road that connects to nothing cannot join the network');
    }
  }

  return errors;
}

/** Convenience: validate a content TileDef (id + grid). */
export function validateTile(def: TileDef): string[] {
  const errors = validateTileCells(def.cells);
  if (!/^[a-z][a-z0-9_]*$/.test(def.id)) errors.unshift(`bad tile id '${def.id}'`);
  return errors;
}
