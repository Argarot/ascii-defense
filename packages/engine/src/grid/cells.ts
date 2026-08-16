/**
 * Cell types (PRD sec 4.1). The single-character codes are the content
 * authoring format; the engine works with the codes directly - they are ids,
 * not appearance.
 *
 * There is no spawn type: entries are DERIVED - an open road end at the board
 * edge is a spawn point (PRD sec 4.1) - the same philosophy as derived
 * connectors. C is the Core's own substance, the thing enemies march toward.
 */
export type CellType = 'G' | 'R' | 'r' | 'K' | 'O' | 'C' | '-' | '|' | 'L' | 'J' | 'F' | '7';

export const CELL_TYPES: readonly CellType[] = ['G', 'R', 'r', 'K', 'O', 'C', '-', '|', 'L', 'J', 'F', '7'];

/**
 * Which sides a road SEGMENT connects (Daniil, playtest 4: not four flow
 * directions - horizontal, vertical, and four corners that say how they
 * bend). Bits: N=1 E=2 S=4 W=8. The letters follow the vi/roguelike
 * convention: L bends north-east, J north-west, F south-east, 7 south-west.
 * 'R'/'r' are omni segments (all four ports).
 */
export const ROAD_PORTS: Partial<Record<CellType, number>> = {
  '-': 2 | 8,
  '|': 1 | 4,
  L: 1 | 2,
  J: 1 | 8,
  F: 4 | 2,
  '7': 4 | 8,
  R: 15,
  r: 15,
};

/**
 * Lane identity (PRD sec 4.2.1, session 14): 'R' and 'r' are BOTH road -
 * same look, same rules, same unbuildability - but they are different LANES
 * within a tile. Two touching road cells of different lanes do not connect:
 * that is what lets parallel roads run side by side without merging. Lanes
 * are tile-local; crossings join whatever lane owns each side's connector.
 */
export function isRoad(c: CellType): boolean {
  return ROAD_PORTS[c] !== undefined;
}

/**
 * Do two ADJACENT route cells connect? (dx, dy) is the step from a to b.
 * Segments connect when BOTH have a port facing each other - symmetric,
 * unambiguous, and the segment's shape IS its connectivity, so what you see
 * is what connects. An S-fold's back-to-back straights share no facing
 * ports and touch without merging. R-r (the two omni lanes) never join
 * each other; the Core welds any route cell.
 */
export function roadsConnect(a: CellType, b: CellType, dx: number, dy: number): boolean {
  if (a === 'C' || b === 'C') return a !== b || a === 'C'; // C joins any route cell (C-C included)
  const pa = ROAD_PORTS[a];
  const pb = ROAD_PORTS[b];
  if (pa === undefined || pb === undefined) return false;
  if (pa === 15 && pb === 15 && a !== b) return false; // R-r stay separate lanes
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
