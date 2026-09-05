/**
 * verifyMap (WBS 2.27): every invariant of the map-generation specification
 * (ARCHITECTURE sec 12) checked in ONE place against a finished map — not
 * implied by pass order. Runs in tests today; wired to the end of generation
 * when the constraint-first rebuild (2.27 PRs 2-3) lands.
 *
 * Returns a list of violations (empty = the map satisfies the spec). Rule
 * ids mirror the spec so a failure names the law it breaks.
 */
import { TILE_SIZE, tilePartition, type Edge } from '../tiles/tile';
import { TileLibrary, slotAt } from '../tiles/board';
import { isRoad, isRouteCell, roadsConnect, strandPorts, type CellType } from '../grid/cells';
import { DIRS, computeFlowField, stepAllowed, strandStep, type FlowField } from '../sim/flow';
import { CORE_STRIP, ORE_REACH, VOID_SHARE_CAP, mapCells, type GeneratedMap } from './mapgen';

export interface VerifyIssue {
  /** Spec rule id, e.g. 'tier1/road-tree'. */
  rule: string;
  detail: string;
}

export interface VerifyMapOptions {
  /** The run's loaded specials — each must appear exactly once (Tier 0). */
  specials?: readonly string[];
  /** When > 0 the relic layer is on: rocks must carry dealt contents. */
  relicPoolSize?: number;
  /**
   * Tier 1: every entry's realized route to the Core must be at least this
   * many cells. Checked when provided (the cell-denominated knob arrives
   * with the 2.27 rebuild).
   */
  minPathCells?: number;
}

const CENTER = (TILE_SIZE - 1) / 2;

export function verifyMap(map: GeneratedMap, lib: TileLibrary, opts: VerifyMapOptions = {}): VerifyIssue[] {
  const issues: VerifyIssue[] = [];
  const bad = (rule: string, detail: string): void => {
    issues.push({ rule, detail });
  };
  const { board } = map;
  const { width, height } = board;
  const W = map.cellsW;
  const H = map.cellsH;
  const tileW = width * TILE_SIZE;
  const cells = mapCells(map, lib);
  const cellAt = (x: number, y: number): CellType | null =>
    x < 0 || y < 0 || x >= W || y >= H ? null : cells[y * W + x];

  // ---- Tier 0: the Core is a FACE past the east border, fed once ----------
  // Session 24 (Daniil): no tile carries the Core. Three 'C' cells stand in
  // the strip column, stacked, centred on `core`; exactly one road cell
  // touches them - the root's east port - and every other Core-adjacent
  // cell is nothing at all.
  if (W !== tileW + CORE_STRIP || H !== height * TILE_SIZE) {
    bad('tier0/cell-grid', `cell grid ${W}x${H} is not ${tileW + CORE_STRIP}x${height * TILE_SIZE}`);
  }
  const face = map.coreFace ?? [];
  if (face.length !== 3) bad('tier0/core-face', `the Core face has ${face.length} cells, not 3`);
  for (const c of face) {
    if (c.x !== tileW) bad('tier0/core-face', `face cell (${c.x},${c.y}) is not in the Core strip (x=${tileW})`);
    if (cellAt(c.x, c.y) !== 'C') bad('tier0/core-face', `face cell (${c.x},${c.y}) is '${cellAt(c.x, c.y)}', not 'C'`);
  }
  if (face.length === 3 && (face[1].y !== face[0].y + 1 || face[2].y !== face[1].y + 1)) bad('tier0/core-face', 'the face is not three stacked cells');
  if (face.length === 3 && (map.core.x !== face[1].x || map.core.y !== face[1].y)) bad('tier0/core', 'core is not the middle face cell');
  let coreCells = 0;
  for (const c of cells) if (c === 'C') coreCells++;
  if (coreCells !== 3) bad('tier0/core-cells', `${coreCells} Core cells on the grid, not 3`);
  let feeds = 0;
  for (const c of face) {
    const west = cellAt(c.x - 1, c.y);
    if (west !== null && isRoad(west) && roadsConnect(west, 'C', 1, 0)) feeds++;
  }
  if (feeds !== 1) bad('tier0/core-one-entrance', `${feeds} road cells feed the Core face, not 1`);
  let coreTiles = 0;
  for (const p of board.slots) {
    if (p && lib.resolved(p.tileId, p.rotation).cells.some((row) => row.includes('C'))) coreTiles++;
  }
  if (coreTiles !== 0) bad('tier0/no-core-tiles', `${coreTiles} tile(s) carry the Core; the Core is not a tile`);

  // ---- Tier 0: specials exactly once, from a known pool ------------------
  const knownIds = new Set(lib.ids());
  const placedCounts = new Map<string, number>();
  for (const p of board.slots) {
    if (!p) continue;
    placedCounts.set(p.tileId, (placedCounts.get(p.tileId) ?? 0) + 1);
    if (!knownIds.has(p.tileId)) bad('tier0/pool', `placed tile '${p.tileId}' is not in the library`);
  }
  for (const id of opts.specials ?? []) {
    const n = placedCounts.get(id) ?? 0;
    if (n !== 1) bad('tier0/specials-exactly-once', `special '${id}' placed ${n} times`);
  }

  // ---- Tier 1: entries are distinct road cells on the border -------------
  const seenEntries = new Set<string>();
  for (const e of map.entries) {
    const key = `${e.x},${e.y}`;
    if (seenEntries.has(key)) bad('tier1/entries-distinct', `duplicate entry at ${key}`);
    seenEntries.add(key);
    // North, west or south: the east border is the Core's side.
    if (e.x !== 0 && e.y !== 0 && e.y !== H - 1) {
      bad('tier1/entries-on-border', `entry ${key} is not on a north, west or south border`);
    }
    const c = cellAt(e.x, e.y);
    if (c === null || !isRoad(c)) bad('tier1/entries-are-road', `entry ${key} sits on '${c}'`);
  }

  // ---- Tier 1: every entry routes to the Core; no orphan road cells ------
  // The flow field is the game's own truth about routing (strand-aware, so
  // bridges keep their two roads separate). It throws on an unreachable
  // entry; a road cell no strand of which reaches the Core is an orphan.
  let flow: FlowField | null = null;
  try {
    flow = computeFlowField(cells, W, H, map.entries);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c === null || !isRouteCell(c)) continue;
      if (flow.dist[i] < 0) bad('tier1/road-cells-route', `road cell (${i % W},${(i / W) | 0}) reaches no Core`);
    }
    if (opts.minPathCells !== undefined) {
      for (const e of map.entries) {
        const d = flow.dist[e.y * W + e.x];
        if (d < opts.minPathCells) {
          bad('tier1/path-min-cells', `entry ${e.x},${e.y} routes in ${d} cells < ${opts.minPathCells}`);
        }
      }
    }
    // D28: lanes balanced - when the carve reports the band met, the
    // shortest entry route is at least that share of the longest, in the
    // cells enemies walk. Reported, never forced: a board that cannot
    // balance says 0 and is not held to it.
    if ((map.laneBand ?? 0) > 0 && map.entries.length > 1) {
      const lanes = map.entries.map((e) => flow!.dist[e.y * W + e.x]);
      const shortest = Math.min(...lanes);
      const longest = Math.max(...lanes);
      // A slot-level band of 0.7 lands within a tile of itself in cells.
      if (shortest < map.laneBand * longest - TILE_SIZE) {
        bad('tier1/lanes-balanced', `shortest lane ${shortest} cells < ${map.laneBand} x longest ${longest}`);
      }
    }
  } catch (err) {
    bad('tier1/routes', err instanceof Error ? err.message : String(err));
  }

  // ---- Tier 1: EXACTLY ONE route per entry, at strand resolution ---------
  // The literal law, checked on the literal graph the enemies walk: strand
  // nodes and the game's own step predicates (stepAllowed + strandStep).
  // All Core cells contract to one supernode (the Core welds internally -
  // its interior adjacencies are not routes). On the reachable component a
  // unique-route network is a tree: |E| = |V| - 1; every extra edge is a
  // second way somewhere. This sees what the slot-level check cannot:
  // cycles INSIDE tiles and cycles threaded through touching segments.
  if (flow) {
    const SUPER = -2;
    const reachable = (i: number, s: number): boolean => flow!.nodeDist[i * 2 + s] >= 0;
    const edgeKeys = new Set<string>();
    const addEdge = (a: number, b: number): void => {
      edgeKeys.add(a <= b ? `${a}|${b}` : `${b}|${a}`);
    };
    let nodeCount = 1; // the Core supernode
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const a = cells[i];
        if (a === null || !isRouteCell(a)) continue;
        if (a !== 'C') {
          for (let s = 0; s < strandPorts(a).length; s++) if (reachable(i, s)) nodeCount++;
        }
        for (const d of [1, 2]) {
          // East and south only - each undirected adjacency counted once.
          const nx = x + DIRS[d][0];
          const ny = y + DIRS[d][1];
          if (nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          const b = cells[ni];
          if (b === null || !isRouteCell(b)) continue;
          if (!stepAllowed(cells, W, H, x, y, nx, ny)) continue;
          if (a === 'C' && b === 'C') continue; // interior of the supernode
          if (a === 'C') {
            const sb = strandStep(a, 0, b, d);
            if (sb >= 0 && reachable(ni, sb)) addEdge(SUPER, ni * 2 + sb);
          } else {
            for (let sa = 0; sa < strandPorts(a).length; sa++) {
              const sb = strandStep(a, sa, b, d);
              if (sb < 0 || !reachable(i, sa)) continue;
              if (b === 'C') addEdge(i * 2 + sa, SUPER);
              else if (reachable(ni, sb)) addEdge(i * 2 + sa, ni * 2 + sb);
            }
          }
        }
      }
    const extra = edgeKeys.size - (nodeCount - 1);
    if (extra > 0) {
      bad('tier1/route-unique', `${extra} extra route connection(s): somewhere the road offers more than one way`);
    }
  }

  // ---- Tier 1: the road is a TREE at the segment level -------------------
  // Nodes are (slot, partition group) — a tunnel or bridge slot carries two
  // independent roads and counts as two nodes. Edges are facing seams whose
  // edge-center cells connect. A connected graph is a tree iff |E| = |V|-1.
  {
    type Groups = { groups: Edge[][]; cells: readonly string[] };
    const slotGroups = new Map<number, Groups>();
    for (let ty = 0; ty < height; ty++)
      for (let tx = 0; tx < width; tx++) {
        const p = slotAt(board, tx, ty);
        if (!p) continue;
        const r = lib.resolved(p.tileId, p.rotation);
        const groups = tilePartition(r.cells).map((g) => [...g]);
        const hasCore = r.cells.some((row) => row.includes('C'));
        if (groups.length === 0 && !hasCore) continue;
        // A core tile's crossings all interconnect through the Core; treat
        // it as a single group over its connector edges.
        slotGroups.set(ty * width + tx, {
          groups: hasCore ? [groups.flat()] : groups,
          cells: r.cells,
        });
      }
    const nodeId = (k: number, e: Edge): string | null => {
      const g = slotGroups.get(k);
      if (!g) return null;
      const gi = g.groups.findIndex((grp) => grp.includes(e));
      return gi === -1 ? null : `${k}:${gi}`;
    };
    const edges: [string, string][] = [];
    const EDGE_CELL: Record<Edge, [number, number]> = {
      n: [CENTER, 0],
      s: [CENTER, TILE_SIZE - 1],
      w: [0, CENTER],
      e: [TILE_SIZE - 1, CENTER],
    };
    for (let ty = 0; ty < height; ty++)
      for (let tx = 0; tx < width; tx++) {
        const k = ty * width + tx;
        if (!slotGroups.has(k)) continue;
        for (const [e, nk, dx, dy] of [
          ['e', k + 1, 1, 0],
          ['s', k + width, 0, 1],
        ] as const) {
          if (e === 'e' && tx + 1 >= width) continue;
          if (e === 's' && ty + 1 >= height) continue;
          if (!slotGroups.has(nk)) continue;
          const [ax, ay] = EDGE_CELL[e];
          const opp: Edge = e === 'e' ? 'w' : 'n';
          const [bx, by] = EDGE_CELL[opp];
          const ca = cellAt(tx * TILE_SIZE + ax, ty * TILE_SIZE + ay);
          const cb = cellAt((tx + dx) * TILE_SIZE + bx, (ty + dy) * TILE_SIZE + by);
          if (ca === null || cb === null) continue;
          if (!isRouteCell(ca) || !isRouteCell(cb)) continue;
          if (!roadsConnect(ca, cb, dx, dy)) continue;
          const a = nodeId(k, e);
          const b = nodeId(nk, opp);
          if (a === null || b === null) continue;
          edges.push([a, b]);
        }
      }
    // Connectivity: BFS over the union of group nodes.
    const adj = new Map<string, string[]>();
    const allNodes = new Set<string>();
    for (const [k, g] of slotGroups) {
      for (let gi = 0; gi < Math.max(1, g.groups.length); gi++) allNodes.add(`${k}:${gi}`);
    }
    for (const [a, b] of edges) {
      adj.set(a, [...(adj.get(a) ?? []), b]);
      adj.set(b, [...(adj.get(b) ?? []), a]);
    }
    if (allNodes.size > 0) {
      const start = allNodes.values().next().value as string;
      const seen = new Set([start]);
      const stack = [start];
      while (stack.length) {
        for (const nb of adj.get(stack.pop()!) ?? []) {
          if (!seen.has(nb)) {
            seen.add(nb);
            stack.push(nb);
          }
        }
      }
      if (seen.size !== allNodes.size) {
        bad('tier1/road-connected', `${allNodes.size - seen.size} road segment(s) disconnected from the network`);
      }
      if (edges.length !== allNodes.size - 1) {
        bad('tier1/road-tree', `|E|=${edges.length}, |V|=${allNodes.size}: the road graph is not a tree`);
      }
    }
  }

  // ---- Tier 2: void distance, share, and land fill -----------------------
  {
    const isRoadSlot = board.slots.map((p) => {
      if (!p) return false;
      const r = lib.resolved(p.tileId, p.rotation);
      return tilePartition(r.cells).length > 0 || r.cells.some((row) => row.includes('C'));
    });
    const dist = new Array<number>(width * height).fill(-1);
    const q: number[] = [];
    isRoadSlot.forEach((v, k) => {
      if (v) {
        dist[k] = 0;
        q.push(k);
      }
    });
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi];
      const x = k % width;
      const y = Math.floor(k / width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
        const nk = (y + dy) * width + x + dx;
        if (dist[nk] === -1) {
          dist[nk] = dist[k] + 1;
          q.push(nk);
        }
      }
    }
    // D28: the board fills - the road covers the share the carve reports.
    {
      let roadCount = 0;
      isRoadSlot.forEach((v) => { if (v) roadCount++; });
      if (roadCount < Math.floor((map.coverage ?? 0) * width * height)) {
        bad('tier2/coverage', `${roadCount}/${width * height} road slots below the reported coverage ${(map.coverage ?? 0).toFixed(2)}`);
      }
    }
    let voidCount = 0;
    for (let k = 0; k < width * height; k++) {
      if (board.slots[k] === null) {
        voidCount++;
        // Also the land-fill rule's contrapositive: a void slot at road
        // distance 1..ORE_REACH is exactly a land slot that failed to fill.
        if (dist[k] !== -1 && dist[k] <= ORE_REACH) {
          bad('tier2/void-far', `void slot (${k % width},${Math.floor(k / width)}) at road distance ${dist[k]}`);
        }
      }
    }
    // D14: the ceiling is the target DRAWN for this map (curve support
    // capped at VOID_SHARE_CAP), carried on the map itself.
    const ceiling = Math.min(map.voidShareTarget, VOID_SHARE_CAP);
    if (voidCount > Math.floor(width * height * ceiling)) {
      bad('tier2/void-share', `${voidCount}/${width * height} void slots exceed the drawn ceiling ${ceiling.toFixed(3)}`);
    }
  }

  // ---- Tier 3: dressing sits on the right cells --------------------------
  for (const b of map.boons) {
    if (cellAt(b.x, b.y) !== 'G') bad('tier3/boons-on-ground', `boon at (${b.x},${b.y}) sits on '${cellAt(b.x, b.y)}'`);
  }
  for (const c of map.caches) {
    if (cellAt(c.x, c.y) !== 'G') bad('tier3/caches-on-ground', `cache at (${c.x},${c.y}) sits on '${cellAt(c.x, c.y)}'`);
  }
  {
    const depositCells = new Set<number>();
    for (const d of map.deposits) {
      const key = d.y * W + d.x;
      if (depositCells.has(key)) bad('tier3/deposits-unique', `two deposits at (${d.x},${d.y})`);
      depositCells.add(key);
      if (cellAt(d.x, d.y) !== 'O') bad('tier3/deposits-on-ore', `deposit at (${d.x},${d.y}) sits on '${cellAt(d.x, d.y)}'`);
      if (d.amount <= 0) bad('tier3/deposits-finite', `deposit at (${d.x},${d.y}) has amount ${d.amount}`);
    }
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === 'O' && !depositCells.has(i)) {
        bad('tier3/ore-has-deposit', `ore cell (${i % W},${(i / W) | 0}) has no dealt vein`);
      }
    }
  }
  if ((opts.relicPoolSize ?? 0) > 0) {
    const poolSize = opts.relicPoolSize!;
    const rockCells = new Set<number>();
    for (const r of map.rockContents) {
      const key = r.y * W + r.x;
      if (rockCells.has(key)) bad('tier3/rocks-unique', `two dealt contents at (${r.x},${r.y})`);
      rockCells.add(key);
      if (cellAt(r.x, r.y) !== 'R') bad('tier3/rocks-on-rock', `rock content at (${r.x},${r.y}) sits on '${cellAt(r.x, r.y)}'`);
    }
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === 'R' && !rockCells.has(i)) {
        bad('tier3/rocks-dealt', `rock cell (${i % W},${(i / W) | 0}) has no dealt contents`);
      }
    }
    void poolSize;
  }

  return issues;
}
