/**
 * Flow field toward the Core (ARCHITECTURE sec 5). Uniform-cost BFS over
 * route cells at cell resolution - all steps cost 1, so Dijkstra's priority
 * queue would be ceremony. Recomputed on map changes only, never per tick.
 *
 * Since session 14 the route is a GRAPH, not raw cell adjacency (PRD sec
 * 4.2.1): within a tile, road cells join only when their LANES join ('R'
 * with 'R', 'r' with 'r', Core with anything); across a tile boundary, the
 * only legal step is between the two edge-centre cells of tiles whose
 * connectors both derive - i.e. an actual crossing. Two roads touching any
 * other way are TOUCHING, not connected. The `allowed` mask carries the
 * verdict per cell and direction so the walk phase can never step where the
 * BFS would not - enemies do not change lanes.
 *
 * Yields `L`, the effective road length feeding the difficulty model
 * (PRD sec 9): the longest entry-to-Core walk in cells.
 */
import { isRoad, isRouteCell, roadsConnect, type CellType } from '../grid/cells';
import { TILE_SIZE } from '../tiles/tile';
import type { CellRef } from '../mapgen/mapgen';

/** Direction bit per neighbour, indexed as the walk phase scans them. */
export const DIR_BITS = [1, 2, 4, 8] as const; // N, E, S, W
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

export interface FlowField {
  /** Distance in cells to the nearest Core cell; -1 off the route. */
  readonly dist: Int32Array;
  readonly width: number;
  readonly height: number;
  /** Bitmask of legal route steps per cell (N=1 E=2 S=4 W=8). */
  readonly allowed: Uint8Array;
  /** Longest entry distance - the L of PRD sec 9. */
  readonly L: number;
}

const CENTER = (TILE_SIZE - 1) / 2;

/**
 * May an enemy step from (x,y) to (nx,ny)? The route-graph edge predicate:
 * same tile - lanes must join; across tiles - both cells must be the shared
 * edge's centres AND both sides must continue inward (their connectors
 * derive), which is precisely deriveConnectors' directional rule applied at
 * board scale.
 */
function stepAllowed(
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

  const dist = new Int32Array(width * height).fill(-1);
  const queue: number[] = [];

  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === 'C') {
      dist[i] = 0;
      queue.push(i);
    }
  }
  if (queue.length === 0) throw new Error('flow field: no Core cells on the board');

  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    const x = i % width;
    const y = (i / width) | 0;
    for (let d = 0; d < 4; d++) {
      if ((allowed[i] & DIR_BITS[d]) === 0) continue;
      const ni = (y + DIRS[d][1]) * width + (x + DIRS[d][0]);
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[i] + 1;
      queue.push(ni);
    }
  }

  let L = 0;
  for (const e of entries) {
    const d = dist[e.y * width + e.x];
    if (d < 0) throw new Error(`flow field: entry ${e.x},${e.y} cannot reach the Core`);
    if (d > L) L = d;
  }

  return { dist, width, height, allowed, L };
}
