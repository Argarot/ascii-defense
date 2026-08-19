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
import { ROAD_PORTS, isCellType, isRoad, isRouteCell, roadsConnect, strandEntered, strandPorts, type CellType } from '../grid/cells';

export const TILE_SIZE = 5;
// TILE_SIZE must be ODD: roads cross tile borders at edge centers (the
// center-or-nothing connector rule), and an even tile has no center cell.
// A property of the design, not an implementation choice (spec sec 12).
const CENTER = (TILE_SIZE - 1) / 2;

/** An authored ore vein (2.18): richness placed by the tile's author. */
export interface TileDeposit {
  x: number;
  y: number;
  amount: number;
  /** Ore tier; defaults to 1 (the D9 shape - richer tiers are M7 content). */
  tier?: number;
}

/** An authored boon cell (2.18): the tile, not the dice, places the power. */
export interface TileBoon {
  x: number;
  y: number;
  boon: 'range' | 'damage' | 'rate';
  tier: 1 | 2 | 3 | 4;
}

/** Content-format tile: id plus 5 strings of 5 cell codes. */
export interface TileDef {
  id: string;
  name?: string;
  cells: string[];
  /** Relative generation pick weight; default 1 (playtest 5, item 6). */
  weight?: number;
  /** Authored overlays (2.18): deposits sit on ore cells, boons on ground. */
  deposits?: TileDeposit[];
  boons?: TileBoon[];
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

/** Directional glyphs rotate WITH the grid: up becomes right, and so on.
 *  T-junction cycle, clockwise: ports N→E→S→W gives T(ESW)→3(NSW)→U(NEW)→E(NES)→T. */
const ROTATE_GLYPH: Record<string, string> = { '-': '|', '|': '-', L: 'F', F: '7', '7': 'J', J: 'L', T: '3', '3': 'U', U: 'E', E: 'T' };

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
 * A tile and its 90-degree rotations are ONE tile (2.24, Daniil playtest 9):
 * the canonical form is the lexicographically smallest of the four
 * rotations, so any two orientations of one shape reduce to the same
 * asset. The generator already deals all four rotations of everything, so
 * canonicalising costs nothing at play time - it only stops one shape
 * being stored, and therefore weighted, four times.
 */
export function canonicalCells(cells: readonly string[]): string[] {
  return rotateCells(cells, canonicalRotation(cells));
}

/** The rotation that produces the canonical form. */
export function canonicalRotation(cells: readonly string[]): Rotation {
  let best: Rotation = 0;
  let bestKey = cells.join('/');
  for (const k of [1, 2, 3] as const) {
    const rotKey = rotateCells(cells, k).join('/');
    if (rotKey < bestKey) {
      best = k;
      bestKey = rotKey;
    }
  }
  return best;
}

/** Rotate a cell coordinate with the grid: clockwise, k quarter turns. */
export function rotatePoint(x: number, y: number, k: Rotation): { x: number; y: number } {
  let px = x;
  let py = y;
  for (let t = 0; t < k; t++) {
    // Clockwise: new (x, y) reads old (y, SIZE-1-x), so old (px, py) lands
    // at new (SIZE-1-py, px).
    const nx = TILE_SIZE - 1 - py;
    const ny = px;
    px = nx;
    py = ny;
  }
  return { x: px, y: py };
}

/**
 * Canonicalise a whole TileDef: the cells rotate to canonical form and the
 * authored overlays (2.18) rotate WITH them - an overlay that stayed behind
 * while its grid turned would sit on the wrong cell, silently.
 */
export function canonicalizeTile(def: TileDef): TileDef {
  const k = canonicalRotation(def.cells);
  if (k === 0) return def;
  const out: TileDef = { ...def, cells: rotateCells(def.cells, k) };
  if (def.deposits) out.deposits = def.deposits.map((d) => ({ ...d, ...rotatePoint(d.x, d.y, k) }));
  if (def.boons) out.boons = def.boons.map((b) => ({ ...b, ...rotatePoint(b.x, b.y, k) }));
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
  //   1. every road STRAND must have continuous road to some entry point
  //      (no decoration roads), and
  //   2. every entry point must have continuous road to at least ONE other
  //      entry point - or to the Core, the route's licensed terminus.
  // A one-entry dead-end stub is therefore unrepresentable, which is what
  // makes an unplaceable mint impossible by design rather than by patch.
  // Floods run over STRAND NODES (4.9): a bridge cell holds two independent
  // nodes - the east-west deck and the north-south underpass - which cross
  // without joining, so each of a bridge's two roads is judged separately.
  const conn = deriveConnectors(cells);
  const entryNodes = new Set<number>();
  if (conn.n) entryNodes.add(nodeKey(CENTER, 0, strandEntered(cellAt(cells, CENTER, 0), 4)));
  if (conn.s) entryNodes.add(nodeKey(CENTER, TILE_SIZE - 1, strandEntered(cellAt(cells, CENTER, TILE_SIZE - 1), 1)));
  if (conn.w) entryNodes.add(nodeKey(0, CENTER, strandEntered(cellAt(cells, 0, CENTER), 2)));
  if (conn.e) entryNodes.add(nodeKey(TILE_SIZE - 1, CENTER, strandEntered(cellAt(cells, TILE_SIZE - 1, CENTER), 8)));

  /** Flood continuous road from a strand node; report entries and Core reached. */
  const reach = (sx: number, sy: number, ss: number): { comp: Set<number>; entries: number; core: boolean } => {
    const comp = new Set<number>([nodeKey(sx, sy, ss)]);
    const stack: [number, number, number][] = [[sx, sy, ss]];
    let hit = 0;
    let core = false;
    while (stack.length) {
      const [x, y, s] = stack.pop()!;
      if (entryNodes.has(nodeKey(x, y, s))) hit++;
      if (cellAt(cells, x, y) === 'C') core = true;
      for (let d = 0; d < 4; d++) {
        const step = nodeStep(cells, x, y, s, d);
        if (step === null) continue;
        const k = nodeKey(step[0], step[1], step[2]);
        if (comp.has(k)) continue;
        comp.add(k);
        stack.push(step);
      }
    }
    return { comp, entries: hit, core };
  };

  const seen = new Set<number>();
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      const c = cellAt(cells, x, y);
      if (!isRouteCell(c)) continue;
      for (let s = 0; s < (c === 'C' ? 1 : strandPorts(c).length); s++) {
        if (seen.has(nodeKey(x, y, s))) continue;
        const r = reach(x, y, s);
        for (const k of r.comp) seen.add(k);
        if (r.entries === 0 && !r.core) {
          errors.push(`road at (${x},${y}) reaches no entry point - decoration in road's clothing`);
        } else if (r.entries === 1 && !r.core) {
          errors.push(`entry point on the road at (${x},${y}) leads to no other entry point - a dead-end stub the generator can never place`);
        }
      }
    }

  // -- no dead ends (2.26, Daniil playtest 11) -------------------------------
  // The entry-point rule admits a SPUR: a stub hanging off a through-road
  // reaches entries via that road, so it passes while visibly leading
  // nowhere. Tighten: every road strand must lie on a route between two
  // terminals - entries, or the Core, the route's licensed terminus.
  // Mechanically: iteratively strip strand nodes that are neither terminal
  // nor linked to 2+ surviving nodes. Cycles survive (a loop is drivable);
  // stubs cannot. Gated on the component checks passing so a broken
  // component reports once, not once per cell.
  if (errors.length === 0) {
    const alive = new Set<number>();
    const roadNodes: [number, number, number][] = [];
    for (let y = 0; y < TILE_SIZE; y++)
      for (let x = 0; x < TILE_SIZE; x++) {
        const c = cellAt(cells, x, y);
        if (!isRoad(c)) continue;
        for (let s = 0; s < strandPorts(c).length; s++) {
          roadNodes.push([x, y, s]);
          alive.add(nodeKey(x, y, s));
        }
      }
    const isTerminal = (x: number, y: number, s: number): boolean => {
      if (entryNodes.has(nodeKey(x, y, s))) return true;
      for (let d = 0; d < 4; d++) {
        const step = nodeStep(cells, x, y, s, d);
        if (step !== null && cellAt(cells, step[0], step[1]) === 'C') return true; // road ends AT the Core
      }
      return false;
    };
    let pruned = true;
    while (pruned) {
      pruned = false;
      for (const [x, y, s] of roadNodes) {
        if (!alive.has(nodeKey(x, y, s)) || isTerminal(x, y, s)) continue;
        let links = 0;
        for (let d = 0; d < 4; d++) {
          const step = nodeStep(cells, x, y, s, d);
          if (step !== null && alive.has(nodeKey(step[0], step[1], step[2]))) links++;
        }
        if (links <= 1) {
          alive.delete(nodeKey(x, y, s));
          pruned = true;
        }
      }
    }
    for (const [x, y, s] of roadNodes) {
      if (!alive.has(nodeKey(x, y, s))) {
        errors.push(`road at (${x},${y}) dead-ends - it lies on no route between two entries`);
      }
    }
  }

  return errors;
}

// ---- the strand-node route graph (4.9) -------------------------------------
// Routing inside a tile traverses (cell, strand) nodes. Every road cell is
// one node except the bridge, which is two: the facing bit of any step
// identifies the target strand uniquely, and the Core welds (steps to and
// from C skip the port check, exactly as roadsConnect always has).

const NODE_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const NODE_BIT = [1, 2, 4, 8] as const;
const NODE_OPP = [4, 8, 1, 2] as const;

/** Node key for (x, y, strand); strand is 0 except a bridge's underpass (1). */
export function nodeKey(x: number, y: number, s: number): number {
  return ((y * TILE_SIZE + x) << 1) | s;
}

/** Step from strand node (x, y, s) in direction d; null when the graph has no edge. */
export function nodeStep(
  cells: readonly string[],
  x: number,
  y: number,
  s: number,
  d: number,
): [number, number, number] | null {
  const nx = x + NODE_DIRS[d][0];
  const ny = y + NODE_DIRS[d][1];
  if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE) return null;
  const a = cellAt(cells, x, y);
  const b = cellAt(cells, nx, ny);
  if (!isRouteCell(a) || !isRouteCell(b)) return null;
  if (a === 'C') return [nx, ny, b === 'C' ? 0 : strandEntered(b, NODE_BIT[d])];
  // The Core welds ports-blind - except a bridge, whose strands connect
  // strictly through their own ports (a walker cannot turn off the deck).
  if ((strandPorts(a)[s] & NODE_BIT[d]) === 0 && !(b === 'C' && a !== 'B')) return null;
  if (b === 'C') return [nx, ny, 0];
  const sb = strandEntered(b, NODE_BIT[d]);
  if ((strandPorts(b)[sb] & NODE_OPP[d]) === 0) return null;
  return [nx, ny, sb];
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
  // Crossing NODES: edge, centre cell, and the strand a walker entering from
  // that edge lands on - so a bridge at a centre belongs to two partitions.
  const crossingOf: [Edge, number, number, number][] = [
    ['n', CENTER, 0, strandEntered(cellAt(cells, CENTER, 0), 4)],
    ['s', CENTER, TILE_SIZE - 1, strandEntered(cellAt(cells, CENTER, TILE_SIZE - 1), 1)],
    ['w', 0, CENTER, strandEntered(cellAt(cells, 0, CENTER), 2)],
    ['e', TILE_SIZE - 1, CENTER, strandEntered(cellAt(cells, TILE_SIZE - 1, CENTER), 8)],
  ];
  const groups: Edge[][] = [];
  const claimed = new Set<Edge>();
  for (const [edge, sx, sy, ss] of crossingOf) {
    if (!conn[edge] || claimed.has(edge)) continue;
    // Flood this crossing's strand component; collect every crossing in it.
    const seen = new Set<number>([nodeKey(sx, sy, ss)]);
    const stack: [number, number, number][] = [[sx, sy, ss]];
    while (stack.length) {
      const [x, y, s] = stack.pop()!;
      for (let d = 0; d < 4; d++) {
        const step = nodeStep(cells, x, y, s, d);
        if (step === null) continue;
        const k = nodeKey(step[0], step[1], step[2]);
        if (seen.has(k)) continue;
        seen.add(k);
        stack.push(step);
      }
    }
    const group: Edge[] = [];
    for (const [e2, x2, y2, s2] of crossingOf) {
      if (conn[e2] && seen.has(nodeKey(x2, y2, s2))) {
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
 * cell's declared ports: an omni 'X' junction claims all four sides but only
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

/** Convenience: validate a content TileDef (id + grid + overlays). */
export function validateTile(def: TileDef): string[] {
  const errors = validateTileCells(def.cells);
  if (!/^[a-z][a-z0-9_]*$/.test(def.id)) errors.unshift(`bad tile id '${def.id}'`);
  const inRange = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < TILE_SIZE && y < TILE_SIZE;
  for (const d of def.deposits ?? []) {
    if (!inRange(d.x, d.y)) errors.push(`deposit at (${d.x},${d.y}) is off the tile`);
    else if (cellAt(def.cells, d.x, d.y) !== 'O') errors.push(`deposit at (${d.x},${d.y}) must sit on an ore cell`);
    if (!(d.amount > 0)) errors.push(`deposit at (${d.x},${d.y}) has no ore in it`);
  }
  for (const b of def.boons ?? []) {
    if (!inRange(b.x, b.y)) errors.push(`boon at (${b.x},${b.y}) is off the tile`);
    else if (cellAt(def.cells, b.x, b.y) !== 'G') errors.push(`boon at (${b.x},${b.y}) must sit on a ground cell`);
  }
  return errors;
}
