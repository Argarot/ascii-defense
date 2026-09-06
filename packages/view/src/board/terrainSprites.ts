import type { Sprite } from '@ascii-defense/content';
import type { SpriteFrame } from './sprites';

export type TerrainSpritePack = Partial<Record<'G' | 'R' | 'O', Sprite>>;

/** Stable geology shared by rock and every ore density, including depletion. */
export function terrainVariant(x: number, y: number): number {
  let h = Math.imul(x + 113, 374761393) ^ Math.imul(y + 71, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 8;
}

export function selectTerrainSprite(pack: TerrainSpritePack, kind: string, x: number, y: number, richness = 1, animMs = 0): { sprite: Sprite; frame: SpriteFrame } | undefined {
  if (kind !== 'G' && kind !== 'R' && kind !== 'O') return undefined;
  const effective = kind === 'O' && richness <= 0 ? 'R' : kind;
  const sprite = pack[effective];
  if (!sprite) return undefined;
  const variant = terrainVariant(x, y);
  const suffix = effective !== 'O' ? '' : richness <= 1 / 3 ? '_sparse' : richness <= 2 / 3 ? '' : '_rich';
  const state = sprite.states[effective + variant + suffix];
  if (!state) throw new Error(`Terrain sprite ${sprite.id} is missing ${effective}${variant}${suffix}`);
  const frames = [state, ...(state.frames ?? [])];
  // Zero is also the reduced-motion/static-preview path: pin the base frame.
  const index = animMs > 0 ? (Math.floor(animMs / (sprite.frameMs ?? 200)) + variant) % frames.length : 0;
  return { sprite, frame: frames[index] };
}
