/**
 * Cell types (PRD sec 4.1). The single-character codes are the content
 * authoring format; the engine works with the codes directly - they are ids,
 * not appearance.
 *
 * There is no spawn type: entries are DERIVED - an open road end at the board
 * edge is a spawn point (PRD sec 4.1) - the same philosophy as derived
 * connectors. C is the Core's own substance, the thing enemies march toward.
 */
export type CellType = 'G' | 'R' | 'r' | 'K' | 'O' | 'C';

export const CELL_TYPES: readonly CellType[] = ['G', 'R', 'r', 'K', 'O', 'C'];

/**
 * Lane identity (PRD sec 4.2.1, session 14): 'R' and 'r' are BOTH road -
 * same look, same rules, same unbuildability - but they are different LANES
 * within a tile. Two touching road cells of different lanes do not connect:
 * that is what lets parallel roads run side by side without merging. Lanes
 * are tile-local; crossings join whatever lane owns each side's connector.
 */
export function isRoad(c: CellType): boolean {
  return c === 'R' || c === 'r';
}

/** Same-tile route adjacency: same lane, or the Core welds any lane to it. */
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
  return c === 'R' || c === 'r' || c === 'C';
}

/** Towers may be built here. Road is never buildable (invariant 4). */
export function isBuildable(c: CellType): boolean {
  return c === 'G' || c === 'O';
}
