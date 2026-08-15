import { describe, expect, it } from 'vitest';
import { createRng, streamFromState } from './rng';

describe('seeded rng with named streams', () => {
  it('same seed and stream produce identical sequences', () => {
    const a = createRng(1234).stream('combat');
    const b = createRng(1234).stream('combat');
    for (let i = 0; i < 200; i++) expect(a.int(0, 1_000_000)).toBe(b.int(0, 1_000_000));
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1).stream('combat');
    const b = createRng(2).stream('combat');
    const drawsA = Array.from({ length: 20 }, () => a.int(0, 1_000_000));
    const drawsB = Array.from({ length: 20 }, () => b.int(0, 1_000_000));
    expect(drawsA).not.toEqual(drawsB);
  });

  it('streams are independent: draining one does not shift another', () => {
    // The property that makes replays survive refactors: what `waves` rolls
    // cannot depend on how much randomness `map` consumed.
    const clean = createRng(777);
    const noisy = createRng(777);
    for (let i = 0; i < 1000; i++) noisy.stream('map').int(0, 9);
    for (let i = 0; i < 50; i++) {
      expect(noisy.stream('waves').int(0, 1_000_000)).toBe(clean.stream('waves').int(0, 1_000_000));
    }
  });

  it('stream objects are cached per rng', () => {
    const rng = createRng(5);
    expect(rng.stream('map')).toBe(rng.stream('map'));
  });

  it('golden values: seed 42 draws are frozen against pure-rand drift', () => {
    // Computed at authoring time against pure-rand 8.4.2. If this fails after
    // a dependency bump, every recorded replay is invalid — that must be a
    // conscious decision, not a silent upgrade.
    const rng = createRng(42);
    expect(Array.from({ length: 5 }, () => rng.stream('map').int(0, 99))).toEqual([4, 71, 13, 91, 82]);
    expect(Array.from({ length: 5 }, () => rng.stream('waves').int(0, 99))).toEqual([28, 29, 3, 87, 94]);
  });

  it('int respects inclusive bounds and reaches both ends', () => {
    const s = createRng(9).stream('map');
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = s.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6, 7]));
  });

  it('float stays in [0, 1)', () => {
    const s = createRng(11).stream('combat');
    for (let i = 0; i < 1000; i++) {
      const v = s.float();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('chance handles the degenerate probabilities without drawing', () => {
    const s = createRng(13).stream('combat');
    const before = s.state();
    expect(s.chance(0)).toBe(false);
    expect(s.chance(1)).toBe(true);
    // Degenerate cases must not consume randomness: gating a feature on
    // chance(0)/chance(1) should never shift subsequent draws.
    expect(s.state()).toEqual(before);
  });

  it('pick throws on empty and covers all items', () => {
    const s = createRng(17).stream('drafts');
    expect(() => s.pick([])).toThrow();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(s.pick(['a', 'b', 'c']));
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
  });

  it('shuffle returns a permutation and leaves the input untouched', () => {
    const s = createRng(19).stream('drafts');
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const frozen = input.slice();
    const out = s.shuffle(input);
    expect(input).toEqual(frozen);
    expect(out.slice().sort((a, b) => a - b)).toEqual(frozen);
  });

  it('state round-trips: a resumed stream continues the exact sequence', () => {
    const original = createRng(21).stream('waves');
    for (let i = 0; i < 37; i++) original.int(0, 999);
    const resumed = streamFromState('waves', original.state());
    for (let i = 0; i < 50; i++) expect(resumed.int(0, 999)).toBe(original.int(0, 999));
  });
});
