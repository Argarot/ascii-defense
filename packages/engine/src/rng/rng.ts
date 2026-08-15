/**
 * Seeded RNG with named streams (CONTRIBUTING invariant 1).
 *
 * Every random draw in the simulation routes through here. Streams exist so
 * that consuming randomness in one subsystem cannot shift another's sequence:
 * laying a different tile must not change what wave 14 rolls. That property is
 * what makes replays exact and calibration comparable across changes.
 *
 * pure-rand's xoroshiro128plus mutates in place via the unsafe distribution
 * API; each stream owns its generator, so the mutation never crosses streams.
 */
import { xoroshiro128plus, xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus';
import { uniformInt } from 'pure-rand/distribution/uniformInt';

/**
 * Closed set on purpose: a typo'd stream name would silently mint a fresh
 * independent stream and desync replays. Adding a subsystem means adding a
 * name here, which is the visibility we want.
 */
export type RngStreamName = 'map' | 'drafts' | 'waves' | 'combat';

export interface RngStream {
  readonly name: RngStreamName;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform float in [0, 1) at 32-bit resolution — plenty for gameplay. */
  float(): number;
  /** True with probability p (clamped to [0, 1]). */
  chance(p: number): boolean;
  /** Uniform pick. Throws on empty — an empty pick is a caller bug. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates into a new array; the input is not touched. */
  shuffle<T>(items: readonly T[]): T[];
  /** Serializable generator state, for save/resume (M2). */
  state(): readonly number[];
}

export interface Rng {
  readonly seed: number;
  /** Streams are created lazily and cached: same name, same stream object. */
  stream(name: RngStreamName): RngStream;
}

/** FNV-1a, mixing the stream name into the run seed so streams differ. */
function hashName(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

class Stream implements RngStream {
  private readonly g: ReturnType<typeof xoroshiro128plus>;

  constructor(
    readonly name: RngStreamName,
    seed: number,
    state?: readonly number[],
  ) {
    this.g =
      state !== undefined
        ? xoroshiro128plusFromState(state)
        : xoroshiro128plus((seed ^ hashName(name)) | 0);
  }

  int(min: number, max: number): number {
    return uniformInt(this.g, min, max);
  }

  float(): number {
    return uniformInt(this.g, 0, 0xffffffff) / 0x100000000;
  }

  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.float() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error(`rng.pick on empty array (stream ${this.name})`);
    return items[this.int(0, items.length - 1)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  state(): readonly number[] {
    return this.g.getState();
  }
}

export function createRng(seed: number): Rng {
  const streams = new Map<RngStreamName, RngStream>();
  return {
    seed,
    stream(name) {
      let s = streams.get(name);
      if (!s) {
        s = new Stream(name, seed);
        streams.set(name, s);
      }
      return s;
    },
  };
}

/** Resume a single stream from serialized state (save/load, M2). */
export function streamFromState(name: RngStreamName, state: readonly number[]): RngStream {
  return new Stream(name, 0, state);
}
