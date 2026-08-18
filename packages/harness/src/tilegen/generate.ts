/**
 * Tile-variant generation (WBS 2.15, D10): emit candidate 5x5 road tiles by
 * random pathing, encode each path in PORT SEGMENTS so folds are airtight by
 * construction, and keep only what the shared validator accepts. The library
 * goes from hand-authored to hundreds for the cost of a script - and every
 * survivor is legal by the exact function the game loads with.
 *
 * Junctions (3-4 edges) use 'X' (omni) at the joint; path bodies use
 * '-|LJF7', computed from each cell's neighbours in the path, so a wiggly
 * road that runs beside itself touches without merging.
 */
import { TILE_SIZE, canonicalCells, validateTileCells, tilePartition, deriveConnectors, type Edge } from '@ascii-defense/engine';
import { createRng, type RngStream } from '@ascii-defense/engine';

const CENTER = (TILE_SIZE - 1) / 2;
const EDGE_CELL: Record<Edge, [number, number]> = {
  n: [CENTER, 0],
  s: [CENTER, TILE_SIZE - 1],
  w: [0, CENTER],
  e: [TILE_SIZE - 1, CENTER],
};

type Pt = [number, number];

/** Random self-avoiding path from a to b; may touch itself, never overlap. */
function wanderPath(rng: RngStream, a: Pt, b: Pt, tries = 60): Pt[] | null {
  for (let t = 0; t < tries; t++) {
    const path: Pt[] = [a];
    const used = new Set<number>([a[1] * TILE_SIZE + a[0]]);
    let [x, y] = a;
    let ok = false;
    for (let step = 0; step < 23; step++) {
      if (x === b[0] && y === b[1]) {
        ok = true;
        break;
      }
      const moves: Pt[] = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE) continue;
        if (used.has(ny * TILE_SIZE + nx)) continue;
        moves.push([nx, ny]);
      }
      if (moves.length === 0) break;
      // Bias toward the target so paths terminate; wiggle otherwise.
      const toward = moves.filter(([mx, my]) => Math.abs(mx - b[0]) + Math.abs(my - b[1]) < Math.abs(x - b[0]) + Math.abs(y - b[1]));
      const pick = toward.length > 0 && rng.chance(0.6) ? rng.pick(toward) : rng.pick(moves);
      [x, y] = pick;
      used.add(y * TILE_SIZE + x);
      path.push(pick);
    }
    if (ok) return path;
  }
  return null;
}

/** Port-encode a path: each cell's code from its prev/next directions. */
function encode(grid: string[][], path: Pt[]): boolean {
  const codeFor = (ports: number): string | null =>
    ({ 10: '-', 5: '|', 3: 'L', 9: 'J', 6: 'F', 12: '7' })[ports] ?? null;
  const bit = (dx: number, dy: number): number => (dy === -1 ? 1 : dx === 1 ? 2 : dy === 1 ? 4 : 8);
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i];
    let ports = 0;
    if (i > 0) ports |= bit(path[i - 1][0] - x, path[i - 1][1] - y);
    if (i + 1 < path.length) ports |= bit(path[i + 1][0] - x, path[i + 1][1] - y);
    // Edge endpoints face outward too, so the crossing derives.
    if (i === 0 || i === path.length - 1) {
      if (y === 0) ports |= 1;
      if (x === TILE_SIZE - 1) ports |= 2;
      if (y === TILE_SIZE - 1) ports |= 4;
      if (x === 0) ports |= 8;
    }
    const c = codeFor(ports);
    if (c === null) return false; // >2 ports on a body cell: needs a junction
    if (grid[y][x] !== 'G') return false;
    grid[y][x] = c;
  }
  return true;
}

export interface GeneratedTile {
  id: string;
  cells: string[];
}

/** Canonical identity key, for deduping generated tiles against hand-authored ones. */
export function canonicalKeyOf(cells: readonly string[]): string {
  return canonicalCells(cells).join('/');
}

/**
 * Generate up to `perSig` valid variants per SHAPE CLASS. A tile and its
 * rotations are one tile (2.24), so the old eleven per-signature families
 * collapse to four canonical classes - the generator's index re-derives
 * every orientation at deal time, so nothing is lost, and no shape enters
 * the pool four times just for being drawn sideways.
 */
export function generateVariants(seed: number, perSig: number): GeneratedTile[] {
  const rng = createRng(seed).stream('map');
  const out: GeneratedTile[] = [];
  const seen = new Set<string>();

  const SIGS: Edge[][] = [
    ['n', 's'],
    ['n', 'e'],
    ['n', 'e', 's'],
    ['n', 'e', 's', 'w'],
  ];

  for (const sig of SIGS) {
    let made = 0;
    for (let attempt = 0; attempt < 400 && made < perSig; attempt++) {
      const grid: string[][] = Array.from({ length: TILE_SIZE }, () => Array.from({ length: TILE_SIZE }, () => 'G'));
      let ok = true;
      if (sig.length === 2) {
        const path = wanderPath(rng, EDGE_CELL[sig[0]], EDGE_CELL[sig[1]]);
        ok = path !== null && encode(grid, path);
      } else {
        // Junction tiles: an omni 'X' joint near the middle, one path per edge.
        const jx = CENTER + rng.int(-1, 1);
        const jy = CENTER + rng.int(-1, 1);
        grid[jy][jx] = 'X';
        for (const e of sig) {
          const path = wanderPath(rng, EDGE_CELL[e], [jx, jy]);
          if (path === null || !encode(grid, path.slice(0, -1))) {
            ok = false;
            break;
          }
          // The cell beside the joint must port INTO the joint; wanderPath's
          // last body cell already faces it, and X accepts from any side.
        }
      }
      if (!ok) continue;
      const cells = grid.map((r) => r.join(''));
      if (validateTileCells(cells).length !== 0) continue;
      if (tilePartition(cells).length !== 1) continue; // routing tiles route
      const conn = deriveConnectors(cells);
      const gotSig = (['n', 'e', 's', 'w'] as Edge[]).filter((e) => conn[e]).sort().join('');
      if (gotSig !== [...sig].sort().join('')) continue; // exactly the asked edges
      // Dedup and store by CANONICAL form: the same shape found sideways in
      // a later attempt is the same tile, not a second asset.
      const canon = canonicalCells(cells);
      const key = canon.join('/');
      if (seen.has(key)) continue;
      seen.add(key);
      made++;
      out.push({ id: `gen_${sig.join('')}_${made}`, cells: canon });
    }
  }
  return out;
}
