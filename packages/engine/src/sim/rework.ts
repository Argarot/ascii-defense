/**
 * THE REWORK'S PROTOTYPE, the sim's half (PRD sec 32.2-32.4, D43-D45, D55):
 * the rules a run plays by when the switch is on. ONE optional object on
 * SimOptions - absent, the sim is the game as it is, and the lab, the bands
 * and the golden hash stand still. The map's half is mapgen/pads.ts. Rework
 * IV deletes the old path and folds what is left of this file into the sim.
 */
import { isRoad, type CellType } from '../grid/cells';

/**
 * Digging replaces prospecting (sec 32.2, D43): "if it can be dug, there is a
 * pad behind it". One rock, no hardness; a flat price; slow; one crew with a
 * queue; one layer of sight. First-pass numbers with their target beside
 * them: a run that digs at every chance ends about six pads up, so a dig is a
 * decision made three to six times a run and never a systematic excavation.
 */
export interface DigRules {
  /** Scrap, flat: the road a pad touches prices it in the Smith (sec 32.10), never in a dig. */
  cost: number;
  seconds: number;
  /** Digs in progress at once; the rest of the queue waits. */
  crews: number;
  /** Layers of sight: a rock or bedrock cell shows which it is within this many cells (Chebyshev) of an open cell. */
  sight: number;
  /** How many digs may be queued behind the crews. */
  queue: number;
}
export const REWORK_DIG: DigRules = { cost: 60, seconds: 45, crews: 1, sight: 1, queue: 4 };

/**
 * The clear bonus (sec 32.3, D44 - his rule, in place of bounty-by-distance):
 * "the sooner a wave is cleared, the more it pays". A wave killed near its
 * entry never walks the road, so clear time already measures how far forward
 * a build kills - and it reads as one line:  WAVE 7 CLEARED in 31 s . par 60 . +58
 *
 * PAR is the wave's spawn window plus the walk of its slowest body from its
 * farthest entry to the Core. The BONUS is the wave's bounties x the share of
 * par saved x `mul`. SPAWN WINDOWS ARE SHORT (his condition): a wave finishes
 * arriving within `windowShare` of its clock, or the last body's entry time
 * decides the payout and not the build; formations compress to fit. The early
 * call is untouched: par runs from a wave's own launch. Target, for the re-fit
 * (Rework IV), not for here: a build that hugs the Core earns about 60% of
 * today's income, one that kills forward about 160%.
 */
export interface ClearRules {
  mul: number;
  /** A wave arrives within this share of its Threat's clock: a fifth - Calm 11 s, Standard 8, Grim 6. */
  windowShare: number;
}
export const REWORK_CLEAR: ClearRules = { mul: 1, windowShare: 0.2 };

export interface ReworkRules {
  dig?: DigRules;
  clear?: ClearRules;
}
/** Everything the prototype turns on in the sim, at its first-pass numbers. */
export function reworkRules(over: Partial<{ dig: Partial<DigRules>; clear: Partial<ClearRules> }> = {}): ReworkRules {
  return { dig: { ...REWORK_DIG, ...over.dig }, clear: { ...REWORK_CLEAR, ...over.clear } };
}

/** An OPEN cell is one a player can see into the ground from: road, the Core, a pad, a vein (a pad with ore under it). */
export function isOpenCell(c: CellType | null): boolean {
  return c !== null && (c === 'G' || c === 'O' || c === 'C' || isRoad(c));
}

/**
 * One layer of sight (sec 32.2): from outside, rock and bedrock look the
 * same. A cell shows which it is only within `layers` cells of an open cell,
 * or within a SOURCE's radius (a Survey refinery reveals the rock around it).
 * Returns 1 for every cell whose nature is known; open cells are always 1.
 * Pure, so the sim (may this rock be dug?) and the view (how is this cell
 * drawn?) read one rule.
 */
export function sightMask(
  cells: readonly (CellType | null)[],
  W: number,
  H: number,
  layers: number,
  sources: readonly { x: number; y: number; r: number }[] = [],
): Uint8Array {
  const known = new Uint8Array(W * H);
  if (layers >= Math.max(W, H)) return known.fill(1);
  const mark = (cx: number, cy: number, r: number): void => {
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++)
      for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) known[y * W + x] = 1;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (isOpenCell(cells[y * W + x])) mark(x, y, layers);
  for (const s of sources) mark(s.x, s.y, s.r);
  return known;
}

/** A Survey refinery's reveal (sec 32.2): "rock within two cells of that Refinery". */
export const SURVEY_SIGHT = 2;

/** What lies under a dug rock when the map dealt it a find: boon ground, by the cell's own position - no dice, so a replay is exact. */
export function boonUnder(x: number, y: number): { boon: 'range' | 'damage' | 'rate'; tier: 1 | 2 } {
  const kinds = ['range', 'damage', 'rate'] as const;
  return { boon: kinds[(x * 7 + y * 13) % 3], tier: (x + y) % 4 === 0 ? 2 : 1 };
}
