/**
 * Cell types (PRD sec 4.1). The single-character codes are the content
 * authoring format; the engine works with the codes directly - they are ids,
 * not appearance.
 */
export type CellType = 'G' | 'R' | 'K' | 'O' | 'S';

export const CELL_TYPES: readonly CellType[] = ['G', 'R', 'K', 'O', 'S'];

export function isCellType(c: string): c is CellType {
  return (CELL_TYPES as readonly string[]).includes(c);
}

/** Enemies can traverse these on the ground. */
export function isPathable(c: CellType): boolean {
  return c === 'R' || c === 'G' || c === 'O' || c === 'S';
}

/**
 * Road-network membership: cells that carry the enemy route. Spawn counts -
 * it is the route's entry terminus - but derives no connector (tile.ts).
 */
export function isRouteCell(c: CellType): boolean {
  return c === 'R' || c === 'S';
}

/** Towers may be built here. Road is never buildable (invariant 4). */
export function isBuildable(c: CellType): boolean {
  return c === 'G' || c === 'O';
}
