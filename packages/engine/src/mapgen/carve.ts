/**
 * The road carve (2.27 rebuild, ARCHITECTURE sec 12): produces a ROAD PLAN —
 * which slots carry road, their segments, the anchored specials and the
 * entries — as pure data. Tiling, terrain and the deal phase live in
 * mapgen.ts; this module owns every road-topology rule:
 *
 *  - the road is a TREE: self-avoiding walks never re-enter road, anchor
 *    entry arms never join anything (joining twice is what a loop is)
 *  - path length is denominated in CELLS, per entry, as a MINIMUM (D13):
 *    the slot conversion uses the fact that any center-to-center crossing
 *    of an odd tile spans at least TILE_SIZE cells, so the floor holds by
 *    construction. The target is clamped to what the board can hold and
 *    NEVER relaxed by retries — a cornered walk retries from a different
 *    branch point at full strength, or the whole map retries.
 *  - the floor binds ALL entries, anchor-grown included (Daniil,
 *    2026-08-19): an entry arm measures its route's deficit against the
 *    existing tree and wanders until it has earned it before exiting.
 *  - every carved shape has a tile — availability is checked at every
 *    place a slot's edge set can grow: tunnels, tree branch starts, and
 *    anchor-arm joints. No tile, no move.
 */
import type { RngStream } from '../rng/rng';
import { EDGES, OPPOSITE, TILE_SIZE, partitionKey, type Edge, type Rotation } from '../tiles/tile';
import type { CellRef } from './mapgen';

export interface RoadSpecialSpec {
  id: string;
  rotations: { rotation: Rotation; edges: Edge[]; groups: Edge[][] }[];
}

/** What the carve needs to know about the tile pool: shape availability. */
export interface CarveIndex {
  hasRoad(partitionKey: string): boolean;
  hasCore(sigKey: string): boolean;
}

export interface CarveOptions {
  width: number;
  height: number;
  entries: number;
  /** Per-entry minimum route length to the Core, in cells (D13). */
  targetPathCells: number;
  roadSpecials: readonly RoadSpecialSpec[];
}

export interface RoadPlan {
  coreK: number;
  /** Primary road segment per slot: the edges it connects. */
  roadEdges: Map<number, Set<Edge>>;
  /** Tunnel second segments: two roads in one slot, never merging. */
  secondSegment: Map<number, Set<Edge>>;
  /** Anchored specials: slot -> exact tile + rotation. */
  forced: Map<number, { tileId: string; rotation: Rotation }>;
  /** Road cells on the board edge where enemies enter (cell coords). */
  entries: CellRef[];
  /**
   * The per-entry cell floor this carve guarantees (D13): the requested
   * target when unclamped, 0 when the board clamp bound it (the floor is
   * then best-effort and not checkable).
   */
  floorCells: number;
}

export const EDGE_DELTA: Record<Edge, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const CENTER = (TILE_SIZE - 1) / 2;

/** Signature key for a set of road-carrying edges, e.g. "n.e" or "e.s.w". */
export function sigKey(edges: ReadonlySet<Edge>): string {
  return EDGES.filter((e) => edges.has(e)).join('.') || 'none';
}

export function carveRoads(rng: RngStream, index: CarveIndex, opts: CarveOptions): RoadPlan {
  const { width, height, entries } = opts;
  if (entries < 1) throw new Error('a map needs at least one entry');

  // D13 unit conversion: every slot a route crosses spans >= TILE_SIZE
  // cells (center-to-center through an odd tile is at least TILE_SIZE
  // cells, seam included), so a walk of ceil(cells / TILE_SIZE) + 1 slots
  // carries the cell floor by construction; +1 absorbs the partial first
  // and last tiles. The board clamp is the ONLY thing that may shorten it.
  const wantSlots = Math.ceil(Math.max(TILE_SIZE, opts.targetPathCells) / TILE_SIZE) + 1;
  const maxSlots = Math.max(1, Math.floor((width * height * 0.55) / entries));
  const slotTarget = Math.min(wantSlots, maxSlots);

  const slotIdx = (x: number, y: number): number => y * width + x;

  // ---- 1. the Core slot, near the center with a little seeded jitter -------
  const coreX = Math.floor(width / 2) + (width > 4 ? rng.int(-1, 1) : 0);
  const coreY = Math.floor(height / 2) + (height > 4 ? rng.int(-1, 1) : 0);
  const coreK = slotIdx(coreX, coreY);

  const roadEdges = new Map<number, Set<Edge>>();
  const secondSegment = new Map<number, Set<Edge>>();
  const roadSlots = new Set<number>([coreK]);
  const walkOrder: number[] = [coreK];
  const entryCells: CellRef[] = [];
  const forced = new Map<number, { tileId: string; rotation: Rotation }>();

  const addEdge = (k: number, e: Edge): void => {
    const set = roadEdges.get(k) ?? new Set<Edge>();
    set.add(e);
    roadEdges.set(k, set);
  };

  /**
   * Availability gate for growing an EXISTING slot by one edge (tree branch
   * starts and anchor-arm joints). Tunnel slots never grow — their two
   * segments are already the full story a tile can tell.
   */
  const canGrow = (k: number, extra: Iterable<Edge>, e: Edge): boolean => {
    if (secondSegment.has(k)) return false;
    const grown = new Set<Edge>(roadEdges.get(k));
    for (const x of extra) grown.add(x);
    grown.add(e);
    if (grown.size > 4) return false;
    return k === coreK ? index.hasCore(sigKey(grown)) : index.hasRoad(partitionKey([[...grown]]));
  };

  function edgeCell(sx: number, sy: number, e: Edge): CellRef {
    const baseX = sx * TILE_SIZE;
    const baseY = sy * TILE_SIZE;
    switch (e) {
      case 'n': return { x: baseX + CENTER, y: baseY };
      case 's': return { x: baseX + CENTER, y: baseY + TILE_SIZE - 1 };
      case 'w': return { x: baseX, y: baseY + CENTER };
      case 'e': return { x: baseX + TILE_SIZE - 1, y: baseY + CENTER };
    }
  }

  // ---- 2. carve the road tree ---------------------------------------------
  // Sectors spread the tree: each walk is nudged toward its own board edge,
  // in seeded-shuffled order so no side is systematically favoured. (A
  // placement preference, not a rule — spec sec 12 tier 3.)
  const sectors = rng.shuffle(EDGES);

  for (let n = 0; n < entries; n++) {
    const sector = sectors[n % sectors.length];
    let done = false;

    // A walk that corners itself rolls back completely and retries from a
    // different branch point AT FULL TARGET — partial roads never leak, and
    // the target is never relaxed (D13).
    for (let attempt = 0; attempt < 24 && !done; attempt++) {
      const startK = n === 0 ? coreK : walkOrder[rng.int(0, walkOrder.length - 1)];
      let x = startK % width;
      let y = Math.floor(startK / width);
      let steps = 0;
      let cameFrom: Edge | null = null;
      const newSlots: number[] = [];
      const newEdges: [number, Edge][] = [];
      const newTunnels: [number, Set<Edge>][] = [];

      const tryWalk = (): boolean => {
        for (;;) {
          const wandering = steps < slotTarget;
          const atStart = steps === 0;
          const legal: { e: Edge; exits: boolean; tunnel?: Edge }[] = [];
          for (const e of EDGES) {
            if (cameFrom === e) continue;
            // The FIRST move grows the start slot (core or branch point) by
            // one edge — only legal if the pool can express the grown shape.
            if (atStart && !canGrow(slotIdx(x, y), [], e)) continue;
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
              // A TUNNEL through an occupied slot: the walk enters via e and
              // leaves as a second segment — two roads in one slot, never
              // merging. Only where a tile EXISTS for the resulting
              // partition — no tile, no move, connectivity by construction.
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
                const pk = partitionKey([[...existing] as Edge[], [enter, out] as Edge[]]);
                if (!index.hasRoad(pk)) continue;
                legal.push({ e, exits: false, tunnel: out });
                break;
              }
              continue;
            }
            legal.push({ e, exits });
          }
          if (legal.length === 0) return false;

          // Once the walk has earned its length it takes the first exit
          // available (sector-preferred); while wandering, a gentle sector
          // bias spreads the tree across the map.
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

  // ---- 3. anchor the road specials ----------------------------------------
  // Placed as anchors: an interior slot plus a rotation, connectors fixed by
  // the drawing. ONE arm per partition group joins the network; every other
  // arm exits the board as a NEW entry, wandering first until its route to
  // the Core satisfies the same cell floor as every other entry (D13 binds
  // ALL entries — an anchored special never hands the player a lane shorter
  // than the threat promises).
  const anchorOrder = [...opts.roadSpecials].sort(
    (a, b) => Math.max(...b.rotations.map((r) => r.edges.length)) - Math.max(...a.rotations.map((r) => r.edges.length)),
  );

  /** Slot-level distance to the Core over the current network plus pending
   *  arm slots. Tunnel slots count once (an underestimate, which only makes
   *  arms wander farther — the safe direction for a floor). */
  const distToCore = (extra: ReadonlyMap<number, Set<Edge>>): Int32Array => {
    const union = (k: number): Set<Edge> => {
      const out = new Set<Edge>(roadEdges.get(k));
      for (const e of secondSegment.get(k) ?? []) out.add(e);
      for (const e of extra.get(k) ?? []) out.add(e);
      return out;
    };
    const dist = new Int32Array(width * height).fill(-1);
    dist[coreK] = 0;
    const q = [coreK];
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi];
      const ke = union(k);
      const x = k % width;
      const y = Math.floor(k / width);
      for (const e of EDGES) {
        if (!ke.has(e)) continue;
        const nx = x + EDGE_DELTA[e][0];
        const ny = y + EDGE_DELTA[e][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nk = slotIdx(nx, ny);
        if (dist[nk] !== -1) continue;
        if (!union(nk).has(OPPOSITE[e])) continue;
        dist[nk] = dist[k] + 1;
        q.push(nk);
      }
    }
    return dist;
  };

  for (const sp of anchorOrder) {
    let placed = false;
    for (let attempt = 0; attempt < 140 && !placed; attempt++) {
      const pick = sp.rotations[sp.rotations.length === 1 ? 0 : rng.int(0, sp.rotations.length - 1)];
      const ax = rng.int(1, width - 2);
      const ay = rng.int(1, height - 2);
      const ak = slotIdx(ax, ay);
      if (roadSlots.has(ak) || forced.has(ak)) continue;

      // This anchor's tentative arms: nothing touches the real network
      // until every connector has landed (partial anchors never leak).
      const armEdges = new Map<number, Set<Edge>>();
      const armAdd = (k: number, e: Edge): void => {
        const set = armEdges.get(k) ?? new Set<Edge>();
        set.add(e);
        armEdges.set(k, set);
      };
      /** Slots an arm may JOIN: network or this anchor's earlier arms — not
       *  tunnels, not other anchors, and only where the pool can express
       *  the grown shape (the joint availability gate). */
      const joinable = (k: number, enter: Edge): boolean => {
        if (forced.has(k) || k === ak) return false;
        const onNet = roadSlots.has(k);
        const onArm = armEdges.has(k);
        if (!onNet && !onArm) return false;
        return canGrow(k, armEdges.get(k) ?? [], enter);
      };
      const nearestNet = (x: number, y: number): number => {
        let best = Infinity;
        for (const k of roadSlots) {
          const d = Math.abs((k % width) - x) + Math.abs(Math.floor(k / width) - y);
          if (d < best) best = d;
        }
        return best;
      };
      /** The joining arm: attaches the anchor's subtree to the tree, once.
       *  Returns the joint slot, or null. */
      const carveJoinArm = (edge: Edge): { joint: number; len: number } | null => {
        let x = ax + EDGE_DELTA[edge][0];
        let y = ay + EDGE_DELTA[edge][1];
        let cameFrom: Edge = OPPOSITE[edge];
        const local: number[] = [];
        for (let steps = 0; steps < 14; steps++) {
          const k = slotIdx(x, y);
          if (joinable(k, cameFrom)) {
            armAdd(k, cameFrom);
            return { joint: k, len: local.length };
          }
          if (roadSlots.has(k) || forced.has(k) || armEdges.has(k) || local.includes(k)) return null;
          local.push(k);
          armAdd(k, cameFrom);
          const joins: Edge[] = [];
          const moves: { e: Edge; d: number }[] = [];
          for (const e of EDGES) {
            if (e === cameFrom) continue;
            const nx = x + EDGE_DELTA[e][0];
            const ny = y + EDGE_DELTA[e][1];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nk = slotIdx(nx, ny);
            if (local.includes(nk) || nk === ak) continue;
            if (joinable(nk, OPPOSITE[e])) joins.push(e);
            else if (!roadSlots.has(nk) && !forced.has(nk) && !armEdges.has(nk)) moves.push({ e, d: nearestNet(nx, ny) });
          }
          let step: Edge;
          if (joins.length > 0) step = joins.length === 1 ? joins[0] : joins[rng.int(0, joins.length - 1)];
          else {
            if (moves.length === 0) return null;
            const best = Math.min(...moves.map((m) => m.d));
            const good = moves.filter((m) => m.d === best);
            step = good.length === 1 ? good[0].e : good[rng.int(0, good.length - 1)].e;
          }
          armAdd(k, step);
          x += EDGE_DELTA[step][0];
          y += EDGE_DELTA[step][1];
          cameFrom = OPPOSITE[step];
        }
        return null;
      };
      /** Every other arm: a self-avoiding walk that WANDERS until the
       *  entry's route to the Core has earned the cell floor, then heads
       *  for the border and becomes a NEW entry. It never joins anything —
       *  joining twice is what a loop is. */
      const newEntries: CellRef[] = [];
      const carveEntryArm = (edge: Edge, armTarget: number): boolean => {
        let x = ax + EDGE_DELTA[edge][0];
        let y = ay + EDGE_DELTA[edge][1];
        let cameFrom: Edge = OPPOSITE[edge];
        const local: number[] = [];
        for (let steps = 0; steps < armTarget + 14; steps++) {
          const k = slotIdx(x, y);
          if (roadSlots.has(k) || forced.has(k) || armEdges.has(k) || local.includes(k)) return false;
          local.push(k);
          armAdd(k, cameFrom);
          const wandering = local.length < armTarget;
          const exits: Edge[] = [];
          const moves: { e: Edge; d: number }[] = [];
          for (const e of EDGES) {
            if (e === cameFrom) continue;
            const nx = x + EDGE_DELTA[e][0];
            const ny = y + EDGE_DELTA[e][1];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
              if (!wandering) exits.push(e);
              continue;
            }
            const nk = slotIdx(nx, ny);
            if (local.includes(nk) || nk === ak || roadSlots.has(nk) || forced.has(nk) || armEdges.has(nk)) continue;
            moves.push({ e, d: Math.min(nx, ny, width - 1 - nx, height - 1 - ny) });
          }
          if (exits.length > 0) {
            const e = exits.length === 1 ? exits[0] : exits[rng.int(0, exits.length - 1)];
            armAdd(k, e);
            newEntries.push(edgeCell(x, y, e));
            return true;
          }
          if (moves.length === 0) return false;
          let step: Edge;
          if (wandering) {
            // Earn length first; any self-avoiding direction will do.
            step = moves.length === 1 ? moves[0].e : moves[rng.int(0, moves.length - 1)].e;
          } else {
            const best = Math.min(...moves.map((m) => m.d));
            const good = moves.filter((m) => m.d === best);
            step = good.length === 1 ? good[0].e : good[rng.int(0, good.length - 1)].e;
          }
          armAdd(k, step);
          x += EDGE_DELTA[step][0];
          y += EDGE_DELTA[step][1];
          cameFrom = OPPOSITE[step];
        }
        return false;
      };

      // Each partition GROUP is its own road: one joining arm, the rest
      // become entries whose lanes honour the floor. The deficit is measured
      // against the real route: arm + anchor + join arm + tree to the Core.
      let ok = true;
      for (const grp of pick.groups) {
        const join = carveJoinArm(grp[0]);
        if (!join) {
          ok = false;
          break;
        }
        const dist = distToCore(armEdges);
        const routeBase = 1 + join.len + Math.max(0, dist[join.joint]);
        const armTarget = Math.max(0, slotTarget - routeBase);
        for (const e of grp.slice(1)) {
          if (!carveEntryArm(e, armTarget)) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (!ok) continue;

      // Commit: the anchor's connectors, every arm slot, the joint, and the
      // arm-grown entries.
      forced.set(ak, { tileId: sp.id, rotation: pick.rotation });
      roadSlots.add(ak);
      roadEdges.set(ak, new Set(pick.edges));
      for (const [k, edges] of armEdges) {
        roadSlots.add(k);
        for (const e of edges) addEdge(k, e);
      }
      entryCells.push(...newEntries);
      placed = true;
    }
    if (!placed) throw new Error(`special tile '${sp.id}' found no anchorage on this map - retrying`);
  }

  return {
    coreK,
    roadEdges,
    secondSegment,
    forced,
    entries: entryCells,
    floorCells: slotTarget === wantSlots ? Math.max(TILE_SIZE, opts.targetPathCells) : 0,
  };
}
