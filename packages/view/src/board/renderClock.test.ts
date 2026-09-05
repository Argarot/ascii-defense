import { describe, expect, it } from 'vitest';
import { RenderClock, RENDER_DELAY, TICK_MS } from './renderClock';

type S = { tick: number; x: number };

describe('the render clock', () => {
  it('draws one tick behind the newest at a steady pace, whatever the burst pattern', () => {
    const clock = new RenderClock<S>();
    // Ticks arrive in bursts: 1, then 2 at once, then none for a frame, then 1.
    const arrivals: [number, number][] = [[1, 50], [2, 116], [3, 116], [4, 200], [5, 233]];
    for (const [tick, ms] of arrivals) clock.push({ tick, x: tick }, ms);
    // Sample the picture every 16.7 ms after the last arrival: the render tick
    // advances by the same amount each frame (no lurch), stays behind the
    // newest by about RENDER_DELAY, and never passes the newest.
    let prev = clock.renderTick(250);
    const steps: number[] = [];
    for (let ms = 266.7; ms <= 300; ms += 16.7) {
      const t = clock.renderTick(ms);
      steps.push(t - prev);
      prev = t;
      expect(t).toBeLessThanOrEqual(5);
    }
    for (const s of steps) expect(s).toBeCloseTo(16.7 / TICK_MS, 2);
    expect(5 - clock.renderTick(233)).toBeGreaterThan(RENDER_DELAY * 0.5);
  });

  it('brackets a render tick between the right two snapshots with the exact fraction', () => {
    const clock = new RenderClock<S>();
    for (const tick of [10, 11, 12, 13]) clock.push({ tick, x: tick * 10 }, tick * TICK_MS);
    const b = clock.bracket(11.25)!;
    expect([b.a.tick, b.b.tick]).toEqual([11, 12]);
    expect(b.alpha).toBeCloseTo(0.25);
    // Past the newest: the newest, whole.
    const late = clock.bracket(13.9)!;
    expect(late.a.tick).toBe(13);
    expect(late.alpha).toBe(1);
    // A gap in ticks (a two-tick burst) blends across the gap.
    clock.push({ tick: 15, x: 150 }, 15 * TICK_MS);
    const gap = clock.bracket(14)!;
    expect([gap.a.tick, gap.b.tick]).toEqual([13, 15]);
    expect(gap.alpha).toBeCloseTo(0.5);
  });

  it('ignores repeats of the same tick and resets when ticks go backwards (a new run)', () => {
    const clock = new RenderClock<S>();
    clock.push({ tick: 3, x: 0 }, 150);
    clock.push({ tick: 3, x: 999 }, 166);
    expect(clock.latest()!.x).toBe(0);
    clock.push({ tick: 1, x: 5 }, 1000);
    expect(clock.latest()!.tick).toBe(1);
    expect(clock.bracket(0.5)!.a.tick).toBe(1);
  });
});
