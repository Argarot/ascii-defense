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
import { TileLibrary, resolveCells, slotAt } from '../tiles/board';
import { isRoad, isRouteCell, roadsConnect, type CellType } from '../grid/cells';
import { computeFlowField } from '../sim/flow';
import { ORE_REACH, VOID_SHARE_CAP, type GeneratedMap } from './mapgen';

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
  const W = width * TILE_SIZE;
  const H = height * TILE_SIZE;
  const cells = resolveCells(board, lib);
  const cellAt = (x: number, y: number): CellType | null =>
    x < 0 || y < 0 || x >= W || y >= H ? null : cells[y * W + x];

  // ---- Tier 0: one Core near center --------------------------------------
  if (cellAt(map.core.x, map.core.y) !== 'C') {
    bad('tier0/core', `core cell (${map.core.x},${map.core.y}) is '${cellAt(map.core.x, map.core.y)}', not 'C'`);
  }
  const coreSlotX = Math.floor(map.core.x / TILE_SIZE);
  const coreSlotY = Math.floor(map.core.y / TILE_SIZE);
  if (Math.abs(coreSlotX - Math.floor(width / 2)) > 1 || Math.abs(coreSlotY - Math.floor(height / 2)) > 1) {
    bad('tier0/core-near-center', `core slot (${coreSlotX},${coreSlotY}) is not within 1 of board center`);
  }
  let coreTiles = 0;
  for (const p of board.slots) {
    if (p && lib.resolved(p.tileId, p.rotation).cells.some((row) => row.includes('C'))) coreTiles++;
  }
  if (coreTiles !== 1) bad('tier0/one-core', `${coreTiles} core tiles on the board`);

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
    if (e.x !== 0 && e.y !== 0 && e.x !== W - 1 && e.y !== H - 1) {
      bad('tier1/entries-on-border', `entry ${key} is not on the board border`);
    }
    const c = cellAt(e.x, e.y);
    if (c === null || !isRoad(c)) bad('tier1/entries-are-road', `entry ${key} sits on '${c}'`);
  }

  // ---- Tier 1: every entry routes to the Core; no orphan road cells ------
  // The flow field is the game's own truth about routing (strand-aware, so
  // bridges keep their two roads separate). It throws on an unreachable
  // entry; a road cell no strand of which reaches the Core is an orphan.
  try {
    const flow = computeFlowField(cells, W, H, map.entries);
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
  } catch (err) {
    bad('tier1/routes', err instanceof Error ? err.message : String(err));
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
      if (r.yields === 'cache' && (r.poolIdx === undefined || r.poolIdx < 0 || r.poolIdx >= poolSize)) {
        bad('tier3/rock-pool-idx', `rock cache at (${r.x},${r.y}) points at pool index ${r.poolIdx}`);
      }
    }
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === 'R' && !rockCells.has(i)) {
        bad('tier3/rocks-dealt', `rock cell (${i % W},${(i / W) | 0}) has no dealt contents`);
      }
    }
    for (const c of map.caches) {
      if (c.poolIdx < 0 || c.poolIdx >= poolSize) bad('tier3/cache-pool-idx', `cache at (${c.x},${c.y}) points at pool index ${c.poolIdx}`);
    }
  }

  return issues;
}
