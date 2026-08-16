// The ONLY layer that knows both engine state and render calls. Deliberately
// thin: read engine state, resolve appearance, call render.
export { BoardView } from './board/BoardView';
export type { BoardViewOptions, CellRef, RenderState } from './board/BoardView';
export { HudPanel } from './hud/HudPanel';
export { OfferModal } from './board/OfferModal';
export type { OfferCard } from './board/OfferModal';
export type { HudState, HudTowerInfo, HudTierInfo, HudChoiceInfo, HudAction, HudCoreInfo, HudRelicSlot } from './hud/HudPanel';
export { CELL_W, CELL_H, drawTerrainCell } from './board/style';
export { role } from './palette';
