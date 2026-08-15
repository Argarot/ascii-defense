// The ONLY layer that knows both engine state and render calls. Deliberately
// thin: read engine state, ask the asset registry what it looks like, call
// render. First real module lands in M1 Phase 3 (board rendering).
export {};
