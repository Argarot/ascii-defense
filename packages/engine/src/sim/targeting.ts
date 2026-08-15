/**
 * Targeting priorities. Pure so the choice logic is unit-testable without a
 * running sim, and shared so the HUD's words and the tower's behaviour can
 * never disagree.
 *
 * Ties break on the lowest slot index in every strategy - deterministic,
 * spends no randomness (the tie-break falls out of the strict < comparisons
 * below, because earlier candidates win equal scores).
 */
export const PRIORITIES = ['first', 'last', 'closest', 'weakest'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface TargetCandidate {
  /** Enemy slot index. */
  slot: number;
  /** Flow-field distance to the Core at the enemy's cell. */
  flowDist: number;
  /** Distance to the tower, squared (cells^2). */
  distSq: number;
  hp: number;
}

/** Choose among in-range candidates. Returns the slot, or -1 for none. */
export function pickTarget(candidates: readonly TargetCandidate[], priority: Priority): number {
  if (candidates.length === 0) return -1;
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    switch (priority) {
      case 'first':
        if (c.flowDist < best.flowDist) best = c;
        break;
      case 'last':
        if (c.flowDist > best.flowDist) best = c;
        break;
      case 'closest':
        if (c.distSq < best.distSq) best = c;
        break;
      case 'weakest':
        if (c.hp < best.hp) best = c;
        break;
    }
  }
  return best.slot;
}
