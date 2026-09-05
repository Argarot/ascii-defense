/**
 * Positional interpolation (WBS 6.9, first half; Daniil's go, 2026-09-05
 * feedback item 3): the sim moves at 20 Hz, the picture at 60. Every
 * walker and shot is drawn between its LAST two known positions by the
 * world clock's progress through the current tick - never ahead of the
 * sim. A body the previous snapshot did not know (just spawned), a body
 * that moved further than a walker can in one tick (a bridge's strand
 * change, a recycled slot), and a body that is gone (dead, breached) all
 * fall back to the rule "draw the last known position": the current one,
 * or nothing.
 */

export interface Keyed {
  x: number;
  y: number;
  /** A stable identity across snapshots: the sim's slot and, for walkers, its generation. */
  k?: number;
  g?: number;
}

/** Cells a walker may move in one tick and still be the same walker on the same road. */
export const WALKER_MAX_STEP = 0.75;
/** Cells a shot may fly in one tick; past that it is a recycled slot. */
export const SHOT_MAX_STEP = 3;

function identity(e: Keyed): number | null {
  if (e.k === undefined) return null;
  return (e.g ?? 0) * 65536 + e.k;
}

/**
 * The current list with positions blended toward the previous snapshot's:
 * `alpha` 0 draws where things were, 1 where they are. Items without an
 * identity, without a match, or that jumped past `maxStep` draw where
 * they are.
 */
export function interpolate<T extends Keyed>(prev: readonly T[], cur: readonly T[], alpha: number, maxStep: number): T[] {
  const a = Math.max(0, Math.min(1, alpha));
  if (a >= 1 || prev.length === 0) return cur.slice();
  const was = new Map<number, T>();
  for (const p of prev) {
    const id = identity(p);
    if (id !== null) was.set(id, p);
  }
  return cur.map((c) => {
    const id = identity(c);
    const p = id === null ? undefined : was.get(id);
    if (!p) return c;
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    if (Math.abs(dx) > maxStep || Math.abs(dy) > maxStep) return c;
    return { ...c, x: p.x + dx * a, y: p.y + dy * a };
  });
}
