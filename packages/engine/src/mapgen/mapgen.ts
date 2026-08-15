/**
 * Map generation (PRD sec 4.3). Carve first, tile second:
 *
 *   1. place the Core slot near the board center
 *   2. random-walk `entries` paths from the Core to the board edge, each
 *      winding until it has spent `targetPathLength` slots before it may exit
 *   3. every walked slot needs a tile whose DERIVED connector signature
 *      matches the carved topology - picked from the pool by signature
 *   4. every other slot gets roadless terrain; ore likelihood rises with
 *      distance from the road
 *
 * The carve decides the topology and the tiles merely dress it, which is what
 * makes "entries reach the Core" true by construction here too: a walk IS a
 * path, and signature-matched tiles reproduce exactly the walked edges.
 *
 * Difficulty knobs (PRD sec 4.4): more entries = harder, longer paths =
 * easier. Both are data, decided by threat level, not by this module.
 */
import type { RngStream } from '../rng/rng';
import { EDGES, OPPOSITE, TILE_SIZE, type Edge, type Rotation } from './../tiles/tile';
import { TileLibrary, createBoard, place, type Board } from '../tiles/board';

export interface MapGenOptions {
  /** Board size in tile slots. */
  width: number;
  height: number;
  /** Open road ends = spawn points. More is harder. */
  entries: number;
  /** Slots a path must wander before it may exit the board. Longer is easier. */
  targetPathLength: number;
}

export interface CellRef {
  x: number;
  y: number;
}

export interface GeneratedMap {
  board: Board;
  /** Road cells at the board edge where enemies enter, in cell coordinates. */
  entries: CellRef[];
  /** Center of the Core tile, in cell coordinates. */
  core: CellRef;
}

const EDGE_DELTA: Record<Edge, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const CENTER = (TILE_SIZE - 1) / 2;

/** Signature key for a set of road-carrying edges, e.g. "n.e" or "e.s.w". */
function sigKey(edges: ReadonlySet<Edge>): string {
  return EDGES.filter((e) => edges.has(e)).join('.') || 'none';
}

/**
 * Index the library by derived connector signature, split into the three
 * roles generation needs. Rotations are enumerated here so the pool only
 * needs one authored orientation per shape.
 */
function indexLibrary(lib: TileLibrary): {
  road: Map<string, { tileId: string; rotation: Rotation }[]>;
  core: Map<string, { tileId: string; rotation: Rotation }[]>;
  filler: { plain: string[]; ore: string[] };
} {
  const road = new Map<string, { tileId: string; rotation: Rotation }[]>();
  const core = new Map<string, { tileId: string; rotation: Rotation }[]>();
  const filler = { plain: [] as string[], ore: [] as string[] };

  for (const id of lib.ids()) {
    for (const rotation of [0, 1, 2, 3] as const) {
      const { cells, connectors } = lib.resolved(id, rotation);
      const edges = new Set<Edge>(EDGES.filter((e) => connectors[e]));
      const hasCore = cells.some((row) => row.includes('C'));
      const hasRoad = edges.size > 0;
      const key = sigKey(edges);
      if (hasCore) {
        const list = core.get(key) ?? [];
        list.push({ tileId: id, rotation });
        core.set(key, list);
      } else if (hasRoad) {
        const list = road.get(key) ?? [];
        list.push({ tileId: id, rotation });
        road.set(key, list);
      } else if (rotation === 0) {
        const hasOre = cells.some((row) => row.includes('O'));
        (hasOre ? filler.ore : filler.plain).push(id);
      }
    }
  }
  return { road, core, filler };
}

export function generateMap(rng: RngStream, lib: TileLibrary, opts: MapGenOptions): GeneratedMap {
  const { width, height, entries, targetPathLength } = opts;
  if (entries < 1) throw new Error('a map needs at least one entry');
  const index = indexLibrary(lib);

  // ---- 1. the Core slot, near the center with a little seeded jitter -------
  const coreX = Math.floor(width / 2) + (width > 4 ? rng.int(-1, 1) : 0);
  const coreY = Math.floor(height / 2) + (height > 4 ? rng.int(-1, 1) : 0);

  // ---- 2. carve paths ------------------------------------------------------
  // roadEdges[slot] = the edges of that slot that carry road.
  const roadEdges = new Map<number, Set<Edge>>();
  const slotIdx = (x: number, y: number): number => y * width + x;
  const addEdge = (x: number, y: number, e: Edge): void => {
    const k = slotIdx(x, y);
    const set = roadEdges.get(k) ?? new Set<Edge>();
    set.add(e);
    roadEdges.set(k, set);
  };

  const entryCells: CellRef[] = [];
  const usedExits = new Set<string>(); // "slot:edge" - two walks may not share an exit
  const maxSteps = Math.max(targetPathLength * 4, width * height);

  for (let n = 0; n < entries; n++) {
    let x = coreX;
    let y = coreY;
    let steps = 0;
    let cameFrom: Edge | null = null; // edge we entered the current slot by

    for (;;) {
      const wandering = steps < targetPathLength && steps < maxSteps;
      const options: { e: Edge; exits: boolean }[] = [];
      for (const e of EDGES) {
        if (cameFrom === e) continue; // no immediate backtrack
        const [dx, dy] = EDGE_DELTA[e];
        const nx = x + dx;
        const ny = y + dy;
        const exits = nx < 0 || ny < 0 || nx >= width || ny >= height;
        if (exits && wandering) continue; // not allowed to leave yet
        if (exits && usedExits.has(`${slotIdx(x, y)}:${e}`)) continue; // entry taken
        if (!exits && nx === coreX && ny === coreY) continue; // never re-enter the Core
        options.push({ e, exits });
      }
      if (options.length === 0) {
        if (wandering) {
          // Cornered while wandering (tiny boards): stop wandering, retry
          // with exits allowed.
          steps = targetPathLength;
          continue;
        }
        // Fully cornered: relax the soft bans (core re-entry) and keep
        // walking on-board; only true dead ends throw.
        for (const e of EDGES) {
          if (cameFrom === e) continue;
          const [dx, dy] = EDGE_DELTA[e];
          if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
          options.push({ e, exits: false });
        }
        if (options.length === 0) {
          throw new Error(`mapgen cornered at (${x},${y}) - board too small for ${entries} entries`);
        }
      }
      const choice = rng.pick(options);
      addEdge(x, y, choice.e);
      if (choice.exits) {
        usedExits.add(`${slotIdx(x, y)}:${choice.e}`);
        entryCells.push(edgeCell(x, y, choice.e));
        break;
      }
      const [dx, dy] = EDGE_DELTA[choice.e];
      x += dx;
      y += dy;
      addEdge(x, y, OPPOSITE[choice.e]);
      cameFrom = OPPOSITE[choice.e];
      steps++;
    }
  }

  // ---- 3. tile the carved slots -------------------------------------------
  let board = createBoard(width, height);
  for (const [k, edges] of roadEdges) {
    const x = k % width;
    const y = Math.floor(k / width);
    const key = sigKey(edges);
    const pool = (x === coreX && y === coreY ? index.core : index.road).get(key);
    if (!pool || pool.length === 0) {
      throw new Error(
        `tile pool has no ${x === coreX && y === coreY ? 'core' : 'road'} tile with signature '${key}' - ` +
          'the generator needs every 1-4 connector shape (see content/assets/tiles/library.json)',
      );
    }
    const pick = rng.pick(pool);
    board = place(board, pick.tileId, pick.rotation, x, y);
  }

  // ---- 4. fill everything else; ore rises with distance from the road -----
  // BFS slot-distance from the road network.
  const dist = new Array<number>(width * height).fill(-1);
  const queue: number[] = [...roadEdges.keys()];
  for (const k of queue) dist[k] = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    const x = k % width;
    const y = Math.floor(k / width);
    for (const e of EDGES) {
      const [dx, dy] = EDGE_DELTA[e];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nk = slotIdx(nx, ny);
      if (dist[nk] === -1) {
        dist[nk] = dist[k] + 1;
        queue.push(nk);
      }
    }
  }

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const k = slotIdx(x, y);
      if (roadEdges.has(k)) continue;
      // Reach vs greed (PRD sec 4.1): adjacent to the road ore is rare,
      // three slots out it is common.
      const oreChance = Math.min(0.05 + 0.22 * (dist[k] - 1), 0.75);
      const pool =
        index.filler.ore.length > 0 && rng.chance(oreChance) ? index.filler.ore : index.filler.plain;
      board = place(board, rng.pick(pool), rng.pick([0, 1, 2, 3] as const), x, y);
    }

  return {
    board,
    entries: entryCells,
    core: { x: coreX * TILE_SIZE + CENTER, y: coreY * TILE_SIZE + CENTER },
  };

  function edgeCell(sx: number, sy: number, e: Edge): CellRef {
    // The road cell at the center of slot (sx, sy)'s edge e, in cell coords.
    const baseX = sx * TILE_SIZE;
    const baseY = sy * TILE_SIZE;
    switch (e) {
      case 'n': return { x: baseX + CENTER, y: baseY };
      case 's': return { x: baseX + CENTER, y: baseY + TILE_SIZE - 1 };
      case 'w': return { x: baseX, y: baseY + CENTER };
      case 'e': return { x: baseX + TILE_SIZE - 1, y: baseY + CENTER };
    }
  }
}
