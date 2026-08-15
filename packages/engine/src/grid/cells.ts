/**
 * Cell types (PRD sec 4.1). The single-character codes are the content
 * authoring format; the engine works with the codes directly - they are ids,
 * not appearance.
 *
 * There is no spawn type: entries are DERIVED - an open road end at the board
 * edge is a spawn point (PRD sec 4.1) - the same philosophy as derived
 * connectors. C is the Core's own substance, the thing enemies march toward.
 */
export type CellType = 'G' | 'R' | 'K' | 'O' | 'C';

export const CELL_TYPES: readonly CellType[] = ['G', 'R', 'K', 'O', 'C'];

export function isCellType(c: string): c is CellType {
  return (CELL_TYPES as readonly string[]).includes(c);
}

/** Enemies can traverse these on the ground. */
export function isPathable(c: CellType): boolean {
  return c === 'R' || c === 'G' || c === 'O' || c === 'C';
}

/**
 * Route-network membership: road, plus the Core cells the road delivers to.
 * Core cells derive no connectors (tile.ts) - roads end AT the Core.
 */
export function isRouteCell(c: CellType): boolean {
  return c === 'R' || c === 'C';
}

/** Towers may be built here. Road is never buildable (invariant 4). */
export function isBuildable(c: CellType): boolean {
  return c === 'G' || c === 'O';
}
