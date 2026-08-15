// Headless simulation. ZERO DOM, ZERO appearance — see CONTRIBUTING invariants
// 2 and 3. This package's tsconfig deliberately omits the DOM lib, so touching
// `document` here is a type error, not a review comment.
export { createRng, streamFromState } from './rng/rng';
export type { Rng, RngStream, RngStreamName } from './rng/rng';

export { CELL_TYPES, isCellType, isPathable, isRouteCell, isBuildable } from './grid/cells';
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

export { generateMap } from './mapgen/mapgen';
export type { GeneratedMap, MapGenOptions, CellRef } from './mapgen/mapgen';

export { computeFlowField } from './sim/flow';
export type { FlowField } from './sim/flow';
export { Sim, TICK_HZ } from './sim/sim';
export type { SimOptions } from './sim/sim';
