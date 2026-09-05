/**
 * Flow field toward the Core (ARCHITECTURE sec 5). Uniform-cost BFS over
 * route cells at cell resolution - all steps cost 1, so Dijkstra's priority
 * queue would be ceremony. Recomputed on map changes only, never per tick.
 *
 * Since session 14 the route is a GRAPH, not raw cell adjacency (PRD sec
 * 4.2.1): within a tile, road cells join only when their PORTS face; across
 * a tile boundary, the only legal step is between the two edge-centre cells
 * of tiles whose connectors both derive - i.e. an actual crossing. Two
 * roads touching any other way are TOUCHING, not connected.
 *
 * Since session 19 the graph is over STRAND NODES (4.9, the bridge): a
 * bridge cell 'B' holds two independent nodes - an east-west deck and a
 * north-south underpass - so two roads cross in one cell without joining.
 * Distances are therefore per NODE (`nodeDist`); the per-cell `dist` is the
 * min over strands and exists for consumers that only need "how far is
 * this cell" (targeting, L, tests). The `allowed` mask stays per cell (the
 * union) for the view's rims; the walk phase resolves its strand from its
 * direction of travel, because both strands are straight.
 *
 * Yields `L`, the effective road length feeding the difficulty model
 * (PRD sec 9): the longest entry-to-Core walk in cells.
 */
import { isRoad, isRouteCell, roadsConnect, strandEntered, strandPorts, type CellType } from '../grid/cells';
import { TILE_SIZE } from '../tiles/tile';
import type { CellRef } from '../mapgen/mapgen';

/** Direction bit per neighbour, indexed as the walk phase scans them. */
export const DIR_BITS = [1, 2, 4, 8] as const; // N, E, S, W
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

export interface FlowField {
  /** Distance in cells to the nearest Core cell; -1 off the route. Per cell: min over strands. */
  readonly dist: Int32Array;
  /** Distance per STRAND NODE: index = (y*width+x)*2 + strand. Strand 0 for everything except a bridge's north-south underpass (1). */
  readonly nodeDist: Int32Array;
  readonly width: number;
  readonly height: number;
  /** Bitmask of legal route steps per cell (N=1 E=2 S=4 W=8) - the union over strands. */
  readonly allowed: Uint8Array;
  /** Longest entry distance - the L of PRD sec 9. */
  readonly L: number;
}

const CENTER = (TILE_SIZE - 1) / 2;

/**
 * May an enemy step from (x,y) to (nx,ny), at CELL level? The route-graph
 * edge predicate: same tile - ports must face; across tiles - both cells
 * must be the shared edge's centres AND both sides must continue inward
 * (their connectors derive), which is precisely deriveConnectors'
 * directional rule applied at board scale.
 */
export function stepAllowed(
  cells: readonly (CellType | null)[],
  width: number,
  height: number,
  x: number,
  y: number,
  nx: number,
  ny: number,
): boolean {
  const a = cells[y * width + x];
  const b = cells[ny * width + nx];
  if (a === null || b === null || !isRouteCell(a) || !isRouteCell(b)) return false;
  // The Core welds any route cell that faces it (session 24: the face sits
  // in the strip past the east border, so the boundary rule below - which
  // looks for a road continuing INWARD beyond the seam - has nothing to
  // find there; the Core IS the end of the road).
  if (a === 'C' || b === 'C') return roadsConnect(a, b, Math.sign(nx - x), Math.sign(ny - y));

  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  const ntx = Math.floor(nx / TILE_SIZE);
  const nty = Math.floor(ny / TILE_SIZE);
  if (tx === ntx && ty === nty) return roadsConnect(a, b, Math.sign(nx - x), Math.sign(ny - y));

  // Crossing a tile boundary: only centre-to-centre, and only when each side
  // continues its road inward (same-lane or Core) - the directional rule.
  const lx = x % TILE_SIZE;
  const ly = y % TILE_SIZE;
  const nlx = nx % TILE_SIZE;
  const nly = ny % TILE_SIZE;
  const horizontal = ty === nty;
  if (horizontal) {
    if (ly !== CENTER || nly !== CENTER) return false;
  } else {
    if (lx !== CENTER || nlx !== CENTER) return false;
  }
  const inwardOk = (cx: number, cy: number, dx: number, dy: number): boolean => {
    const ix = cx + dx;
    const iy = cy + dy;
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
    const centre = cells[cy * width + cx]!;
    const inward = cells[iy * width + ix];
    if (inward === null) return false;
    if (centre === 'C' || inward === 'C') return true;
    return isRoad(inward) && roadsConnect(centre, inward, dx, dy);
  };
  // Each side's inward direction points AWAY from the boundary.
  return inwardOk(x, y, x - nx, y - ny) && inwardOk(nx, ny, nx - x, ny - y);
}

/**
 * Strand-level edge on top of stepAllowed: leaving (a, sa) in direction d
 * needs that strand's port (the Core welds ports-blind, except off a
 * bridge - a walker cannot turn off the deck); the target strand is the
 * one the motion enters. Returns the target strand, or -1 for no edge.
 */
export function strandStep(a: CellType, sa: number, b: CellType, d: number): number {
  if (a === 'C') return b === 'C' ? 0 : strandEntered(b, DIR_BITS[d]);
  if ((strandPorts(a)[sa] & DIR_BITS[d]) === 0 && !(b === 'C' && a !== 'B')) return -1;
  if (b === 'C') return 0;
  const sb = strandEntered(b, DIR_BITS[d]);
  return (strandPorts(b)[sb] & DIR_BITS[(d + 2) % 4]) === 0 ? -1 : sb;
}

export function computeFlowField(
  cells: readonly (CellType | null)[],
  width: number,
  height: number,
  entries: readonly CellRef[],
): FlowField {
  const allowed = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (cells[i] === null || !isRouteCell(cells[i]!)) continue;
      let mask = 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0];
        const ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (stepAllowed(cells, width, height, x, y, nx, ny)) mask |= DIR_BITS[d];
      }
      allowed[i] = mask;
    }

  const nodeDist = new Int32Array(width * height * 2).fill(-1);
  const queue: number[] = []; // node indices

  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === 'C') {
      nodeDist[i * 2] = 0;
      queue.push(i * 2);
    }
  }
  if (queue.length === 0) throw new Error('flow field: no Core cells on the board');

  for (let qi = 0; qi < queue.length; qi++) {
    const node = queue[qi];
    const i = node >> 1;
    const s = node & 1;
    const x = i % width;
    const y = (i / width) | 0;
    for (let d = 0; d < 4; d++) {
      if ((allowed[i] & DIR_BITS[d]) === 0) continue;
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const ni = ny * width + nx;
      const sb = strandStep(cells[i]!, s, cells[ni]!, d);
      if (sb < 0) continue;
      const nn = ni * 2 + sb;
      if (nodeDist[nn] !== -1) continue;
      nodeDist[nn] = nodeDist[node] + 1;
      queue.push(nn);
    }
  }

  // Per-cell distance: the nearer strand. -1 when neither routes.
  const dist = new Int32Array(width * height).fill(-1);
  for (let i = 0; i < width * height; i++) {
    const a = nodeDist[i * 2];
    const b = nodeDist[i * 2 + 1];
    dist[i] = a === -1 ? b : b === -1 ? a : Math.min(a, b);
  }

  let L = 0;
  for (const e of entries) {
    const d = dist[e.y * width + e.x];
    if (d < 0) throw new Error(`flow field: entry ${e.x},${e.y} cannot reach the Core`);
    if (d > L) L = d;
  }

  return { dist, nodeDist, width, height, allowed, L };
}
