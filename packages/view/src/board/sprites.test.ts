/**
 * The attack look (session 25): a tower's fire, cool and charge sequences
 * at a moment of its cycle - authored when the sprite has them, derived
 * from the idle frame when it does not - and the walker/relic drawing
 * options.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { validateSprite, type Sprite } from '@ascii-defense/content';
import boltJson from '@ascii-defense/content/assets/sprites/bolt.json';
import gruntJson from '@ascii-defense/content/assets/sprites/enemy_grunt.json';
import { CELL_W } from './style';
import { attackLook, drawSpriteFrame, CHARGE_SHARE, TICK_MS } from './sprites';

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('sprite invalid');
  return r.value;
}
const BOLT = must(validateSprite.check(boltJson));
const GRUNT = must(validateSprite.check(gruntJson));

describe('the attack look', () => {
  const st = BOLT.states[''];
  it('is idle before the first shot and once the cycle is spent', () => {
    expect(attackLook(BOLT, st, st, -1, 0)).toBeNull();
    expect(attackLook(BOLT, st, st, 40, 0.6)).toBeNull(); // 2 s after a shot, mid-cooldown
    expect(attackLook(BOLT, { ...st, sequences: undefined }, st, 40, 0.6)).toBeNull();
  });
  it('falls back to a muzzle spark, smoke and a charge spark over an unmoved idle frame', () => {
    const bare = { ...st, sequences: undefined };
    expect(attackLook(BOLT, bare, st, 0, 1)?.overlay?.ch).toBe('*');
    expect(attackLook(BOLT, bare, st, 0, 1)?.dy).toBeUndefined(); // the body never moves (feedback item 2)
    expect(attackLook(BOLT, bare, st, 4, 0.8)?.overlay?.ch).toBe('~'); // 200 ms: smoke
    const charge = attackLook(BOLT, bare, st, 20, CHARGE_SHARE / 2);
    expect(charge?.overlay?.role).toBe('fx.ember');
  });
  it('every shipped tower sprite carries a fire sequence with durations, and the attack look plays it (the approved pack authors its own)', () => {
    expect(st.sequences?.fire?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(st.sequences?.fire?.[0].ms ?? 0).toBeGreaterThan(0);
    expect(attackLook(BOLT, st, st, 0, 1)?.frame.art).toEqual(st.sequences?.fire?.[0].art);
  });
  it('plays authored sequences by their own durations, fire then cool, then charge by progress', () => {
    const f = (tag: string, ms: number) => ({ art: [tag.padEnd(8)] as [string], ink: ['a'.repeat(8)] as [string], ms });
    const seq: Sprite = {
      ...BOLT,
      states: { '': { ...st, sequences: { fire: [f('F1', 100), f('F2', 100)], cool: [f('C1', 200)], charge: [f('H1', 100), f('H2', 100)] } } },
    };
    const s = seq.states[''];
    const at = (ticks: number, cd: number) => attackLook(seq, s, s, ticks, cd)?.frame.art[0].trim();
    expect(at(0, 1)).toBe('F1');
    expect(at(Math.ceil(120 / TICK_MS), 0.9)).toBe('F2');
    expect(at(Math.ceil(250 / TICK_MS), 0.8)).toBe('C1');
    expect(attackLook(seq, s, s, 20, 0.6)).toBeNull(); // spent, not yet charging
    expect(at(20, CHARGE_SHARE * 0.9)).toBe('H1');
    expect(at(20, CHARGE_SHARE * 0.1)).toBe('H2');
  });
});

describe('drawing a walker', () => {
  it('leaves the ground alone under a transparent sprite and clips a recoil to the cell', () => {
    const term = new TextTerm({ cols: 16, rows: 8 });
    term.put(1, 1, '#', '#ffffff', '#123456');
    drawSpriteFrame(term, GRUNT, GRUNT.states[''], 0, 0, { transparent: true });
    const rows = term.toText().split('\n');
    expect(rows[0].startsWith('(@)')).toBe(true);
    // The gap between the legs is transparent: the glyph under it survives.
    expect(rows[1].startsWith('/#\\')).toBe(true);
    // Clipped: a 5-row tower drawn one row down with clipRows 4 never writes row 5.
    const t2 = new TextTerm({ cols: CELL_W, rows: 6 });
    drawSpriteFrame(t2, BOLT, BOLT.states[''], 0, 1, { clipRows: 4 });
    expect(t2.toText().split('\n')[5].trim()).toBe('');
  });
});
