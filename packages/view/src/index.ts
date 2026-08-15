// The ONLY layer that knows both engine state and render calls. Deliberately
// thin: read engine state, resolve appearance, call render.
export { BoardView, CELL_W, CELL_H } from './board/BoardView';
export type { BoardViewOptions, CellRef, RenderState } from './board/BoardView';
export { role } from './palette';
