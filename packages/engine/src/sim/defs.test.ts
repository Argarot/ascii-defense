import { describe, expect, it } from 'vitest';
import { canChoose, effectiveStats, type TowerDef } from './defs';

describe('tiered either/or progression (3 tiers x 2 exclusive choices = 14 variants)', () => {
  it('only tier 1 opens on a fresh tower', () => {
    expect(canChoose([-1, -1, -1], 0)).toBe(true);
    expect(canChoose([-1, -1, -1], 1)).toBe(false);
    expect(canChoose([-1, -1, -1], 2)).toBe(false);
  });

  it('tiers unlock in order', () => {
    expect(canChoose([0, -1, -1], 1)).toBe(true);
    expect(canChoose([0, -1, -1], 2)).toBe(false);
    expect(canChoose([1, 0, -1], 2)).toBe(true);
  });

  it('a committed tier is final - siblings are mutually exclusive', () => {
    expect(canChoose([0, -1, -1], 0)).toBe(false);
    expect(canChoose([1, 1, 1], 2)).toBe(false);
  });

  it('out-of-range tiers refuse', () => {
    expect(canChoose([-1, -1, -1], -1)).toBe(false);
    expect(canChoose([-1, -1, -1], 3)).toBe(false);
  });
});

describe('effectiveStats folding', () => {
  const DEF: TowerDef = {
    id: 't',
    cost: 20,
    range: 6,
    fireEveryTicks: 14,
    projectile: { damage: 8, speed: 0.5, homing: true },
    tiers: [
      { choices: [{ name: 'A1', cost: 1, mods: { damage: 6 } }, { name: 'B1', cost: 1, mods: { fireEveryTicks: -4 } }] },
      { choices: [{ name: 'A2', cost: 1, mods: { range: 2.5 } }, { name: 'B2', cost: 1, mods: { damage: 3 } }] },
      { choices: [{ name: 'A3', cost: 1, mods: { damage: 22 } }, { name: 'B3', cost: 1, mods: { fireEveryTicks: -4 } }] },
    ],
  };

  it('base stats with nothing chosen', () => {
    expect(effectiveStats(DEF, [-1, -1, -1])).toMatchObject({ damage: 8, range: 6, fireEveryTicks: 14 });
  });

  it('folds exactly the committed choices', () => {
    expect(effectiveStats(DEF, [0, 1, -1])).toMatchObject({ damage: 17, range: 6, fireEveryTicks: 14 });
    expect(effectiveStats(DEF, [1, 0, 0])).toMatchObject({ damage: 30, range: 8.5, fireEveryTicks: 10 });
  });

  it('fire interval never drops below 2', () => {
    const rapid: TowerDef = { ...DEF, fireEveryTicks: 5 };
    expect(effectiveStats(rapid, [1, -1, 1]).fireEveryTicks).toBe(2);
  });
});
