import { describe, expect, it } from 'vitest';
import { pickTarget, type TargetCandidate } from './targeting';

const c = (slot: number, flowDist: number, distSq: number, hp: number): TargetCandidate => ({
  slot,
  flowDist,
  distSq,
  hp,
});

// One shared lineup: slot 0 is far-from-core/near-tower/healthy, slot 1 is
// near-core/far-from-tower/hurt, slot 2 is middle everything.
const LINEUP = [c(0, 40, 1, 30), c(1, 5, 25, 8), c(2, 20, 9, 15)];

describe('pickTarget', () => {
  it('first: lowest flow distance (closest to the Core)', () => {
    expect(pickTarget(LINEUP, 'first')).toBe(1);
  });

  it('last: highest flow distance (freshest arrival)', () => {
    expect(pickTarget(LINEUP, 'last')).toBe(0);
  });

  it('closest: nearest to the tower', () => {
    expect(pickTarget(LINEUP, 'closest')).toBe(0);
  });

  it('weakest: lowest hp', () => {
    expect(pickTarget(LINEUP, 'weakest')).toBe(1);
  });

  it('ties go to the lowest slot, deterministically', () => {
    const tied = [c(3, 10, 4, 20), c(1, 10, 4, 20), c(2, 10, 4, 20)];
    // Candidates arrive in scan order (ascending slot) from the sim; with
    // equal scores the first seen wins. Order as the sim provides it:
    const scanOrder = [...tied].sort((a, b) => a.slot - b.slot);
    for (const p of ['first', 'last', 'closest', 'weakest'] as const) {
      expect(pickTarget(scanOrder, p)).toBe(1);
    }
  });

  it('empty means -1, never a throw', () => {
    expect(pickTarget([], 'first')).toBe(-1);
  });
});
