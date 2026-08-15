// Headless simulation. ZERO DOM, ZERO appearance — see CONTRIBUTING invariants
// 2 and 3. This package's tsconfig deliberately omits the DOM lib, so touching
// `document` here is a type error, not a review comment.
// First real module (rng/) lands with WBS 1.1.5.
export {};
