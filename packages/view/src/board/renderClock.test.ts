import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import type { StampedSimEvent } from '@ascii-defense/engine';
import { EffectsLayer } from './effects';
import { CELL_H, CELL_W } from './style';
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

describe('the clock and the effects layer together (feedback 2026-09-06, item 1)', () => {
  it('an effect born at the newest tick is painted on the frames that follow, at every speed', () => {
    // main.ts's wiring: a snapshot per sim tick pushed at its arrival time,
    // the picture drawn at the clock's render tick, effects ingested from
    // the newest snapshot. Before the fix every effect died unborn: the
    // render tick trails the newest tick by one, and the prune dropped
    // effects whose start was still ahead.
    for (const ticksPerFrame of [0.33, 1, 2, 4]) {
      const clock = new RenderClock<{ tick: number; events: StampedSimEvent[] }>();
      const fx = new EffectsLayer();
      let painted = 0;
      let tick = 0;
      let seq = 0;
      let acc = 0;
      for (let frameNo = 0; frameNo < 120; frameNo++) {
        const worldMs = frameNo * 16.7 * (ticksPerFrame * TICK_MS / 16.7);
        acc += ticksPerFrame;
        const events: StampedSimEvent[] = [];
        while (acc >= 1) {
          acc -= 1;
          tick++;
          if (tick % 5 === 0) events.push({ kind: 'impact', x: 2.5, y: 1.5, r: 0, seq: seq++, tick });
          clock.push({ tick, events }, worldMs);
        }
        const latest = clock.latest();
        if (!latest) continue;
        const term = new TextTerm({ cols: 6 * CELL_W, rows: 3 * CELL_H });
        fx.ingest(latest.events);
        fx.draw(term, clock.renderTick(worldMs));
        if (fx.alive().drawn > 0) painted++;
      }
      // A spark lives four ticks; one is born every five: most frames show one.
      expect(painted, `ticks per frame ${ticksPerFrame}`).toBeGreaterThan(40);
    }
  });

  it('a burst that jumps the clock over an effect still shows it once (a throttled tab, a stalled worker)', () => {
    // Twenty ticks arrive at once, once a "second"; the ring keeps six, the
    // render tick leaps. Every impact born in the leap is painted once.
    const clock = new RenderClock<{ tick: number; events: StampedSimEvent[] }>();
    const fx = new EffectsLayer();
    let tick = 0;
    let seq = 0;
    let paintedImpacts = 0;
    for (let burst = 0; burst < 6; burst++) {
      const worldMs = burst * 1000;
      for (let i = 0; i < 20; i++) {
        tick++;
        const events: StampedSimEvent[] = tick % 5 === 0 ? [{ kind: 'impact', x: 2.5, y: 1.5, r: 0, seq: seq++, tick }] : [];
        clock.push({ tick, events }, worldMs);
        fx.ingest(events);
      }
      for (let f = 0; f < 3; f++) {
        const term = new TextTerm({ cols: 6 * CELL_W, rows: 3 * CELL_H });
        fx.draw(term, clock.renderTick(worldMs + f * 16));
        if (term.toText().includes('x') || term.toText().includes('.')) paintedImpacts += fx.alive().drawn;
      }
    }
    // Twenty-four impacts were born; each is painted at least once.
    expect(paintedImpacts).toBeGreaterThanOrEqual(seq);
  });
});
