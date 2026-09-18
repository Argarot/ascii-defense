import { describe, expect, it } from 'vitest';
import { createRng, streamFromState, type RngStreamName } from './rng';

/**
 * A stream's early draws must be random IN THE SEED (D35, issue #339).
 * Determinism never was the problem: until 2026-09-18 a stream was seeded
 * with `seed ^ hashName(name)` and nothing else, and xoroshiro's first
 * outputs are near-linear in that word - a Standard map's entry count was
 * `seed mod 4` on 100.0% of 4,000 seeds, the second draw anti-correlated on
 * 100.0%, and a 120-seed lab corpus came out with exactly thirty maps per
 * entry count. Every corpus the project uses is an arithmetic walk, so these
 * are the corpora read here.
 */
const STREAMS: RngStreamName[] = ['map', 'drafts', 'waves', 'combat', 'relics', 'loot', 'passives'];
/**
 * [first seed, stride]: consecutive seeds (dailies), the lab's corpus, and seeds that differ only in their high bits.
 * A seed is 32 bits to the generator, so the widest stride that still gives 4,000 DISTINCT seeds is 2^20 - at 2^24 the
 * corpus is 256 seeds sixteen times over, and reads as a bias that is not there.
 */
const CORPORA: [number, number][] = [[0, 1], [20260918, 1], [13, 7919], [5, 1 << 16], [9, 1 << 20]];
const N = 4000;
/** The k-th draw (1-based) of `draw` on a fresh stream, for every seed of a corpus. */
function kth(name: RngStreamName, [first, stride]: [number, number], k: number, max: number): number[] {
  return Array.from({ length: N }, (_, i) => {
    const s = createRng(first + i * stride).stream(name);
    let v = 0;
    for (let d = 0; d < k; d++) v = s.int(0, max);
    return v;
  });
}
const share = (hits: number): number => hits / N;

describe("a stream's early draws are random in the seed (D35)", () => {
  it('no draw is the seed walked round a four-cycle, on any stream or corpus', () => {
    // Chance is 25%; 30% is seven standard deviations at 4,000. The defect read 100%.
    for (const name of STREAMS)
      for (const corpus of CORPORA)
        for (let k = 1; k <= 6; k++) {
          const draws = kth(name, corpus, k, 3);
          for (let c = 0; c < 4; c++) {
            const hits = draws.filter((v, i) => v === (i + c) % 4).length;
            expect(share(hits), `${name} draw ${k}, corpus ${corpus.join('+')}, offset ${c}`).toBeLessThan(0.3);
          }
        }
  });

  it('every face comes up: the first draw is uniform over a corpus', () => {
    for (const name of STREAMS)
      for (const corpus of CORPORA) {
        const draws = kth(name, corpus, 1, 3);
        for (let face = 0; face < 4; face++) {
          const s = share(draws.filter((v) => v === face).length);
          expect(s, `${name}, corpus ${corpus.join('+')}, face ${face}`).toBeGreaterThan(0.2);
          expect(s, `${name}, corpus ${corpus.join('+')}, face ${face}`).toBeLessThan(0.3);
        }
      }
  });

  it('one draw says nothing about the next, within a stream', () => {
    // The defect: the second draw's parity was the first's, inverted, on 100% of seeds.
    for (const name of STREAMS)
      for (const corpus of CORPORA)
        for (let k = 1; k <= 4; k++) {
          const a = kth(name, corpus, k, 1);
          const b = kth(name, corpus, k + 1, 1);
          const agree = share(a.filter((v, i) => v === b[i]).length);
          expect(agree, `${name} draws ${k} and ${k + 1}, corpus ${corpus.join('+')}`).toBeGreaterThan(0.45);
          expect(agree, `${name} draws ${k} and ${k + 1}, corpus ${corpus.join('+')}`).toBeLessThan(0.55);
        }
  });

  it('one stream says nothing about another: first draws of the same seed are unrelated', () => {
    for (const corpus of CORPORA)
      for (let a = 0; a < STREAMS.length; a++)
        for (let b = a + 1; b < STREAMS.length; b++) {
          const x = kth(STREAMS[a], corpus, 1, 3);
          const y = kth(STREAMS[b], corpus, 1, 3);
          for (let c = 0; c < 4; c++) {
            const hits = x.filter((v, i) => (v + c) % 4 === y[i]).length;
            expect(share(hits), `${STREAMS[a]} vs ${STREAMS[b]}, corpus ${corpus.join('+')}, offset ${c}`).toBeLessThan(0.3);
          }
        }
  });
});

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
    // Re-frozen ONCE on 2026-09-18 (D35): the seed word is mixed before it seeds a stream. Before that day these
    // read [4, 71, 13, 91, 82] and [28, 29, 3, 87, 94]; pure-rand did not move.
    const rng = createRng(42);
    expect(Array.from({ length: 5 }, () => rng.stream('map').int(0, 99))).toEqual([43, 85, 78, 73, 50]);
    expect(Array.from({ length: 5 }, () => rng.stream('waves').int(0, 99))).toEqual([65, 7, 88, 68, 23]);
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
