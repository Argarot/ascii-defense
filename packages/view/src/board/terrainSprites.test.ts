import { describe, expect, it } from 'vitest';
import type { Sprite } from '@ascii-defense/content';
import { selectTerrainSprite, terrainVariant, type TerrainSpritePack } from './terrainSprites';

function fixture(kind: 'G' | 'R' | 'O'): Sprite {
  const states: Sprite['states'] = {};
  for (let i = 0; i < 8; i++) for (const suffix of kind === 'O' ? ['_sparse', '', '_rich'] : ['']) {
    const grid = (row: string): [string, ...string[]] => [row, row, row, row, row];
    const frame = (ink: string) => ({ art: grid(' /____/ '), ink: grid(ink.repeat(8)) });
    states[kind + i + suffix] = { ...frame('a'), frames: [frame('b'), frame('c'), frame('d'), frame('e')] };
  }
  return { id: kind, kind: 'terrain', cell: [8, 5], frameMs: 200, states, inkMap: { a: 'base' } };
}
const pack: TerrainSpritePack = { G: fixture('G'), R: fixture('R'), O: fixture('O') };

describe('optional authored terrain', () => {
  it('keeps the same geology through every density and depletion', () => {
    for (let x = 0; x < 80; x += 8) {
      const n = terrainVariant(x, 15);
      for (const [richness, suffix] of [[1, '_rich'], [0.6, ''], [0.2, '_sparse']] as const) {
        expect(selectTerrainSprite(pack, 'O', x, 15, richness, 0)?.frame).toBe(pack.O!.states['O' + n + suffix]);
      }
      expect(selectTerrainSprite(pack, 'O', x, 15, 0, 0)?.frame).toBe(pack.R!.states['R' + n]);
    }
  });
  it('animates all five frames and pins the base when motion is disabled', () => {
    const n = terrainVariant(8, 5);
    expect(selectTerrainSprite(pack, 'G', 8, 5, 1, 0)?.frame).toBe(pack.G!.states['G' + n]);
    const frames = new Set(Array.from({ length: 5 }, (_, i) => selectTerrainSprite(pack, 'G', 8, 5, 1, (i + 1) * 200)?.frame));
    expect(frames.size).toBe(5);
  });
  it('leaves legacy packs and road rendering to their existing paths', () => {
    expect(selectTerrainSprite({}, 'G', 0, 0)).toBeUndefined();
    expect(selectTerrainSprite(pack, '-', 0, 0)).toBeUndefined();
    expect(new Set(Array.from({ length: 30 }, (_, x) => terrainVariant(x * 8, 0))).size).toBeGreaterThan(1);
  });
});
