import { describe, expect, it } from 'vitest';
import { validatePalette, validateSprite } from './validate';

// Sprite v2 (session 22): states keyed by choice path, frames = animation,
// variations = static alternates, bgInk optional.
const goodSprite = {
  id: 'tower_bolt',
  cell: [5, 3],
  states: {
    '': { art: ['.-^-.', '|[O]|', "'---'"], ink: ['fffff', 'fcwcf', 'fffff'], bgInk: ['.....', '.....', '.....'] },
    '0': { art: ['.-^-.', '|[O]|', "'---'"], ink: ['fffff', 'fcwcf', 'fffff'], frames: [{ art: ['.-^-.', '|[o]|', "'---'"], ink: ['fffff', 'fcwcf', 'fffff'] }] },
  },
  inkMap: { f: 'tower.frame', c: 'PATH', w: 'tower.core', '.': null },
};

describe('palette validation', () => {
  it('accepts a well-formed palette', () => {
    const r = validatePalette.check({ roles: { 'ui.bg': '#000000', 'path.1': '#4cc9f0' } });
    expect(r.ok).toBe(true);
  });

  it('rejects shorthand and non-hex colours with a path to the offender', () => {
    const r = validatePalette.check({ roles: { 'ui.bg': '#fff' } });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.errors[0].path).toBe('/roles/ui.bg');
  });

  it('rejects an empty roles object and unknown top-level keys', () => {
    expect(validatePalette.check({ roles: {} }).ok).toBe(false);
    expect(validatePalette.check({ roles: { a: '#000000' }, extra: 1 }).ok).toBe(false);
  });
});

describe('sprite validation', () => {
  it('accepts the ASSETS.md reference sprite', () => {
    expect(validateSprite.check(goodSprite).ok).toBe(true);
  });

  it('rejects a multi-character ink key', () => {
    const bad = { ...goodSprite, inkMap: { ...goodSprite.inkMap, xx: 'nope' } };
    expect(validateSprite.check(bad).ok).toBe(false);
  });

  it('rejects a state missing its ink grid', () => {
    const bad = { ...goodSprite, states: { '': { art: ['.'] } } };
    expect(validateSprite.check(bad).ok).toBe(false);
  });

  it('reports every error, not just the first', () => {
    const r = validateSprite.check({ id: 'Bad Id', cell: [0], tiers: {}, inkMap: {} });
    if (r.ok) throw new Error('should fail');
    expect(r.errors.length).toBeGreaterThan(2);
  });
});
