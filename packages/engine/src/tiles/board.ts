/**
 * The board: a grid of tile slots. Placement legality is the whole Carcassonne
 * rule set and it is small on purpose:
 *
 *   1. the slot is empty and in bounds
 *   2. against every occupied neighbour, the shared edge agrees (both carry
 *      road at the center, or neither does)
 *   3. a connector may not face off the board - roads to nowhere are
 *      unrepresentable, not discouraged
 *   4. optionally (the in-game rule): the tile touches at least one occupied
 *      neighbour, so the board grows as one landmass
 *
 * There is deliberately no "is a path still available" check anywhere
 * (invariant 5): these four rules are why none is needed.
 */
import type { RngStream } from '../rng/rng';
import {
  deriveConnectors,
  rotateCells,
  EDGES,
  OPPOSITE,
  TILE_SIZE,
  type Connectors,
  type Edge,
  type Rotation,
  type TileDef,
} from './tile';
import type { CellType } from '../grid/cells';

export interface Placement {
  tileId: string;
  rotation: Rotation;
}

export interface Board {
  /** Size in tile slots. */
  readonly width: number;
  readonly height: number;
  /** Row-major slots; null = void (unclaimed land). */
  readonly slots: (Placement | null)[];
}

export function createBoard(width: number, height: number): Board {
  return { width, height, slots: new Array(width * height).fill(null) };
}

export function slotAt(board: Board, x: number, y: number): Placement | null {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return null;
  return board.slots[y * board.width + x];
}

const EDGE_DELTA: Record<Edge, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

/** Tile library indexed by id, with rotations resolved on demand. */
export class TileLibrary {
  private byId = new Map<string, TileDef>();
  // rotation cache: 'id:k' -> { cells, connectors }
  private cache = new Map<string, { cells: string[]; connectors: Connectors }>();

  constructor(defs: readonly TileDef[]) {
    for (const def of defs) {
      if (this.byId.has(def.id)) throw new Error(`duplicate tile id '${def.id}'`);
      this.byId.set(def.id, def);
    }
  }

  ids(): string[] {
    return [...this.byId.keys()];
  }

  def(id: string): TileDef {
    const d = this.byId.get(id);
    if (!d) throw new Error(`unknown tile id '${id}'`);
    return d;
  }

  resolved(id: string, rotation: Rotation): { cells: string[]; connectors: Connectors } {
    const k = `${id}:${rotation}`;
    let r = this.cache.get(k);
    if (!r) {
      const cells = rotateCells(this.def(id).cells, rotation);
      r = { cells, connectors: deriveConnectors(cells) };
      this.cache.set(k, r);
    }
    return r;
  }
}

export interface PlaceOptions {
  /** Require >=1 occupied neighbour (the in-game rule). Off for the first tile. */
  requireContact?: boolean;
  /**
   * Require a road-carrying tile to JOIN the existing road: at least one of
   * its connectors must pair with a neighbour's connector. Without this, a
   * road tile can legally attach by a ground edge and found a second,
   * disconnected road network - edge agreement alone permits it, the "you
   * extend the road" pillar does not. Roadless tiles are exempt (contact is
   * their only obligation). Found by the connectivity property test.
   */
  requireRoadJoin?: boolean;
}

/** The one legality function. Everything that lays tiles goes through this. */
export function canPlace(
  board: Board,
  lib: TileLibrary,
  tileId: string,
  rotation: Rotation,
  x: number,
  y: number,
  opts: PlaceOptions = {},
): boolean {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return false;
  if (slotAt(board, x, y) !== null) return false;

  const { connectors } = lib.resolved(tileId, rotation);
  const hasRoad = connectors.n || connectors.e || connectors.s || connectors.w;
  let contact = false;
  let roadJoin = false;

  for (const edge of EDGES) {
    const [dx, dy] = EDGE_DELTA[edge];
    const nx = x + dx;
    const ny = y + dy;
    const offBoard = nx < 0 || ny < 0 || nx >= board.width || ny >= board.height;
    if (offBoard) {
      // Rule 3: a road may not run off the edge of the world.
      if (connectors[edge]) return false;
      continue;
    }
    const nb = slotAt(board, nx, ny);
    if (!nb) continue;
    contact = true;
    const nbConn = lib.resolved(nb.tileId, nb.rotation).connectors;
    if (nbConn[OPPOSITE[edge]] !== connectors[edge]) return false; // rule 2
    if (connectors[edge]) roadJoin = true; // matched road-to-road edge
  }

  if (opts.requireContact && !contact) return false;
  if (opts.requireRoadJoin && hasRoad && !roadJoin) return false; // rule 4b
  return true;
}

/** Place without re-checking; callers use canPlace first. Returns a new board. */
export function place(board: Board, tileId: string, rotation: Rotation, x: number, y: number): Board {
  const slots = board.slots.slice();
  slots[y * board.width + x] = { tileId, rotation };
  return { width: board.width, height: board.height, slots };
}

/** Every legal placement for the current board state. */
export function legalPlacements(
  board: Board,
  lib: TileLibrary,
  tileIds: readonly string[],
  opts: PlaceOptions = {},
): { tileId: string; rotation: Rotation; x: number; y: number }[] {
  const out: { tileId: string; rotation: Rotation; x: number; y: number }[] = [];
  for (let y = 0; y < board.height; y++)
    for (let x = 0; x < board.width; x++) {
      if (slotAt(board, x, y)) continue;
      for (const tileId of tileIds)
        for (const rotation of [0, 1, 2, 3] as const) {
          if (canPlace(board, lib, tileId, rotation, x, y, opts)) out.push({ tileId, rotation, x, y });
        }
    }
  return out;
}

/**
 * Grow a board from a start tile by repeatedly choosing a random legal
 * placement. Demo scenery today; the drafting flow (M2) replaces the "pick
 * anything legal" policy with the player's hand, on the same primitives.
 */
export function growBoard(
  rng: RngStream,
  lib: TileLibrary,
  opts: {
    width: number;
    height: number;
    startTileId: string;
    startRotation?: Rotation;
    tileIds?: readonly string[];
    maxTiles: number;
  },
): Board {
  const ids = opts.tileIds ?? lib.ids().filter((id) => id !== opts.startTileId);
  let board = createBoard(opts.width, opts.height);

  // Random legal slot for the start tile (boundary rule still applies).
  const startSpots: { x: number; y: number }[] = [];
  for (let y = 0; y < opts.height; y++)
    for (let x = 0; x < opts.width; x++)
      if (canPlace(board, lib, opts.startTileId, opts.startRotation ?? 0, x, y)) startSpots.push({ x, y });
  if (startSpots.length === 0) throw new Error(`start tile '${opts.startTileId}' fits nowhere`);
  const s = rng.pick(startSpots);
  board = place(board, opts.startTileId, opts.startRotation ?? 0, s.x, s.y);

  for (let laid = 1; laid < opts.maxTiles; laid++) {
    const options = legalPlacements(board, lib, ids, { requireContact: true, requireRoadJoin: true });
    if (options.length === 0) break;
    const p = rng.pick(options);
    board = place(board, p.tileId, p.rotation, p.x, p.y);
  }
  return board;
}

/**
 * Resolve the board to a flat cell grid (width*5 x height*5); null = void.
 * This is what the view renders and what pathfinding (1.3.6) will consume.
 */
export function resolveCells(board: Board, lib: TileLibrary): (CellType | null)[] {
  const w = board.width * TILE_SIZE;
  const h = board.height * TILE_SIZE;
  const out: (CellType | null)[] = new Array(w * h).fill(null);
  for (let ty = 0; ty < board.height; ty++)
    for (let tx = 0; tx < board.width; tx++) {
      const p = slotAt(board, tx, ty);
      if (!p) continue;
      const { cells } = lib.resolved(p.tileId, p.rotation);
      for (let cy = 0; cy < TILE_SIZE; cy++)
        for (let cx = 0; cx < TILE_SIZE; cx++) {
          out[(ty * TILE_SIZE + cy) * w + tx * TILE_SIZE + cx] = cells[cy][cx] as CellType;
        }
    }
  return out;
}
