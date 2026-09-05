/**
 * The render clock and the snapshot ring (session 27, Daniil: "the game
 * itself still doesn't feel smooth"). The first interpolation blended the
 * last two snapshots by the time since the newest arrived - but snapshots
 * arrive in bursts (a frame can carry zero, one or two ticks, a throttled
 * worker three), so the blend's speed lurched with the burst. This one
 * draws the world at a STEADY time: the main thread's world clock, phased
 * to the sim's ticks by a slowly-adapting offset, one tick behind the
 * newest snapshot so there is always a pair to blend between. Bursts move
 * the offset a little; the picture keeps its pace.
 *
 * Nothing here touches the sim; the golden hash cannot see it.
 */

/** World-clock milliseconds per sim tick. */
export const TICK_MS = 50;
/** How far behind the newest tick the picture is drawn, in ticks. */
export const RENDER_DELAY = 1;
/** How fast the phase offset follows the sim (0..1 per arrival); low = steady, high = quick to a speed change. */
const OFFSET_GAIN = 0.15;

export interface Ticked {
  tick: number;
}

export class RenderClock<T extends Ticked> {
  private ring: T[] = [];
  private offset: number | null = null;
  constructor(private readonly keep = 6) {}

  /** Forget everything - a new run, or a replayed one whose ticks restart. */
  reset(): void {
    this.ring = [];
    this.offset = null;
  }

  /**
   * A snapshot arrived at world time `worldMs`. Snapshots for a tick
   * already held are ignored (the worker answers every frame; most carry
   * no new tick). A tick that goes backwards resets the clock.
   */
  push(snap: T, worldMs: number): void {
    const last = this.ring[this.ring.length - 1];
    if (last && snap.tick === last.tick) return;
    if (last && snap.tick < last.tick) this.reset();
    this.ring.push(snap);
    if (this.ring.length > this.keep) this.ring.shift();
    const phase = worldMs / TICK_MS - snap.tick;
    this.offset = this.offset === null ? phase : this.offset + (phase - this.offset) * OFFSET_GAIN;
  }

  /** The continuous tick the picture should show at world time `worldMs`. */
  renderTick(worldMs: number): number {
    const last = this.ring[this.ring.length - 1];
    if (!last || this.offset === null) return 0;
    const t = worldMs / TICK_MS - this.offset - RENDER_DELAY;
    // Never ahead of what the sim has said, never before what is still held.
    return Math.max(this.ring[0].tick, Math.min(last.tick, t));
  }

  /**
   * The two snapshots bracketing a render tick and the blend between them
   * (0 = the first, 1 = the second). At or past the newest, both are the
   * newest with alpha 1.
   */
  bracket(renderTick: number): { a: T; b: T; alpha: number } | null {
    const n = this.ring.length;
    if (n === 0) return null;
    const last = this.ring[n - 1];
    if (renderTick >= last.tick || n === 1) return { a: last, b: last, alpha: 1 };
    for (let i = n - 2; i >= 0; i--) {
      const a = this.ring[i];
      const b = this.ring[i + 1];
      if (renderTick >= a.tick) {
        const span = b.tick - a.tick;
        return { a, b, alpha: span > 0 ? (renderTick - a.tick) / span : 1 };
      }
    }
    const first = this.ring[0];
    return { a: first, b: first, alpha: 1 };
  }

  /** The newest snapshot held, or null. */
  latest(): T | null {
    return this.ring[this.ring.length - 1] ?? null;
  }
}
