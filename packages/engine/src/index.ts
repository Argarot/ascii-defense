// Headless simulation. ZERO DOM, ZERO appearance — see CONTRIBUTING invariants
// 2 and 3. This package's tsconfig deliberately omits the DOM lib, so touching
// `document` here is a type error, not a review comment.
export { createRng, streamFromState } from './rng/rng';
export type { Rng, RngStream, RngStreamName } from './rng/rng';

export { CELL_TYPES, isCellType, isRouteCell, isBuildable, isRoad, lanesJoin, roadsConnect, ROAD_PORTS } from './grid/cells';
export type { CellType } from './grid/cells';

export {
  TILE_SIZE,
  EDGES,
  OPPOSITE,
  ROTATIONS,
  cellAt,
  rotateCells,
  deriveConnectors,
  validateTileCells,
  tilePartition,
  partitionKey,
  crossingsInterconnect,
  validateTile,
} from './tiles/tile';
export type { TileDef, Edge, Connectors, Rotation } from './tiles/tile';

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

export { generateMap, ORE_FLOOR, DEPOSIT_MAX } from './mapgen/mapgen';
export type { GeneratedMap, MapGenOptions, CellRef, CacheRef, RockContent, OreDeposit, BoonRef } from './mapgen/mapgen';

export { computeFlowField } from './sim/flow';
export type { FlowField } from './sim/flow';
export { Sim, TICK_HZ, SELL_REFUND, OFFER_EVERY_WAVES, RELIC_DRAW_COST, OFFER_REROLL_COST, CACHE_CLAIM_COST, PROSPECT_COST, PROSPECT_TICKS, DEFAULT_DIFFICULTY, waveHpScale, waveCount } from './sim/sim';
export type { DifficultySpec } from './sim/sim';
export type { SimOptions, Tower } from './sim/sim';
export { REPLAY_VERSION, contentHashOf, fnv1a, playReplay } from './sim/replay';
export type { Replay, ReplayAction, ReplayInput } from './sim/replay';
export { PRIORITIES, pickTarget } from './sim/targeting';
export type { Priority, TargetCandidate } from './sim/targeting';
export { canChoose, effectiveStats, foldRelics, EMPTY_FOLD } from './sim/defs';
export type {
  EnemyDef,
  TowerDef,
  ProjectileSpec,
  TowerTierDef,
  ChoiceDef,
  StatMods,
  EffectiveStats,
  RelicDef,
  RelicKind,
  RelicEffects,
  RelicFold,
} from './sim/defs';
