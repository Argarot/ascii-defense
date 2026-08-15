// DATA plus the typed validation/registry layer. No game logic.
// The full asset registry (typed lookups, sprite resolution) lands with the
// art pipeline in M1 Phase 2-3.
export { validatePalette, validateSprite } from './validate';
export type { Palette, Sprite, Validator, ContentError } from './validate';
