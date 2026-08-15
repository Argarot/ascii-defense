# ASCII Defense — Work Breakdown Structure

Status: **living document.** This decomposes [ROADMAP.md](ROADMAP.md) into
tracked work packages. The roadmap owns sequencing and rationale; this file owns
the checklist. If they disagree, fix whichever is wrong — never let them drift.

Conventions:

- IDs are `<milestone>.<phase>.<item>` and are stable once assigned.
- `[ ]` open · `[x]` done · `[~]` in progress · `[!]` blocked/decision needed.
- Distant milestones stay coarse on purpose (progressive elaboration). Each
  milestone is decomposed to this detail only when it becomes next.
- Every phase ends at its **gate** from the roadmap. A phase is not done until
  its gate passes.

---

## Open decisions (block future work — resolve by the deadline, not before)

| ID | Decision | Deadline | Owner |
|---|---|---|---|
| D1 | **Buildable density** — how tiles keep tower slots in the tens, not thousands (PRD §4.3; preferred: sparse-ground tile library) | before 1.4 | Daniil + dev |
| D2 | **The Wall** — cut / flyer-blocker / ground-denial (PRD §5.5; preferred: cut) | before 1.4 | Daniil + dev |
| D3 | **Material language** — glyph vocabulary for metal/stone/energy/organic (ASSETS §5) | before 1.4 art authoring | Daniil + dev |

---

## M1 — The fun test

### 1.1 Phase 1 — harness before game code *(~2 sessions)*

**Gate: CI green on an empty game.**

- [x] 1.1.1 Convert repo to npm workspaces: `packages/{engine,content,render,view,bot,harness,app}` + `tools/`. Move `GLTerm.ts` → `render`, demo bootstrap → `app`. Site still builds and deploys identically. *(PR #1; also fixed `vite preview` never serving the Pages base)*
- [x] 1.1.2 TypeScript project references / per-package tsconfig; `typecheck` covers all packages. Headless packages get `lib: [ES2022]`, no DOM — invariant 2 at compile level. *(PR #1)*
- [x] 1.1.3 ESLint 9 flat config with **invariant rules**: `Math.random` ban (inv 1); DOM-global ban in headless packages (inv 2); layer-import boundaries via `eslint-plugin-boundaries` v7 (inv 3); `node:` builtins banned outside harness/tools. All rules proven to fire on planted violations. *(PR #2)*
- [x] 1.1.4 Vitest 4 for Node-side unit tests; 11 RNG tests. *(PR #3)*
- [x] 1.1.5 `pure-rand` seeded PRNG with named streams (`map|drafts|waves|combat` as a union type) in `engine/rng`; golden values frozen against dependency drift; state round-trip tested for M2 save/resume. The mock xorshift survives only as `main.ts` demo layout hashing, replaced wholesale in Phase 3. *(PR #3)*
- [x] 1.1.6 Vitest Browser Mode + Playwright provider; 5 GLTerm tests in real Chromium incl. pixel-exact readback; headless WebGL2 proven on the CI runner (SwiftShader). *(PR #5)*
- [x] 1.1.7 Text-snapshot infrastructure on `GLTerm.toText()`; `hud-frame.golden.txt` committed and diffable. *(PR #5)*
- [x] 1.1.8 Content pipeline: palette + sprite schemas, codegen with embedded schema objects (committed, CI fails on drift), `ajv` validation at load, content linter with honest idle reporting. First asset: `palette.json`. *(PR #6)*
- [x] 1.1.9 `ci.yml` complete: lint, typecheck, unit, browser (Playwright cached), content validation, drift check, build — on every PR. *(PRs #4-#6)*

**Phase 1 gate: PASSED — CI green on an empty game. Tagged `v0.1.0`.**
Bonus: demo rebuilt as a seeded board through the real pipeline (PR #7); live page verified pixel-identical to local build for a pinned seed.

### 1.2 Phase 2 — art pipeline proof *(~0.5 session, needs Daniil)*

**Parked until Daniil is at the laptop** — Phase 3 backend pulled forward
instead (no dependency between them; resequenced 2026-08-15).

**Gate: a sprite drawn in REXPaint appears in the game unchanged.**

- [ ] 1.2.1 `tools/build-rexpaint-font.mjs` — spleen atlas as 16-column PNG, same index order as runtime glyphset.
- [ ] 1.2.2 Install font into REXPaint (`data/fonts/_config.xt`); verify braille renders in the editor.
- [ ] 1.2.3 Author **one** tower sprite and **one** terrain tile in REXPaint (Daniil, hands-on).
- [ ] 1.2.4 `tools/rexpaint-import.mjs` — `.xp` → sprite JSON per ASSETS §3; commit `.xp` sources.
- [ ] 1.2.5 Render the imported art in the browser; verify glyph-for-glyph fidelity on the deployed page (cache-busted).

### 1.3 Phase 3 — the board *(~2–3 sessions)*

**Gate: connectivity property test — seeded edge-biased boards + adversarial
unit battery, always holds.** *(Rescoped from "10,000 boards": with derived
connectors, invalid states are unrepresentable; mass generation tests the RNG,
not the logic. Decision: Daniil, 2026-08-15.)*

- [ ] 1.3.1 Fixed 20 Hz tick loop; pause / 1× / 2× / 4× as ticks-per-frame.
- [ ] 1.3.2 Three-level grid model; **subcell entity coordinates** (shipping as 1×1); occupancy `Uint16Array`.
- [x] 1.3.3 Tile model: native 5×5 grids, **derived center-or-nothing connectors** (PRD §4.2), rotation, single validity function. *(PR #8)*
- [x] 1.3.4 Placement legality: edge agreement, no road off-board, contact + **road-join rule** (road tiles must extend the network — found by the property test catching disconnected networks). Draft→place flow itself lands with the run loop (M2). *(PR #8)*
- [x] 1.3.5 Starter library: 11 tiles authored native 5×5 in `content/assets/tiles/library.json`; 7×7 `tiledefs.json` + `to5()` downsampling hack removed. Semantic validation via engine in harness CI test. *(PR #8)*
- [ ] 1.3.6 Dijkstra flow fields over cells: ground + flying; yields `L`.
- [ ] 1.3.7 Terrain rendering: weighted glyph pools, mixing hash, boundary shading (lit/mid/dark). *(pools + hash exist in demo; boundary shading and the view-package home remain)*
- [x] 1.3.8 Connectivity tests: 35 seeded boards over sizes 2×1…14×7 + adversarial battery (off-center roads, corner roads, split routes, roads-to-nowhere, edge spawns, boundary violations, rotation identities, road-join). *(PR #8)*
- [x] 1.3.9 **Tile Smith** authoring tool: paint a 5×5 grid at `/tilesmith.html`, live derived connectors, verdict + export gated by engine `validateTileCells`, shared terrain styling with the game view. *(new item, Daniil 2026-08-15; PR #10)*

### 1.4 Phase 4 — the game *(~3–4 sessions)* — **blocked by D1, D2, D3**

- [ ] 1.4.1 Tower framework: one cell footprint, 3×5 upgrade trees, crosspath rule (5/2/0) enforced in engine + tests.
- [ ] 1.4.2 Bolt Turret, Mortar, Frost Emitter, Refinery — stats and trees as content; art per D3.
- [ ] 1.4.3 Enemies: SoA storage, 2 damage types, 5 traits, 6 enemy defs; movement on flow field; flyers straight-line.
- [ ] 1.4.4 Targeting + projectiles (subcell); damage resolution.
- [ ] 1.4.5 Waves, Scrap, lives, win/lose; wave budgets from analytic prior with `L` offset `(L/L_base)^0.5`.
- [ ] 1.4.6 Refinery economy: Yield → Scrap anywhere; Extraction → Ore on ore cells only; Ore banked per tier.
- [~] 1.4.7 **HUD** (first-class): build palette, tower inspector with crosspath legality, tile hand, wave state, speed controls. *(early slice shipped ahead of schedule, PR #9: BoardView in `view`, pixel→cell mapping, hover highlight, click-select with brackets, cell inspector line)*
- [ ] 1.4.8 Replay: `{version, seed, contentHash, inputs}` record/playback; golden state-hash test (2,000 ticks).

### 1.5 Phase 5 — smoke harness *(~0.5–1 session)*

- [ ] 1.5.1 Crude bot policy (build/upgrade heuristic).
- [ ] 1.5.2 `harness calibrate` / `harness check` CLI; per-wave margin table output.

**M1 exit gate: Daniil plays it and says whether it is fun.**

---

## M2 — A complete run *(coarse; decompose when M1 exits)*

- [ ] 2.1 Full board scale, escalating waves, run end conditions.
- [ ] 2.2 Draft flow between tiles (3-choice hand or similar).
- [ ] 2.3 Save/resume; run summary screen.
- [ ] 2.4 Ore banking → persistent meta store.
- [ ] 2.5 +4 towers, +~8 enemies (content, on the proven pipeline).

## M3 — Trustworthy difficulty *(coarse)*

- [ ] 3.1 Real bot policy; calibration runs across seed corpus.
- [ ] 3.2 Calibrated curves committed as data; `balance.yml` CI gate.
- [ ] 3.3 Human offset measured from Daniil's recorded replays.
- [ ] 3.4 Unwinnable/trivial seed detection across ≥500 runs.
- [ ] 3.5 Tech tree stage 1 (~5 nodes); in-game autopilot.

## M4+ — Expansion *(à la carte, decompose on demand)*

- [ ] 4.1 Effects system (subcell particles, projectiles, impacts, animation).
- [ ] 4.2 Full art pass, material language everywhere, biome palettes.
- [ ] 4.3 Towers 5–9; traits 6–11; third damage type.
- [ ] 4.4 Tech tree stage 2; 4.5 dailies + replay sharing; 4.6 ore tiers; 4.7 potency (optional).
