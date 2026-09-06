// Headless simulation. ZERO DOM, ZERO appearance — see CONTRIBUTING invariants
// 2 and 3. This package's tsconfig deliberately omits the DOM lib, so touching
// `document` here is a type error, not a review comment.
export { createRng, streamFromState } from './rng/rng';
export type { Rng, RngStream, RngStreamName } from './rng/rng';

export { CELL_TYPES, isCellType, isRouteCell, isBuildable, isRoad, lanesJoin, roadsConnect, ROAD_PORTS, LEGACY_CELL_MAP, migrateLegacyCells, strandPorts, strandEntered } from './grid/cells';
export type { CellType } from './grid/cells';

export {
  TILE_SIZE,
  EDGES,
  OPPOSITE,
  ROTATIONS,
  cellAt,
  rotateCells,
  rotatePoint,
  canonicalCells,
  canonicalRotation,
  canonicalizeTile,
  deriveConnectors,
  validateTileCells,
  tileRimMask,
  segmentRimMask,
  tilePartition,
  partitionKey,
  tileHasTouchingSegments,
  tileIsSpecialShape,
  mirrorCells,
  mirrorCanonicalKey,
  validateTile,
} from './tiles/tile';
export type { TileDef, TileDeposit, TileBoon, Edge, Connectors, Rotation } from './tiles/tile';

export {
  TileLibrary,
  createBoard,
  slotAt,
  canPlace,
  place,
  legalPlacements,
  growBoard,
  resolveCells,
} from './tiles/board';
export type { Board, Placement, PlaceOptions } from './tiles/board';

export { generateMap, mapCells, CORE_STRIP, DEPOSIT_MAX, VOID_SHARE_CAP, GENERATOR_VERSION } from './mapgen/mapgen';
export { COVERAGE_TARGET, LANE_BAND } from './mapgen/carve';
export type { GeneratedMap, MapGenOptions, CellRef, CacheRef, RockContent, OreDeposit, BoonRef } from './mapgen/mapgen';
export { verifyMap } from './mapgen/verify';
export type { VerifyIssue, VerifyMapOptions } from './mapgen/verify';

export { computeFlowField } from './sim/flow';
export type { FlowField } from './sim/flow';
export { Sim, TICK_HZ, SELL_REFUND, OFFER_EVERY_WAVES, PASSIVE_OFFER_EVERY_WAVES, PASSIVE_SLOTS, RELIC_SLOTS, SALVAGE_ORE, CHEST_EVERY, CHEST_WINDOW, CHEST_MAX, RELIC_DRAW_COST, OFFER_REROLL_COST, PROSPECT_COST, PROSPECT_TICKS, DEFAULT_DIFFICULTY, waveHpScale, waveCount } from './sim/sim';
export type { DifficultySpec, CacheSpot } from './sim/sim';
export type { LootTable, LootOutcome, LootKind } from './sim/defs';
export type { SimOptions, Tower, SimEvent, StampedSimEvent } from './sim/sim';
export { EVENT_CAP } from './sim/sim';
export { REPLAY_VERSION, contentHashOf, fnv1a, playReplay } from './sim/replay';
export type { Replay, ReplayAction, ReplayInput } from './sim/replay';
export { PRIORITIES, pickTarget } from './sim/targeting';
export type { Priority, TargetCandidate } from './sim/targeting';
export { canChoose, effectiveStats, foldRelics, foldPassiveMods, relicEffectsAt, relicDescAt, RARITIES, EMPTY_FOLD, resistMul, DAMAGE_TYPES, applyCoreBoon } from './sim/defs';
export type { CoreBoon } from './sim/defs';
export type { DamageType } from './sim/defs';
export type {
  EnemyDef,
  TowerDef,
  ProjectileSpec,
  TowerTierDef,
  ChoiceDef,
  StatMods,
  EffectiveStats,
  RelicDef,
  PassiveDef,
  SetDef,
  RecipeDef,
  Rarity,
  RelicKind,
  RelicEffects,
  RelicFold,
} from './sim/defs';
export { FACING_DX, FACING_DY, FACING_NAME } from './sim/sim';
