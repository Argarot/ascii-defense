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
import { ROAD_PORTS, isCellType, isRoad, isRouteCell, roadsConnect, type CellType } from '../grid/cells';

export const TILE_SIZE = 5;
const CENTER = 2; // (TILE_SIZE - 1) / 2

/** Content-format tile: id plus 5 strings of 5 cell codes. */
export interface TileDef {
  id: string;
  name?: string;
  cells: string[];
  /** Relative generation pick weight; default 1 (playtest 5, item 6). */
  weight?: number;
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

  // -- entry points (Daniil, 2026-08-17 - replaces the crossings framing) ----
  // An ENTRY POINT is a derived connector: road on an edge centre with the
  // appropriate inward orientation. The rule is stated in terms of entries,
  // not lane components, so it survives bridges and new road kinds:
  //   1. every road cell must have continuous road to some entry point
  //      (no decoration roads), and
  //   2. every entry point must have continuous road to at least ONE other
  //      entry point - or to the Core, the route's licensed terminus.
  // A one-entry dead-end stub is therefore unrepresentable, which is what
  // makes an unplaceable mint impossible by design rather than by patch.
  // (Valid entry counts fall out as 0, 2, 3 or 4 - never 1 without a Core.)
  const key = (x: number, y: number): number => y * TILE_SIZE + x;
  const conn = deriveConnectors(cells);
  const entries: [number, number][] = [];
  if (conn.n) entries.push([CENTER, 0]);
  if (conn.s) entries.push([CENTER, TILE_SIZE - 1]);
  if (conn.w) entries.push([0, CENTER]);
  if (conn.e) entries.push([TILE_SIZE - 1, CENTER]);
  const entryKeys = new Set(entries.map(([x, y]) => key(x, y)));

  /** Flood continuous road from (sx, sy); report entries and Core reached. */
  const reach = (sx: number, sy: number): { comp: Set<number>; entries: number; core: boolean } => {
    const comp = new Set<number>([key(sx, sy)]);
    const stack: [number, number][] = [[sx, sy]];
    let hit = 0;
    let core = false;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (entryKeys.has(key(x, y))) hit++;
      if (cellAt(cells, x, y) === 'C') core = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE) continue;
        const k = key(nx, ny);
        if (comp.has(k) || !isRouteCell(cellAt(cells, nx, ny))) continue;
        if (!roadsConnect(cellAt(cells, x, y), cellAt(cells, nx, ny), dx, dy)) continue;
        comp.add(k);
        stack.push([nx, ny]);
      }
    }
    return { comp, entries: hit, core };
  };

  const seen = new Set<number>();
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      if (!isRouteCell(cellAt(cells, x, y)) || seen.has(key(x, y))) continue;
      const r = reach(x, y);
      for (const k of r.comp) seen.add(k);
      if (r.entries === 0 && !r.core) {
        errors.push(`road at (${x},${y}) reaches no entry point - decoration in road's clothing`);
      } else if (r.entries === 1 && !r.core) {
        errors.push(`entry point on the road at (${x},${y}) leads to no other entry point - a dead-end stub the generator can never place`);
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

/**
 * The tile's edge PARTITION (session 15, carve v3): which crossings belong
 * to which internal road segment. A classic routing tile is one group
 * ("e.n.s"); a twin-bend is two ("e.n|s.w"). The generator indexes road
 * tiles by this key, so a slot hosting two separate path segments can be
 * tiled - the thing Daniil's two-touching-turns tile needed to exist.
 */
export function tilePartition(cells: readonly string[]): Edge[][] {
  const conn = deriveConnectors(cells);
  const crossingOf: [Edge, number, number][] = [
    ['n', CENTER, 0],
    ['s', CENTER, TILE_SIZE - 1],
    ['w', 0, CENTER],
    ['e', TILE_SIZE - 1, CENTER],
  ];
  const groups: Edge[][] = [];
  const claimed = new Set<Edge>();
  for (const [edge, sx, sy] of crossingOf) {
    if (!conn[edge] || claimed.has(edge)) continue;
    // Flood this crossing's component; collect every crossing it contains.
    const key = (x: number, y: number): number => y * TILE_SIZE + x;
    const seen = new Set<number>([key(sx, sy)]);
    const stack: [number, number][] = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE) continue;
        const k = key(nx, ny);
        if (seen.has(k) || !isRouteCell(cellAt(cells, nx, ny))) continue;
        if (!roadsConnect(cellAt(cells, x, y), cellAt(cells, nx, ny), dx, dy)) continue;
        seen.add(k);
        stack.push([nx, ny]);
      }
    }
    const group: Edge[] = [];
    for (const [e2, x2, y2] of crossingOf) {
      if (conn[e2] && seen.has(key(x2, y2))) {
        group.push(e2);
        claimed.add(e2);
      }
    }
    groups.push(group.sort());
  }
  return groups.sort((a, b) => a.join('.').localeCompare(b.join('.')));
}

/** Canonical partition key, e.g. "e.n.s" or "e.n|s.w". */
export function partitionKey(groups: readonly (readonly Edge[])[]): string {
  return groups.map((g) => [...g].sort().join('.')).sort().join('|');
}

/**
 * Which sides of a road cell are CLOSED, as bits N=1 E=2 S=4 W=8 - the mask
 * the view draws kerbs from. Derived from actual connectivity, never from a
 * cell's declared ports: an omni 'R' junction claims all four sides but only
 * connects where a neighbour answers, and drawing its declared ports left
 * junctions with no boundary at all (Daniil, playtest 6).
 *
 * Tile-local: an edge-centre cell whose crossing derives is open outward.
 * The board-scale equivalent is FlowField.allowed, which also knows about
 * neighbouring tiles.
 */
export function tileRimMask(cells: readonly string[], x: number, y: number): number {
  const here = cellAt(cells, x, y);
  if (!isRoad(here)) return 0;
  const conn = deriveConnectors(cells);
  let closed = 0;
  const dirs: [number, number, number, Edge | null][] = [
    [0, -1, 1, y === 0 && x === CENTER ? 'n' : null],
    [1, 0, 2, x === TILE_SIZE - 1 && y === CENTER ? 'e' : null],
    [0, 1, 4, y === TILE_SIZE - 1 && x === CENTER ? 's' : null],
    [-1, 0, 8, x === 0 && y === CENTER ? 'w' : null],
  ];
  for (const [dx, dy, bit, edge] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE) {
      if (!(edge && conn[edge])) closed |= bit; // off-tile: open only at a crossing
      continue;
    }
    const n = cellAt(cells, nx, ny);
    const joins = n === 'C' ? true : isRoad(n) && roadsConnect(here, n, dx, dy);
    if (!joins) closed |= bit;
  }
  return closed;
}

/**
 * Closed sides from a cell's OWN declared ports - what the segment IS, not
 * what it happens to touch. This is the authoring view (Tile Smith): a lone
 * '-' must read as an east-west road the moment it is painted, whereas
 * tileRimMask would box it on all four sides because nothing is adjacent
 * yet, making all six shapes look identical (Daniil, playtest 7).
 *
 * Ports are symmetric by construction, so this still reads honestly about
 * connection: place '|' beside '-' and the '|' shows a kerb facing it,
 * because it has no port that way and the two genuinely do not join.
 * A port pointing off-tile counts as open only at an edge centre, where a
 * crossing can actually derive.
 */
export function segmentRimMask(cell: string, x: number, y: number): number {
  const ports = ROAD_PORTS[cell as CellType];
  if (ports === undefined) return 0;
  let closed = 0;
  const dirs: [number, number, number, boolean][] = [
    [0, -1, 1, y === 0 && x === CENTER],
    [1, 0, 2, x === TILE_SIZE - 1 && y === CENTER],
    [0, 1, 4, y === TILE_SIZE - 1 && x === CENTER],
    [-1, 0, 8, x === 0 && y === CENTER],
  ];
  for (const [dx, dy, bit, atCrossing] of dirs) {
    const offTile = x + dx < 0 || y + dy < 0 || x + dx >= TILE_SIZE || y + dy >= TILE_SIZE;
    if ((ports & bit) === 0 || (offTile && !atCrossing)) closed |= bit;
  }
  return closed;
}

/** Convenience: validate a content TileDef (id + grid). */
export function validateTile(def: TileDef): string[] {
  const errors = validateTileCells(def.cells);
  if (!/^[a-z][a-z0-9_]*$/.test(def.id)) errors.unshift(`bad tile id '${def.id}'`);
  return errors;
}
