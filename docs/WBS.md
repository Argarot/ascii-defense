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
- [ ] 1.1.6 Vitest Browser Mode + Playwright provider; prove GLTerm renders in real Chromium under test.
- [ ] 1.1.7 Text-snapshot infrastructure on `GLTerm.toText()`; one golden screen committed and diffable.
- [ ] 1.1.8 Content pipeline: `content/schema/*.schema.json`, `json-schema-to-typescript` codegen (committed types, CI fails on drift), `ajv` validation at load, content linter skeleton.
- [~] 1.1.9 `ci.yml`: typecheck, lint, unit, **build** run on every PR *(PR #4)*. Still to add in session 2: browser/snapshot job, content validation job.

### 1.2 Phase 2 — art pipeline proof *(~0.5 session, needs Daniil)*

**Gate: a sprite drawn in REXPaint appears in the game unchanged.**

- [ ] 1.2.1 `tools/build-rexpaint-font.mjs` — spleen atlas as 16-column PNG, same index order as runtime glyphset.
- [ ] 1.2.2 Install font into REXPaint (`data/fonts/_config.xt`); verify braille renders in the editor.
- [ ] 1.2.3 Author **one** tower sprite and **one** terrain tile in REXPaint (Daniil, hands-on).
- [ ] 1.2.4 `tools/rexpaint-import.mjs` — `.xp` → sprite JSON per ASSETS §3; commit `.xp` sources.
- [ ] 1.2.5 Render the imported art in the browser; verify glyph-for-glyph fidelity on the deployed page (cache-busted).

### 1.3 Phase 3 — the board *(~2–3 sessions)*

**Gate: property test — 10,000 generated boards, connectivity always holds.**

- [ ] 1.3.1 Fixed 20 Hz tick loop; pause / 1× / 2× / 4× as ticks-per-frame.
- [ ] 1.3.2 Three-level grid model; **subcell entity coordinates** (shipping as 1×1); occupancy `Uint16Array`.
- [ ] 1.3.3 Tile model: 5×5 cell grids, edge connectors, rotation.
- [ ] 1.3.4 Placement legality = connector agreement with all placed neighbours; tile-laying flow (draft → place).
- [ ] 1.3.5 Starter tile library in `content/assets/tiles/` (enough shapes to exercise matching; density per D1 can come later).
- [ ] 1.3.6 Dijkstra flow fields over cells: ground + flying; yields `L`.
- [ ] 1.3.7 Terrain rendering: weighted glyph pools, mixing hash, boundary shading (lit/mid/dark).
- [ ] 1.3.8 Property test: 10k random legal boards → connectivity holds, no orphaned tiles.

### 1.4 Phase 4 — the game *(~3–4 sessions)* — **blocked by D1, D2, D3**

- [ ] 1.4.1 Tower framework: one cell footprint, 3×5 upgrade trees, crosspath rule (5/2/0) enforced in engine + tests.
- [ ] 1.4.2 Bolt Turret, Mortar, Frost Emitter, Refinery — stats and trees as content; art per D3.
- [ ] 1.4.3 Enemies: SoA storage, 2 damage types, 5 traits, 6 enemy defs; movement on flow field; flyers straight-line.
- [ ] 1.4.4 Targeting + projectiles (subcell); damage resolution.
- [ ] 1.4.5 Waves, Scrap, lives, win/lose; wave budgets from analytic prior with `L` offset `(L/L_base)^0.5`.
- [ ] 1.4.6 Refinery economy: Yield → Scrap anywhere; Extraction → Ore on ore cells only; Ore banked per tier.
- [ ] 1.4.7 **HUD** (first-class): build palette, tower inspector with crosspath legality, tile hand, wave state, speed controls.
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
