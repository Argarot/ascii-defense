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
import { EDGES, OPPOSITE, TILE_SIZE, partitionKey, rotatePoint, tilePartition, type Edge, type Rotation } from './../tiles/tile';
import { TileLibrary, createBoard, place, resolveCells, slotAt, type Board } from '../tiles/board';

export interface MapGenOptions {
  /** Board size in tile slots. */
  width: number;
  height: number;
  /** Open road ends = spawn points. More is harder. */
  entries: number;
  /** Slots a path must wander before it may exit the board. Longer is easier. */
  targetPathLength: number;
  /**
   * Size of the unlocked relic pool. When > 0, caches are scattered and rock
   * cells are dealt hidden contents (PRD sec 4.6) - each cache/find carries
   * a specific pool index, decided HERE so nothing rolls dice mid-run.
   */
  relicPoolSize?: number;
  /**
   * The run's loaded SPECIAL tiles (2.21, PRD sec 4.8), by id - the defs must
   * be in the library. Guaranteed to appear: road specials claim a carved
   * slot whose partition they express, roadless specials claim a fill slot.
   * A special that cannot be placed legally throws (after generateMap's
   * whole-map retries give it fresh carves) - it never silently drops.
   * Specials are excluded from the random pools: they appear because they
   * were CHOSEN, exactly once each.
   */
  specials?: readonly string[];
}

export interface CellRef {
  x: number;
  y: number;
}

/** A visible relic cache: claimed by selecting the cell and paying (PRD sec 4.6). */
export interface CacheRef {
  x: number;
  y: number;
  /** Index into the unlocked relic pool, dealt at generation. */
  poolIdx: number;
}

/** What a rock cell secretly holds; prospecting only ever REVEALS (PRD sec 4.6). */
export interface RockContent {
  x: number;
  y: number;
  yields: 'ore' | 'cache' | 'none';
  /** Set when yields is 'cache'. */
  poolIdx?: number;
  /** Set when yields is 'ore': the hidden vein's size. */
  depositAmount?: number;
}

/**
 * A finite ore vein (PRD sec 6): a quantity and a tier, dealt at generation.
 * Richness IS amount - the view scales its gold-speck density by what is
 * left, so "where is the money" is answered by looking. Tier is the D9
 * shape: everything ships tier 1; richer tiles arrive as purchases (M7).
 */
/**
 * Boon ground (PRD sec 4.7): a ground cell that permanently modifies
 * whatever is built on it. An overlay like caches - the tile library never
 * knows. Dealt at generation; the map, not a shop, decides where power is.
 */
export interface BoonRef {
  x: number;
  y: number;
  boon: 'range' | 'damage' | 'rate';
  /** 1-4; higher is rarer and stronger. Corner marks on the board = tier. */
  tier: 1 | 2 | 3 | 4;
}

export interface OreDeposit {
  x: number;
  y: number;
  amount: number;
  tier: number;
}

export interface GeneratedMap {
  board: Board;
  /** Road cells at the board edge where enemies enter, in cell coordinates. */
  entries: CellRef[];
  /** Center of the Core tile, in cell coordinates. */
  core: CellRef;
  /** Empty when relicPoolSize is absent. */
  caches: CacheRef[];
  rockContents: RockContent[];
  /** Every ore cell's finite vein (PRD sec 6). */
  deposits: OreDeposit[];
  /** Boon cells (PRD sec 4.7); empty when relicPoolSize is absent. */
  boons: BoonRef[];
}

/** Roadless slots farther than this (in slots) from the road stay void. */
export const FILL_RADIUS = 2;
/**
 * Ore may appear one ring beyond ordinary terrain - the only thing worth
 * keeping land for is a resource (Daniil). Slots at this distance are
 * ore-or-void.
 */
export const ORE_REACH = 3;
/**
 * Generation guarantee (PRD sec 4.3): at least this many ore tiles per map,
 * chance permitting nothing. A map without ore has no Ore economy and so no
 * relic purchases at the Core - not a hard run, a broken one. A floor, not an
 * average; capped by how many fillable slots the board actually has.
 */
export const ORE_FLOOR = 2;
/** Caches per map when the relic layer is on (channel A of PRD sec 7.3). */
export const CACHE_COUNT = 2;
/** Boon cells per map (PRD sec 4.7). */
export const BOON_COUNT = 2;
/** What a rock cell secretly holds: ore, a cache, or (mostly) nothing. */
export const ROCK_ORE_CHANCE = 0.3;
export const ROCK_CACHE_CHANCE = 0.12;
/** Vein size range; dealt per ore cell. Rich veins are visibly rich. */
export const DEPOSIT_MIN = 30;
export const DEPOSIT_MAX = 90;

/** Weighted deterministic pick (tile weights, playtest 5 item 6). */
function pickWeighted<T extends { weight: number }>(rng: RngStream, pool: readonly T[]): T {
  let total = 0;
  for (const p of pool) total += p.weight;
  let roll = rng.int(0, Math.max(0, Math.ceil(total * 100) - 1)) / 100;
  for (const p of pool) {
    if (roll < p.weight) return p;
    roll -= p.weight;
  }
  return pool[pool.length - 1];
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
function indexLibrary(
  lib: TileLibrary,
  exclude?: ReadonlySet<string>,
): {
  road: Map<string, { tileId: string; rotation: Rotation; weight: number }[]>;
  core: Map<string, { tileId: string; rotation: Rotation; weight: number }[]>;
  filler: { plain: { tileId: string; weight: number }[]; ore: { tileId: string; weight: number }[] };
} {
  const road = new Map<string, { tileId: string; rotation: Rotation; weight: number }[]>();
  const core = new Map<string, { tileId: string; rotation: Rotation; weight: number }[]>();
  const filler = { plain: [] as { tileId: string; weight: number }[], ore: [] as { tileId: string; weight: number }[] };

  for (const id of lib.ids()) {
    if (exclude?.has(id)) continue; // specials are chosen, never rolled
    const weight = lib.weightOf(id);
    // Symmetric shapes repeat under rotation (a straight at 0 and 2 is the
    // same tile); indexing every repeat would weight one shape twice (2.24).
    const seenForms = new Set<string>();
    for (const rotation of [0, 1, 2, 3] as const) {
      const { cells, connectors } = lib.resolved(id, rotation);
      const form = cells.join('/');
      if (seenForms.has(form)) continue;
      seenForms.add(form);
      const edges = new Set<Edge>(EDGES.filter((e) => connectors[e]));
      const hasCore = cells.some((row) => row.includes('C'));
      const hasRoad = edges.size > 0;
      // Carve v3: road tiles are indexed by their edge PARTITION, so a tile
      // whose crossings split into two separate segments (twin bends) is
      // dealt exactly where the carve routed two separate path segments -
      // and never onto a single-path slot (session 14's boot crash).
      const key = hasRoad ? partitionKey(tilePartition(cells)) : sigKey(edges);
      if (hasCore) {
        // The Core's crossings must interconnect (all roads reach it).
        if (tilePartition(cells).length > 1) continue;
        const list = core.get(sigKey(edges)) ?? [];
        list.push({ tileId: id, rotation, weight });
        core.set(sigKey(edges), list);
      } else if (hasRoad) {
        const list = road.get(key) ?? [];
        list.push({ tileId: id, rotation, weight });
        road.set(key, list);
      } else if (rotation === 0) {
        const hasOre = cells.some((row) => row.includes('O'));
        (hasOre ? filler.ore : filler.plain).push({ tileId: id, weight });
      }
    }
  }
  return { road, core, filler };
}

export function generateMap(rng: RngStream, lib: TileLibrary, opts: MapGenOptions): GeneratedMap {
  // A cornered carve is rare but real; the whole generation retries on the
  // SAME stream (state simply advances), so a seed still means one exact map
  // and no failure ever reaches a player. Ten strikes before we admit defeat.
  let lastError: unknown;
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      // Later whole-map attempts progressively relax the demands: fewer
      // required slots per walk corners fewer walkers.
      const relaxed =
        attempt < 10
          ? opts
          : { ...opts, targetPathLength: Math.max(1, opts.targetPathLength >> (attempt < 18 ? 1 : 2)) };
      return generateMapOnce(rng, lib, relaxed);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function generateMapOnce(rng: RngStream, lib: TileLibrary, opts: MapGenOptions): GeneratedMap {
  const { width, height, entries } = opts;
  if (entries < 1) throw new Error('a map needs at least one entry');
  // A target no board could honour would guarantee cornered walks; clamp to
  // a share of the board per walk and let 'longer' mean 'as long as fits'.
  const targetPathLength = Math.min(
    opts.targetPathLength,
    Math.max(1, Math.floor((width * height * 0.55) / entries)),
  );
  const specialIds = opts.specials ?? [];
  const index = indexLibrary(lib, specialIds.length > 0 ? new Set(specialIds) : undefined);

  // Specials (2.21): resolve each loaded special's shape once. Road-carrying
  // specials list the partition keys their rotations express (deduped, like
  // the index); roadless specials just need a fill slot.
  const roadSpecials: { id: string; keys: Map<string, Rotation> }[] = [];
  const roadlessSpecials: string[] = [];
  for (const id of specialIds) {
    const keys = new Map<string, Rotation>();
    const forms = new Set<string>();
    let hasRoad = false;
    for (const rotation of [0, 1, 2, 3] as const) {
      const { cells, connectors } = lib.resolved(id, rotation);
      const form = cells.join('/');
      if (forms.has(form)) continue;
      forms.add(form);
      if (cells.some((row) => row.includes('C'))) throw new Error(`special tile '${id}' carries the Core - specials cannot`);
      if (connectors.n || connectors.e || connectors.s || connectors.w) {
        hasRoad = true;
        const key = partitionKey(tilePartition(cells));
        if (!keys.has(key)) keys.set(key, rotation);
      }
    }
    if (hasRoad) roadSpecials.push({ id, keys });
    else roadlessSpecials.push(id);
  }

  const slotIdx = (x: number, y: number): number => y * width + x;

  // ---- 1. the Core slot, near the center with a little seeded jitter -------
  const coreX = Math.floor(width / 2) + (width > 4 ? rng.int(-1, 1) : 0);
  const coreY = Math.floor(height / 2) + (height > 4 ? rng.int(-1, 1) : 0);
  const coreK = slotIdx(coreX, coreY);

  // ---- 2. carve the road tree ---------------------------------------------
  // roadEdges[slot] = edges of that slot carrying road. roadSlots is the set
  // of carved slots (incl. the Core); walkOrder remembers insertion order so
  // branch-start picks are deterministic.
  // Per slot: one or two SEGMENTS, each a set of edges (carve v3). Two
  // segments in one slot = two roads passing without merging.
  const roadEdges = new Map<number, Set<Edge>>();
  const secondSegment = new Map<number, Set<Edge>>();
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
      const newTunnels: [number, Set<Edge>][] = [];

      const tryWalk = (): boolean => {
        for (;;) {
          const wandering = steps < target;
          const legal: { e: Edge; exits: boolean; tunnel?: Edge }[] = [];
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
            const nk = slotIdx(nx, ny);
            if (roadSlots.has(nk) || newSlots.includes(nk)) {
              // Carve v3: a TUNNEL through an occupied slot. The walk
              // enters via e and leaves as a second segment - two roads in
              // one slot, never merging. Perpendicular exits produce the
              // twin-bend partitions; a STRAIGHT exit produces a crossing
              // partition, which only a bridge tile can express (4.9) - the
              // availability gate below makes that self-limiting: no bridge
              // tile in the pool, no straight tunnel, exactly as before.
              if (nk === coreK || secondSegment.has(nk) || newTunnels.some(([tk]) => tk === nk)) continue;
              const existing = roadEdges.get(nk);
              if (!existing) continue;
              const enter = OPPOSITE[e];
              if (existing.has(enter)) continue;
              for (const out of EDGES) {
                if (out === enter) continue;
                if (existing.has(out)) continue;
                const [ox, oy] = EDGE_DELTA[out];
                const lx = nx + ox;
                const ly = ny + oy;
                const landExit = lx < 0 || ly < 0 || lx >= width || ly >= height;
                if (!landExit) {
                  const lk = slotIdx(lx, ly);
                  if (roadSlots.has(lk) || newSlots.includes(lk)) continue;
                }
                if (wandering && landExit) continue;
                // Only tunnel where a tile EXISTS for the resulting
                // partition - no tile, no move, connectivity by construction.
                const pk = partitionKey([[...existing] as Edge[], [enter, out] as Edge[]]);
                if (!index.road.has(pk)) continue;
                legal.push({ e, exits: false, tunnel: out });
                break;
              }
              continue;
            }
            legal.push({ e, exits });
          }
          if (legal.length === 0) return false;

          // Once the walk has earned its length it takes the first exit
          // available (sector-preferred) - wandering past the target would
          // hog slots and starve later walks on small boards. While
          // wandering, a gentle sector bias spreads the tree across the map.
          let choice: { e: Edge; exits: boolean; tunnel?: Edge };
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
          if (choice.tunnel) {
            // Pass through the occupied slot as a second segment and land
            // beyond its far side (or exit the board there).
            const tk = slotIdx(x + dx, y + dy);
            newTunnels.push([tk, new Set<Edge>([OPPOSITE[choice.e], choice.tunnel])]);
            const [ox, oy] = EDGE_DELTA[choice.tunnel];
            const lx = x + dx + ox;
            const ly = y + dy + oy;
            if (lx < 0 || ly < 0 || lx >= width || ly >= height) {
              entryCells.push(edgeCell(x + dx, y + dy, choice.tunnel));
              return true;
            }
            x = lx;
            y = ly;
            newSlots.push(slotIdx(x, y));
            newEdges.push([slotIdx(x, y), OPPOSITE[choice.tunnel]]);
            cameFrom = OPPOSITE[choice.tunnel];
            steps += 2;
            continue;
          }
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
        for (const [k, seg] of newTunnels) secondSegment.set(k, seg);
        done = true;
      }
    }
    if (!done) {
      throw new Error(`mapgen: could not carve entry ${n + 1}/${entries} on a ${width}x${height} board`);
    }
  }

  // ---- 3. tile the carved slots -------------------------------------------
  // Road specials first (2.21): each claims a carved slot whose partition it
  // expresses - guaranteed presence, or a loud throw (generateMap's retries
  // give it several carves before the player hears about it). Slots are
  // scanned in carve order, so the claim is deterministic.
  const forced = new Map<number, { tileId: string; rotation: Rotation }>();
  for (const sp of roadSpecials) {
    let placedAt = -1;
    for (const [k, edges] of roadEdges) {
      if (k === coreK || forced.has(k)) continue;
      const second = secondSegment.get(k);
      const key = second
        ? partitionKey([[...edges] as Edge[], [...second] as Edge[]])
        : partitionKey([[...edges] as Edge[]]);
      const rotation = sp.keys.get(key);
      if (rotation === undefined) continue;
      forced.set(k, { tileId: sp.id, rotation });
      placedAt = k;
      break;
    }
    if (placedAt === -1) throw new Error(`special tile '${sp.id}' cannot fit this map - no carved slot matches its road shape`);
  }

  let board = createBoard(width, height);
  for (const [k, edges] of roadEdges) {
    const x = k % width;
    const y = Math.floor(k / width);
    const claim = forced.get(k);
    if (claim) {
      board = place(board, claim.tileId, claim.rotation, x, y);
      continue;
    }
    const second = secondSegment.get(k);
    const key =
      k === coreK
        ? sigKey(edges)
        : second
          ? partitionKey([[...edges] as Edge[], [...second] as Edge[]])
          : partitionKey([[...edges] as Edge[]]);
    const pool = (k === coreK ? index.core : index.road).get(key);
    if (!pool || pool.length === 0) {
      throw new Error(
        `tile pool has no ${k === coreK ? 'core' : 'road'} tile for '${key}' - ` +
          'the generator needs every routed shape (see content/assets/tiles/library.json)',
      );
    }
    const pick = pickWeighted(rng, pool);
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

  // No enclosed voids (Daniil, playtest 4): void is COASTLINE, not holes.
  // Any empty slot that cannot reach the board border through other empty
  // slots is inside the map's hull and gets terrain like its neighbours.
  {
    const reach = new Array<boolean>(width * height).fill(false);
    const q: number[] = [];
    for (let x = 0; x < width; x++) {
      for (const y of [0, height - 1]) {
        const k = slotIdx(x, y);
        if (!roadEdges.has(k) && dist[k] > ORE_REACH && !reach[k]) { reach[k] = true; q.push(k); }
      }
    }
    for (let y = 0; y < height; y++) {
      for (const x of [0, width - 1]) {
        const k = slotIdx(x, y);
        if (!roadEdges.has(k) && dist[k] > ORE_REACH && !reach[k]) { reach[k] = true; q.push(k); }
      }
    }
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi];
      const x = k % width;
      const y = Math.floor(k / width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nk = slotIdx(nx, ny);
        if (reach[nk] || roadEdges.has(nk) || dist[nk] <= ORE_REACH) continue;
        reach[nk] = true;
        q.push(nk);
      }
    }
    // Enclosed void slots become fillable: mark them as if within reach.
    for (let k = 0; k < width * height; k++) {
      if (!roadEdges.has(k) && dist[k] > ORE_REACH && !reach[k]) dist[k] = ORE_REACH; // outer-ring rules apply
    }
  }

  // Void share cap (playtest 5, item 12): the enclosure rule killed holes,
  // not EXCESS - a map that is one-third void is a broken coastline. Convert
  // the void slots nearest to terrain into fillable land until the share is
  // sane; rare large bays survive, oceans do not.
  {
    const total = width * height;
    const voidSlots: number[] = [];
    for (let k = 0; k < total; k++) if (!roadEdges.has(k) && dist[k] > ORE_REACH) voidSlots.push(k);
    const maxVoid = Math.floor(total * 0.22);
    if (voidSlots.length > maxVoid) {
      voidSlots.sort((a, b) => dist[a] - dist[b]); // nearest to land first
      for (const k of voidSlots.slice(0, voidSlots.length - maxVoid)) dist[k] = ORE_REACH;
    }
  }

  // The ore floor is pre-committed, not checked after: a seeded shuffle of
  // every fillable slot marks the first ORE_FLOOR as guaranteed ore, and the
  // fill loop honours the marks. The guarantee therefore holds by
  // construction - there is no repair pass, matching how connectivity works.
  const guaranteedOre = new Set<number>();
  if (index.filler.ore.length > 0) {
    const fillable: number[] = [];
    for (let k = 0; k < width * height; k++) {
      if (!roadEdges.has(k) && dist[k] >= 1 && dist[k] <= ORE_REACH) fillable.push(k);
    }
    for (const k of rng.shuffle(fillable).slice(0, ORE_FLOOR)) guaranteedOre.add(k);
  }

  // Roadless specials (2.21) claim fill slots before the dice see them.
  // Only rolls when a loadout exists, so special-free generation spends the
  // stream exactly as before.
  const specialClaims = new Map<number, { tileId: string; rotation: Rotation }>();
  if (roadlessSpecials.length > 0) {
    const eligible: number[] = [];
    for (let k = 0; k < width * height; k++) {
      if (!roadEdges.has(k) && dist[k] >= 1 && dist[k] <= ORE_REACH) eligible.push(k);
    }
    const spots = rng.shuffle(eligible);
    for (let i = 0; i < roadlessSpecials.length; i++) {
      const k = spots[i];
      if (k === undefined) throw new Error(`special tile '${roadlessSpecials[i]}' cannot fit this map - no open land near the road`);
      specialClaims.set(k, { tileId: roadlessSpecials[i], rotation: rng.pick([0, 1, 2, 3] as const) });
    }
  }

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const k = slotIdx(x, y);
      if (roadEdges.has(k)) continue;
      const claim = specialClaims.get(k);
      if (claim) {
        board = place(board, claim.tileId, claim.rotation, x, y);
        continue;
      }
      if (dist[k] > ORE_REACH) continue; // unclaimed land stays void
      if (dist[k] > FILL_RADIUS) {
        // The outer ring ALWAYS fills (playtest 12): every slot within
        // ORE_REACH of the road is land - ore by luck, plain otherwise.
        // The earlier stay-void roll here was the source of two bugs at
        // once: enclosed holes and cap-converted slots are re-marked as
        // outer ring, so a ~31% stay-void chance put voids INSIDE the
        // landmass and closer to the road than the void rule permits.
        if (guaranteedOre.has(k) || (index.filler.ore.length > 0 && rng.chance(0.3))) {
          board = place(board, pickWeighted(rng, index.filler.ore).tileId, rng.pick([0, 1, 2, 3] as const), x, y);
        } else if (index.filler.plain.length > 0) {
          board = place(board, pickWeighted(rng, index.filler.plain).tileId, rng.pick([0, 1, 2, 3] as const), x, y);
        }
        continue;
      }
      // Reach vs greed (PRD sec 4.1): ore is rare near the road, likelier
      // (but never common - nodes are a find, not a floor) farther out.
      const oreChance = 0.04 + 0.1 * (dist[k] - 1);
      const pool =
        guaranteedOre.has(k) || (index.filler.ore.length > 0 && rng.chance(oreChance))
          ? index.filler.ore
          : index.filler.plain;
      board = place(board, pickWeighted(rng, pool).tileId, rng.pick([0, 1, 2, 3] as const), x, y);
    }

  // ---- 5+6. deal the relic layer's map half (PRD sec 4.6) -----------------
  // Caches on buildable ground away from the road (the same greed-vs-safety
  // trade as ore), and every rock cell dealt its hidden contents. All decided
  // here, on the map stream: nothing about the map ever rolls dice mid-run.
  const caches: CacheRef[] = [];
  const rockContents: RockContent[] = [];
  const deposits: OreDeposit[] = [];
  const boons: BoonRef[] = [];
  const poolSize = opts.relicPoolSize ?? 0;
  {
    const cellsNow = resolveCells(board, lib);
    const cellsW = width * TILE_SIZE;

    // Authored overlays (2.18): any placed tile may carry deposits and boons
    // of its author's choosing; they rotate with the tile and OVERRIDE the
    // dice for their cells. The tile's word is law on the tile's land.
    const authoredDeposits = new Map<number, { amount: number; tier: number }>();
    for (let ty = 0; ty < height; ty++)
      for (let tx = 0; tx < width; tx++) {
        const p = slotAt(board, tx, ty);
        if (!p) continue;
        const def = lib.def(p.tileId);
        if (!def.deposits && !def.boons) continue;
        for (const d of def.deposits ?? []) {
          const pt = rotatePoint(d.x, d.y, p.rotation);
          authoredDeposits.set((ty * TILE_SIZE + pt.y) * cellsW + tx * TILE_SIZE + pt.x, { amount: d.amount, tier: d.tier ?? 1 });
        }
        for (const b of def.boons ?? []) {
          const pt = rotatePoint(b.x, b.y, p.rotation);
          boons.push({ x: tx * TILE_SIZE + pt.x, y: ty * TILE_SIZE + pt.y, boon: b.boon, tier: b.tier });
        }
      }

    const farGround: CellRef[] = [];
    for (let cy = 0; cy < height * TILE_SIZE; cy++)
      for (let cx = 0; cx < cellsW; cx++) {
        const t = cellsNow[cy * cellsW + cx];
        if (t === 'O') {
          // Every vein is finite, dealt here so replays stay exact (sec 6).
          // An authored vein keeps its author's numbers and spends no dice.
          const authored = authoredDeposits.get(cy * cellsW + cx);
          deposits.push(
            authored
              ? { x: cx, y: cy, amount: authored.amount, tier: authored.tier }
              : { x: cx, y: cy, amount: rng.int(DEPOSIT_MIN, DEPOSIT_MAX), tier: 1 },
          );
        } else if (t === 'R' && poolSize > 0) {
          const roll = rng.int(0, 99);
          const yields: RockContent['yields'] =
            roll < ROCK_ORE_CHANCE * 100 ? 'ore' : roll < (ROCK_ORE_CHANCE + ROCK_CACHE_CHANCE) * 100 ? 'cache' : 'none';
          rockContents.push(
            yields === 'cache'
              ? { x: cx, y: cy, yields, poolIdx: rng.int(0, poolSize - 1) }
              : yields === 'ore'
                ? { x: cx, y: cy, yields, depositAmount: rng.int(DEPOSIT_MIN, DEPOSIT_MAX) }
                : { x: cx, y: cy, yields },
          );
        } else if (t === 'G' && poolSize > 0 && dist[slotIdx(Math.floor(cx / TILE_SIZE), Math.floor(cy / TILE_SIZE))] >= 2) {
          farGround.push({ x: cx, y: cy });
        }
      }
    const shuffled = rng.shuffle(farGround);
    for (const spot of shuffled.slice(0, CACHE_COUNT)) {
      caches.push({ x: spot.x, y: spot.y, poolIdx: rng.int(0, poolSize - 1) });
    }
    // Boons live NEAR the road (playtest 5, item 10) - a buff nobody can
    // reach with a useful tower is decoration. Tier: 1 common .. 4 rare.
    const BOONS: BoonRef['boon'][] = ['range', 'damage', 'rate'];
    const nearGround: CellRef[] = [];
    for (let cy = 0; cy < height * TILE_SIZE; cy++)
      for (let cx = 0; cx < cellsW; cx++) {
        if (cellsNow[cy * cellsW + cx] !== 'G') continue;
        if (dist[slotIdx(Math.floor(cx / TILE_SIZE), Math.floor(cy / TILE_SIZE))] <= 1) nearGround.push({ x: cx, y: cy });
      }
    for (const spot of rng.shuffle(nearGround).slice(0, BOON_COUNT)) {
      const roll = rng.int(0, 99);
      const tier = (roll < 50 ? 1 : roll < 80 ? 2 : roll < 95 ? 3 : 4) as BoonRef['tier'];
      boons.push({ x: spot.x, y: spot.y, boon: BOONS[rng.int(0, BOONS.length - 1)], tier });
    }
  }

  return {
    board,
    entries: entryCells,
    core: { x: coreX * TILE_SIZE + CENTER, y: coreY * TILE_SIZE + CENTER },
    caches,
    rockContents,
    deposits,
    boons,
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
