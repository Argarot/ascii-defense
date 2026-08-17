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
| D3 | ~~Material language~~ **CLOSED 2026-08-16 as obsolete.** "Which glyphs mean metal vs stone" was a question from when we expected hand-authored art at volume. The live remnant is narrower — *what compositional rule makes 14 tower variants legible* (V11) — and it is not answerable in the abstract; it moves into the art session as a concrete question with sprites in front of us | — | closed |
| D4 | ~~Wave-clear offer cadence~~ **RESOLVED 2026-08-16**: every **3 waves**, pick 1 of 3. ~6 guaranteed picks in a 20-wave run, ~11 acquisitions once caches and Ore draws are counted — above the ~6–10 floor at which combinations start happening (PRD §7.1) | — | closed |
| D5 | ~~Relic rarity tiers~~ **RESOLVED 2026-08-16 (second pass)**: yes — rarity weights the pool so run-breaking relics are rare and filler is common. The flat pool was correct until play evidence existed; it now does. Weighting lands in 2.7 | — | closed |
| D6 | ~~Does a run end?~~ **RESOLVED 2026-08-16**: **finite** — a final wave and a victory. Simpler to playtest and to calibrate against; endless-scored-by-depth may return later as a separate mode | — | closed |
| D7 | ~~Hidden-tab behaviour~~ **RESOLVED 2026-08-16**: the **simulation keeps running** in a Web Worker; an explicit PAUSED indicator covers deliberate pauses only. Also buys in-browser bot runs without freezing the UI | — | closed |
| D8 | **The printing-trade lexicon** — own mini-session, **before more towers/enemies** (Daniil). Dev's position to argue there: theme the *flavour* layer hard (enemies, relics, tier names, currencies) but keep **tower** names functionally readable — "Frost Emitter" tells you it slows, "Quoin" does not, and towers are picked under pressure | before 2.5/2.8 | Daniil + dev |
| D9 | ~~Ore tier driver~~ **RESOLVED 2026-08-16**: there is no generator driver — **ore tiers are tiles you buy** (PRD §11.1). Rarity is economic: expensive tiles, owned in finite copies, with tier-N nodes bought using tier-(N-1) ore. Appearance likelihood is a calibration knob. Engine keeps only the shape (tiered cells, per-tier costs); the economy lands in M7 |
| D10 | ~~Road-shape variance~~ **RESOLVED 2026-08-16**: the constraint was never tile size — it was the validity rule confining roads to the interior 3×3 (PRD §4.2.1). Drop that, add route-as-a-graph (2.16), then generate variants (2.15). 7×7 stays a fallback only if the widened vocabulary still reads samey | — | closed |

## Request index

Daniil's numbered feedback → where it landed. Compact on purpose: the item
text lives in the WBS entry, declines in PRD §14, deferrals in the table above.
*(Replaced a separate FEEDBACK.md on 2026-08-16 — a third copy of the same facts
was a drift surface, not an aid.)*

**Round 1, mechanics:** 1→2.6 · 2→2.11 · 3→1.7.3+2.1 · 4→2.7 · 5→2.7 · 6→2.13 ·
7→1.7.2 *(diagnosed: pool exhaustion, not a missing button)* · 8→2.16 · 9→4.9 ·
10→2.8 · 11→4.10 · 12→2.9 · 13→4.1 · 14→1.7.4 · 15→1.7.5 · 16→2.13 (D7) ·
17→2.10 · 18→2.10 · 19→1.7.1 *(a bug)* · 20→2.12 (D8)

**Round 1, visuals:** V1→2.13+4.13 · V2→4.13 · V3→2.15 · V4→4.1 · V5→4.1 ·
V6→2.14 · V7→4.11 · V8→4.12 · V9→4.12 · V10→4.1 · V11→4.11 · V12→4.14
*(marked, not committed — visual size only)* · V13→2.14

⚠ **This index pointed at IDs 4.1 and 4.9–4.14, which had no entries** until
2026-08-17 — the numbers were assigned in PR #48 as FEEDBACK.md was deleted, and
the entries were never written, so seven of Daniil's items were tracked by
reference to nothing. Entries now exist under M4. **V8 and V9 (→4.12) could not
be recovered** and need restating. The lesson, logged: an index is not a
tracker — a mapping to an ID that does not exist is worse than no mapping,
because it reads as tracked.

**Round 8 (playtest 8, 2026-08-17 — the effects engine landed; "animation looks
great, game is indeed much more fun now"):** explosion radius must drive damage,
visual and readout→2.19 · mortar should be ballistic, not homing→2.19 ·
projectiles must not vanish when their target dies→2.19 · Tile Smith mints
unplaceable tiles→**2.20 (fixed by construction, not patched)** · basic vs
special tiles + pre-run loadout→2.21 (+7.5 for the slot economy) · relic sprites
at board scale→6.7, square slots→2.13 · background animation ignores tick
speed→4.25 *(diagnosed: session 16 put world motion on the wall clock while
arguing the opposite for effects — both halves cannot be right)* · shoreline
blending→6.6 *(already promised in PRD §13; had no WBS item — asked twice)* ·
void chests→2.22/PRD §4.9 · loot tables→2.22/PRD §7.7 · smoother animation→6.8
*(mechanism corrected: spatial phase, not partial redraw)*

**Round 5 (playtest 5, all PR #63):** 1 rim-as-shade · 2 library re-encoded to
segments · 3 segment-only brushes · 4 auto tile ids · 5 paint-on-preview ·
6 tile weights · 7 **partial: ore paintable; richness/boon authoring → 2.18** ·
8 boon tiers 1–4 (corner marks) · 9 exact boon text · 10 boons near road ·
11 duplicate relics equippable (rebalance later, agreed) · 12 void share cap

**Round 4 (playtest 4, PRs #59–#61):** ports model · transparent modal ·
enclosed-void fill · prospect stacking/parallel-auto

**Round 3 (playtest 3):** difficulty ✓ · reroll visibility→#57 · 2× cards→#57 ·
richness density+bg→#57 · timed/auto prospecting→#57 (2.11) · ore readout on
select→#57 · directional roads replacing lane letters→#57 · Tile Smith add
UX→#57 · two-turn tiles unused by carve→**2.17 (the fix is the carve, stated
openly)** · "bigger sessions"→ledger rescoped

**Round 2:** consumables free slots→1.7.6 · cut `foundry`→1.7.7 · 10× slower
mining→1.7.8 · ore tiers→D9 · Tile Smith "add"→2.16 · balance maths→1.5.3/1.5.4 ·
Phase 5 too early→split · content too late→ledger reordered · animation is
engine work→4.1 pulled forward

**Declined** (reasons in PRD §14): both-tier relics · mechanically multi-cell
enemies · offset connectors *(my proposal, withdrawn)* · build-to-claim caches ·
mid-run tech tree · road mutation · silent hidden-tab simulation.

---

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

**Split 2026-08-16.** A bot calibrating against systems that are still changing
is wasted work, but *measurement* is needed immediately. 1.5.3/1.5.4 come first;
1.5.1/1.5.2 wait until damage types, relics and the difficulty shape have settled.

- [x] 1.5.3 **Balance lab — headless runner** *(PR #52, 2026-08-16)*. The real `Sim`, no renderer, at full speed: place a loadout from a spec, run N waves, report leak %, margin, time-to-kill, breach wave, economy curves. Exact by construction because it IS the game. The engine is already DOM-free and deterministic, so this is a measurement layer, not a new simulator.
- [x] 1.5.4 **Balance lab — analytic model** *(PR #52)*. Closed form: coverage × exposure time × effective DPS against a wave HP pool, with armor/shield/slow folded in. Answers "what threatens this build at wave 30" instantly and sweeps thousands of configurations. The analytic model proposes, the headless runner verifies, and the **gap between them is itself a bug detector** (PRD §9 always specified this two-layer shape; only the order was wrong).
- [ ] 1.5.1 ~~Crude bot policy~~ **DEFERRED** until systems settle — build/upgrade heuristic plus relic picks.
- [ ] 1.5.2 ~~`harness calibrate` / `check` CLI~~ **DEFERRED** with 1.5.1. Calibration targets a distribution over relic draws, not a point (PRD §9).

### 1.7 Phase 7 — post-playtest triage *(~0.5 session, next)*

The wave-14 run produced both bugs and one shape error worth fixing before any
calibration work, because they corrupt the evidence calibration would gather.

- [x] 1.7.1 *(PR #51)* **Preview fold bug** — the tower upgrade preview calls `effectiveStats()` directly, bypassing the relic fold, so with Loadbearing live a tower shows range 18 and previews 8.5. Route previews through `sim.stats()`; colour a change for the worse red (PRD §5.4).
- [ ] 1.7.2 **The pool runs dry silently** — 11 relics, caches deal duplicates, `unheldPool()` empties, `maybeOffer` returns early and the acquisition layer switches off with no message. Short term: more relics + an honest "pool exhausted" state. Real fix is 2.7.
- [x] 1.7.3 *(PR #52)* **Difficulty shape, first pass**: difficulty is data (`DifficultySpec`); `hpGeometric 1.06` chosen from the lab sweep — naked ~10, competent ~23, god build ~26. Composition escalation is session 13; calibration M3.
- [x] 1.7.4 *(PR #51)* Speed control gains 8× (the frame loop already tolerates it: 32 ticks/frame ≈ 96×).
- [x] 1.7.5 *(PR #54)* Refinery card shows remaining deposit instead of kills.
- [x] 1.7.6 *(PR #51)* **A used consumable frees its slot.** It currently occupies one forever as `[--]` — a bug, not a design. Touches the held-relic arrays, so replay indices and `hashState` move with it.
- [x] 1.7.7 *(PR #51)* **Cut the `foundry` relic** and its now-dead `offVeinScrap` engine knob (Daniil: a relic that deletes the Refinery's siting decision). Dead knobs mislead the next context — see the `isPathable` correction.
- [x] 1.7.8 *(PR #54)* Mining 10× slower, landed with finite deposits.

**M1 exit gate: PASSED 2026-08-16.** *"The game is fun now, it’s just very
unbalanced and with quite a few holes still."* Phases 5 and 7 remain as M1 work,
but the question the milestone existed to answer is answered.

---

## M2 — A complete run *(decomposed 2026-08-16 when M1 exited)*

**Remaining M2 work by session** *(2026-08-17, revised after playtest 8)*:
2.10, 2.13, 2.14, **2.19, 2.20** → session 17 (legibility, truth, worker) ·
2.3, 2.4 absorbed by 4.19–4.21 in session 18 · **2.21** → session 19 (map
agency) · 2.12 (D8), 2.8 → session 20 (naming, then combat identity) ·
2.7, **2.22** → session 21 (relic economy + loot tables) · 2.5 spills into
sessions 20 and 23–24 · 2.1's remainder (board scale, front escalation, threat
levels as data) rides with 5.5 · **2.18 (Tile Smith overlay authoring) is now
scheduled** — it joins 2.21 in session 19, since both rework the tile format.

- [~] 2.1 *(PR #54, first shaped pass)* **The difficulty arc**: the run ENDS — finalWave 20 (lab-chosen), THE CORE STANDS victory, WAVE X/20; composition escalates in kind (weighted picks), every 5th wave carries an elite surge, Juggernaut anchors the late game. Remaining for M2: full board scale, front escalation, threat levels as data.
- [ ] 2.2 ~~Draft flow between tiles~~ **CUT 2026-08-16** — a survivor of the pre-pivot design that should have died with player tile-laying on 2026-08-15. Replaced by relic pool expansion on the Phase 6 machinery.
- [ ] 2.3 Save/resume (must serialise relic state + the input log); run summary screen listing the relics the run was built on.
- [ ] 2.4 Ore banking → persistent meta store; relic pool unlock set persisted alongside it.
- [ ] 2.5 +4 towers, +~8 enemies, +relics (content, on the proven pipeline).
- [x] 2.6 *(PR #54)* **Finite ore deposits**: veins dealt at generation (30–90, tier field live-but-tier-1), refineries draw down and stop, spent cells revert to ground, gold-speck density tracks remaining richness, deposit readout replaces refinery kills. Mining 10× slower (1.7.8). Prospected rocks carry hidden vein sizes. richness + quantity per ore cell set at generation, Refineries draw down and stop when exhausted, spent veins revert to ground. Gold-speck density on the cell tracks remaining richness, so "where is the money" is answered by looking.
- [ ] 2.7 **Relic economy** (PRD §7.6): pool grown well beyond what one run can drain; **fusion** (several relics into one stronger) and **salvage** (trade back for Ore); a much larger share single-use; rarity weighting (D5). This is what makes more slots safe to add rather than trivialising.
- [ ] 2.8 **Damage types decide fights** (PRD §8): Kinetic/Energy become real via resistance and immunity, so no single tower answers every wave. The direct answer to "2-3 mortars demolish everything".
- [x] 2.9 *(PR #61)* **Boon ground**: overlay cells (+range/+damage/+rate), folded after tiers+relics, corner-tint telegraph survives a standing tower, inspector names it. Threat bundles (Calm/Standard/Grim, `?threat=N`) shipped alongside.
- [x] 2.10 *(session 17)* **Tower legibility** (PRD §5.4): full stat block, written descriptions on every upgrade choice (same card mechanic as relics), previews folding all live modifiers.
- [x] 2.11 *(PR #57)* **Prospecting rework**: unlock dropped, 25 scrap + 600 ticks for everyone, PROSPECTING n% bar; Survey refineries accelerate nearby jobs (to 4×) and start free jobs autonomously.
- [ ] 2.12 **The naming pass** (PRD §13, D8): printing-trade vocabulary across towers, enemies, upgrades, currencies. Before any art.
- [~] 2.13 **UI infrastructure** *(session 17: scrollable panel (wheel, click-safe regions) and square relic slots shipped)*. Remaining: illustrated relic cards ride the art pass (6.7); hidden-tab behaviour (D7, the worker) took the pre-approved cut line to the head of session 18.
- [ ] 2.18 **Tile Smith overlay authoring** (playtest 5, item 7): per-tile ore richness and boon placement need an overlay format beside `cells` (deposits/boons arrays in TileDef) + schema + smith UI + mapgen honoring them. The one piece of playtest 5 NOT shipped, stated openly.
- [x] 2.14 *(session 17)* **Enemy readouts** (PRD §8): shields as a bracket around the glyph, destroyed separately from the body so any enemy may carry one; health and status effects as marks beside the glyph (braille is a candidate). No tooltips.
- [x] 2.15 *(PR #60)* **Generated tile library**: `tools/tilegen.mjs` emits port-encoded wiggly paths + junction tiles through the shared validator; 15 authored + 24 generated, regenerable deterministically; `gen_*` replaced wholesale.
- [x] 2.17 *(PR #60)* **Carve v3 — edge partitions + turning tunnels**: road pools keyed by partition; walks tunnel through occupied slots perpendicular (only when a partition tile exists — no tile, no move); shipped `twin_bend` proven dealt on real maps.
- [x] 2.16 *(PR #55, 2026-08-16)* **Roads that touch without connecting** — the full in-tile lane model (Daniil's call): 'r' as a second lane in the cell alphabet; connectors derive **directionally** (centre + inward continuation); border roads legal, orphan lanes rejected; the route is a **graph** (per-cell allowed-direction mask shared by BFS and the walk phase — enemies never lane-hop); Tile Smith lane brush + **ADD TO POOL** (localStorage pool, engine-revalidated on load, joins the generator). Found live: multi-lane tiles share boolean signatures with routing tiles, so the library index now demands a road-slot tile's crossings interconnect — connectivity stays by construction.

- [x] 2.19 *(session 17)* **Combat truth** *(playtest 8; session 17)*. Three related lies, all confirmed in the source 2026-08-17:
  - **Explosion radius drives everything.** `explodeRadius` already folds correctly through `effectiveStats` (base + tier mods), and AoE damage already uses it — but it is printed **nowhere** in the inspector, and the blast *visual* does not match it: the ring expands from 0.4 to r, and the ground-zero flash is a hard-coded ±2×±1 glyph box regardless of radius. So a Mortar upgraded from 1.2 to 2.5 cells kills wider and looks identical. Fix: one folded number consumed by damage, drawing, and the stat block, with the visual's peak extent equal to the true radius (PRD §5.5).
  - **Mortar is ballistic, not homing.** `roster.json` sets `homing: true` on the Mortar; it should commit an aim *point* at fire time and detonate there regardless of who is standing on it. Needs an "impact at a point" path — `impact()` currently requires an enemy — which is the same code the next item needs.
  - **A fired shot always resolves.** `projectilePhase` despawns a homing projectile outright when its target dies (`sim.ts`, the `!alive[t] || gen mismatch` branch). Unguided shots land where aimed; homing shots re-acquire. Today the damage is silently deleted.
- [x] 2.20 **Tile Smith cannot mint an unplaceable tile — by construction** *(playtest 8; shipped ahead of session 17)*. Daniil minted a "valid" tile the generator could never deal. Root cause: two predicates — `validateTileCells` accepted any lane deriving ≥1 crossing while the generator demanded through-routing at index time, so a one-entry stub passed the first and failed the second. **Fixed with Daniil's entry-point rule, which superseded the dev's crossings framing:** an *entry point* is road touching an edge centre with the appropriate inward orientation (exactly what `deriveConnectors` computes); every road cell must have continuous road to some entry point, and **every entry point must have continuous road to at least one other entry point** — the Core being the licensed terminus. Valid entry counts fall out as 0/2/3/4; a one-entry tile is unrepresentable. Stated over road reachability rather than lane components, so it survives bridges and future road kinds. One function, consumed by the smith's verdict, the mint gate, the pool loader (stale invalid mints silently drop), the content linter and the loader. All 39 shipped tiles pass; the session-14 twin-stub boot-breaker and the screenshot stub are now impossible, proven by test and live in the smith ("✗ invalid — export disabled").
- [ ] 2.21 **Basic and special tiles** (PRD §4.8) *(Daniil, 2026-08-17; session 19)*: basics infinite and unslotted; specials finite, slotted, and **guaranteed placement** at generation; Tile Smith mints into the special pool. Engine/mapgen model + the loadout picker in run setup, tiles rendered **visually** through the shared `drawTerrainCell` the board and smith already use (so visual costs nearly nothing — the name-only fallback Daniil offered is not needed). Generation must *fail loudly* rather than silently drop a special it cannot place. The slot **economy** (upgradable count, unlock set) is 7.5.
- [ ] 2.22 **Loot tables + void chests** (PRD §7.7, §4.9) *(Daniil, 2026-08-17; session 21)*: weighted outcome lists as content, rolled on a named stream at claim time so they ride the input log; sources reference a table by id instead of carrying payout code. Void chests surface and sink on a timer as the first consumer. Built **with** the relic economy because rarity weighting is the same machinery.

## M3 — Trustworthy difficulty *(sequenced after M4/M5: calibrating before the
content and the shell settle would produce curves we throw away)*

- [ ] 3.1 Real bot policy; calibration runs across seed corpus.
- [ ] 3.2 Calibrated curves committed as data; `balance.yml` CI gate.
- [ ] 3.3 Human offset measured from Daniil's recorded replays.
- [ ] 3.4 Unwinnable/trivial seed detection across ≥500 runs, measured with the relic layer held fixed — trivial-by-relic is the feature, trivial-by-map is the defect (PRD §9).
- [ ] 3.5 Tech tree stage 1 (~5 nodes); in-game autopilot.
- [ ] 3.6 **Calibration II** *(Daniil, 2026-08-17; session 27)*: re-baseline after meta progression — tech-tree multipliers and pool unlocks move player power underneath the calibrated curves, so `balance.yml` is re-fixed and the seed corpus re-swept at several tree states. Gate: no trivial or unwinnable seed at any tree state the player can actually hold.

## M4 — The shell, and what the player sees *(it becomes a product)*

*(Was "M4+ Expansion", a bucket rather than a plan — Daniil, 2026-08-16. The
shell is sequenced BEFORE calibration and art because it is what makes external
playtesting possible at all: today a stranger handed the URL gets a debug
harness with no context.)*

**Split across sessions 16, 18 and 21** *(2026-08-17)*: 4.1 opens session 16,
4.15–4.22 are session 18 (the semi-stable alpha marker), 4.23–4.24 are session
21. 4.9–4.14 are presentation items that ride with the art pass, sessions 28–30.

**IDs 4.1 and 4.9–4.14 were referenced by the request index above but never
written as entries** — found 2026-08-17. The text below is recovered from the
sources that cite each ID (PR bodies #44/#46, PRD §13/§14, WBS 6.2/6.3 and the
roadmap's own "what remains late" paragraph) and is marked where recovery was
partial. IDs 4.2–4.8 were never assigned; 4.8 was the offset-connector proposal,
withdrawn before it got an entry (PRD §14). Do not reuse any of these numbers.

- [x] 4.1 **Effects & animation engine** *(session 16; requests 13, V4, V5, V10)*. The sim→view event pipeline generalised from `Sim.pulses` — `Sim.events`, a typed capped list (pulse/impact/death/breach/build/sell/waveStart/reveal) with monotonic seq, never read back, never hashed. View-side `EffectsLayer` with tick-anchored lifetimes: mortar blasts (flash→debris→smoke), hit sparks, death puffs, breach flashes, construction dust, the pulse ring migrated from BoardView. **Frame model in the sprite schema** (`frames` + `frameMs`, format-agnostic plain grids; codegen rerun, linter checks every frame's dims) with the four shipped towers as first sprites — idle cycles on the wall clock, phase-offset by board position. Projectile trails from exposed `projVX/VY`. Terrain drift (hash-selected ~18% of ground/Core glyphs re-roll per slow step) and **void-as-water** (sparse drifting ripples, `terrain.water.*` roles). **Reduced motion shipped with it** (PRD §15.4): module flag defaulting from `prefers-reduced-motion`, ambient stops entirely, gameplay feedback degrades to static marks; settings toggle remains 4.22. Golden replay hash byte-identical — the proof none of it touches the simulation.
- [ ] 4.9 **Bridges** — road crossing road without connecting *(request 9)*. Was filed with 2.16 and 4.8 as three features that were one change; 2.16 shipped the route-as-a-graph identity model, so this is now **tile content plus a draw rule**, not engine work. Cheap, and deliberately late.
- [ ] 4.10 **Attack shapes** (PRD §5.5) *(session 19; request 11)*: chain, beam along a run of road, arc/wedge AoE. Needs the effects engine (4.1) to be legible, which is why 4.1 comes first.
- [ ] 4.11 **Per-upgrade tower visual identity** *(sessions 28–30; requests V7, V11)*: the 14 defined tower forms read as distinct. Cited by 6.2. The open question D3 was closed as unanswerable in the abstract — it is answered here, with sprites in front of us, as "what compositional rule makes 14 variants legible".
- [ ] 4.12 **Unrecovered** — requests V8 and V9 mapped here, and the item text was lost when FEEDBACK.md was deleted (PR #48) without the numbered items being copied into the WBS entries. Visual, from playtest round 1. **Ask Daniil to restate V8/V9 at the next playtest, then write this entry or retire the ID.** Recorded rather than silently dropped: an untracked request is how scope quietly shrinks.
- [ ] 4.13 **UI art pass** *(sessions 28–30; requests V1, V2)*: illustrated relic and upgrade cards, panel chrome. The structural half (scrollable panels, larger card geometry) is 2.13 in session 17; this is the art that fills it. *Reconstructed from the V1→2.13+4.13 split — confirm against V1/V2 when they are restated.*
- [ ] 4.14 **Enemies drawn wider than one cell** *(sessions 28–30; request V12)*: a boss drawn three glyphs wide keeps a one-cell footprint. Visual size yes, mechanical size no — the mechanical version is rejected in PRD §14, and this entry is the half that was accepted.

- [ ] 4.15 **Screen stack** in the view — screens push/pop, board renders beneath where it should. Generalises the relic-offer modal rather than duplicating it. No screen owns game state.
- [ ] 4.16 **Title / main menu**: new run · continue · workshop · settings · how to play.
- [ ] 4.17 **Run setup**: threat level, optional pinned seed, chosen starting loadout later.
- [ ] 4.18 **Pause overlay** and an explicit paused state (pairs with the Worker, 2.13).
- [ ] 4.19 **Run summary screen** — what killed you, which wave, what you built, relics taken, Ore banked. A designed screen: it is the moment that produces another run or ends the session.
- [ ] 4.20 **Persistence** (PRD §15.2): meta state (Ore, unlocks, history, settings) in localStorage; run state as seed + input log (**a save IS a replay**). Schema versioned, migrate-or-say-so, never wipe silently.
- [ ] 4.21 **Save export / import** — a file. Cheap, moves progress between machines, and gives us reproducible bug reports for free.
- [ ] 4.22 **Settings screen**: reduced motion, colourblind palette, text scale, keybinds, wipe data.
- [ ] 4.23 **Onboarding** (PRD §15.3): contextual first-encounter prompts, a How-to-play screen, gentle opening waves. No forced tutorial.
- [ ] 4.24 **Accessibility** (PRD §15.4): colourblind palette values, full keyboard operation, reduced motion honoured by the effects engine, HUD text scale.
- [x] 4.25 *(session 17)* **World motion rides sim time, UI motion rides the wall clock** *(Daniil, playtest 8; session 17)*. Session 16 put terrain drift, water and tower idles on raw wall-clock `performance.now()`, so the world keeps ambling at 8× and keeps moving while paused — while the effects layer, in the same session, was deliberately tick-anchored on the argument that "an honest pause shows a stopped world". Both halves cannot be right. Fix: world ambient advances on a speed-scaled accumulator (freezes at pause, 8× at 8×); telegraph breathing and preview pulses stay on the wall clock, because the interface is not part of the world (PRD §13).

**M4 gate: a stranger opens the link, starts a run from a menu, loses, reads why,
and starts another — with progress surviving a reload.**

## M5 — Content completeness

- [ ] 5.1 Towers to **8** (Acid Sprayer, Arc Coil, Bastion, Rail Lance — PRD §5.3), each with a full tier tree and a distinct attack shape.
- [ ] 5.2 Enemies to **~14**, covering the trait matrix and both damage types with real resistances.
- [ ] 5.3 Relics to **~40**, weighted by rarity, with fusion recipes that make sense.
- [ ] 5.4 Tile pool to **~100+** via generation (2.15) plus authored specials.
- [ ] 5.5 Threat levels as data — the generator knobs bound into named difficulties.

**M5 gate: two runs do not resemble each other.**

## M6 — Presentation at scale

*(Deliberately after M5: authoring art for four towers and then again for eight
is the same mistake as authoring sprites before the animation engine.)*

- [ ] 6.1 Art round-trip **proof** (Phase 2 gate) — opens session 28. **Neither tool exists yet** (`tools/build-rexpaint-font.mjs`, `tools/rexpaint-import.mjs` — confirmed absent 2026-08-17), so the whole art pipeline is an unproven delivery path that 6.2–6.4 depend on. The proposal to prove it in session 16 was **declined 2026-08-17** (Daniil: session 16 needs the engine and a crude implementation, not prettiness). Accepted consequence: the pipeline stays unproven until this item runs, and 4.1's frame model must stay format-agnostic — frames as plain grids in sprite JSON, nothing REXPaint-specific in the schema.
- [ ] 6.2 Full art pass: towers with per-upgrade visual identity (V11), enemies with trait markers, terrain, UI.
- [ ] 6.3 Effects at scale: every attack shape, impact and death authored against the engine from 4.1.
- [ ] 6.4 Biomes — palette and tile-pool variants per threat level.
- [ ] 6.5 **Minimal SFX** (Daniil, 2026-08-16 — PRD §16): impacts, builds, wave start, UI. Not music, not a mix. Includes sourcing and licence clearance, which is the part that is not free.
- [ ] 6.6 **The shoreline** (PRD §13) *(Daniil, asked twice — 2026-08-16 and 2026-08-17; session 19)*: a procedural "beach" band where land meets water, so the coast reads as a coast rather than a cut. Water shipped in session 16; this is its outstanding half. Safe by construction — border cells can never carry road (PRD §4.2), so overwriting them is always legal. Scheduled with the map session rather than the art pass because it is procedural, not authored.
- [ ] 6.7 **Relic art at board-glyph scale** (PRD §13) *(Daniil, 2026-08-17)*: relics drawn as sprites in the *board's* 5×8 font rather than the HUD's 2× font — the smaller cell buys the detail that makes a relic read as an object. Needs the HUD to host a board-scale sub-surface. *(The **square slots** half is cheap and rides 2.13 in session 17; only the art waits for the pass.)*
- [ ] 6.8 **Smoothness via spatial phase** (PRD §13) *(Daniil, 2026-08-17)*: waves that travel across ground and water — each glyph's phase offset by its position — plus finer effect interpolation. **Explicitly not** "redraw less": the full board redraw is already well under a millisecond, so partial redraw optimises the wrong quantity. Recorded so a future session does not spend itself on the intuitive-but-wrong mechanism.

**M6 gate: the board reads as a place, not a diagram.**

## M7 — Meta progression, full

- [ ] 7.1 Tech tree stage 2 — five disciplines, alternate tier-5s, capped economy nodes (PRD §11).
- [ ] 7.2 Relic pool and tile pool unlocks wired to the tree.
- [ ] 7.3 Run history and personal bests — the reason to open the game on day nine.
- [ ] 7.4 Daily challenges (a fixed seed per day) and replay sharing — both nearly free given determinism.
- [ ] 7.5 Tile Smith as an in-game meta feature (PRD §11) — the authorship endgame. **Features price the tile** (richer nodes cost more to mint), so the tool and the shop share one pricing function. Now also owns the **loadout slot economy** *(Daniil, 2026-08-17)*: the number of special-tile slots a run may carry is a tree upgrade, locked slots render as locked rather than hidden, and the minted-tile collection persists. The slot *mechanic* ships in session 19 (2.21) with a fixed count and everything unlocked; this is the economy on top.
- [ ] 7.7 **The tile shop** (PRD §11.1, resolves D9): special tiles bought with meta-currency; the pool becomes a **multiset of owned copies** rather than a set, so generation may place at most what you own; tier-N ore nodes purchased with tier-(N-1) ore. Appearance likelihood is a calibration knob, not a constant.
- [ ] 7.6 Tech tree stage 3, Potency — **optional**, and the trigger for `seeds × meta tiers` in CI.

**M7 gate: finishing a run visibly changes the next one.**

## M8 — Beta hardening and release

- [ ] 8.1 Performance budget enforced: 60 fps at full board, bundle and asset budgets tracked in CI.
- [ ] 8.2 Browser support matrix; WebGL2 absence handled with an honest message.
- [ ] 8.3 Error handling audit — every throw reachable from a player path gets a recovery story.
- [ ] 8.4 Save migration tested across versions, including the corrupt-save path.
- [ ] 8.5 **External playtest** — strangers, no explanation offered, observed. The first evidence that is not Daniil.
- [ ] 8.6 Release process: versioning, changelog, tagged beta, a way for players to send a replay file back.
- [ ] 8.7 Licences and attribution verified (Apache-2.0; spleen BSD-2-Clause).

**M8 gate: the stable-beta bar in PRD §17.**
