/**
 * Flow field toward the Core (ARCHITECTURE sec 5). Uniform-cost BFS over
 * route cells at cell resolution - all steps cost 1, so Dijkstra's priority
 * queue would be ceremony. Recomputed on map changes only, never per tick.
 *
 * Yields `L`, the effective road length feeding the difficulty model
 * (PRD sec 8): the longest entry-to-Core walk in cells.
 */
import { isRouteCell, type CellType } from '../grid/cells';
import type { CellRef } from '../mapgen/mapgen';

export interface FlowField {
  /** Distance in cells to the nearest Core cell; -1 off the route. */
  readonly dist: Int32Array;
  readonly width: number;
  readonly height: number;
  /** Longest entry distance - the L of PRD sec 8. */
  readonly L: number;
}

export function computeFlowField(
  cells: readonly (CellType | null)[],
  width: number,
  height: number,
  entries: readonly CellRef[],
): FlowField {
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
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      const t = cells[ni];
      if (t === null || !isRouteCell(t) || dist[ni] !== -1) continue;
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

  return { dist, width, height, L };
}
