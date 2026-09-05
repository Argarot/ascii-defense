import { describe, expect, it } from 'vitest';
import { SHOT_MAX_STEP, WALKER_MAX_STEP, interpolate } from './interpolate';

describe('interpolate', () => {
  const prev = [
    { k: 0, g: 1, x: 2, y: 5, id: 'grunt' },
    { k: 1, g: 1, x: 8, y: 5, id: 'grunt' },
    { k: 2, g: 1, x: 3, y: 3, id: 'skitter' },
  ];
  it('blends a matched body between its last two positions, never past the current one', () => {
    const cur = [{ k: 0, g: 1, x: 2.5, y: 5, id: 'grunt' }];
    expect(interpolate(prev, cur, 0.5, WALKER_MAX_STEP)[0].x).toBeCloseTo(2.25);
    expect(interpolate(prev, cur, 0, WALKER_MAX_STEP)[0].x).toBe(2);
    expect(interpolate(prev, cur, 1, WALKER_MAX_STEP)[0].x).toBe(2.5);
    expect(interpolate(prev, cur, 1.7, WALKER_MAX_STEP)[0].x).toBe(2.5); // clamped, no extrapolation
  });
  it('draws the current position for a newcomer, a recycled slot and a strand jump; a dead body is gone', () => {
    const cur = [
      { k: 5, g: 1, x: 1, y: 1, id: 'grunt' }, // never seen
      { k: 1, g: 2, x: 8.1, y: 5, id: 'grunt' }, // same slot, new generation
      { k: 2, g: 1, x: 3, y: 8, id: 'skitter' }, // five cells in one tick: a bridge strand change
    ];
    const out = interpolate(prev, cur, 0.5, WALKER_MAX_STEP);
    expect(out.map((e) => [e.x, e.y])).toEqual([[1, 1], [8.1, 5], [3, 8]]);
    expect(out.length).toBe(3); // slot 0 died: not drawn, not resurrected
  });
  it('lets a shot fly further per tick than a walker', () => {
    const p = [{ k: 0, x: 0, y: 0 }];
    const c = [{ k: 0, x: 2, y: 0 }];
    expect(interpolate(p, c, 0.5, WALKER_MAX_STEP)[0].x).toBe(2);
    expect(interpolate(p, c, 0.5, SHOT_MAX_STEP)[0].x).toBe(1);
  });
});
