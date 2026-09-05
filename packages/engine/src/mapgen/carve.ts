/**
 * The road carve, v4 (session 24, WBS 2.30 - "the board fills"): produces a
 * ROAD PLAN - which slots carry road, their segments, the anchored specials
 * and the entries - as pure data. Tiling, terrain and the deal phase live in
 * mapgen.ts; this module owns every road-topology rule (ARCHITECTURE sec 12):
 *
 *  - the Core is a FACE past the east border (session 24): the tree ROOTS at
 *    a slot on that border whose east port is the Core's one entrance; no
 *    walk ever exits east.
 *  - the road is a TREE: self-avoiding walks never re-enter road, anchor
 *    entry arms never join anything (joining twice is what a loop is).
 *  - SPECIALS ARE PLACED FIRST, as fixed nodes; one arm per road joins the
 *    tree, every other arm walks on and becomes an entry (Daniil, 2026-09-05).
 *  - EVERY DEAD END IS AN ENTRANCE: a walk ends only at a north, west or
 *    south border cell. Interior leaves do not exist.
 *  - THE BOARD FILLS: walks are added - beyond the threat's entry roll if
 *    need be - until road covers COVERAGE_TARGET of the slots or the board
 *    has no room left. Entry count is emergent within that.
 *  - LANES ARE BALANCED: every walk is planned to the same lane length L*
 *    (its route to the root, in slots), wandering until it has 85% of it
 *    and exiting by 120%; the plan reports whether the shortest lane is at
 *    least LANE_BAND of the longest. The cell floor (D13) is the minimum L*
 *    may take; it is never relaxed.
 *  - when the rules fight, the order is: tree > specials > floor > balance
 *    > coverage. Coverage and the band are REPORTED, not forced: the plan
 *    says what it achieved and verifyMap holds the map to that.
 *  - every carved shape has a tile: availability is checked at every place
 *    a slot's edge set can grow. No tile, no move.
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
}

export interface CarveOptions {
  width: number;
  height: number;
  /** The threat's entry roll: the MINIMUM number of walks (entries grow to fill the board). */
  entries: number;
  /** Per-entry minimum route length to the Core, in cells (D13). */
  targetPathCells: number;
  roadSpecials: readonly RoadSpecialSpec[];
  /** Share of slots the road should cover (D28 default COVERAGE_TARGET). */
  coverage?: number;
  /** Shortest lane over longest lane, at least (D28 default LANE_BAND). */
  laneBand?: number;
}

export interface RoadPlan {
  /** The ROOT slot: on the east border, its east port is the Core's one entrance (session 24). */
  rootK: number;
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
  /** Share of slots carrying road, as achieved (verifyMap holds the map to it). */
  coverage: number;
  /** The lane band as achieved: LANE_BAND when the shortest lane is within it, else 0. */
  laneBand: number;
  /** Every entry's lane to the root, in slots - the sweep's balance readout. */
  laneSlots: number[];
}

/** D28 (Daniil, 2026-09-05, defaults he did not amend). */
export const COVERAGE_TARGET = 0.9;
export const LANE_BAND = 0.7;
/** A walk earns this share of L* before it may exit, and must exit by this much over. */
const EXIT_EARLY = 0.85;
const EXIT_LATE = 1.2;
/** No lane longer than this share of the board: longer snakes corner themselves. */
const MAX_LANE_SHARE = 0.45;
/** Extra walks past the threat's roll, at most, to reach coverage. */
const EXTRA_WALKS = 6;

export const EDGE_DELTA: Record<Edge, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const CENTER = (TILE_SIZE - 1) / 2;

/** Signature key for a set of road-carrying edges, e.g. "n.e" or "e.s.w". */
export function sigKey(edges: ReadonlySet<Edge>): string {
  return EDGES.filter((e) => edges.has(e)).join('.') || 'none';
}

interface WalkResult {
  slots: number[];
  edges: [number, Edge][];
  tunnels: [number, Set<Edge>][];
  entry: CellRef;
  /** The lane this walk creates: start depth plus its own slots. */
  lane: number;
}

export function carveRoads(rng: RngStream, index: CarveIndex, opts: CarveOptions): RoadPlan {
  const { width, height, entries } = opts;
  if (entries < 1) throw new Error('a map needs at least one entry');
  const coverageTarget = opts.coverage ?? COVERAGE_TARGET;
  const laneBand = opts.laneBand ?? LANE_BAND;
  const total = width * height;
  const slotIdx = (x: number, y: number): number => y * width + x;
  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height;

  // D13 unit conversion: every slot a route crosses spans >= TILE_SIZE
  // cells, so a lane of ceil(cells / TILE_SIZE) + 1 slots carries the cell
  // floor by construction. The board clamp is the ONLY thing that may
  // shorten it, and then the floor is reported as best-effort (0).
  const wantSlots = Math.ceil(Math.max(TILE_SIZE, opts.targetPathCells) / TILE_SIZE) + 1;
  const wantCover = Math.ceil(total * coverageTarget);
  // Every special's spare arms are lanes too: a 4-way anchor brings three
  // entries of its own, and the board's room is shared out over all the
  // lanes it will actually carry, not just the threat's roll.
  let spareArms = 0;
  for (const sp of opts.roadSpecials) {
    let most = 0;
    for (const r of sp.rotations) most = Math.max(most, r.groups.reduce((n, g) => n + Math.max(0, g.length - 1), 0));
    spareArms += most;
  }
  const lanesExpected = Math.max(1, entries + spareArms);
  // What the board can hold per lane: its fair share of the covered slots,
  // and never a snake longer than MAX_LANE_SHARE of the board. The floor is
  // clamped to this (D13: "clamped to what the board can hold") and then
  // reported as best-effort; the target itself is never relaxed.
  const fairShare = Math.max(2, Math.floor((wantCover - 1) / lanesExpected));
  const maxLane = Math.max(2, Math.min(Math.floor(total * MAX_LANE_SHARE), fairShare));
  const floorSlots = Math.min(wantSlots, maxLane);
  // The planned lane length L*: the floor, or the fair share when that is
  // longer. Balance falls out of every walk aiming at the same L*.
  const laneStar = Math.max(floorSlots, maxLane);
  // Never below the floor: a walk that may exit at 85% of L* while L* IS
  // the floor would hand the player a lane the threat did not promise.
  const exitEarly = Math.max(1, floorSlots, Math.ceil(laneStar * EXIT_EARLY));
  const exitLate = Math.max(exitEarly, Math.floor(laneStar * EXIT_LATE));

  // ---- 1. the ROOT slot: on the east border, facing the Core ---------------
  const rootX = width - 1;
  const rootLo = Math.floor(height / 3);
  const rootHi = Math.max(rootLo, Math.ceil((2 * height) / 3) - 1);
  const rootY = rootLo === rootHi ? rootLo : rng.int(rootLo, rootHi);
  const rootK = slotIdx(rootX, rootY);

  const roadEdges = new Map<number, Set<Edge>>();
  const secondSegment = new Map<number, Set<Edge>>();
  const roadSlots = new Set<number>([rootK]);
  const forced = new Map<number, { tileId: string; rotation: Rotation }>();
  const entryCells: CellRef[] = [];
  const laneSlots: number[] = [];
  /** Lane depth (slots from the root) of every tree slot's primary segment. */
  const depth = new Map<number, number>([[rootK, 0]]);

  const addEdge = (k: number, e: Edge): void => {
    const set = roadEdges.get(k) ?? new Set<Edge>();
    set.add(e);
    roadEdges.set(k, set);
  };
  addEdge(rootK, 'e');

  /**
   * Availability gate for growing an EXISTING slot by one edge (branch
   * starts and anchor-arm joints). Tunnel slots and anchors never grow.
   */
  const canGrow = (k: number, extra: Iterable<Edge>, e: Edge): boolean => {
    if (secondSegment.has(k) || forced.has(k)) return false;
    const grown = new Set<Edge>(roadEdges.get(k));
    for (const x of extra) grown.add(x);
    grown.add(e);
    if (grown.size > 4) return false;
    return index.hasRoad(partitionKey([[...grown]]));
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

  const NONE: ReadonlySet<number> = new Set<number>();
  const occupied = (k: number): boolean => roadSlots.has(k) || forced.has(k);
  /** Free (not yet road) in-bounds neighbours of a slot - the walk's "open space" score. */
  const openAround = (x: number, y: number, taken: ReadonlySet<number>): number => {
    let n = 0;
    for (const e of EDGES) {
      const nx = x + EDGE_DELTA[e][0];
      const ny = y + EDGE_DELTA[e][1];
      if (!inBounds(nx, ny)) continue;
      const nk = slotIdx(nx, ny);
      if (!occupied(nk) && !taken.has(nk)) n++;
    }
    return n;
  };

  /**
   * One self-avoiding walk from an existing slot (a tree slot, or a special's
   * arm) to a north, west or south border, planned to lane length L*. It
   * wanders through open space - preferring moves that keep options open -
   * until the lane has earned EXIT_EARLY of L*, then takes an exit when one
   * is adjacent, and must be out by EXIT_LATE. A tunnel through existing
   * road is a legal move where the pool has the bridge partition. Returns
   * null when cornered; nothing touches the real network until commit.
   */
  const tryWalk = (startK: number, startFrom: Edge | null, startDepth: number, growsStart: boolean, reserved: ReadonlySet<number> = NONE): WalkResult | null => {
    let x = startK % width;
    let y = Math.floor(startK / width);
    let cameFrom: Edge | null = startFrom;
    let lane = startDepth;
    const slots: number[] = [];
    const edges: [number, Edge][] = [];
    const tunnels: [number, Set<Edge>][] = [];
    // Slots this walk may not enter: its own trail plus whatever the caller
    // holds pending (an anchor's arms before they are committed).
    const taken = new Set<number>(reserved);
    for (let guard = 0; guard < total * 3; guard++) {
      const atStart = slots.length === 0;
      const mayExit = lane >= exitEarly;
      const mustExit = lane >= laneStar;
      const legal: { e: Edge; exits: boolean; tunnel?: Edge; score: number }[] = [];
      for (const e of EDGES) {
        if (cameFrom === e) continue;
        if (atStart && growsStart && !canGrow(slotIdx(x, y), [], e)) continue;
        const [dx, dy] = EDGE_DELTA[e];
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) {
          // The east border is the Core's side: no entry ever spawns there.
          // And an exit is a NEW port: a slot that already leaves the board
          // this way (an earlier walk's entry) cannot leave it again.
          if (nx >= width || !mayExit) continue;
          if (roadEdges.get(slotIdx(x, y))?.has(e)) continue;
          legal.push({ e, exits: true, score: 0 });
          continue;
        }
        const nk = slotIdx(nx, ny);
        if (occupied(nk) || taken.has(nk)) {
          // A TUNNEL through an occupied slot: enter via e, leave as a second
          // segment - two roads in one slot, never merging. Only where a
          // tile EXISTS for the resulting partition, never through the root,
          // an anchor, or another tunnel.
          if (nk === rootK || forced.has(nk) || secondSegment.has(nk) || taken.has(nk) || tunnels.some(([tk]) => tk === nk)) continue;
          const existing = roadEdges.get(nk);
          if (!existing) continue;
          const enter = OPPOSITE[e];
          if (existing.has(enter)) continue;
          for (const out of EDGES) {
            if (out === enter || existing.has(out)) continue;
            const [ox, oy] = EDGE_DELTA[out];
            const lx = nx + ox;
            const ly = ny + oy;
            if (lx >= width) continue; // never out through the Core's side
            const landExit = !inBounds(lx, ly);
            if (landExit && !mayExit) continue;
            if (!landExit) {
              const lk = slotIdx(lx, ly);
              if (occupied(lk) || taken.has(lk)) continue;
            }
            const pk = partitionKey([[...existing] as Edge[], [enter, out] as Edge[]]);
            if (!index.hasRoad(pk)) continue;
            legal.push({ e, exits: false, tunnel: out, score: landExit ? 0 : openAround(lx, ly, taken) });
            break;
          }
          continue;
        }
        legal.push({ e, exits: false, score: openAround(nx, ny, taken) });
      }
      // Cornered before the lane earned its length: an adjacent exit is
      // still taken when the lane clears the FLOOR (floor > balance - the
      // band is reported, the floor is not negotiable); otherwise fail and
      // let the caller retry from elsewhere.
      const inwardMoves = legal.filter((o) => !o.exits);
      if (inwardMoves.length === 0 && lane >= floorSlots && lane < exitEarly) {
        for (const e of EDGES) {
          if (cameFrom === e) continue;
          const nx = x + EDGE_DELTA[e][0];
          const ny = y + EDGE_DELTA[e][1];
          if (inBounds(nx, ny) || nx >= width) continue;
          if (roadEdges.get(slotIdx(x, y))?.has(e)) continue;
          if (atStart && growsStart && !canGrow(slotIdx(x, y), [], e)) continue;
          legal.push({ e, exits: true, score: 0 });
        }
      }
      if (legal.length === 0) return null;
      const exitMoves = legal.filter((o) => o.exits);
      if (lane > exitLate + 2 && exitMoves.length === 0) return null; // overlong and no way out: cornered

      let choice: { e: Edge; exits: boolean; tunnel?: Edge; score: number };
      if (exitMoves.length > 0 && (mustExit || inwardMoves.length === 0 || rng.chance(0.5))) {
        choice = exitMoves.length === 1 ? exitMoves[0] : rng.pick(exitMoves);
      } else if (mustExit) {
        // Length earned, no exit adjacent: head for the nearest border an
        // entry may use (north, west or south) instead of wandering on.
        const inward = legal.filter((o) => !o.exits);
        const toBorder = (o: { e: Edge; tunnel?: Edge }): number => {
          const [dx, dy] = EDGE_DELTA[o.e];
          let nx = x + dx;
          let ny = y + dy;
          if (o.tunnel) {
            nx += EDGE_DELTA[o.tunnel][0];
            ny += EDGE_DELTA[o.tunnel][1];
          }
          return Math.min(nx, ny, height - 1 - ny);
        };
        const best = Math.min(...inward.map(toBorder));
        const good = inward.filter((o) => toBorder(o) === best);
        choice = good.length === 1 ? good[0] : rng.pick(good);
      } else {
        // Weighted by open space around the target, squared: a walk that
        // keeps its options open fills the board instead of boxing itself
        // in. While it is still earning its length it also stays off the
        // exit borders - a walk that hugs the edge early gets cornered
        // there and leaves as a stub. A dead-end target (score 0) is still
        // legal - it is how the last pockets get filled - just unlikely.
        const inward = legal.filter((o) => !o.exits);
        const pool = inward.length > 0 ? inward : legal;
        const weight = (o: { e: Edge; tunnel?: Edge; score: number }): number => {
          let w = (1 + 2 * o.score) * (1 + 2 * o.score);
          if (!mayExit) {
            const [dx, dy] = EDGE_DELTA[o.e];
            let nx = x + dx;
            let ny = y + dy;
            if (o.tunnel) {
              nx += EDGE_DELTA[o.tunnel][0];
              ny += EDGE_DELTA[o.tunnel][1];
            }
            if (nx === 0 || ny === 0 || ny === height - 1) w *= 0.3;
          }
          return w;
        };
        let totalW = 0;
        for (const o of pool) totalW += weight(o);
        let roll = rng.int(0, Math.max(0, Math.floor(totalW * 10) - 1)) / 10;
        choice = pool[pool.length - 1];
        for (const o of pool) {
          const w = weight(o);
          if (roll < w) {
            choice = o;
            break;
          }
          roll -= w;
        }
      }

      edges.push([slotIdx(x, y), choice.e]);
      if (choice.exits) {
        return { slots, edges, tunnels, entry: edgeCell(x, y, choice.e), lane };
      }
      const [dx, dy] = EDGE_DELTA[choice.e];
      if (choice.tunnel) {
        const tk = slotIdx(x + dx, y + dy);
        tunnels.push([tk, new Set<Edge>([OPPOSITE[choice.e], choice.tunnel])]);
        const [ox, oy] = EDGE_DELTA[choice.tunnel];
        const lx = x + dx + ox;
        const ly = y + dy + oy;
        lane += 1;
        if (!inBounds(lx, ly)) {
          return { slots, edges, tunnels, entry: edgeCell(x + dx, y + dy, choice.tunnel), lane };
        }
        x = lx;
        y = ly;
        const k = slotIdx(x, y);
        slots.push(k);
        taken.add(k);
        edges.push([k, OPPOSITE[choice.tunnel]]);
        cameFrom = OPPOSITE[choice.tunnel];
        lane += 1;
        continue;
      }
      x += dx;
      y += dy;
      const k = slotIdx(x, y);
      slots.push(k);
      taken.add(k);
      edges.push([k, OPPOSITE[choice.e]]);
      cameFrom = OPPOSITE[choice.e];
      lane += 1;
    }
    return null;
  };

  const commit = (w: WalkResult, startDepth: number): void => {
    let d = startDepth;
    for (const k of w.slots) {
      roadSlots.add(k);
      depth.set(k, ++d);
    }
    for (const [k, e] of w.edges) addEdge(k, e);
    for (const [k, seg] of w.tunnels) secondSegment.set(k, seg);
    entryCells.push(w.entry);
    laneSlots.push(w.lane);
  };

  /**
   * Tree slots a new walk may branch from, weighted by open space and by
   * how much lane they leave to earn (a shallow branch point can still
   * balance; a deep one exits at once and reads as a stub). Anchors and
   * tunnels never branch.
   */
  const branchPoints = (): number[] => {
    const out: number[] = [];
    for (const k of roadSlots) {
      if (forced.has(k) || secondSegment.has(k)) continue;
      const d = depth.get(k) ?? 0;
      const x = k % width;
      const y = Math.floor(k / width);
      const open = openAround(x, y, new Set());
      const weight = open * (d < exitEarly ? 3 : 1);
      for (let i = 0; i < weight; i++) out.push(k);
    }
    return out;
  };

  /** A branch walk from the tree: retries from different branch points at full strength. */
  const carveBranch = (): boolean => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const points = branchPoints();
      if (points.length === 0) return false;
      const startK = rng.pick(points);
      const w = tryWalk(startK, startK === rootK ? 'e' : null, depth.get(startK) ?? 0, true);
      if (w) {
        commit(w, depth.get(startK) ?? 0);
        return true;
      }
    }
    return false;
  };

  // ---- 2. specials FIRST, as fixed nodes ----------------------------------
  // Each road special claims an interior slot and a rotation. One arm per
  // partition group joins the tree (a walk that ends the moment it can
  // attach); every other arm walks on to a border and becomes an entry,
  // planned to L* like any lane. Nothing touches the network until every
  // arm has landed (partial anchors never leak).
  const anchorOrder = [...opts.roadSpecials].sort(
    (a, b) => Math.max(...b.rotations.map((r) => r.edges.length)) - Math.max(...a.rotations.map((r) => r.edges.length)),
  );
  /** Slot-level distance to the root over the network plus pending arms. */
  const distToRoot = (extra: ReadonlyMap<number, Set<Edge>>): Int32Array => {
    const union = (k: number): Set<Edge> => {
      const out = new Set<Edge>(roadEdges.get(k));
      for (const e of secondSegment.get(k) ?? []) out.add(e);
      for (const e of extra.get(k) ?? []) out.add(e);
      return out;
    };
    const dist = new Int32Array(total).fill(-1);
    dist[rootK] = 0;
    const q = [rootK];
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi];
      const ke = union(k);
      const x = k % width;
      const y = Math.floor(k / width);
      for (const e of EDGES) {
        if (!ke.has(e)) continue;
        const nx = x + EDGE_DELTA[e][0];
        const ny = y + EDGE_DELTA[e][1];
        if (!inBounds(nx, ny)) continue;
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
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const pick = sp.rotations[sp.rotations.length === 1 ? 0 : rng.int(0, sp.rotations.length - 1)];
      // Anywhere but the Core's column: a border anchor whose arm faces
      // off-board simply IS an entry there (north, west or south).
      const ax = rng.int(0, Math.max(0, width - 2));
      const ay = rng.int(0, height - 1);
      const ak = slotIdx(ax, ay);
      if (occupied(ak) || ak === rootK) continue;

      const armEdges = new Map<number, Set<Edge>>();
      const armAdd = (k: number, e: Edge): void => {
        const set = armEdges.get(k) ?? new Set<Edge>();
        set.add(e);
        armEdges.set(k, set);
      };
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
      /** The joining arm: attaches the anchor's subtree to the tree, once. */
      const carveJoinArm = (edge: Edge): { joint: number; len: number } | null => {
        let x = ax + EDGE_DELTA[edge][0];
        let y = ay + EDGE_DELTA[edge][1];
        let cameFrom: Edge = OPPOSITE[edge];
        const local: number[] = [];
        for (let steps = 0; steps < 14; steps++) {
          if (!inBounds(x, y)) return null;
          const k = slotIdx(x, y);
          if (joinable(k, cameFrom)) {
            armAdd(k, cameFrom);
            return { joint: k, len: local.length };
          }
          if (occupied(k) || armEdges.has(k) || local.includes(k)) return null;
          local.push(k);
          armAdd(k, cameFrom);
          const joins: Edge[] = [];
          const moves: { e: Edge; d: number }[] = [];
          for (const e of EDGES) {
            if (e === cameFrom) continue;
            const nx = x + EDGE_DELTA[e][0];
            const ny = y + EDGE_DELTA[e][1];
            if (!inBounds(nx, ny)) continue;
            const nk = slotIdx(nx, ny);
            if (local.includes(nk) || nk === ak) continue;
            if (joinable(nk, OPPOSITE[e])) joins.push(e);
            else if (!occupied(nk) && !armEdges.has(nk)) moves.push({ e, d: nearestNet(nx, ny) });
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

      // Every group: one joining arm, the rest become entry walks planned to
      // L* from the anchor's real depth (join arm + anchor + tree to root).
      // The entry walks are carved on a snapshot of the network plus the
      // arms so far, committed only when the whole anchor succeeds.
      let ok = true;
      const pendingWalks: { w: WalkResult; startDepth: number }[] = [];
      const pendingSlots = new Set<number>();
      for (const grp of pick.groups) {
        // Any arm of the group may be the one that joins: with the tree
        // only a root at the east border, the first arm listed is often
        // the one facing a wall. Try each, rolling the tentative arm edges
        // back between tries; the rest of the group become entry walks.
        const snapshot = new Map([...armEdges].map(([k, v]) => [k, new Set(v)]));
        let join: { joint: number; len: number } | null = null;
        let joinEdge: Edge = grp[0];
        for (const candidate of rng.shuffle([...grp])) {
          armEdges.clear();
          for (const [k, v] of snapshot) armEdges.set(k, new Set(v));
          join = carveJoinArm(candidate);
          if (join) {
            joinEdge = candidate;
            break;
          }
        }
        if (!join) {
          ok = false;
          break;
        }
        const dist = distToRoot(armEdges);
        const anchorDepth = 1 + join.len + Math.max(0, dist[join.joint]);
        for (const e of grp.filter((x) => x !== joinEdge)) {
          // The arm's first slot must be free; the walk starts THERE with
          // the anchor as its back, so the anchor slot itself never grows.
          const sx = ax + EDGE_DELTA[e][0];
          const sy = ay + EDGE_DELTA[e][1];
          if (!inBounds(sx, sy)) {
            // Off the board: the arm is an entry on the spot - unless it
            // faces east (the Core's side, never an entry) or the anchor
            // sits closer to the root than the floor allows (D13 binds
            // every entry; a shorter lane means another placement).
            if (sx >= width || anchorDepth < floorSlots) { ok = false; break; }
            pendingWalks.push({ w: { slots: [], edges: [], tunnels: [], entry: edgeCell(ax, ay, e), lane: anchorDepth }, startDepth: anchorDepth });
            continue;
          }
          const sk = slotIdx(sx, sy);
          if (occupied(sk) || armEdges.has(sk) || pendingSlots.has(sk)) { ok = false; break; }
          // The walk must avoid the anchor, its arms and the earlier
          // pending walks: none of them is on the network yet.
          for (const k of armEdges.keys()) pendingSlots.add(k);
          pendingSlots.add(ak);
          // A cornered arm rolls back and tries again from the same start
          // (the dice differ); the placement is abandoned only after that.
          let w: WalkResult | null = null;
          for (let tries = 0; tries < 8 && !w; tries++) w = tryWalk(sk, OPPOSITE[e], anchorDepth + 1, false, pendingSlots);
          if (!w) { ok = false; break; }
          // The walk's own start slot joins as an arm slot facing the anchor.
          w.slots.unshift(sk);
          w.edges.push([sk, OPPOSITE[e]]);
          for (const k of w.slots) pendingSlots.add(k);
          pendingWalks.push({ w, startDepth: anchorDepth });
        }
        if (!ok) break;
      }
      if (!ok) continue;

      // Commit: the anchor's connectors, the join arms, then the entry walks.
      forced.set(ak, { tileId: sp.id, rotation: pick.rotation });
      roadSlots.add(ak);
      roadEdges.set(ak, new Set(pick.edges));
      for (const [k, edgesSet] of armEdges) {
        roadSlots.add(k);
        for (const e of edgesSet) addEdge(k, e);
      }
      const dist = distToRoot(new Map());
      for (const k of armEdges.keys()) depth.set(k, Math.max(0, dist[k]));
      depth.set(ak, Math.max(0, dist[ak]));
      for (const { w, startDepth } of pendingWalks) commit(w, startDepth);
      placed = true;
    }
    if (!placed) throw new Error(`special tile '${sp.id}' found no anchorage on this map - retrying`);
  }

  // ---- 3. the threat's walks, then walks until the board fills ------------
  // The threat's `entries` walks are always carved - a loadout's anchor arms
  // come ON TOP of the roll, as they always have (PRD sec 4.3). A cornered
  // walk retries from other branch points at full strength, and if the tree
  // truly has no room the whole map retries. Beyond that, walks are added
  // while the board is under its coverage target and a walk can still be
  // carved - every one of them another entry (entries are emergent, D28).
  const owed = entries;
  for (let n = 0; n < owed; n++) {
    if (!carveBranch()) throw new Error(`mapgen: could not carve entry ${laneSlots.length + 1}/${entries} on a ${width}x${height} board`);
  }
  const roadCount = (): number => roadSlots.size;
  for (let extra = 0; extra < EXTRA_WALKS && roadCount() < wantCover; extra++) {
    if (!carveBranch()) break;
  }

  const coverage = roadCount() / total;
  const shortest = Math.min(...laneSlots);
  const longest = Math.max(...laneSlots);
  return {
    rootK,
    roadEdges,
    secondSegment,
    forced,
    entries: entryCells,
    floorCells: floorSlots === wantSlots && laneSlots.every((l) => l >= floorSlots) ? Math.max(TILE_SIZE, opts.targetPathCells) : 0,
    coverage,
    laneBand: laneSlots.length > 0 && shortest >= laneBand * longest ? laneBand : 0,
    laneSlots,
  };
}
