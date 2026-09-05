// The ONLY layer that knows both engine state and render calls. Deliberately
// thin: read engine state, resolve appearance, call render.
export { BoardView } from './board/BoardView';
export type { BoardViewOptions, CellRef, RenderState } from './board/BoardView';
export { HudPanel } from './hud/HudPanel';
export { StripPanel, STRIP_ROWS } from './hud/StripPanel';
export { drawSpriteFrame } from './board/sprites';
export { OfferModal } from './board/OfferModal';
export type { OfferCard } from './board/OfferModal';
export type { HudState, HudTowerInfo, HudTierInfo, HudChoiceInfo, HudAction, HudCoreInfo, HudRelicSlot } from './hud/HudPanel';
export { CELL_W, CELL_H, GLYPH_PX_W, GLYPH_PX_H, drawTerrainCell, drawVoidCell } from './board/style';
export { EffectsLayer } from './board/effects';
export { MenuScreen, tileCapacity } from './screens/MenuScreen';
export type { MenuItem, MenuSpec } from './screens/MenuScreen';
export { isReducedMotion, setReducedMotion } from './motion';
export { role } from './palette';
export { interpolate, WALKER_MAX_STEP, SHOT_MAX_STEP } from './board/interpolate';
export { RenderClock, RENDER_DELAY, TICK_MS as WORLD_TICK_MS } from './board/renderClock';
