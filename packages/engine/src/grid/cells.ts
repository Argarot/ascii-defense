/**
 * Cell types (PRD sec 4.1). The single-character codes are the content
 * authoring format; the engine works with the codes directly - they are ids,
 * not appearance.
 *
 * Nomenclature migrated 2026-08-18 (Daniil, session 19): the omni crossroads
 * is 'X' (was 'R'), rock is 'R' (was 'K'), and the second omni lane is 'B'
 * for bridge (was 'r') - reserving the letter for the true crossing cell of
 * WBS 4.9, whose semantics land later. Old-format content is migrated, not
 * reinterpreted: under the new alphabet an old 'R' would silently read as
 * rock, which is exactly the kind of quiet corruption the migration exists
 * to prevent.
 *
 * There is no spawn type: entries are DERIVED - an open road end at the board
 * edge is a spawn point (PRD sec 4.1) - the same philosophy as derived
 * connectors. C is the Core's own substance, the thing enemies march toward.
 */
export type CellType = 'G' | 'X' | 'B' | 'R' | 'O' | 'C' | '-' | '|' | 'L' | 'J' | 'F' | '7' | 'T' | 'U' | 'E' | '3';

export const CELL_TYPES: readonly CellType[] = ['G', 'X', 'B', 'R', 'O', 'C', '-', '|', 'L', 'J', 'F', '7', 'T', 'U', 'E', '3'];

/** Old-alphabet cell codes (pre-2026-08-18) mapped to the current ones. */
export const LEGACY_CELL_MAP: Readonly<Record<string, string>> = { R: 'X', K: 'R', r: 'B' };

/** Migrate one old-format 5-row cell grid to the current alphabet. */
export function migrateLegacyCells(cells: readonly string[]): string[] {
  return cells.map((row) => row.replace(/[RKr]/g, (c) => LEGACY_CELL_MAP[c]));
}

/**
 * Which sides a road SEGMENT connects (Daniil, playtest 4: not four flow
 * directions - horizontal, vertical, and four corners that say how they
 * bend). Bits: N=1 E=2 S=4 W=8. The letters follow the vi/roguelike
 * convention: L bends north-east, J north-west, F south-east, 7 south-west.
 * 'X'/'B' are omni segments (all four ports).
 */
export const ROAD_PORTS: Partial<Record<CellType, number>> = {
  '-': 2 | 8,
  '|': 1 | 4,
  L: 1 | 2,
  J: 1 | 8,
  F: 4 | 2,
  '7': 4 | 8,
  // T-junctions: first-class 3-port segments (2.23, Daniil playtest 9).
  // NOT 'X': an omni cell merges with an adjacent omni cell, which would
  // roll back touch-without-connecting exactly where roads are dense. The
  // glyph mnemonic is the box-drawing shape: T like a ┬ (stem south),
  // U like ┴ (stem north), E like ├ (opens east), 3 like ┤ (opens west).
  T: 2 | 4 | 8,
  U: 1 | 2 | 8,
  E: 1 | 2 | 4,
  '3': 1 | 4 | 8,
  // A true 4-way INTERSECTION - crossing and merging - genuinely has four
  // ports: that is 'X'. 'B' is the BRIDGE (4.9, pulled forward by Daniil,
  // session 19): the same four ports, but split into two INDEPENDENT
  // strands - an east-west deck and a north-south underpass - that cross
  // in one cell and never join. The union mask stays 15 so port-union code
  // (adjacency, rims) is unchanged; everything that ROUTES must think in
  // strands (strandPorts / strandEntered below).
  X: 15,
  B: 15,
};

/** The bridge's two independent strands: [0] east-west deck, [1] north-south underpass. */
const BRIDGE_STRANDS: readonly number[] = [2 | 8, 1 | 4];
const NO_STRANDS: readonly number[] = [];

/**
 * Port masks per independent STRAND. Every road cell is one strand - its
 * ports - except the bridge, which is two. Routing code (validity floods,
 * the flow field, the walk) traverses (cell, strand) nodes so the two
 * roads crossing a bridge stay separate; cell-level adjacency code may
 * keep using ROAD_PORTS, because the facing bit always identifies the
 * strand uniquely (the strands partition the mask).
 */
export function strandPorts(c: CellType): readonly number[] {
  if (c === 'B') return BRIDGE_STRANDS;
  const p = ROAD_PORTS[c];
  return p === undefined ? NO_STRANDS : [p];
}

/** Which strand of `c` a walker moving in direction `dirBit` (N=1 E=2 S=4 W=8) enters. */
export function strandEntered(c: CellType, dirBit: number): number {
  return c === 'B' && (dirBit === 1 || dirBit === 4) ? 1 : 0;
}

export function isRoad(c: CellType): boolean {
  return ROAD_PORTS[c] !== undefined;
}

/**
 * Do two ADJACENT route cells connect? (dx, dy) is the step from a to b.
 * Segments connect when BOTH have a port facing each other - symmetric,
 * unambiguous, and the segment's shape IS its connectivity, so what you see
 * is what connects. An S-fold's back-to-back straights share no facing
 * ports and touch without merging. The bridge joins by whichever STRAND
 * faces the neighbour - its separation lives inside the cell (the two
 * strands never join each other), not in adjacency. The Core welds any
 * route cell.
 */
export function roadsConnect(a: CellType, b: CellType, dx: number, dy: number): boolean {
  if (a === 'C' || b === 'C') return a !== b || a === 'C'; // C joins any route cell (C-C included)
  const pa = ROAD_PORTS[a];
  const pb = ROAD_PORTS[b];
  if (pa === undefined || pb === undefined) return false;
  const bit = dy === -1 ? 1 : dx === 1 ? 2 : dy === 1 ? 4 : 8;
  const opp = dy === -1 ? 4 : dx === 1 ? 8 : dy === 1 ? 1 : 2;
  return (pa & bit) !== 0 && (pb & opp) !== 0;
}

/** @deprecated session-14 lane join; roadsConnect is the rule now. */
export function lanesJoin(a: CellType, b: CellType): boolean {
  if (a === 'C' || b === 'C') return true;
  return a === b;
}

export function isCellType(c: string): c is CellType {
  return (CELL_TYPES as readonly string[]).includes(c);
}

/**
 * Route-network membership: road, plus the Core cells the road delivers to.
 * Core cells derive no connectors (tile.ts) - roads end AT the Core.
 *
 * This is the ONLY notion of "enemies walk here" (PRD sec 4.1). A former
 * isPathable() also called G and O traversable - a pre-pivot leftover, never
 * called by anything, and contradicted by the flow field since it shipped.
 * Deleted 2026-08-16 after it misled a fresh context into believing that
 * opening a rock cell could create a shortcut. Ground is open, not walkable.
 */
export function isRouteCell(c: CellType): boolean {
  return isRoad(c) || c === 'C';
}

/** Towers may be built here. Road is never buildable (invariant 4). */
export function isBuildable(c: CellType): boolean {
  return c === 'G' || c === 'O';
}
