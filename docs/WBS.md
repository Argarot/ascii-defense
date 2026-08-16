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
| D1 | ~~Buildable density~~ **RESOLVED 2026-08-15**: the map generator controls ground amount/placement directly; density is a generation knob tuned as data (PRD §4.4) | — | closed |
| D2 | ~~The Wall~~ **RESOLVED 2026-08-15**: cut. All three candidate jobs died with the pivot + flyer cut (PRD §5.3, §13) | — | closed |
| D3 | **Material language** — glyph vocabulary for metal/stone/energy/organic (ASSETS §5) | before 1.4 art authoring | Daniil + dev |
| D4 | ~~Wave-clear offer cadence~~ **RESOLVED 2026-08-16**: every **3 waves**, pick 1 of 3. ~6 guaranteed picks in a 20-wave run, ~11 acquisitions once caches and Ore draws are counted — above the ~6–10 floor at which combinations start happening (PRD §7.1) | — | closed |
| D5 | ~~Relic rarity tiers~~ **REOPENED 2026-08-16** — the play evidence D5 was waiting for arrived: a flat pool deals run-breaking relics as readily as filler, so draw order decides the ceiling. Weight the pool | before 2.7 | dev + Daniil |
| D6 | **Does a run end?** Finite (final wave + victory, meta rewards depth) vs endless scored by depth. Blocks the difficulty arc — you cannot tune a curve without knowing where it stops | before 2.1 | Daniil |
| D7 | **Hidden-tab behaviour** — explicit visible pause (~30 min) vs simulation in a Web Worker (~1 session, also buys in-browser bot runs). Silent stalling is rejected either way (PRD §14) | before 2.13 | Daniil |
| D8 | **The printing-trade lexicon** — the naming pass for towers, enemies, upgrades, currencies (PRD §13). A taste call, and it must close before art since art illustrates names | before 2.12 | Daniil + dev |

**2026-08-15 pivot** (PRD §1, §14): player tile-laying cut; maps are generated
at run start (Core tile center, `entries` carved paths, ore by road distance).
Flyers cut. Tile machinery and Tile Smith survive as generator input and meta
progression.

**2026-08-16 — the relic layer** (PRD §7, new Phase 6 below). The Core's own
branch tree is **cut before implementation**; the Core becomes the vessel that
holds run-local relics. Rationale: a handful of symmetric balanced purchases
cannot produce a build-breaking run, which is what a roguelite is for. Also
settled: the Refinery mines Ore only (its Scrap path becomes a relic), caches
are claimed by paying not by building, prospecting reveals rock contents dealt
at generation, and no relic may ever combine both options of a tier (art
budget — PRD §5.2, §14). M1 grew by ~2 sessions; the relic layer is inside the
fun-test gate, not after it.

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

- [x] 1.3.1 Fixed 20 Hz tick loop; pause / 1× / 2× / 4× as tick frequency in the app's frame loop; clamped dt. *(PR #13)*
- [~] 1.3.2 Three-level grid model ✓; **subcell entity coordinates** ✓ (continuous cell units in SoA arrays). Occupancy `Uint16Array` arrives with towers (Phase 4).
- [x] 1.3.3 Tile model: native 5×5 grids, **derived center-or-nothing connectors** (PRD §4.2), rotation, single validity function. *(PR #8)*
- [x] 1.3.4 Placement legality: edge agreement, no road off-board, contact + **road-join rule** (road tiles must extend the network — found by the property test catching disconnected networks). Draft→place flow itself lands with the run loop (M2). *(PR #8)*
- [x] 1.3.5 Starter library: 11 tiles authored native 5×5 in `content/assets/tiles/library.json`; 7×7 `tiledefs.json` + `to5()` downsampling hack removed. Semantic validation via engine in harness CI test. *(PR #8)*
- [x] 1.3.6 Flow field (uniform-cost BFS — Dijkstra unneeded at cost 1) toward Core cells; yields `L`, shown live in HUD. *(PR #13)*
- [x] 1.3.10 **Map generator**: carve-then-tile, entries exact and unique, ore by road distance. *(PR #12)* **v2 (Daniil's rules, PR #14):** road network is a tree (unique route per entry, no loops — tested as |E|=|V|−1), walks exit promptly after earning `targetPathLength`, roadless slots >3 from road stay void, sector-assigned walks spread the tree across all board halves.

**Phase 3: COMPLETE** *(2026-08-15)* — every item shipped except the occupancy
array, which deliberately arrives with towers (1.4.1). Gate held: connectivity
(now tree-uniqueness) proven across edge-biased seeded boards + adversarial
battery; sim deterministic cross-machine against the live deploy.
- [x] 1.3.11 Sim skeleton: SoA walker enemies marching entries→Core, deterministic to the tick cross-machine (verified against the live deploy); animated demo with pause/1×/2×/4×. *(PR #13)*
- [x] 1.3.7 Terrain rendering: weighted glyph pools, mixing hash, boundary shading (lit tops, shadowed bottoms per ASSETS light rules); faint tile-seam markers on G. *(PR #14)*
- [x] 1.3.8 Connectivity tests: 35 seeded boards over sizes 2×1…14×7 + adversarial battery (off-center roads, corner roads, split routes, roads-to-nowhere, edge spawns, boundary violations, rotation identities, road-join). *(PR #8)*
- [x] 1.3.9 **Tile Smith** authoring tool: paint a 5×5 grid at `/tilesmith.html`, live derived connectors, verdict + export gated by engine `validateTileCells`, shared terrain styling with the game view. *(new item, Daniil 2026-08-15; PR #10)*

### 1.4 Phase 4 — the game *(~3–4 sessions)* — **blocked by D1, D2, D3**

- [x] 1.4.1 Tower framework complete: one-cell footprint, occupancy, build/sell, 3×5 trees, crosspath 5/2/0 enforced (pure canUpgrade shared with HUD), effective-stat folding, sell refunds tiers. *(PRs #17, #23)*
- [x] 1.4.2 Bolt, Mortar (explosive AoE), Frost (slow) with full paths as content; Refinery: session D. *(PRs #16, #23)*
- [x] 1.4.3 Six enemies across the trait matrix (armor blunts, shields burn first, fast/swarm stats), minWave gating. Damage types (Kinetic/Energy): deferred to D with the Core branches. *(PRs #16, #23)*
- [x] 1.4.4 Targeting (first-on-path, deterministic ties) + subcell projectiles + damage resolution + kill credit. Cross-content CI rule: projectiles must outrun enemies. *(PR #17)*
- [x] 1.4.5 Scrap economy + waves with telegraphed widening fronts + Core health and defeat. Budget curves from analytic prior: M3 calibration. *(PRs #19, #23)*
- [x] 1.4.6 **Refinery + Ore** *(PR #32, 2026-08-16)*: Ore-only production on `O` cells (off-vein the cycle timer holds, ready for prospecting to resume it); Ore per tier in `Sim`; 3-reroll carry then wipe in the app; HUD ORE readout + producer card (yield/s, OFF VEIN warning); mapgen ore floor **by construction** (pre-committed slots, no repair pass — `ORE_FLOOR`). *Rescoped 2026-08-16: the Core's type-choice-and-tier-tree half is **cut, not deferred** (PRD §14) and replaced by 1.6; the Refinery's Yield/Scrap path is cut and becomes relic `foundry` (1.6.3). The Survey tier path arrives with 1.6.6 — deliberately not sold as a no-op today.*
- [x] 1.4.7 HUD complete for M1: 2× panel, build palette, tower inspector w/ crosspath-aware upgrade buttons, priority selector, range circle, telegraphs, Core vitals, defeat banner. Mouse-first. *(PRs #9, #18-#20, #23)*
- [x] 1.4.8 **Replay + golden hash** *(PR #33, 2026-08-16)*: recording inside the Sim's four mutation methods; `applyAction` playback + `playReplay` driver; `hashState()` FNV-1a over all state; golden 2,000-tick hash frozen (`2829733585` in `replay.test.ts`); round-trip proven bit-identical. All seven Phase 6 action shapes reserved in the union; Sim rejects them until built. `__ad.replay()` serialises a run (~119 bytes played).

**Phase 4: COMPLETE** *(2026-08-16)* — every item shipped or explicitly
replaced by Phase 6 (the Core tree → relics, PRD §14).

### 1.6 Phase 6 — the power layer *(~2 sessions)* — **runs before 1.5**

Relics: rule-breakers acquired mid-run (PRD §7). Numbered 6 because IDs are
stable once assigned; sequenced before Phase 5 because calibrating a game that
is missing its power layer produces curves we would throw away.

- [x] 1.6.1 **Hook layer** *(PR #36, 2026-08-16)*: named knobs at fixed seams - stats fold (damageMul/fireRateMul/rangeAdd/coreAdjacentRangeMul), damage resolution (slowedDamageMul/killRefundScrap/overkillCarry), impact (explodeTwice), build legality (buildOnRock/offVeinScrap), production (offVeinScrap yield, productionMul window), movement (freezeTicks), targeted actives (orbital). Passives fold immediately, consumables once USED, actives cooldown per relic; fold is order-free. Schema + codegen + validateRelics shipped, `rarity` reserved (D5).
- [x] 1.6.2 **Acquisition B** *(PRs #36 engine + #37 modal, 2026-08-16)*: offers every 3 completed waves (D4), pick 1 of 3, no duplicates vs held, `relics` RNG stream (map/waves/combat draws untouched). The offer modal is the project's first pop-up and the reusable pattern (painted over the finished frame; no state to save). Auto-pause on offer, app-level. A dead run stops offering.
- [~] 1.6.3 **Relic content** *(PR #36)*: the eleven-relic starter pool shipped and effect-tested (`overflow`, `frostbite`, `tithe`, `splinter`, `vein_tap`, `loadbearing`, `ballistics`, `foundry`, `orbital`, `stasis`, `deep_vein`). Grows toward ~20 with 1.6.6 (prospecting-adjacent relics land with their mechanics).
- [x] 1.6.4 **Core as vessel** *(PR #40, 2026-08-16)*: Core card with HP bar and a Stone Story-style slot grid (12 slots always drawn, empty included - Daniil); slots are stateful buttons (passive/ready/cooling-with-countdown/consumable/used); targeted actives arm a board-click aim mode with blast-radius preview, Esc cancels.
- [x] 1.6.5 **Acquisition C then A** *(PRs #41, #42, 2026-08-16)*: DRAW RELIC (15 ore) on the Core card, REROLL OFFER (8 ore) on the modal - both draw at action time on the relics stream, riding the replay log. Caches dealt at generation ([?] plates, far ground), claim card replaces the palette (40 scrap), building on unclaimed caches blocked outright.
- [x] 1.6.6 **Prospecting** *(PR #42, 2026-08-16)*: rock contents dealt at generation (30% ore / 12% cache / rest nothing); rocks are clickable with their own card, PROSPECT (25 scrap) gated behind the Refinery's Survey tier choice (`unlocks: 'prospect'` - a new ChoiceDef capability field, replacing Twin Shaft); the Sim owns a mutable cell map with an ordered change log the view consumes. Off-route only, flow field untouched by construction.

**Phase 6 gate: PASSED** *(2026-08-16)* — frostbite+overflow proven composing in one damage resolution, and relic runs (offers, draws, claims, prospects) replay bit-identically from seed + input log.

**Phase 6 gate: a run where two relics combine into something absurd,
reproduced exactly from its seed + input log.**

### 1.5 Phase 5 — smoke harness *(~0.5–1 session)*

- [ ] 1.5.1 Crude bot policy (build/upgrade heuristic, **plus relic picks** — they are part of run power).
- [ ] 1.5.2 `harness calibrate` / `harness check` CLI; per-wave margin table output. Calibration targets a distribution over relic draws, not a point (PRD §9).

### 1.7 Phase 7 — post-playtest triage *(~0.5 session, next)*

The wave-14 run produced both bugs and one shape error worth fixing before any
calibration work, because they corrupt the evidence calibration would gather.

- [ ] 1.7.1 **Preview fold bug** — the tower upgrade preview calls `effectiveStats()` directly, bypassing the relic fold, so with Loadbearing live a tower shows range 18 and previews 8.5. Route previews through `sim.stats()`; colour a change for the worse red (PRD §5.4).
- [ ] 1.7.2 **The pool runs dry silently** — 11 relics, caches deal duplicates, `unheldPool()` empties, `maybeOffer` returns early and the acquisition layer switches off with no message. Short term: more relics + an honest "pool exhausted" state. Real fix is 2.7.
- [ ] 1.7.3 **Difficulty shape** (PRD §9.1) — threat scales geometrically, composition escalates in kind, so no build reaches a stable state. First-pass formula only; calibration is M3.
- [ ] 1.7.4 Speed control gains 8× (the frame loop already tolerates it: 32 ticks/frame ≈ 96×).
- [ ] 1.7.5 Refinery card shows remaining deposit instead of kills (pairs with 2.6).

**M1 exit gate: PASSED 2026-08-16.** *"The game is fun now, it’s just very
unbalanced and with quite a few holes still."* Phases 5 and 7 remain as M1 work,
but the question the milestone existed to answer is answered.

---

## M2 — A complete run *(coarse; decompose when M1 exits)*

- [ ] 2.1 **The difficulty arc**: full board scale, escalating waves, and a run END (blocked by D6). Implements PRD §9.1 properly — 1.7.3 is the first pass, this is the shaped version with elites, boss waves and front escalation.
- [ ] 2.2 ~~Draft flow between tiles~~ **CUT 2026-08-16** — a survivor of the pre-pivot design that should have died with player tile-laying on 2026-08-15. Replaced by relic pool expansion on the Phase 6 machinery.
- [ ] 2.3 Save/resume (must serialise relic state + the input log); run summary screen listing the relics the run was built on.
- [ ] 2.4 Ore banking → persistent meta store; relic pool unlock set persisted alongside it.
- [ ] 2.5 +4 towers, +~8 enemies, +relics (content, on the proven pipeline).
- [ ] 2.6 **Finite ore deposits** (PRD §6): richness + quantity per ore cell set at generation, Refineries draw down and stop when exhausted, spent veins revert to ground. Gold-speck density on the cell tracks remaining richness, so "where is the money" is answered by looking.
- [ ] 2.7 **Relic economy** (PRD §7.6): pool grown well beyond what one run can drain; **fusion** (several relics into one stronger) and **salvage** (trade back for Ore); a much larger share single-use; rarity weighting (D5). This is what makes more slots safe to add rather than trivialising.
- [ ] 2.8 **Damage types decide fights** (PRD §8): Kinetic/Energy become real via resistance and immunity, so no single tower answers every wave. The direct answer to "2-3 mortars demolish everything".
- [ ] 2.9 **Boon ground** (PRD §4.7): overlay cells granting a permanent modifier to whatever is built on them; must read as ground, and keep telegraphing under a tower without corrupting its 14 states.
- [ ] 2.10 **Tower legibility** (PRD §5.4): full stat block, written descriptions on every upgrade choice (same card mechanic as relics), previews folding all live modifiers.
- [ ] 2.11 **Prospecting rework** (PRD §4.6): drop the unlock; prospecting costs Scrap **and time** for everyone; the Refinery tier choice becomes a real ability (auto-prospect adjacent rock, or faster).
- [ ] 2.12 **The naming pass** (PRD §13, D8): printing-trade vocabulary across towers, enemies, upgrades, currencies. Before any art.
- [ ] 2.13 **UI infrastructure**: scrollable panels, larger illustrated relic cards, hidden-tab behaviour (D7). The modal layer from 1.6.2 is the foundation.
- [ ] 2.14 **Enemy readouts** (PRD §8): shields as a bracket around the glyph, destroyed separately from the body so any enemy may carry one; health and status effects as marks beside the glyph (braille is a candidate). No tooltips.

## M3 — Trustworthy difficulty *(coarse)*

- [ ] 3.1 Real bot policy; calibration runs across seed corpus.
- [ ] 3.2 Calibrated curves committed as data; `balance.yml` CI gate.
- [ ] 3.3 Human offset measured from Daniil's recorded replays.
- [ ] 3.4 Unwinnable/trivial seed detection across ≥500 runs, measured with the relic layer held fixed — trivial-by-relic is the feature, trivial-by-map is the defect (PRD §9).
- [ ] 3.5 Tech tree stage 1 (~5 nodes); in-game autopilot.

## M4+ — Expansion *(à la carte, decompose on demand)*

- [ ] 4.1 Effects system (subcell particles, projectiles, impacts, animation) — including explosions, projectile **spread**, and a **living board**: terrain drift and 2–3 frame tower cycles (PRD §13). The renderer already redraws every frame, so this is authoring cost, not engine cost.
- [ ] 4.8 **Offset connectors** (PRD §4.2.1): edge connector becomes a set of offsets, so parallel roads may touch without merging. Re-authors the tile library, the signature index and Tile Smith. **Lands before the tile pool grows** (§11) or it has to be done twice.
- [ ] 4.9 **Bridges** (PRD §4.2.2): roads cross without merging. Turns the route from a grid BFS into a graph where a bridge cell holds two nodes; movement, targeting distance and `L` all follow. Depends on 4.8.
- [ ] 4.10 **Attack shapes** (PRD §5.5): chain, beam over a run of road, arc/wedge AoE. Arc Coil and Rail Lance in the §5.3 roster already reserve two of these.
- [ ] 4.11 **Per-upgrade tower visuals** (PRD §5.2, blocked by D3): each committed choice legible on the tower — a second barrel as a second glyph, background colour for what glyphs cannot say.
- [ ] 4.12 **Void becomes water** with procedural blending at the terrain border (PRD §13); border cells can never carry road, so the overwrite is always safe.
- [ ] 4.13 Illustrated relic cards and slot icons (PRD §7.2) — the slot grid ships functional in M1 and gets its art here.
- [ ] 4.14 Boss enemies drawn multiple glyphs wide on a one-cell footprint (PRD §14 — visual size only, never mechanical).
- [ ] 4.2 Full art pass, material language everywhere, biome palettes.
- [ ] 4.3 Towers 5–9; traits 6–11; third damage type.
- [ ] 4.4 Tech tree stage 2; 4.5 dailies + replay sharing; 4.6 ore tiers; 4.7 potency (optional).
