/**
 * Cell types (PRD sec 4.1). The single-character codes are the content
 * authoring format; the engine works with the codes directly - they are ids,
 * not appearance.
 *
 * There is no spawn type: entries are DERIVED - an open road end at the board
 * edge is a spawn point (PRD sec 4.1) - the same philosophy as derived
 * connectors. C is the Core's own substance, the thing enemies march toward.
 */
export type CellType = 'G' | 'R' | 'r' | 'K' | 'O' | 'C' | '^' | 'v' | '<' | '>';

export const CELL_TYPES: readonly CellType[] = ['G', 'R', 'r', 'K', 'O', 'C', '^', 'v', '<', '>'];

/** Direction a directional road cell flows along, as a (dx, dy) unit step. */
export const ROAD_DIR: Partial<Record<CellType, readonly [number, number]>> = {
  '^': [0, -1],
  'v': [0, 1],
  '<': [-1, 0],
  '>': [1, 0],
};

/**
 * Lane identity (PRD sec 4.2.1, session 14): 'R' and 'r' are BOTH road -
 * same look, same rules, same unbuildability - but they are different LANES
 * within a tile. Two touching road cells of different lanes do not connect:
 * that is what lets parallel roads run side by side without merging. Lanes
 * are tile-local; crossings join whatever lane owns each side's connector.
 */
export function isRoad(c: CellType): boolean {
  return c === 'R' || c === 'r' || c === '^' || c === 'v' || c === '<' || c === '>';
}

/**
 * Do two ADJACENT route cells connect? (dx, dy) is the step from a to b.
 * The directional model (Daniil, playtest 3): a directional cell points one
 * way; two neighbours connect when either points at the other. An S-fold
 * authored with directional cells therefore touches itself without merging -
 * the folded segments point along themselves, not at each other. Plain 'R'
 * points everywhere (omni); 'r' is a second omni lane kept for bridge work;
 * R and r never join each other; the Core welds anything.
 */
export function roadsConnect(a: CellType, b: CellType, dx: number, dy: number): boolean {
  if (a === 'C' || b === 'C') return a !== b || a === 'C'; // C joins any route cell (C-C included)
  if (!isRoad(a) || !isRoad(b)) return false;
  const omni = (c: CellType): boolean => c === 'R' || c === 'r';
  if (omni(a) && omni(b)) return a === b; // R-R yes, r-r yes, R-r never
  const points = (c: CellType, ddx: number, ddy: number): boolean => {
    if (omni(c)) return true;
    const d = ROAD_DIR[c]!;
    return d[0] === ddx && d[1] === ddy;
  };
  return points(a, dx, dy) || points(b, -dx, -dy);
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
