/**
 * Map generation (PRD sec 4.3). Carve first, tile second:
 *
 *   1. place the Core slot near the board center
 *   2. carve a road TREE: self-avoiding walks that never re-enter existing
 *      road, so every entry has exactly one route to the Core and no other
 *      road exists (no loops, by construction). The first walk leaves the
 *      Core; later walks branch off a random existing road slot. Each walk is
 *      assigned a compass sector so the tree spreads across the whole board
 *      instead of clumping in one half.
 *   3. every walked slot gets a tile whose DERIVED connector signature
 *      matches the carved topology - picked from the pool by signature
 *   4. slots within FILL_RADIUS of the road get roadless terrain (ore
 *      likelier with distance - reach vs greed); farther slots stay VOID.
 *      The map hugs its roads; emptiness reads as unclaimed land, not as a
 *      half-finished screen.
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

/** Roadless slots farther than this (in slots) from the road stay void. */
export const FILL_RADIUS = 3;

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

  const slotIdx = (x: number, y: number): number => y * width + x;

  // ---- 1. the Core slot, near the center with a little seeded jitter -------
  const coreX = Math.floor(width / 2) + (width > 4 ? rng.int(-1, 1) : 0);
  const coreY = Math.floor(height / 2) + (height > 4 ? rng.int(-1, 1) : 0);
  const coreK = slotIdx(coreX, coreY);

  // ---- 2. carve the road tree ---------------------------------------------
  // roadEdges[slot] = edges of that slot carrying road. roadSlots is the set
  // of carved slots (incl. the Core); walkOrder remembers insertion order so
  // branch-start picks are deterministic.
  const roadEdges = new Map<number, Set<Edge>>();
  const roadSlots = new Set<number>([coreK]);
  const walkOrder: number[] = [coreK];
  const entryCells: CellRef[] = [];

  const addEdge = (k: number, e: Edge): void => {
    const set = roadEdges.get(k) ?? new Set<Edge>();
    set.add(e);
    roadEdges.set(k, set);
  };

  // Sectors spread the tree: each walk is nudged toward its own board edge,
  // in seeded-shuffled order so no side is systematically favoured.
  const sectors = rng.shuffle(EDGES);

  for (let n = 0; n < entries; n++) {
    const sector = sectors[n % sectors.length];
    let done = false;

    // A walk that corners itself rolls back completely and retries from a
    // different branch point - partial roads never leak into the map.
    for (let attempt = 0; attempt < 24 && !done; attempt++) {
      // Later attempts accept shorter paths rather than failing the map.
      const target = attempt < 8 ? targetPathLength : Math.max(1, targetPathLength >> (attempt < 16 ? 1 : 2));
      const startK =
        n === 0 ? coreK : walkOrder[rng.int(0, walkOrder.length - 1)];
      let x = startK % width;
      let y = Math.floor(startK / width);
      let steps = 0;
      let cameFrom: Edge | null = null;
      const newSlots: number[] = [];
      const newEdges: [number, Edge][] = [];

      const tryWalk = (): boolean => {
        for (;;) {
          const wandering = steps < target;
          const legal: { e: Edge; exits: boolean }[] = [];
          for (const e of EDGES) {
            if (cameFrom === e) continue;
            const [dx, dy] = EDGE_DELTA[e];
            const nx = x + dx;
            const ny = y + dy;
            const exits = nx < 0 || ny < 0 || nx >= width || ny >= height;
            if (exits) {
              if (wandering) continue;
              legal.push({ e, exits });
              continue;
            }
            // Tree rule: never step into existing road (loops impossible),
            // nor into slots this walk already claimed.
            if (roadSlots.has(slotIdx(nx, ny))) continue;
            if (newSlots.includes(slotIdx(nx, ny))) continue;
            legal.push({ e, exits });
          }
          if (legal.length === 0) return false;

          // Once the walk has earned its length it takes the first exit
          // available (sector-preferred) - wandering past the target would
          // hog slots and starve later walks on small boards. While
          // wandering, a gentle sector bias spreads the tree across the map.
          let choice: { e: Edge; exits: boolean };
          const exitMoves = legal.filter((o) => o.exits);
          if (!wandering && exitMoves.length > 0) {
            choice = exitMoves.find((o) => o.e === sector) ?? rng.pick(exitMoves);
          } else {
            const sectorMove = legal.find((o) => o.e === sector);
            choice = sectorMove && rng.chance(0.35) ? sectorMove : rng.pick(legal);
          }

          newEdges.push([slotIdx(x, y), choice.e]);
          if (choice.exits) {
            entryCells.push(edgeCell(x, y, choice.e));
            return true;
          }
          const [dx, dy] = EDGE_DELTA[choice.e];
          x += dx;
          y += dy;
          newSlots.push(slotIdx(x, y));
          newEdges.push([slotIdx(x, y), OPPOSITE[choice.e]]);
          cameFrom = OPPOSITE[choice.e];
          steps++;
        }
      };

      if (tryWalk()) {
        for (const k of newSlots) {
          roadSlots.add(k);
          walkOrder.push(k);
        }
        for (const [k, e] of newEdges) addEdge(k, e);
        done = true;
      }
    }
    if (!done) {
      throw new Error(`mapgen: could not carve entry ${n + 1}/${entries} on a ${width}x${height} board`);
    }
  }

  // ---- 3. tile the carved slots -------------------------------------------
  let board = createBoard(width, height);
  for (const [k, edges] of roadEdges) {
    const x = k % width;
    const y = Math.floor(k / width);
    const key = sigKey(edges);
    const pool = (k === coreK ? index.core : index.road).get(key);
    if (!pool || pool.length === 0) {
      throw new Error(
        `tile pool has no ${k === coreK ? 'core' : 'road'} tile with signature '${key}' - ` +
          'the generator needs every 1-4 connector shape (see content/assets/tiles/library.json)',
      );
    }
    const pick = rng.pick(pool);
    board = place(board, pick.tileId, pick.rotation, x, y);
  }

  // ---- 4. fill near the road; the rest of the world stays void ------------
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
      if (dist[k] > FILL_RADIUS) continue; // unclaimed land stays void
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
