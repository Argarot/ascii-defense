// The ONLY layer that knows both engine state and render calls. Deliberately
// thin: read engine state, resolve appearance, call render.
export { BoardView } from './board/BoardView';
export type { BoardViewOptions, CellRef, RenderState } from './board/BoardView';
export { HudPanel } from './hud/HudPanel';
export type { HudState, HudTowerInfo, HudAction } from './hud/HudPanel';
export { CELL_W, CELL_H, drawTerrainCell } from './board/style';
export { role } from './palette';
