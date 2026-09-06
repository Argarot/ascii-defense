// DATA plus the typed validation/registry layer. No game logic.
// The full asset registry (typed lookups, sprite resolution) lands with the
// art pipeline in M1 Phase 2-3.
export { validatePalette, validateSprite, validateEnemies, validateTowers, validateRelics, validateSets, validateRecipes, validateTerrain, validateLoot, validateGrid, validateTree } from './validate';
export type {
  Palette,
  Sprite,
  EnemyRoster,
  TowerRoster,
  RelicPool,
  SetPool,
  RecipePool,
  TerrainAppearance,
  LootTables,
  Grid,
  TechTree,
  Validator,
  ContentError,
} from './validate';
