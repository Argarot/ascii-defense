import { describe, expect, it } from 'vitest';
import { canUpgrade, effectiveStats, type TowerDef } from './defs';

describe('crosspathing (PRD 5.2: one path to 5, a second to 2, the third stays 0)', () => {
  it('a fresh tower can start any path', () => {
    for (const p of [0, 1, 2]) expect(canUpgrade([0, 0, 0], p)).toBe(true);
  });

  it('the primary path can run to 5, never 6', () => {
    expect(canUpgrade([4, 0, 0], 0)).toBe(true);
    expect(canUpgrade([5, 0, 0], 0)).toBe(false);
  });

  it('the second path caps at 2', () => {
    expect(canUpgrade([5, 1, 0], 1)).toBe(true);
    expect(canUpgrade([5, 2, 0], 1)).toBe(false);
  });

  it('a third path can never open', () => {
    expect(canUpgrade([3, 2, 0], 2)).toBe(false);
    expect(canUpgrade([1, 1, 0], 2)).toBe(false);
  });

  it('two paths at 2 lock each other out of 3 only if another is primary', () => {
    // [2,2,0]: either path may still become the primary (3 <= 5, other 2 <= 2).
    expect(canUpgrade([2, 2, 0], 0)).toBe(true);
    expect(canUpgrade([2, 2, 0], 1)).toBe(true);
    // But at [3,2,0] the second path is frozen at 2.
    expect(canUpgrade([3, 2, 0], 1)).toBe(false);
  });
});

describe('effectiveStats folding', () => {
  const DEF: TowerDef = {
    id: 't',
    cost: 20,
    range: 6,
    fireEveryTicks: 14,
    projectile: { damage: 8, speed: 0.5, homing: true },
    paths: [
      { name: 'A', tiers: [{ cost: 1, mods: { damage: 4 } }, { cost: 1, mods: { damage: 5 } }, { cost: 1 }, { cost: 1 }, { cost: 1 }] },
      { name: 'B', tiers: [{ cost: 1, mods: { fireEveryTicks: -2 } }, { cost: 1, mods: { fireEveryTicks: -2 } }, { cost: 1 }, { cost: 1 }, { cost: 1 }] },
      { name: 'C', tiers: [{ cost: 1, mods: { range: 1 } }, { cost: 1 }, { cost: 1 }, { cost: 1 }, { cost: 1 }] },
    ],
  };

  it('base stats with no tiers', () => {
    expect(effectiveStats(DEF, [0, 0, 0])).toMatchObject({ damage: 8, range: 6, fireEveryTicks: 14 });
  });

  it('folds every taken tier across paths', () => {
    expect(effectiveStats(DEF, [2, 1, 0])).toMatchObject({ damage: 17, range: 6, fireEveryTicks: 12 });
  });

  it('fire interval never drops below 2', () => {
    const rapid: TowerDef = { ...DEF, fireEveryTicks: 3 };
    expect(effectiveStats(rapid, [0, 2, 0]).fireEveryTicks).toBe(2);
  });
});
