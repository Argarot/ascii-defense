// Headless simulation. ZERO DOM, ZERO appearance — see CONTRIBUTING invariants
// 2 and 3. This package's tsconfig deliberately omits the DOM lib, so touching
// `document` here is a type error, not a review comment.
export { createRng, streamFromState } from './rng/rng';
export type { Rng, RngStream, RngStreamName } from './rng/rng';
