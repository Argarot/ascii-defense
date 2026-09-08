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
import { TILE_SIZE, canonicalCells, mirrorCanonicalKey, tileIsSpecialShape, validateTileCells, tilePartition, deriveConnectors, type Edge } from '@ascii-defense/engine';
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
  special?: boolean;
  /** A name by shape family (session 33: the hundred): "Bend III", "Fork II". */
  name?: string;
}

/**
 * The shape FAMILY of a routing tile, read from its road (session 33, the
 * plan's "names by shape family"): a two-edge tile is a Lane (no turn), a
 * Bend (one), a Dogleg (two), a Staircase (three), a Meander (four or
 * more); a three-edge tile is a Fork, a four-edge one a Cross; a special
 * shape wears the family of its road with "Twin" for a second segment.
 */
export { priceTile } from '@ascii-defense/engine';

export function familyOf(cells: readonly string[]): string {
  const conn = deriveConnectors(cells);
  const edges = (['n', 'e', 's', 'w'] as Edge[]).filter((e) => conn[e]).length;
  if (edges >= 4) return 'Cross';
  if (edges === 3) return 'Fork';
  // Count the turns: every corner glyph on the road is a change of direction.
  let turns = 0;
  for (const row of cells) for (const ch of row) if ('LJF7'.includes(ch)) turns++;
  const twin = tilePartition(cells).length > 1;
  const base = turns === 0 ? 'Lane' : turns === 1 ? 'Bend' : turns === 2 ? 'Dogleg' : turns === 3 ? 'Staircase' : 'Meander';
  return twin ? `Twin ${base}` : base;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX'];
/** Names every tile of a batch "<Family> <numeral>", numbering within the family in order. */
export function nameByFamily(tiles: GeneratedTile[]): GeneratedTile[] {
  const seen = new Map<string, number>();
  return tiles.map((t) => {
    const fam = familyOf(t.cells);
    const n = (seen.get(fam) ?? 0) + 1;
    seen.set(fam, n);
    return { ...t, name: `${fam} ${ROMAN[n - 1] ?? String(n)}` };
  });
}

/** ASSET identity key: rotation AND reflection (playtest 18 - gen_ns_4 was
 *  gen_ns_3's mirror and read as a duplicate). Used to dedup generated tiles
 *  against each other and against hand-authored shapes. */
export function canonicalKeyOf(cells: readonly string[]): string {
  return mirrorCanonicalKey(cells);
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
      // Dedup by MIRROR-canonical form (store as rotation-canonical): the
      // same shape found sideways OR flipped is the same asset.
      const canon = canonicalCells(cells);
      const key = mirrorCanonicalKey(cells);
      if (seen.has(key)) continue;
      seen.add(key);
      made++;
      // Special-shape tiles (touching or twin-segment) are SPECIALS
      // (Daniil, playtests 17-18): chosen in the loadout, never rolled.
      out.push({ id: `gen_${sig.join('')}_${made}`, cells: canon, ...(tileIsSpecialShape(canon) ? { special: true } : {}) });
    }
  }
  return out;
}

// ---- the hundred (session 33): every shape, not a wander's luck ----------

/**
 * Every self-avoiding path from a to b whose cells never touch another
 * cell of the path except their neighbours along it - so the road never
 * runs beside itself (a touching road is a SPECIAL by the one law). A
 * bounded exhaustive walk: the 5x5 grid keeps it small.
 */
function nonTouchingPaths(a: Pt, b: Pt, cap = 6000): Pt[][] {
  const out: Pt[][] = [];
  const onPath: boolean[][] = Array.from({ length: TILE_SIZE }, () => Array.from({ length: TILE_SIZE }, () => false));
  const path: Pt[] = [];
  const touches = (x: number, y: number, px: number, py: number): boolean => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx === px && ny === py) continue;
      if (nx >= 0 && ny >= 0 && nx < TILE_SIZE && ny < TILE_SIZE && onPath[ny][nx]) return true;
    }
    return false;
  };
  const walk = (x: number, y: number): void => {
    if (out.length >= cap) return;
    path.push([x, y]);
    onPath[y][x] = true;
    if (x === b[0] && y === b[1]) out.push(path.slice());
    else {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE || onPath[ny][nx]) continue;
        if (touches(nx, ny, x, y)) continue;
        walk(nx, ny);
      }
    }
    onPath[y][x] = false;
    path.pop();
  };
  walk(a[0], a[1]);
  return out;
}

/** Corners along a path: the turns. */
function turnsOf(path: Pt[]): number {
  let t = 0;
  for (let i = 1; i + 1 < path.length; i++) {
    const dx1 = path[i][0] - path[i - 1][0];
    const dy1 = path[i][1] - path[i - 1][1];
    const dx2 = path[i + 1][0] - path[i][0];
    const dy2 = path[i + 1][1] - path[i][1];
    if (dx1 !== dx2 || dy1 !== dy2) t++;
  }
  return t;
}

/**
 * The hundred (session 33): per signature, EVERY legal routing shape,
 * deduped by mirror and rotation, spread over the turn counts so a
 * signature's `perSig` picks are straight, bent, and wandering in even
 * measure. Two-edge signatures are enumerated exactly; junctions (three
 * and four edges) join exact arms at a joint in the middle nine cells,
 * sampled deterministically. Ids are `t_<sig>_<n>`, stable for a given
 * library seed, distinct from the wander's `gen_` ids so a save that owns
 * a gen tile keeps it.
 */
export function enumerateVariants(seed: number, perSig: number): GeneratedTile[] {
  const rng = createRng(seed).stream('map');
  const out: GeneratedTile[] = [];
  const SIGS: Edge[][] = [['n', 's'], ['n', 'e'], ['n', 'e', 's'], ['n', 'e', 's', 'w']];
  for (const sig of SIGS) {
    const seen = new Set<string>();
    const candidates: { cells: string[]; turns: number }[] = [];
    const consider = (grid: string[][], turns: number): void => {
      const cells = grid.map((r) => r.join(''));
      if (validateTileCells(cells).length !== 0) return;
      if (tilePartition(cells).length !== 1) return;
      if (tileIsSpecialShape(cells)) return; // the hundred are ROUTING tiles; specials are chosen, and the Smith mints them
      const conn = deriveConnectors(cells);
      const got = (['n', 'e', 's', 'w'] as Edge[]).filter((e) => conn[e]).sort().join('');
      if (got !== [...sig].sort().join('')) return;
      const key = mirrorCanonicalKey(cells);
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ cells: canonicalCells(cells), turns });
    };
    if (sig.length === 2) {
      for (const path of nonTouchingPaths(EDGE_CELL[sig[0]], EDGE_CELL[sig[1]])) {
        const grid: string[][] = Array.from({ length: TILE_SIZE }, () => Array.from({ length: TILE_SIZE }, () => 'G'));
        if (encode(grid, path)) consider(grid, turnsOf(path));
      }
    } else {
      for (let jy = 1; jy <= 3; jy++) for (let jx = 1; jx <= 3; jx++) {
        const arms = sig.map((e) => nonTouchingPaths(EDGE_CELL[e], [jx, jy], 400));
        if (arms.some((a) => a.length === 0)) continue;
        for (let tries = 0; tries < 300; tries++) {
          const grid: string[][] = Array.from({ length: TILE_SIZE }, () => Array.from({ length: TILE_SIZE }, () => 'G'));
          grid[jy][jx] = 'X';
          let ok = true;
          let turns = 0;
          for (const armSet of arms) {
            const arm = armSet[rng.int(0, armSet.length - 1)];
            turns += turnsOf(arm);
            if (!encode(grid, arm.slice(0, -1))) { ok = false; break; }
          }
          if (ok) consider(grid, turns);
        }
      }
    }
    // Spread over the turn counts: take evenly from the sorted list.
    candidates.sort((a, b) => a.turns - b.turns || a.cells.join('').localeCompare(b.cells.join('')));
    const take = Math.min(perSig, candidates.length);
    for (let i = 0; i < take; i++) {
      const c = candidates[Math.floor((i * candidates.length) / take)];
      out.push({ id: `t_${sig.join('')}_${i + 1}`, cells: c.cells });
    }
  }
  return out;
}

// ---- the land (session 33): fillers and decorated roads --------------------

/** Cells orthogonally beside a road glyph: rock never crowds the road. */
function besideRoad(cells: string[][], x: number, y: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE) continue;
    if (!'GRO'.includes(cells[ny][nx])) return true;
  }
  return false;
}

/** Grows a rock blob of `size` cells from a seed cell on free ground; ore cells go inside it. */
function growRock(rng: RngStream, cells: string[][], size: number, ore: number): boolean {
  const free: Pt[] = [];
  for (let y = 0; y < TILE_SIZE; y++) for (let x = 0; x < TILE_SIZE; x++) if (cells[y][x] === 'G' && !besideRoad(cells, x, y)) free.push([x, y]);
  if (free.length === 0) return false;
  const blob: Pt[] = [free[rng.int(0, free.length - 1)]];
  const inBlob = (x: number, y: number): boolean => blob.some(([bx, by]) => bx === x && by === y);
  while (blob.length < size) {
    const [bx, by] = blob[rng.int(0, blob.length - 1)];
    const opts: Pt[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = bx + dx;
      const ny = by + dy;
      if (nx < 0 || ny < 0 || nx >= TILE_SIZE || ny >= TILE_SIZE || inBlob(nx, ny)) continue;
      if (cells[ny][nx] !== 'G' || besideRoad(cells, nx, ny)) continue;
      opts.push([nx, ny]);
    }
    if (opts.length === 0) break;
    blob.push(opts[rng.int(0, opts.length - 1)]);
  }
  if (blob.length < 2) return false;
  for (const [x, y] of blob) cells[y][x] = 'R';
  // Ore sits INSIDE the rock (a vein is prospected out of it), never on its rim alone.
  const inner = blob.filter(([x, y]) => blob.filter(([ox, oy]) => Math.abs(ox - x) + Math.abs(oy - y) === 1).length >= 2);
  for (let k = 0; k < ore && inner.length > 0; k++) {
    const i = rng.int(0, inner.length - 1);
    const [x, y] = inner[i];
    cells[y][x] = 'O';
    inner.splice(i, 1);
  }
  return true;
}

/**
 * Filler tiles (session 33): the land between roads - scree fields, outcrops
 * and veins in many shapes, so two boards do not resemble each other even
 * where the road runs the same. Deduped by mirror and rotation; ids f_<n>.
 */
export function enumerateFillers(seed: number, count: number): GeneratedTile[] {
  const rng = createRng(seed).stream('map');
  const out: GeneratedTile[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < count * 20 && out.length < count; attempt++) {
    const cells: string[][] = Array.from({ length: TILE_SIZE }, () => Array.from({ length: TILE_SIZE }, () => 'G'));
    const blobs = rng.int(1, 2);
    let any = false;
    for (let b = 0; b < blobs; b++) any = growRock(rng, cells, rng.int(2, 7), rng.int(0, 2)) || any;
    if (!any) continue;
    const rows = cells.map((r) => r.join(''));
    if (validateTileCells(rows).length !== 0) continue;
    const key = mirrorCanonicalKey(rows);
    if (seen.has(key)) continue;
    seen.add(key);
    const ore = rows.join('').split('O').length - 1;
    const rock = rows.join('').split('R').length - 1;
    out.push({ id: `f_${out.length + 1}`, cells: canonicalCells(rows), name: ore > 0 ? 'Vein' : rock >= 5 ? 'Scree' : 'Outcrop' });
  }
  return out;
}

/**
 * Decorated roads (session 33): each routing shape with rock and a vein or
 * two on the ground beside it - cliff bends for every bend. The road is
 * the base tile's; the land is new. Ids <base>r<k>.
 */
export function decorateRoads(seed: number, bases: readonly { id: string; cells: readonly string[] }[], perBase: number): GeneratedTile[] {
  const rng = createRng(seed).stream('map');
  const out: GeneratedTile[] = [];
  const seen = new Set<string>();
  for (const base of bases) {
    let made = 0;
    for (let attempt = 0; attempt < perBase * 12 && made < perBase; attempt++) {
      const cells = base.cells.map((r) => [...r]);
      if (!growRock(rng, cells, rng.int(2, 5), rng.int(0, 1))) continue;
      const rows = cells.map((r) => r.join(''));
      if (validateTileCells(rows).length !== 0) continue;
      if (tileIsSpecialShape(rows)) continue;
      const key = mirrorCanonicalKey(rows);
      if (seen.has(key)) continue;
      seen.add(key);
      made++;
      out.push({ id: `${base.id}r${made}`, cells: canonicalCells(rows), name: `Cliff ${familyOf(base.cells)}` });
    }
  }
  return out;
}
