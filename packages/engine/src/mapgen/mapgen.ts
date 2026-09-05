/**
 * Map generation (PRD sec 4.3). Carve first, tile second:
 *
 *   1. the ROOT slot sits on the east border; the Core is a three-cell FACE
 *      in an extra cell column past that border (session 24, Daniil), fed by
 *      the root's east port - the Core's only entrance. No tile carries the
 *      Core any more.
 *   2. carve a road TREE: self-avoiding walks that never re-enter existing
 *      road, so every entry has exactly one route to the Core and no other
 *      road exists (no loops, by construction). The first walk leaves the
 *      root; later walks branch off a random existing road slot. Each walk is
 *      assigned a compass sector so the tree spreads across the whole board
 *      instead of clumping in one half. Entries never sit on the east border.
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
import { EDGES, TILE_SIZE, partitionKey, rotatePoint, tilePartition, type Edge, type Rotation } from './../tiles/tile';
import { TileLibrary, createBoard, place, resolveCells, slotAt, type Board } from '../tiles/board';
import type { CellType } from '../grid/cells';
import { EDGE_DELTA, carveRoads, sigKey, type RoadSpecialSpec } from './carve';
import { verifyMap } from './verify';

export interface MapGenOptions {
  /** Board size in tile slots. */
  width: number;
  height: number;
  /** Open road ends = spawn points. More is harder. */
  entries: number;
  /**
   * Per-entry MINIMUM route length to the Core, in CELLS вЂ” the unit enemies
   * actually walk (D13). Longer is easier. Clamped to what the board can
   * hold and never relaxed by retries; the floor binds every entry,
   * anchor-grown ones included.
   */
  targetPathCells: number;
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
  /** The middle cell of the Core FACE, in cell coordinates (session 24: the Core is not a tile). */
  core: CellRef;
  /** The Core's three cells, in the extra column past the east border, top to bottom. */
  coreFace: CellRef[];
  /** The cell grid's size: the board's slots times TILE_SIZE, plus CORE_STRIP columns. */
  cellsW: number;
  cellsH: number;
  /**
   * ALWAYS EMPTY since design round 1 (2026-09-03): caches are no longer
   * scattered at generation - they come out of prospected rock (rare,
   * capped per map) and off bosses, and the sim owns them. The field stays
   * so v3 saves still type-check; the sim seeds nothing from it.
   */
  caches: CacheRef[];
  rockContents: RockContent[];
  /** Every ore cell's finite vein (PRD sec 6). */
  deposits: OreDeposit[];
  /** Boon cells (PRD sec 4.7); empty when relicPoolSize is absent. */
  boons: BoonRef[];
  /**
   * The void-share ceiling DRAWN for this map (D14) - verifyMap checks the
   * actual share against it, not against a constant.
   */
  voidShareTarget: number;
  /**
   * The per-entry cell floor this map actually guarantees (D13); 0 when the
   * board clamp bound the target (the floor is then best-effort).
   */
  pathFloorCells: number;
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
 * Generator version (D15): stamps run codes and shareable identities. Bump
 * when a change makes the same (seed, threat, loadout) produce a different
 * map - the golden-hash reasons list in replay.test.ts is the changelog.
 * A code from another version is refused loudly, never silently
 * regenerated into a different map.
 */
export const GENERATOR_VERSION = 2; // 2: the Core at the east edge (session 24)
/**
 * Extra cell columns past the east border that hold the Core FACE (session
 * 24, Daniil): the board's slots stay TILE_SIZE-square, and the Core lives
 * in this strip - not in a tile, not in a slot.
 */
export const CORE_STRIP = 1;

/**
 * The cell grid a run actually plays on: the board's tiles resolved, plus
 * the Core strip - null except the face. THE way to get cells from a map;
 * resolveCells alone is the tile grid without the Core.
 */
export function mapCells(map: GeneratedMap, lib: TileLibrary): (CellType | null)[] {
  const tileW = map.board.width * TILE_SIZE;
  const tiles = resolveCells(map.board, lib);
  const out: (CellType | null)[] = new Array(map.cellsW * map.cellsH).fill(null);
  for (let y = 0; y < map.cellsH; y++) for (let x = 0; x < tileW; x++) out[y * map.cellsW + x] = tiles[y * tileW + x];
  for (const c of map.coreFace) out[c.y * map.cellsW + c.x] = 'C';
  return out;
}
/**
 * Support ceiling of the void-share curve (D14): the target share is drawn
 * as VOID_SHARE_CAP * roll^2 - heavily biased low, impossible beyond the
 * cap. The drawn target rides the map as `voidShareTarget`.
 */
export const VOID_SHARE_CAP = 0.22;
/** Caches per map when the relic layer is on (channel A of PRD sec 7.3). */
/** Boon cells per map (PRD sec 4.7). */
export const BOON_COUNT = 2;
/** What a rock cell secretly holds: ore, a cache, or (mostly) nothing. */
export const ROCK_ORE_CHANCE = 0.3;
export const ROCK_CACHE_CHANCE = 0.06;
/** Caches a map's rock may hide, at most (Daniil: "maybe 2-3 per map"). */
export const ROCK_CACHE_MAX = 3;
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

const CENTER = (TILE_SIZE - 1) / 2;

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
  filler: { plain: { tileId: string; weight: number }[]; ore: { tileId: string; weight: number }[] };
} {
  const road = new Map<string, { tileId: string; rotation: Rotation; weight: number }[]>();
  const filler = { plain: [] as { tileId: string; weight: number }[], ore: [] as { tileId: string; weight: number }[] };

  for (const id of lib.ids()) {
    // Specials are chosen, never rolled - both the run's loadout and the
    // library's own special-flagged tiles (touch-without-merge and
    // twin-segment shapes; Daniil, 2026-08-19).
    if (exclude?.has(id) || lib.def(id).special === true) continue;
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
        // Session 24: the Core is a FACE past the east border, never a tile.
        // A library still carrying core tiles is stale, and saying so beats
        // dealing one onto a road slot.
        throw new Error(`tile '${id}' carries the Core - the Core is not a tile since session 24; remove it from the library`);
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
  return { road, filler };
}

export function generateMap(rng: RngStream, lib: TileLibrary, opts: MapGenOptions): GeneratedMap {
  // A cornered carve is rare but real; the whole generation retries on the
  // SAME stream (state simply advances), so a seed still means one exact map
  // and no failure ever reaches a player. Retries re-attempt at FULL
  // strength вЂ” the path target is never relaxed (D13); a board that cannot
  // hold the demand says so by throwing.
  let lastError: unknown;
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      return generateMapOnce(rng, lib, opts);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function generateMapOnce(rng: RngStream, lib: TileLibrary, opts: MapGenOptions): GeneratedMap {
  const { width, height } = opts;
  const specialIds = opts.specials ?? [];
  const index = indexLibrary(lib, specialIds.length > 0 ? new Set(specialIds) : undefined);

  // Specials (2.21): resolve each loaded special's shape once. Road-carrying
  // specials become ANCHORS (playtest 14) - placed first, connected after -
  // so they list their distinct rotations with each rotation's connector
  // edges; roadless specials just need a fill slot.
  const roadSpecials: RoadSpecialSpec[] = [];
  const roadlessSpecials: string[] = [];
  for (const id of specialIds) {
    const rotations: { rotation: Rotation; edges: Edge[]; groups: Edge[][] }[] = [];
    const forms = new Set<string>();
    let hasRoad = false;
    for (const rotation of [0, 1, 2, 3] as const) {
      const { cells, connectors } = lib.resolved(id, rotation);
      const form = cells.join('/');
      if (forms.has(form)) continue;
      forms.add(form);
      if (cells.some((row) => row.includes('C'))) throw new Error(`special tile '${id}' carries the Core - specials cannot`);
      const edges = EDGES.filter((e) => connectors[e]);
      if (edges.length > 0) {
        hasRoad = true;
        // Partition groups matter to the arms: a bridge's deck and underpass
        // are SEPARATE roads, and each needs its own connection to the tree.
        rotations.push({ rotation, edges, groups: tilePartition(cells).map((grp) => [...grp]) });
      }
    }
    if (hasRoad) roadSpecials.push({ id, rotations });
    else roadlessSpecials.push(id);
  }

  const slotIdx = (x: number, y: number): number => y * width + x;

  // ---- the road plan (carve.ts owns every road-topology rule) -------------
  const plan = carveRoads(
    rng,
    { hasRoad: (k) => index.road.has(k) },
    { width, height, entries: opts.entries, targetPathCells: opts.targetPathCells, roadSpecials },
  );
  const { rootK, roadEdges, secondSegment, forced } = plan;
  const entryCells = plan.entries;
  const rootY = Math.floor(rootK / width);

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
    // The root slot is an ordinary road tile whose east port runs off the
    // board into the Core face - the same shape an entry tile has.
    const key = second ? partitionKey([[...edges] as Edge[], [...second] as Edge[]]) : partitionKey([[...edges] as Edge[]]);
    const pool = index.road.get(key);
    if (!pool || pool.length === 0) {
      throw new Error(
        `tile pool has no road tile for '${key}' - ` +
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

  // Void share (D14): a TARGET share is drawn from a heavily-low-biased
  // curve on the map stream - quadratic over [0, VOID_SHARE_CAP], so a
  // beach is common, an ocean rare, and beyond the cap impossible by the
  // curve's support. Emergent void is trimmed to the target, nearest to
  // land first. Enclosed void is LEGAL (D11: the old no-enclosed-void
  // repair pass was never a rule - its only provenance was a comment) so
  // long as it keeps the distance rule. The draw always spends exactly one
  // roll so the stream stays aligned whether or not trimming happens.
  const voidRoll = rng.int(0, 999) / 999;
  const voidShareTarget = VOID_SHARE_CAP * voidRoll * voidRoll;
  {
    const total = width * height;
    const voidSlots: number[] = [];
    for (let k = 0; k < total; k++) if (!roadEdges.has(k) && dist[k] > ORE_REACH) voidSlots.push(k);
    const maxVoid = Math.floor(total * voidShareTarget);
    if (voidSlots.length > maxVoid) {
      voidSlots.sort((a, b) => dist[a] - dist[b]); // nearest to land first
      for (const k of voidSlots.slice(0, voidSlots.length - maxVoid)) dist[k] = ORE_REACH;
    }
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
        // Ore is a BIAS, not a guarantee (D12): these odds make an
        // ore-less map possible but rare (~1 in thousands on real boards);
        // the only guaranteed ore is authored ore on a chosen special.
        if (index.filler.ore.length > 0 && rng.chance(0.3)) {
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
        index.filler.ore.length > 0 && rng.chance(oreChance)
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
    // dice for their cells. The tile's word is law on the tile's land - but
    // only on the RIGHT land: validateTile is the authoring surface's gate
    // (boons on ground, deposits on ore), and this is the engine's own
    // defense for a library built without it (spec tier 3).
    const authoredDeposits = new Map<number, { amount: number; tier: number }>();
    for (let ty = 0; ty < height; ty++)
      for (let tx = 0; tx < width; tx++) {
        const p = slotAt(board, tx, ty);
        if (!p) continue;
        const def = lib.def(p.tileId);
        if (!def.deposits && !def.boons) continue;
        for (const d of def.deposits ?? []) {
          const pt = rotatePoint(d.x, d.y, p.rotation);
          const at = (ty * TILE_SIZE + pt.y) * cellsW + tx * TILE_SIZE + pt.x;
          if (cellsNow[at] !== 'O') throw new Error(`tile '${p.tileId}' authors a deposit on a non-ore cell (${d.x},${d.y})`);
          authoredDeposits.set(at, { amount: d.amount, tier: d.tier ?? 1 });
        }
        for (const b of def.boons ?? []) {
          const pt = rotatePoint(b.x, b.y, p.rotation);
          const bx = tx * TILE_SIZE + pt.x;
          const by = ty * TILE_SIZE + pt.y;
          if (cellsNow[by * cellsW + bx] !== 'G') throw new Error(`tile '${p.tileId}' authors a boon on a non-ground cell (${b.x},${b.y})`);
          boons.push({ x: bx, y: by, boon: b.boon, tier: b.tier });
        }
      }

    const anyGround: CellRef[] = [];
    const rockCells: CellRef[] = [];
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
          rockCells.push({ x: cx, y: cy });
        } else if (t === 'G' && poolSize > 0) {
          // Caches land on ANY ground cell, uniformly - no distance
          // shaping (Daniil, 2026-08-19; spec tier 3).
          anyGround.push({ x: cx, y: cy });
        }
      }
    void anyGround; // caches are no longer scattered on ground (design round 1)
    // Rock contents: dealt in a shuffled order so the cache cap falls on
    // random rocks, not the first rocks in scan order. Ore is common, a
    // cache rare and capped (ROCK_CACHE_MAX), bare rock the rest.
    let cachesDealt = 0;
    for (const r of rng.shuffle(rockCells)) {
      const roll = rng.int(0, 99);
      const yields: RockContent['yields'] =
        roll < ROCK_ORE_CHANCE * 100 ? 'ore'
          : roll < (ROCK_ORE_CHANCE + ROCK_CACHE_CHANCE) * 100 && cachesDealt < ROCK_CACHE_MAX ? 'cache'
            : 'none';
      if (yields === 'cache') cachesDealt++;
      rockContents.push(
        yields === 'ore'
          ? { x: r.x, y: r.y, yields, depositAmount: rng.int(DEPOSIT_MIN, DEPOSIT_MAX) }
          : { x: r.x, y: r.y, yields },
      );
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

  // The Core FACE: three cells in the strip past the east border, centred
  // on the root's east port. The middle cell is `core`, for everything that
  // wants one point (the lab, the offset, the tests).
  const faceX = width * TILE_SIZE;
  const faceY = rootY * TILE_SIZE + CENTER;
  const map: GeneratedMap = {
    board,
    entries: entryCells,
    core: { x: faceX, y: faceY },
    coreFace: [{ x: faceX, y: faceY - 1 }, { x: faceX, y: faceY }, { x: faceX, y: faceY + 1 }],
    cellsW: width * TILE_SIZE + CORE_STRIP,
    cellsH: height * TILE_SIZE,
    caches,
    rockContents,
    deposits,
    boons,
    voidShareTarget,
    pathFloorCells: plan.floorCells,
  };

  // The spec's one-place check (ARCHITECTURE sec 12): every invariant,
  // verified on every generated map before it leaves this function. A
  // violation throws into the retry loop and, if systematic, surfaces -
  // never a silently broken map.
  const issues = verifyMap(map, lib, {
    specials: specialIds,
    relicPoolSize: opts.relicPoolSize,
    minPathCells: plan.floorCells > 0 ? plan.floorCells : undefined,
  });
  if (issues.length > 0) {
    throw new Error(`mapgen: spec violation - ${issues.map((i) => `${i.rule}: ${i.detail}`).join('; ')}`);
  }
  return map;
}
